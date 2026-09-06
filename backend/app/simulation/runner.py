import logging
import secrets
from threading import Event, Thread

from fastapi import HTTPException
from sqlalchemy import select

from app.core.security import hash_password, new_session
from app.models.entities import (
    Beneficiary,
    Device,
    Incident,
    RiskScore,
    SecurityEvent,
    SimulationRun,
    SimulationScenario,
    ThreatIntelRecord,
    User,
    now,
)
from app.services.banking import account_for, active, add_beneficiary, transfer
from app.services.common import audit, public
from app.siem.events import ingest, record
from app.simulation.scenarios import LESSONS


def run_view(db, run):
    scenario = db.get(SimulationScenario, run.scenario_id)
    data = public(run)
    risk = db.scalar(
        select(RiskScore)
        .join(SecurityEvent, RiskScore.event_id == SecurityEvent.id)
        .where(SecurityEvent.run_id == run.id)
        .order_by(RiskScore.created_at.desc())
    )
    data.update(
        scenario=scenario.slug,
        name=scenario.name,
        total_steps=len(scenario.steps),
        lessons=[LESSONS[s] for s in scenario.steps],
        risk_score=risk.score if risk else 0,
    )
    return data


def start(db, actor, slug, guided, target_id=None):
    scenario = db.scalar(
        select(SimulationScenario).where(
            SimulationScenario.slug == slug, SimulationScenario.enabled.is_(True)
        )
    )
    if not scenario:
        raise HTTPException(404, "Scenario not found or disabled.")
    user = (
        db.get(User, target_id)
        if target_id
        else db.scalar(select(User).where(User.customer_id == "BG1001"))
    )
    active(account_for(db, user.id))
    if db.scalar(
        select(SimulationRun).where(
            SimulationRun.user_id == user.id, SimulationRun.status.in_(["RUNNING", "PAUSED"])
        )
    ):
        raise HTTPException(409, "This customer already has an active simulation.")
    run = SimulationRun(scenario_id=scenario.id, user_id=user.id, actor_id=actor.id, guided=guided)
    db.add(run)
    db.flush()
    audit(db, actor.email, "SIMULATION_START", run.id)
    return run


def step(db, run, settings):
    if run.status != "RUNNING":
        raise HTTPException(409, "Only a running simulation can advance.")
    scenario = db.get(SimulationScenario, run.scenario_id)
    name = scenario.steps[run.step]
    user = db.get(User, run.user_id)
    fingerprint = f"attack-{run.id}"
    device = db.scalar(
        select(Device).where(Device.user_id == user.id, Device.fingerprint == fingerprint)
    )
    context = {
        "ip": "203.0.113.50",
        "run_id": run.id,
        "device_id": device.id if device else None,
        "location": {"country": "Netherlands", "city": "Amsterdam"},
        "source": "simulation",
    }
    if name == "phishing":
        for event_type in ["PHISHING_EMAIL_SENT", "PHISHING_LINK_CLICK", "CREDENTIAL_SUBMITTED"]:
            ingest(
                db,
                user.id,
                event_type,
                details={
                    "synthetic": True,
                    "message": "Fictional phishing activity; no email or credential capture.",
                },
                **context,
            )
    elif name in {"login", "new_device_only"}:
        if name == "login":
            intel = db.scalar(
                select(ThreatIntelRecord).where(ThreatIntelRecord.ip == context["ip"])
            )
            if intel and intel.status == "BLOCKED":
                raise HTTPException(
                    423,
                    "The simulated source IP is blocked. Reset the lab before repeating this scenario.",
                )
        device = Device(
            user_id=user.id,
            fingerprint=fingerprint,
            name="Unrecognized browser" if name == "login" else "New personal phone",
        )
        db.add(device)
        db.flush()
        context["device_id"] = device.id
        if name == "new_device_only":
            context.update(ip="192.0.2.55", location={"country": "India", "city": "Coimbatore"})
        new_session(db, user, settings, context["ip"], device.id)
        ingest(db, user.id, "LOGIN_SUCCESS", **context)
    elif name == "password":
        active(account_for(db, user.id))
        user.password_hash = hash_password(secrets.token_urlsafe(32))
        ingest(
            db,
            user.id,
            "PASSWORD_CHANGED",
            details={
                "synthetic": True,
                "recovery": "Reset demo environment to restore demo credentials.",
            },
            **context,
        )
    elif name == "beneficiary":
        add_beneficiary(
            db, user.id, "Synthetic Horizon recipient", f"BG-SIM-{run.id[:8].upper()}", **context
        )
    elif name == "transfer":
        beneficiary = db.scalar(
            select(Beneficiary).where(
                Beneficiary.user_id == user.id,
                Beneficiary.account_number == f"BG-SIM-{run.id[:8].upper()}",
            )
        )
        transfer(db, user.id, beneficiary.id, 15000000, "Simulated fraud attempt", **context)
    elif name == "brute_force":
        for _ in range(6):
            ingest(db, user.id, "LOGIN_FAILURE", **context)
    else:
        record(
            db,
            user.id,
            "MFA_EVENT" if name == "device" else "ANALYST_REVIEW",
            details={"lesson": LESSONS[name]["decision"]},
            **context,
        )
    run.step += 1
    incident = db.scalar(select(Incident).where(Incident.run_id == run.id))
    if incident:
        run.incident_id = incident.id
    if run.step == len(scenario.steps):
        run.status, run.finished_at = "COMPLETED", now()
    db.flush()
    return run


class SimulationWorker:
    def __init__(self, app):
        self.app = app
        self.stop_event = Event()
        self.thread = Thread(target=self.loop, name="bankguard-simulator", daemon=True)

    def start(self):
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        self.thread.join(timeout=10)

    def loop(self):
        while not self.stop_event.wait(self.app.state.settings.simulation_interval):
            with self.app.state.lock:
                with self.app.state.db() as db:
                    runs = list(
                        db.scalars(
                            select(SimulationRun).where(
                                SimulationRun.status == "RUNNING", SimulationRun.guided.is_(False)
                            )
                        )
                    )
                    for run in runs:
                        try:
                            step(db, run, self.app.state.settings)
                            db.commit()
                        except Exception:
                            run_id = run.id
                            db.rollback()
                            failed = db.get(SimulationRun, run_id)
                            failed.status, failed.error = (
                                "FAILED",
                                "Simulation stopped safely. Review account state and reset the environment.",
                            )
                            db.commit()
                            logging.getLogger("bankguard").exception("Simulation step failed")
