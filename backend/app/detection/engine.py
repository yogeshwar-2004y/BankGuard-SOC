"""Stored-event rules, bounded correlation and deduplicated risk contributions."""

from datetime import timedelta

from sqlalchemy import select

from app.models.entities import (
    Alert,
    DetectionRule,
    Device,
    Incident,
    RiskScore,
    SecurityEvent,
    ThreatIntelRecord,
    now,
)
from app.services.common import audit, evidence, public
from app.siem.events import link_event, record

RULES = [
    (
        "NEW_DEVICE",
        "New device detection",
        "A successful login used a device not previously seen for this customer.",
        "MEDIUM",
        15,
        {},
    ),
    (
        "UNUSUAL_LOCATION",
        "Unusual location",
        "The login country differs from the customer's established India baseline.",
        "MEDIUM",
        20,
        {},
    ),
    (
        "IMPOSSIBLE_TRAVEL",
        "Impossible travel",
        "Successful logins in different countries occurred less than an hour apart.",
        "HIGH",
        30,
        {"window_minutes": 60},
    ),
    (
        "PASSWORD_CHANGED",
        "Suspicious password change",
        "A password changed within the correlation window of a suspicious login.",
        "MEDIUM",
        10,
        {},
    ),
    (
        "NEW_BENEFICIARY",
        "New beneficiary",
        "A new payee creates a possible destination for funds; correlate with authentication signals.",
        "MEDIUM",
        15,
        {},
    ),
    (
        "LARGE_TRANSFER_DETECTED",
        "Large transaction",
        "A transfer meets or exceeds the configured amount in INR.",
        "HIGH",
        30,
        {"threshold": 100000},
    ),
    (
        "BRUTE_FORCE",
        "Brute force",
        "Repeated failed logins within five minutes suggest password guessing.",
        "MEDIUM",
        10,
        {"threshold": 5, "window_minutes": 5},
    ),
    (
        "PHISHING_INTERACTION",
        "Phishing interaction",
        "A synthetic credential submission followed a simulated phishing interaction.",
        "MEDIUM",
        10,
        {},
    ),
    (
        "THREAT_INTEL",
        "Local IP reputation",
        "A reserved test IP matches the local synthetic credential-theft dataset.",
        "MEDIUM",
        10,
        {},
    ),
    (
        "HIGH_RISK_FRAUD",
        "Beneficiary and transfer correlation",
        "A large transfer followed creation of a new beneficiary within the correlation window.",
        "HIGH",
        0,
        {"window_minutes": 15},
    ),
    (
        "ATO_CORRELATION",
        "Account takeover correlation",
        "Combine distinct signals for the same customer and account; critical risk triggers containment.",
        "CRITICAL",
        0,
        {"window_minutes": 15, "medium": 30, "high": 60, "critical": 90},
    ),
]


def rules(db):
    return {r.key: r for r in db.scalars(select(DetectionRule))}


def severity(score: int, config: dict) -> str:
    for level in ("critical", "high", "medium"):
        if score >= config[level]:
            return level.upper()
    return "LOW"


