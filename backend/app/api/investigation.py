from uuid import UUID

from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select

from app.core.security import Analyst, DB
from app.models.entities import (
    Account,
    Beneficiary,
    Device,
    Evidence,
    Incident,
    IncidentEvent,
    IncidentReport,
    InvestigationNote,
    ResponseAction,
    SecurityEvent,
    Session,
    SOARExecution,
    SOARPlaybook,
    ThreatIntelRecord,
    Transaction,
    User,
    now,
)
from app.reports.generator import pdf_report, sections, snapshot_report
from app.schemas.requests import EvidenceInput, IncidentUpdate, NoteInput
from app.services.common import audit, evidence, public
from app.soar.engine import execute

router = APIRouter(prefix="/api/soc", tags=["Investigation and response"])
TRANSITIONS = {
    "NEW": {"TRIAGED", "INVESTIGATING"},
    "TRIAGED": {"INVESTIGATING"},
    "INVESTIGATING": {"REMEDIATING", "RESOLVED"},
    "CONTAINED": {"INVESTIGATING", "REMEDIATING", "RESOLVED"},
    "REMEDIATING": {"RESOLVED"},
    "RESOLVED": {"CLOSED", "INVESTIGATING"},
    "CLOSED": set(),
}


def get_incident(db, incident_id):
    item = db.get(Incident, str(incident_id))
    if not item:
        raise HTTPException(404, "Incident not found.")
    return item


@router.get("/incidents/{incident_id}")
def detail(incident_id: UUID, db: DB, user: Analyst) -> dict:
    item = get_incident(db, incident_id)

    def rows(model, condition):
        return [
            public(r) for r in db.scalars(select(model).where(condition).order_by(model.created_at))
        ]

    events = db.scalars(
        select(SecurityEvent)
        .join(IncidentEvent, IncidentEvent.event_id == SecurityEvent.id)
        .where(IncidentEvent.incident_id == item.id)
        .order_by(SecurityEvent.created_at)
    )
    intel = db.scalar(select(ThreatIntelRecord).where(ThreatIntelRecord.ip == item.source_ip))
    return {
        "incident": public(item),
        "user": public(db.get(User, item.user_id)),
        "account": public(db.get(Account, item.account_id)),
        "events": [public(e) for e in events],
        "evidence": rows(Evidence, Evidence.incident_id == item.id),
        "notes": rows(InvestigationNote, InvestigationNote.incident_id == item.id),
        "sessions": rows(Session, Session.user_id == item.user_id),
        "devices": rows(Device, Device.user_id == item.user_id),
        "beneficiaries": rows(Beneficiary, Beneficiary.user_id == item.user_id),
        "transactions": rows(Transaction, Transaction.account_id == item.account_id),
        "threat_intel": public(intel),
        "executions": rows(SOARExecution, SOARExecution.incident_id == item.id),
        "response_actions": rows(ResponseAction, ResponseAction.incident_id == item.id),
        "report": sections(db, item),
        "allowed_statuses": sorted(TRANSITIONS[item.status]),
    }


@router.patch("/incidents/{incident_id}")
def update(incident_id: UUID, payload: IncidentUpdate, db: DB, user: Analyst) -> dict:
    item = get_incident(db, incident_id)
    if payload.status:
        if payload.status not in TRANSITIONS[item.status]:
            raise HTTPException(409, "This incident status transition is not allowed.")
        item.status = payload.status
    if payload.assigned_to:
        analyst = db.get(User, str(payload.assigned_to))
        if not analyst or analyst.role not in {"analyst", "admin"}:
            raise HTTPException(400, "Assign an analyst or administrator.")
        item.assigned_to = analyst.id
    audit(db, user.email, "INCIDENT_STATUS_CHANGE", item.id)
    db.commit()
    return public(item)


@router.post("/incidents/{incident_id}/notes")
def create_note(incident_id: UUID, payload: NoteInput, db: DB, user: Analyst) -> dict:
    item = get_incident(db, incident_id)
    note = InvestigationNote(incident_id=item.id, author_id=user.id, content=payload.content)
    db.add(note)
    db.flush()
    evidence(db, item.id, "Analyst Note", "Investigation note snapshot", public(note))
    audit(db, user.email, "NOTE_CREATE", note.id)
    db.commit()
    return public(note)


def own_note(db, note_id, user):
    note = db.get(InvestigationNote, str(note_id))
    if not note:
        raise HTTPException(404, "Note not found.")
    if note.author_id != user.id:
        raise HTTPException(403, "Only the author can change this note.")
    return note


@router.patch("/notes/{note_id}")
def edit_note(note_id: UUID, payload: NoteInput, db: DB, user: Analyst) -> dict:
    note = own_note(db, note_id, user)
    note.content, note.updated_at = payload.content, now()
    audit(db, user.email, "NOTE_EDIT", note.id)
    db.commit()
    return public(note)


@router.delete("/notes/{note_id}")
def delete_note(note_id: UUID, db: DB, user: Analyst) -> dict:
    note = own_note(db, note_id, user)
    audit(db, user.email, "NOTE_DELETE", note.id)
    db.delete(note)
    db.commit()
    return {"ok": True}


@router.post("/incidents/{incident_id}/evidence")
def add_evidence(incident_id: UUID, payload: EvidenceInput, db: DB, user: Analyst) -> dict:
    item = get_incident(db, incident_id)
    evidence(
        db,
        item.id,
        payload.type,
        payload.title,
        {"description": payload.description, "author": user.email},
        "analyst",
    )
    audit(db, user.email, "EVIDENCE_ADD", item.id)
    db.commit()
    return {"ok": True}


@router.post("/incidents/{incident_id}/respond")
def respond(incident_id: UUID, db: DB, user: Analyst) -> dict:
    item = get_incident(db, incident_id)
    if item.status in {"RESOLVED", "CLOSED"}:
        raise HTTPException(409, "Reopen the incident before responding.")
    result = execute(db, item, "MANUAL", user.email)
    db.commit()
    return public(result)


@router.post("/incidents/{incident_id}/report", response_class=Response)
def report(incident_id: UUID, db: DB, user: Analyst):
    item = get_incident(db, incident_id)
    report = snapshot_report(db, item)
    data = pdf_report(report.sections)
    audit(db, user.email, "REPORT_GENERATION", report.id)
    db.commit()
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="BankGuard-{item.id[:8]}.pdf"'},
    )


@router.get("/reports")
def reports(db: DB, user: Analyst) -> list[dict]:
    return [
        public(r)
        for r in db.scalars(
            select(IncidentReport).order_by(IncidentReport.created_at.desc()).limit(100)
        )
    ]


@router.get("/playbooks")
def playbooks(db: DB, user: Analyst) -> list[dict]:
    return [public(p) for p in db.scalars(select(SOARPlaybook))]


@router.get("/response-history")
def history(db: DB, user: Analyst) -> list[dict]:
    return [
        dict(
            public(e),
            actions=[
                public(a)
                for a in db.scalars(
                    select(ResponseAction)
                    .where(ResponseAction.execution_id == e.id)
                    .order_by(ResponseAction.created_at)
                )
            ],
        )
        for e in db.scalars(
            select(SOARExecution).order_by(SOARExecution.created_at.desc()).limit(100)
        )
    ]
