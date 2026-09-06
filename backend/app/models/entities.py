"""Relational model. Money is stored as integer paise, timestamps as UTC."""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def uid() -> str:
    return str(uuid4())


class Base(DeclarativeBase):
    """Metadata root used by Alembic and tests."""


class Record:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=now, index=True)


class User(Record, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    customer_id: Mapped[str | None] = mapped_column(String(30), unique=True)
    role: Mapped[str] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (CheckConstraint("role IN ('customer','analyst','admin')"),)


class Account(Record, Base):
    __tablename__ = "accounts"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    number: Mapped[str] = mapped_column(String(40), unique=True)
    balance_paise: Mapped[int] = mapped_column(Integer, default=25000000)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    __table_args__ = (
        CheckConstraint("balance_paise >= 0"),
        CheckConstraint("status IN ('ACTIVE','LOCKED')"),
    )


class Device(Record, Base):
    __tablename__ = "devices"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    fingerprint: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(100))
    trusted: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (UniqueConstraint("user_id", "fingerprint"),)


class Session(Record, Base):
    __tablename__ = "sessions"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_token: Mapped[str] = mapped_column(String(100))
    device_id: Mapped[str | None] = mapped_column(ForeignKey("devices.id"))
    source_ip: Mapped[str] = mapped_column(String(45))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=False))


class SimulationScenario(Record, Base):
    __tablename__ = "simulation_scenarios"
    slug: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    steps: Mapped[list] = mapped_column(JSON)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class SimulationRun(Record, Base):
    __tablename__ = "simulation_runs"
    scenario_id: Mapped[str] = mapped_column(ForeignKey("simulation_scenarios.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), default="RUNNING")
    guided: Mapped[bool] = mapped_column(Boolean, default=False)
    step: Mapped[int] = mapped_column(Integer, default=0)
    incident_id: Mapped[str | None] = mapped_column(String(36))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    error: Mapped[str | None] = mapped_column(Text)


class SecurityEvent(Record, Base):
    __tablename__ = "security_events"
    event_type: Mapped[str] = mapped_column(String(60), index=True)
    severity: Mapped[str] = mapped_column(String(20), default="INFO", index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"))
    source_ip: Mapped[str] = mapped_column(String(45), index=True)
    device_id: Mapped[str | None] = mapped_column(ForeignKey("devices.id"))
    location: Mapped[dict] = mapped_column(JSON, default=dict)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[str] = mapped_column(String(40), default="bankguard-api")
    run_id: Mapped[str | None] = mapped_column(ForeignKey("simulation_runs.id"), index=True)
    __table_args__ = (Index("ix_event_user_time", "user_id", "created_at"),)


class LoginEvent(Record, Base):
    __tablename__ = "login_events"
    event_id: Mapped[str] = mapped_column(ForeignKey("security_events.id"), unique=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    success: Mapped[bool] = mapped_column(Boolean)


class Beneficiary(Record, Base):
    __tablename__ = "beneficiaries"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    account_number: Mapped[str] = mapped_column(String(40))
    __table_args__ = (UniqueConstraint("user_id", "account_number"),)


class Transaction(Record, Base):
    __tablename__ = "transactions"
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    beneficiary_id: Mapped[str | None] = mapped_column(ForeignKey("beneficiaries.id"))
    amount_paise: Mapped[int] = mapped_column(Integer)
    reference: Mapped[str] = mapped_column(String(120), default="Simulated transfer")
    status: Mapped[str] = mapped_column(String(20), default="PENDING", index=True)
    run_id: Mapped[str | None] = mapped_column(ForeignKey("simulation_runs.id"))
    __table_args__ = (
        CheckConstraint("amount_paise > 0"),
        CheckConstraint("status IN ('PENDING','COMPLETED','FROZEN','BLOCKED')"),
    )


class DetectionRule(Record, Base):
    __tablename__ = "detection_rules"
    key: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    weight: Mapped[int] = mapped_column(Integer, default=0)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    trigger_count: Mapped[int] = mapped_column(Integer, default=0)
    last_triggered: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))


class Incident(Record, Base):
    __tablename__ = "incidents"
    title: Mapped[str] = mapped_column(String(120), default="Potential Account Takeover")
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    source_ip: Mapped[str] = mapped_column(String(45))
    device_id: Mapped[str | None] = mapped_column(ForeignKey("devices.id"))
    severity: Mapped[str] = mapped_column(String(20))
    risk_score: Mapped[int] = mapped_column(Integer)
    reasons: Mapped[list] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="NEW", index=True)
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    run_id: Mapped[str | None] = mapped_column(ForeignKey("simulation_runs.id"), index=True)
    contained_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    __table_args__ = (
        CheckConstraint(
            "status IN ('NEW','TRIAGED','INVESTIGATING','CONTAINED','REMEDIATING','RESOLVED','CLOSED')"
        ),
    )


class IncidentEvent(Record, Base):
    __tablename__ = "incident_events"
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("security_events.id"))
    __table_args__ = (UniqueConstraint("incident_id", "event_id"),)


