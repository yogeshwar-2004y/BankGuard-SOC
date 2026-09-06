from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from sqlalchemy import select

from app.models.entities import (
    Account,
    Evidence,
    IncidentEvent,
    IncidentReport,
    ResponseAction,
    SecurityEvent,
    Transaction,
    User,
)
from app.services.common import iso


def sections(db, incident) -> dict:
    user, account = db.get(User, incident.user_id), db.get(Account, incident.account_id)
    events = list(
        db.scalars(
            select(SecurityEvent)
            .join(IncidentEvent, IncidentEvent.event_id == SecurityEvent.id)
            .where(IncidentEvent.incident_id == incident.id)
            .order_by(SecurityEvent.created_at)
        )
    )
    actions = list(
        db.scalars(
            select(ResponseAction)
            .where(ResponseAction.incident_id == incident.id)
            .order_by(ResponseAction.created_at)
        )
    )
    items = list(db.scalars(select(Evidence).where(Evidence.incident_id == incident.id)))
    transactions = list(
        db.scalars(
            select(Transaction).where(
                Transaction.account_id == account.id, Transaction.run_id == incident.run_id
            )
        )
    )
    frozen = sum(t.amount_paise for t in transactions if t.status == "FROZEN") / 100
    phishing = any(e.event_type == "CREDENTIAL_SUBMITTED" for e in events)
    return {
        "Incident": f"{incident.id} | {incident.title} | {incident.severity} | Risk {incident.risk_score}",
        "Affected user and account": f"{user.name} ({user.customer_id}) | {account.number}",
        "Executive Summary": f"BankGuard correlated {len(incident.reasons)} distinct signals. Account state: {account.status}. All activity and identities are synthetic.",
        "Initial Access": "Simulated phishing credential submission."
        if phishing
        else "Authentication or transaction anomaly; initial access not established.",
        "Attack Timeline": "\n".join(f"{iso(e.created_at)}  {e.event_type}" for e in events),
        "Detection Logic": "Distinct enabled rules contribute once per user/account within the configured time window. HIGH recommends response; CRITICAL initiates containment.",
        "Evidence": "\n".join(f"{e.type}: {e.title} | SHA256 {e.sha256}" for e in items),
        "Risk Analysis": "\n".join(
            f"{f['name']}: +{f['points']} — {f['reason']}" for f in incident.reasons
        ),
        "Automated Response": "\n".join(f"{a.action}: {a.status} ({a.result})" for a in actions)
        or "No response has executed.",
        "Containment": f"Account {account.status}; incident {incident.status}.",
        "Impact": f"INR {frozen:,.2f} in simulated transfers frozen. No real funds or payment systems involved.",
        "Root Cause": "Simulated disclosure of credentials followed by account misuse."
        if phishing
        else "Requires analyst investigation; an anomaly alone is not proof of compromise.",
        "Recommendations": "Validate customer activity; reset compromised credentials; enroll phishing-resistant MFA; review beneficiary changes; retain evidence; tune rules against false positives.",
        "Final Status": incident.status,
    }


def snapshot_report(db, incident):
    report = IncidentReport(
        incident_id=incident.id, sections=sections(db, incident), status_snapshot=incident.status
    )
    db.add(report)
    db.flush()
    return report


def pdf_report(data: dict) -> bytes:
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=(595.28, 841.89),
        rightMargin=48,
        leftMargin=48,
        topMargin=48,
        bottomMargin=48,
        title="BankGuard SOC Incident Report",
    )
    styles = getSampleStyleSheet()
    styles["Title"].textColor = colors.HexColor("#12394b")
    styles["BodyText"].fontSize = 9
    styles["BodyText"].leading = 14
    story = [
        Paragraph("BANKGUARD SOC", styles["Title"]),
        Paragraph("Incident investigation report · Synthetic environment", styles["Heading2"]),
        Spacer(1, 0.15 * inch),
    ]
    for title, content in data.items():
        story.append(Paragraph(escape(title), styles["Heading2"]))
        for line in str(content).splitlines() or ["None recorded."]:
            story.append(Paragraph(escape(line), styles["BodyText"]))
        story.append(Spacer(1, 10))

    def footer(canvas, doc):
        canvas.setFont("Helvetica", 8)
        canvas.drawString(48, 28, "BANKGUARD | Educational simulation | No real financial activity")
        canvas.drawRightString(547, 28, str(doc.page))

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
