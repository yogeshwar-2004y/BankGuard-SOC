import hashlib
import secrets
from datetime import timedelta
from typing import Annotated

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.models.entities import Session, User, now

hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return hasher.hash(password)


def verify_password(encoded: str, password: str) -> bool:
    try:
        return hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def db_dependency(request: Request):
    # One modular-monolith worker; serialize state transitions with the simulation worker.
    with request.app.state.lock:
        with request.app.state.db() as db:
            yield db


DB = Annotated[DBSession, Depends(db_dependency)]


def current_user(request: Request, db: DB) -> User:
    token = request.cookies.get("bankguard_session", "")
    session = db.scalar(
        select(Session).where(
            Session.token_hash == digest(token),
            Session.status == "ACTIVE",
            Session.expires_at > now(),
        )
    )
    user = db.get(User, session.user_id) if session else None
    if not user or not user.enabled:
        raise HTTPException(401, "Please sign in to continue.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        csrf = request.headers.get("X-CSRF-Token", "")
        if not secrets.compare_digest(csrf, session.csrf_token):
            raise HTTPException(403, "Invalid security token. Reload and try again.")
    request.state.session = session
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def analyst(user: CurrentUser) -> User:
    if user.role not in {"analyst", "admin"}:
        raise HTTPException(403, "SOC access is required.")
    return user


def admin(user: CurrentUser) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Administrator access is required.")
    return user


Analyst = Annotated[User, Depends(analyst)]
Admin = Annotated[User, Depends(admin)]


def new_session(db, user, settings, ip="192.0.2.10", device_id=None):
    token, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    session = Session(
        user_id=user.id,
        token_hash=digest(token),
        csrf_token=csrf,
        source_ip=ip,
        device_id=device_id,
        expires_at=now() + timedelta(hours=settings.session_hours),
    )
    db.add(session)
    db.flush()
    return token, session