def evaluate(db, event):
    registry = rules(db)
    correlation = registry["ATO_CORRELATION"]
    since = event.created_at - timedelta(minutes=correlation.config["window_minutes"])
    query = select(SecurityEvent).where(
        SecurityEvent.user_id == event.user_id,
        SecurityEvent.account_id == event.account_id,
        SecurityEvent.created_at >= since,
        SecurityEvent.created_at <= event.created_at,
    )
    # Separate learning runs so a false-positive demo cannot inherit another run's risk.
    query = query.where(SecurityEvent.run_id == event.run_id)
    previous = list(db.scalars(query.order_by(SecurityEvent.created_at)))
    signals = []

    def signal(key, derived=True):
        rule = registry[key]
        if not rule.enabled:
            return
        source = event
        if derived:
            source = record(
                db,
                event.user_id,
                key,
                ip=event.source_ip,
                device_id=event.device_id,
                location=event.location,
                run_id=event.run_id,
                severity=rule.severity,
                details={"trigger_event_id": event.id, "reason": rule.description},
                source="detection-engine",
            )
        if not db.scalar(
            select(Alert).where(Alert.event_id == source.id, Alert.rule_id == rule.id)
        ):
            db.add(
                Alert(
                    event_id=source.id,
                    rule_id=rule.id,
                    user_id=event.user_id,
                    title=rule.name,
                    severity=rule.severity,
                    reason=rule.description,
                )
            )
            rule.trigger_count += 1
            rule.last_triggered = now()
        signals.append(source)
        db.flush()

    if event.event_type == "LOGIN_SUCCESS":
        device = db.get(Device, event.device_id) if event.device_id else None
        seen = db.scalar(
            select(SecurityEvent.id)
            .where(
                SecurityEvent.user_id == event.user_id,
                SecurityEvent.device_id == event.device_id,
                SecurityEvent.event_type == "LOGIN_SUCCESS",
                SecurityEvent.id != event.id,
            )
            .limit(1)
        )
        if not seen and not (device and device.trusted):
            signal("NEW_DEVICE")
        if event.location.get("country") != "India":
            signal("UNUSUAL_LOCATION")
        recent = [
            e
            for e in previous
            if e.event_type == "LOGIN_SUCCESS"
            and e.id != event.id
            and e.created_at
            >= event.created_at
            - timedelta(minutes=registry["IMPOSSIBLE_TRAVEL"].config["window_minutes"])
        ]
        if recent and recent[-1].location.get("country") != event.location.get("country"):
            signal("IMPOSSIBLE_TRAVEL")
        intel = db.scalar(select(ThreatIntelRecord).where(ThreatIntelRecord.ip == event.source_ip))
        if intel and intel.reputation == "Malicious":
            signal("THREAT_INTEL")
    elif event.event_type == "LOGIN_FAILURE":
        cutoff = event.created_at - timedelta(
            minutes=registry["BRUTE_FORCE"].config["window_minutes"]
        )
        if (
            sum(e.event_type == "LOGIN_FAILURE" and e.created_at >= cutoff for e in previous)
            >= registry["BRUTE_FORCE"].config["threshold"]
        ):
            signal("BRUTE_FORCE")
    elif event.event_type == "CREDENTIAL_SUBMITTED":
        signal("PHISHING_INTERACTION")
    elif event.event_type == "PASSWORD_CHANGED":
        if any(e.event_type in {"NEW_DEVICE", "UNUSUAL_LOCATION"} for e in previous):
            signal("PASSWORD_CHANGED", False)
    elif event.event_type == "NEW_BENEFICIARY":
        signal("NEW_BENEFICIARY", False)
    elif event.event_type == "TRANSFER_INITIATED":
        if (
            event.details.get("amount", 0)
            >= registry["LARGE_TRANSFER_DETECTED"].config["threshold"]
        ):
            signal("LARGE_TRANSFER_DETECTED")
            cutoff = event.created_at - timedelta(
                minutes=registry["HIGH_RISK_FRAUD"].config["window_minutes"]
            )
            if any(e.event_type == "NEW_BENEFICIARY" and e.created_at >= cutoff for e in previous):
                signal("HIGH_RISK_FRAUD")

    event_ids = [e.id for e in previous + signals]
    matched = list(db.scalars(select(Alert).where(Alert.event_id.in_(event_ids))))
    by_rule = {a.rule_id: a for a in matched}
    factors = [
        {"key": r.key, "name": r.name, "points": r.weight, "reason": r.description}
        for r in registry.values()
        if r.enabled and r.id in by_rule and r.weight
    ]
    score = sum(f["points"] for f in factors)
    level = severity(score, correlation.config)
    db.add(
        RiskScore(
            user_id=event.user_id, event_id=event.id, score=score, level=level, factors=factors
        )
    )
    incident = db.scalar(
        select(Incident).where(
            Incident.user_id == event.user_id,
            Incident.run_id == event.run_id,
            Incident.status.not_in(["CLOSED", "RESOLVED"]),
        )
    )
    if correlation.enabled and score >= correlation.config["high"] and event.account_id:
        if not incident:
            incident = Incident(
                user_id=event.user_id,
                account_id=event.account_id,
                source_ip=event.source_ip,
                device_id=event.device_id,
                severity=level,
                risk_score=score,
                reasons=factors,
                run_id=event.run_id,
            )
            db.add(incident)
            db.flush()
            correlation.trigger_count += 1
            correlation.last_triggered = now()
            record(
                db,
                event.user_id,
                "ATO_CORRELATION",
                ip=event.source_ip,
                run_id=event.run_id,
                severity=level,
                details={"risk_score": score, "incident_id": incident.id},
                source="detection-engine",
            )
            record(
                db,
                event.user_id,
                "INCIDENT_CREATED",
                ip=event.source_ip,
                run_id=event.run_id,
                severity=level,
                details={"incident_id": incident.id},
                source="siem",
            )
            intel = db.scalar(
                select(ThreatIntelRecord).where(ThreatIntelRecord.ip == event.source_ip)
            )
            if intel:
                evidence(
                    db, incident.id, "IP Intelligence", "Local threat intelligence", public(intel)
                )
            if event.device_id:
                evidence(
                    db,
                    incident.id,
                    "Device Record",
                    "Login device",
                    public(db.get(Device, event.device_id)),
                )
            audit(db, "detection-engine", "INCIDENT_CREATED", incident.id)
        incident.risk_score, incident.severity, incident.reasons = score, level, factors
        for item in previous + signals:
            link_event(db, incident, item)
        for alert in matched:
            alert.incident_id = incident.id
        if level == "CRITICAL" and incident.status not in {"CONTAINED", "REMEDIATING"}:
            from app.soar.engine import execute

            execute(db, incident, "AUTOMATED", "soar-engine")
    db.flush()
    return score, incident
