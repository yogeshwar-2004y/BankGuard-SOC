from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import delete, select, text

from app.api.soc import page_result
from app.core.security import Admin, Analyst, DB
from app.models.entities import (
    Alert,
    AuditLog,
    Base,
    DetectionRule,
    SimulationRun,
    SOARPlaybook,
    User,
)
from app.schemas.requests import ResetInput, RuleUpdate, UserUpdate
from app.services.common import audit, public
from app.services.seed import seed

router = APIRouter(prefix="/api", tags=["System and detection management"])


@router.get("/soc/detections")
def detections(db: DB, user: Analyst) -> list[dict]:
    return [public(r) for r in db.scalars(select(DetectionRule))]


@router.patch("/soc/detections/{rule_id}")
def change_rule(rule_id: UUID, payload: RuleUpdate, db: DB, user: Admin) -> dict:
    rule = db.get(DetectionRule, str(rule_id))
    if not rule:
        raise HTTPException(404, "Rule not found.")
    changes = payload.model_dump(exclude_none=True)
    config = dict(rule.config)
    for key in ["threshold", "window_minutes", "medium", "high", "critical"]:
        if key in changes:
            if key not in config:
                raise HTTPException(400, "This rule does not support that parameter.")
            config[key] = changes.pop(key)
    if rule.key == "ATO_CORRELATION" and not config["medium"] < config["high"] < config["critical"]:
        raise HTTPException(422, "Risk thresholds must increase: medium < high < critical.")
    rule.config = config
    for key, value in changes.items():
        setattr(rule, key, value)
    audit(db, user.email, "RULE_CHANGE", rule.id)
    db.commit()
    return public(rule)


@router.post("/soc/detections/{rule_id}/test")
def test_rule(rule_id: UUID, db: DB, user: Analyst) -> dict:
    rule = db.get(DetectionRule, str(rule_id))
    if not rule:
        raise HTTPException(404, "Rule not found.")
    # Run the current rule configuration against a rollback-only replay of stored source events.
    from app.detection.engine import evaluate
    from app.models.entities import RiskScore, SecurityEvent

    events = list(
        db.scalars(
            select(SecurityEvent)
            .where(SecurityEvent.source != "detection-engine")
            .order_by(SecurityEvent.created_at.desc())
            .limit(100)
        )
    )
    matched = []
    for event in reversed(events):
        with db.begin_nested() as savepoint:
            db.execute(delete(RiskScore).where(RiskScore.event_id == event.id))
            before = rule.trigger_count
            evaluate(db, event)
            if rule.enabled and (
                rule.trigger_count > before
                or db.scalar(
                    select(Alert.id).where(Alert.rule_id == rule.id, Alert.event_id == event.id)
                )
            ):
                matched.append(event.id)
            savepoint.rollback()
    audit(db, user.email, "RULE_TEST", rule.id)
    db.commit()
    return {
        "rule": rule.name,
        "evaluated_events": len(events),
        "matching_events": len(matched),
        "event_ids": matched[:20],
        "mode": "ROLLBACK_ONLY",
    }


@router.get("/admin/users")
def users(db: DB, user: Admin) -> list[dict]:
    return [public(u) for u in db.scalars(select(User).order_by(User.created_at).limit(100))]


@router.patch("/admin/users/{user_id}")
def change_user(user_id: UUID, payload: UserUpdate, db: DB, user: Admin) -> dict:
    item = db.get(User, str(user_id))
    if not item:
        raise HTTPException(404, "User not found.")
    if item.id == user.id:
        raise HTTPException(409, "You cannot disable your own administrator account.")
    item.enabled = payload.enabled
    audit(db, user.email, "USER_CHANGE", item.id)
    db.commit()
    return public(item)


@router.get("/admin/audit")
def logs(
    db: DB, user: Analyst, page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=100)
) -> dict:
    return page_result(db, select(AuditLog).order_by(AuditLog.created_at.desc()), page, limit)


@router.get("/admin/health")
def health(request: Request, db: DB, user: Admin) -> dict:
    db.execute(text("SELECT 1"))
    return {
        "Backend": "HEALTHY",
        "Database": "HEALTHY",
        "Event Engine": "HEALTHY" if request.app.state.worker.thread.is_alive() else "DEGRADED",
        "SIEM": "HEALTHY" if db.scalar(select(DetectionRule.id).limit(1)) else "DEGRADED",
        "SOAR": "HEALTHY"
        if db.scalar(select(SOARPlaybook.id).where(SOARPlaybook.enabled.is_(True)).limit(1))
        else "DEGRADED",
        "SSE": "AVAILABLE",
        "database_dialect": db.bind.dialect.name,
    }


@router.post(
    "/admin/reset",
    summary="Confirm and atomically restore the synthetic baseline; revokes all sessions",
)
def reset(payload: ResetInput, request: Request, db: DB, user: Admin) -> dict:
    actor = user.email
    # The application lock prevents a worker step from racing this transaction.
    for run in db.scalars(
        select(SimulationRun).where(SimulationRun.status.in_(["RUNNING", "PAUSED"]))
    ):
        run.status = "STOPPED"
    db.flush()
    db.expunge_all()
    for table in reversed(Base.metadata.sorted_tables):
        if table.name != "audit_logs":
            db.execute(delete(table))
    seed(db, request.app.state.settings)
    audit(db, actor, "SIMULATION_RESET", "demo environment")
    db.commit()
    return {"message": "Demo restored. All sessions revoked. Please sign in again."}
