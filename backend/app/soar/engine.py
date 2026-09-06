"""An allowlisted playbook executor; no arbitrary code or external network actions."""

from sqlalchemy import select

from app.models.entities import (
    Account,
    Alert,
    InvestigationNote,
    ResponseAction,
    Session,
    SOARExecution,
    SOARPlaybook,
    ThreatIntelRecord,
    Transaction,
    now,
)
from app.services.common import audit, evidence, public
from app.siem.events import record

ACTIONS = [
    "ENRICH_IP",
    "ADD_IP_TO_WATCHLIST",
    "LOCK_ACCOUNT",
    "REVOKE_SESSION",
    "FREEZE_TRANSACTION",
    "BLOCK_IP",
    "NOTIFY_SOC",
    "CREATE_INVESTIGATION_NOTE",
    "CREATE_INCIDENT_REPORT",
]


def execute(db, incident, mode="MANUAL", actor="soc-analyst"):
    existing = db.scalar(
        select(SOARExecution).where(
            SOARExecution.incident_id == incident.id, SOARExecution.status == "SUCCESS"
        )
    )
    if existing:
        return existing
    playbook = db.scalar(select(SOARPlaybook).where(SOARPlaybook.enabled.is_(True)))
    if not playbook:
        raise ValueError("No active containment playbook")
    execution = SOARExecution(incident_id=incident.id, playbook_id=playbook.id, mode=mode)
    db.add(execution)
    db.flush()
    record(
        db,
        incident.user_id,
        "SOAR_EXECUTION_STARTED",
        ip=incident.source_ip,
        run_id=incident.run_id,
        source="soar",
        details={"mode": mode},
    )
    for action in playbook.actions:
        start = now()
        try:
            with db.begin_nested():
                result = perform(db, incident, action)
            status, error = "SUCCESS", None
        except Exception:
            # The savepoint rolls back a failed action. Its failure remains in the ledger.
            result, status, error = (
                {},
                "FAILED",
                "Action failed; inspect server logs and retry after remediation.",
            )
            import logging

            logging.getLogger("bankguard").exception("SOAR action failed: %s", action)
        response = ResponseAction(
            execution_id=execution.id,
            incident_id=incident.id,
            action=action,
            status=status,
            result=result,
            error=error,
            created_at=start,
            completed_at=now(),
        )
        db.add(response)
        audit(db, actor, action, incident.id, result=status)
        db.flush()
        if status == "FAILED":
            execution.status = "FAILED"
            break
    if execution.status != "FAILED":
        execution.status = "SUCCESS"
        incident.status, incident.contained_at = "CONTAINED", now()
        record(
            db,
            incident.user_id,
            "INCIDENT_CONTAINED",
            ip=incident.source_ip,
            run_id=incident.run_id,
            source="soar",
            severity="INFO",
        )
        for alert in db.scalars(select(Alert).where(Alert.incident_id == incident.id)):
            alert.status = "CONTAINED"
    execution.completed_at = now()
    evidence(db, incident.id, "SOAR Execution", "Containment execution ledger", public(execution))
    audit(db, actor, "PLAYBOOK_EXECUTION", execution.id, result=execution.status)
    return execution


def perform(db, incident, action):
    if action not in ACTIONS:
        raise ValueError("Unsupported response action")
    account = db.get(Account, incident.account_id)
    intel = db.scalar(select(ThreatIntelRecord).where(ThreatIntelRecord.ip == incident.source_ip))
    if action in {"ENRICH_IP", "ADD_IP_TO_WATCHLIST", "BLOCK_IP"}:
        if not intel:
            intel = ThreatIntelRecord(
                ip=incident.source_ip,
                reputation="Unknown",
                confidence=0,
                category="simulation",
                tags=["simulation"],
            )
            db.add(intel)
            db.flush()
        intel.last_seen = now()
        if action == "BLOCK_IP":
            intel.status = "BLOCKED"
            record(
                db,
                incident.user_id,
                "IP_BLOCKED",
                ip=incident.source_ip,
                run_id=incident.run_id,
                source="soar",
            )
        elif action == "ADD_IP_TO_WATCHLIST" and intel.status != "BLOCKED":
            intel.status = "WATCHLIST"
        return {
            "ip": intel.ip,
            "status": intel.status,
            "reputation": intel.reputation,
            "confidence": intel.confidence,
        }
    if action == "LOCK_ACCOUNT":
        account.status = "LOCKED"
        record(
            db,
            incident.user_id,
            "ACCOUNT_LOCKED",
            ip=incident.source_ip,
            run_id=incident.run_id,
            source="soar",
        )
        return {"account": account.number, "status": account.status}
    if action == "REVOKE_SESSION":
        sessions = list(
            db.scalars(
                select(Session).where(
                    Session.user_id == incident.user_id, Session.status == "ACTIVE"
                )
            )
        )
        for session in sessions:
            session.status = "REVOKED"
        record(
            db,
            incident.user_id,
            "SESSION_REVOKED",
            ip=incident.source_ip,
            run_id=incident.run_id,
            source="soar",
            details={"count": len(sessions)},
        )
        return {"revoked": len(sessions)}
    if action == "FREEZE_TRANSACTION":
        transactions = list(
            db.scalars(
                select(Transaction).where(
                    Transaction.account_id == account.id, Transaction.status == "PENDING"
                )
            )
        )
        for transaction in transactions:
            transaction.status = "FROZEN"
            evidence(db, incident.id, "Transaction", "Frozen transfer", public(transaction))
        record(
            db,
            incident.user_id,
            "TRANSACTION_FROZEN",
            ip=incident.source_ip,
            run_id=incident.run_id,
            source="soar",
            details={"count": len(transactions)},
        )
        return {
            "frozen": len(transactions),
            "amount": sum(t.amount_paise for t in transactions) / 100,
        }
    if action == "NOTIFY_SOC":
        record(
            db,
            incident.user_id,
            "SOC_NOTIFICATION",
            ip=incident.source_ip,
            run_id=incident.run_id,
            source="soar",
            details={"message": "Containment actions recorded. Analyst review required."},
        )
        return {"channel": "internal SOC event stream", "delivered": True}
    if action == "CREATE_INVESTIGATION_NOTE":
        note = InvestigationNote(
            incident_id=incident.id,
            content="Automated containment executed. Review the account, sessions, transaction and IP evidence before remediation.",
        )
        db.add(note)
        db.flush()
        return {"note_id": note.id}
    from app.reports.generator import snapshot_report

    report = snapshot_report(db, incident)
    return {"report_id": report.id}