class Alert(Record, Base):
    __tablename__ = "alerts"
    event_id: Mapped[str] = mapped_column(ForeignKey("security_events.id"), index=True)
    rule_id: Mapped[str] = mapped_column(ForeignKey("detection_rules.id"))
    incident_id: Mapped[str | None] = mapped_column(ForeignKey("incidents.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    severity: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    reason: Mapped[str] = mapped_column(Text)
    __table_args__ = (UniqueConstraint("event_id", "rule_id"),)


class RiskScore(Record, Base):
    __tablename__ = "risk_scores"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("security_events.id"), unique=True)
    score: Mapped[int] = mapped_column(Integer)
    level: Mapped[str] = mapped_column(String(20))
    factors: Mapped[list] = mapped_column(JSON)


class SOARPlaybook(Record, Base):
    __tablename__ = "soar_playbooks"
    name: Mapped[str] = mapped_column(String(100))
    actions: Mapped[list] = mapped_column(JSON)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class SOARExecution(Record, Base):
    __tablename__ = "soar_executions"
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    playbook_id: Mapped[str] = mapped_column(ForeignKey("soar_playbooks.id"))
    mode: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="RUNNING")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))


class ResponseAction(Record, Base):
    __tablename__ = "response_actions"
    execution_id: Mapped[str] = mapped_column(ForeignKey("soar_executions.id"), index=True)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    action: Mapped[str] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(20))
    result: Mapped[dict] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))


class ThreatIntelRecord(Record, Base):
    __tablename__ = "threat_intel"
    ip: Mapped[str] = mapped_column(String(45), unique=True)
    reputation: Mapped[str] = mapped_column(String(30))
    confidence: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(40))
    tags: Mapped[list] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="WATCHLIST")
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=now)


class InvestigationNote(Record, Base):
    __tablename__ = "investigation_notes"
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    author_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    content: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=now)


class Evidence(Record, Base):
    __tablename__ = "evidence"
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    type: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(100))
    snapshot: Mapped[dict] = mapped_column(JSON)
    sha256: Mapped[str] = mapped_column(String(64))


class AuditLog(Record, Base):
    __tablename__ = "audit_logs"
    actor: Mapped[str] = mapped_column(String(100))
    action: Mapped[str] = mapped_column(String(60), index=True)
    resource: Mapped[str] = mapped_column(String(120))
    result: Mapped[str] = mapped_column(String(40), default="SUCCESS")
    ip: Mapped[str] = mapped_column(String(45), default="127.0.0.1")


class IncidentReport(Record, Base):
    __tablename__ = "incident_reports"
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    sections: Mapped[dict] = mapped_column(JSON)
    status_snapshot: Mapped[str] = mapped_column(String(20))
