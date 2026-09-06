import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import inspect

from app.models.entities import AuditLog, Evidence


def iso(value: datetime) -> str:
    return value.replace(tzinfo=value.tzinfo or timezone.utc).isoformat()


def public(obj) -> dict:
    if obj is None:
        return {}
    hidden = {"password_hash", "token_hash", "csrf_token"}
    result = {}
    for col in inspect(type(obj)).columns:
        if col.name in hidden:
            continue
        value = getattr(obj, col.name)
        result[col.name] = iso(value) if isinstance(value, datetime) else value
    if "balance_paise" in result:
        result["balance"] = result.pop("balance_paise") / 100
    if "amount_paise" in result:
        result["amount"] = result.pop("amount_paise") / 100
    if "event_type" in result:
        result["event_id"] = result["id"]
        result["timestamp"] = result["created_at"]
        result["metadata"] = result.pop("details")
    return result


def audit(db, actor: str, action: str, resource: str, ip: str = "127.0.0.1", result="SUCCESS"):
    db.add(AuditLog(actor=actor, action=action, resource=resource, ip=ip, result=result))


def evidence(db, incident_id: str, kind: str, title: str, snapshot: dict, source="bankguard"):
    payload = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
    db.add(
        Evidence(
            incident_id=incident_id,
            type=kind,
            title=title,
            description=f"Captured {kind.lower()} for incident investigation.",
            source=source,
            snapshot=snapshot,
            sha256=hashlib.sha256(payload.encode()).hexdigest(),
        )
    )
