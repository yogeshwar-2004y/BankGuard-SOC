import asyncio
import json
import logging
import secrets
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from threading import Lock

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import func, select, text

from app.api import admin, auth, banking, investigation, simulation, soc
from app.core.config import Settings
from app.core.database import database
from app.core.security import digest, hash_password
from app.models.entities import AuditLog, Base, SecurityEvent, Session, SimulationRun, User, now
from app.services.common import public
from app.services.seed import seed
from app.simulation.runner import SimulationWorker


class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps(
            {
                "time": self.formatTime(record),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
            }
        )


def create_app():
    settings = Settings()
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("bankguard")
    logger.handlers = [handler]
    logger.setLevel(settings.log_level)

    @asynccontextmanager
    async def lifespan(app):
        if settings.app_env == "test":
            Base.metadata.create_all(app.state.engine)
        with app.state.db() as db:
            if settings.seed_demo:
                seed(db, settings)
            for run in db.scalars(select(SimulationRun).where(SimulationRun.status == "RUNNING")):
                run.status = "PAUSED"
            db.commit()
        app.state.worker = SimulationWorker(app)
        app.state.worker.start()
        yield
        app.state.worker.stop()
        app.state.engine.dispose()

    app = FastAPI(
        title="BankGuard SOC API",
        version="1.0.0",
        description="Synthetic retail banking, internal SIEM and SOAR. No real financial activity.",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.engine, app.state.db = database(settings.database_url)
    app.state.lock = Lock()
    app.state.dummy_hash = hash_password(secrets.token_urlsafe(32))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins.split(","),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )
    buckets = defaultdict(deque)

    @app.middleware("http")
    async def guard(request: Request, call_next):
        start = time.monotonic()
        ip = request.client.host if request.client else "unknown"
        category = "auth" if request.url.path == "/api/auth/login" else "api"
        bucket = buckets[(ip, category)]
        while bucket and bucket[0] < start - 60:
            bucket.popleft()
        limit = 10 if category == "auth" else 1200
        if len(bucket) >= limit:
            return JSONResponse(
                {"detail": "Too many requests. Try again in one minute."},
                429,
                headers={"Retry-After": "60"},
            )
        bucket.append(start)
        if len(buckets) > 10000:
            for key in list(buckets):
                if not buckets[key] or buckets[key][-1] < start - 60:
                    del buckets[key]
        if request.method in {"POST", "PATCH", "DELETE"}:
            origin = request.headers.get("origin")
            allowed = settings.cors_origins.split(",")
            if origin and origin not in allowed and origin != str(request.base_url).rstrip("/"):
                return JSONResponse({"detail": "Request origin is not allowed."}, 403)
            if int(request.headers.get("content-length", "0")) > 65536:
                return JSONResponse({"detail": "Request body is too large."}, 413)
        response = await call_next(request)
        response.headers.update(
            {
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "Referrer-Policy": "no-referrer",
                "Cache-Control": "no-store",
            }
        )
        logger.info("%s %s %s", request.method, request.url.path, response.status_code)
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return JSONResponse(
            {
                "detail": "Invalid input. Check required fields and allowed values.",
                "fields": [".".join(map(str, error["loc"])) for error in exc.errors()],
            },
            422,
        )

    @app.exception_handler(Exception)
    async def unexpected(request, exc):
        logger.error("Unhandled error (%s)", type(exc).__name__)
        return JSONResponse(
            {"detail": "The operation could not be completed. Please try again."}, 500
        )

    @app.get("/health", tags=["Health"])
    def health() -> dict:
        return {"status": "healthy", "service": "bankguard-api"}

    @app.get("/ready", tags=["Health"])
    def ready() -> dict:
        with app.state.db() as db:
            db.execute(text("SELECT 1"))
        return {"status": "ready"}

    @app.get("/api/stream", tags=["Live telemetry"])
    async def stream(request: Request):
        token_hash = digest(request.cookies.get("bankguard_session", ""))

        def authorized(db):
            session = db.scalar(
                select(Session).where(
                    Session.token_hash == token_hash,
                    Session.status == "ACTIVE",
                    Session.expires_at > now(),
                )
            )
            user = db.get(User, session.user_id) if session else None
            return user and user.enabled and user.role in {"admin", "analyst"}

        with app.state.db() as db:
            if not authorized(db):
                raise HTTPException(401, "SOC session required.")

        async def feed():
            previous = None
            ticks = 0
            while not await request.is_disconnected():
                with app.state.db() as db:
                    if not authorized(db):
                        yield "event: expired\ndata: {}\n\n"
                        return
                    revision = [
                        str(db.scalar(select(func.max(SecurityEvent.created_at)))),
                        str(db.scalar(select(func.max(AuditLog.created_at)))),
                    ]
                    if revision != previous:
                        recent = [
                            public(e)
                            for e in db.scalars(
                                select(SecurityEvent)
                                .order_by(SecurityEvent.created_at.desc())
                                .limit(20)
                            )
                        ]
                        yield f"event: update\ndata: {json.dumps({'events': recent, 'revision': revision})}\n\n"
                        previous = revision
                    elif ticks % 20 == 0:
                        yield ": heartbeat\n\n"
                ticks += 1
                await asyncio.sleep(0.5)

        return StreamingResponse(
            feed(),
            media_type="text/event-stream",
            headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
        )

    for router in [
        auth.router,
        banking.router,
        soc.router,
        investigation.router,
        admin.router,
        simulation.router,
    ]:
        app.include_router(router)

    from pathlib import Path
    from fastapi.responses import FileResponse
    frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    static_dist = Path(__file__).resolve().parent / "static"
    serve_dir = frontend_dist if frontend_dist.is_dir() else (static_dist if static_dist.is_dir() else None)
    if serve_dir:
        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa(full_path: str):
            file_path = serve_dir / full_path
            if file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(serve_dir / "index.html")

    return app


app = create_app()
