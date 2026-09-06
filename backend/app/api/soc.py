from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_, select

from app.core.security import Analyst, DB
from app.models.entities import (
    Account,
    Alert,
    Beneficiary,
    DetectionRule,
    Incident,
    ResponseAction,
    RiskScore,
    SecurityEvent,
    ThreatIntelRecord,
    Transaction,
    User,
    now,
)
from app.services.common import public

router = APIRouter(prefix="/api/soc", tags=["SIEM and analytics"])


def page_result(db, query, page, limit):
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    return {
        "items": [
            public(item) for item in db.scalars(query.offset((page - 1) * limit).limit(limit))
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/events", summary="Search normalized security events using safe structured filters")
def events(
    db: DB,
    user: Analyst,
    q: str = Query("", max_length=200),
    event_type: str = "",
    severity: str = "",
    user_id: str = "",
    ip: str = "",
    since: datetime | None = None,
    until: datetime | None = None,
    run_id: UUID | None = None,
    hunt: str = "",
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
) -> dict:
    query = select(SecurityEvent).join(User, SecurityEvent.user_id == User.id)
    if q:
        term = f"%{q}%"
        query = query.where(
            or_(
                SecurityEvent.event_type.ilike(term),
                SecurityEvent.source_ip.ilike(term),
                User.customer_id.ilike(term),
                User.name.ilike(term),
            )
        )
    for column, value in [
        (SecurityEvent.event_type, event_type),
        (SecurityEvent.severity, severity),
        (SecurityEvent.source_ip, ip),
    ]:
        if value:
            query = query.where(column == value)
    if user_id:
        query = query.where(or_(User.id == user_id, User.customer_id == user_id))
    if since:
        query = query.where(SecurityEvent.created_at >= since.replace(tzinfo=None))
    if until:
        query = query.where(SecurityEvent.created_at <= until.replace(tzinfo=None))
    if run_id:
        query = query.where(SecurityEvent.run_id == str(run_id))
    if hunt == "password-after-login":
        alert_events = (
            select(Alert.event_id)
            .join(DetectionRule, Alert.rule_id == DetectionRule.id)
            .where(DetectionRule.key == "PASSWORD_CHANGED")
        )
        query = query.where(SecurityEvent.id.in_(alert_events))
    return page_result(
        db, query.order_by(SecurityEvent.created_at.desc(), SecurityEvent.id), page, limit
    )


@router.get("/events/{event_id}")
def event_detail(event_id: UUID, db: DB, user: Analyst) -> dict:
    event = db.get(SecurityEvent, str(event_id))
    if not event:
        raise HTTPException(404, "Event not found.")
    return public(event)


@router.get("/alerts")
def alerts(
    db: DB, user: Analyst, page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=100)
) -> dict:
    return page_result(db, select(Alert).order_by(Alert.created_at.desc()), page, limit)


@router.get("/incidents")
def incidents(
    db: DB,
    user: Analyst,
    severity: str = "",
    status: str = "",
    q: str = Query("", max_length=100),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
) -> dict:
    query = select(Incident)
    if severity:
        query = query.where(Incident.severity == severity)
    if status:
        query = query.where(Incident.status == status)
    if q:
        query = query.where(or_(Incident.title.ilike(f"%{q}%"), Incident.id.ilike(f"%{q}%")))
    result = page_result(db, query.order_by(Incident.created_at.desc()), page, limit)
    for item in result["items"]:
        item["customer"] = public(db.get(User, item["user_id"]))
        item["account"] = public(db.get(Account, item["account_id"]))
        item["analyst"] = public(db.get(User, item["assigned_to"])) if item["assigned_to"] else None
    return result


@router.get("/customers")
def customers(db: DB, user: Analyst) -> list[dict]:
    return [
        dict(public(a), customer=public(db.get(User, a.user_id)))
        for a in db.scalars(select(Account).order_by(Account.number).limit(100))
    ]


@router.get("/transactions")
def transactions(
    db: DB, user: Analyst, page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=100)
) -> dict:
    return page_result(db, select(Transaction).order_by(Transaction.created_at.desc()), page, limit)


@router.get("/beneficiaries")
def beneficiaries(db: DB, user: Analyst) -> list[dict]:
    return [
        public(b)
        for b in db.scalars(select(Beneficiary).order_by(Beneficiary.created_at.desc()).limit(100))
    ]


@router.get("/threat-intel")
def intel(db: DB, user: Analyst) -> list[dict]:
    return [public(i) for i in db.scalars(select(ThreatIntelRecord))]


@router.get("/dashboard")
def dashboard(db: DB, user: Analyst) -> dict:
    def count(model, *filters):
        return db.scalar(select(func.count()).select_from(model).where(*filters))

    def grouped(column, model):
        return [
            {"name": name, "value": value}
            for name, value in db.execute(
                select(column, func.count()).select_from(model).group_by(column)
            )
        ]

    daily = []
    for offset in range(6, -1, -1):
        start = (now() - timedelta(days=offset)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        daily.append(
            {
                "name": start.strftime("%d %b"),
                "events": count(
                    SecurityEvent, SecurityEvent.created_at >= start, SecurityEvent.created_at < end
                ),
                "incidents": count(
                    Incident, Incident.created_at >= start, Incident.created_at < end
                ),
            }
        )
    return {
        "stats": {
            "Critical incidents": count(Incident, Incident.severity == "CRITICAL"),
            "High incidents": count(Incident, Incident.severity == "HIGH"),
            "Medium incidents": count(Incident, Incident.severity == "MEDIUM"),
            "Open incidents": count(Incident, Incident.status.not_in(["CLOSED", "RESOLVED"])),
            "ATO detections": count(Incident),
            "Fraud attempts": count(SecurityEvent, SecurityEvent.event_type == "HIGH_RISK_FRAUD"),
            "Blocked transactions": count(
                Transaction, Transaction.status.in_(["FROZEN", "BLOCKED"])
            ),
            "Accounts contained": count(Account, Account.status == "LOCKED"),
            "Active alerts": count(Alert, Alert.status == "OPEN"),
        },
        "protected_amount": db.scalar(
            select(func.coalesce(func.sum(Transaction.amount_paise), 0)).where(
                Transaction.status == "FROZEN"
            )
        )
        / 100,
        "event_count": count(SecurityEvent),
        "daily": daily,
        "severity": grouped(Incident.severity, Incident),
        "rules": [
            {"name": r.name, "value": r.trigger_count}
            for r in db.scalars(select(DetectionRule).order_by(DetectionRule.trigger_count.desc()))
        ],
        "response": grouped(ResponseAction.action, ResponseAction),
        "transaction_status": grouped(Transaction.status, Transaction),
        "ips": [
            {"name": ip, "value": n}
            for ip, n in db.execute(
                select(SecurityEvent.source_ip, func.count())
                .where(SecurityEvent.severity != "INFO")
                .group_by(SecurityEvent.source_ip)
                .order_by(func.count().desc())
                .limit(5)
            )
        ],
        "risk": [
            {"name": r.created_at.strftime("%H:%M:%S"), "value": r.score}
            for r in reversed(
                list(db.scalars(select(RiskScore).order_by(RiskScore.created_at.desc()).limit(20)))
            )
        ],
        "recent_events": [
            public(e)
            for e in db.scalars(
                select(SecurityEvent).order_by(SecurityEvent.created_at.desc()).limit(8)
            )
        ],
    }
