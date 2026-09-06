from sqlalchemy import select

from app.models.entities import Account, Incident, IncidentEvent, LoginEvent, SecurityEvent
from app.services.common import evidence, public


def record(
    db,
    user_id: str,
    event_type: str,
    *,
    ip="192.0.2.10",
    device_id=None,
    location=None,
    details=None,
    severity="INFO",
    run_id=None,
    source="bankguard-api",
    timestamp=None,
):
    account = db.scalar(select(Account).where(Account.user_id == user_id))
    event = SecurityEvent(
        user_id=user_id,
        account_id=account.id if account else None,
        event_type=event_type,
        source_ip=ip,
        device_id=device_id,
        location=location or {"country": "India", "city": "Coimbatore"},
        details=details or {},
        severity=severity,
        run_id=run_id,
        source=source,
    )
    if timestamp:
        event.created_at = timestamp
    db.add(event)
    db.flush()
    if event_type in {"LOGIN_SUCCESS", "LOGIN_FAILURE"}:
        db.add(
            LoginEvent(event_id=event.id, user_id=user_id, success=event_type == "LOGIN_SUCCESS")
        )
    if run_id:
        incident = db.scalar(
            select(Incident).where(Incident.run_id == run_id).order_by(Incident.created_at.desc())
        )
        if incident:
            link_event(db, incident, event)
    return event


def link_event(db, incident, event):
    if not db.scalar(
        select(IncidentEvent).where(
            IncidentEvent.incident_id == incident.id, IncidentEvent.event_id == event.id
        )
    ):
        db.add(IncidentEvent(incident_id=incident.id, event_id=event.id))
        evidence(db, incident.id, "Security Event", event.event_type, public(event), event.source)
        db.flush()


def ingest(db, user_id: str, event_type: str, **kwargs):
    from app.detection.engine import evaluate

    event = record(db, user_id, event_type, **kwargs)
    evaluate(db, event)
    return event
