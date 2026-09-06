from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from test_workflows import client, login


def test_rules_thresholds_replay_and_permissions():
    with client() as c:
        login(c)
        rules = c.get("/api/soc/detections").json()
        new_device = next(r for r in rules if r["key"] == "NEW_DEVICE")
        assert (
            c.patch(f"/api/soc/detections/{new_device['id']}", json={"enabled": False}).status_code
            == 403
        )
        login(c, "admin")
        baseline = c.get("/api/soc/dashboard").json()
        replay = c.post(f"/api/soc/detections/{new_device['id']}/test")
        assert replay.status_code == 200, replay.text
        assert replay.json()["mode"] == "ROLLBACK_ONLY"
        assert c.get("/api/soc/dashboard").json() == baseline
        assert (
            c.patch(f"/api/soc/detections/{new_device['id']}", json={"enabled": False}).status_code
            == 200
        )
        run = c.post("/api/simulations", json={"scenario": "new-device", "guided": True}).json()
        outcome = c.post(f"/api/simulations/{run['id']}/continue").json()
        assert outcome["risk_score"] == 0
        beneficiary = next(r for r in rules if r["key"] == "NEW_BENEFICIARY")
        assert (
            c.patch(f"/api/soc/detections/{beneficiary['id']}", json={"enabled": False}).status_code
            == 200
        )
        assert (
            c.post(f"/api/soc/detections/{beneficiary['id']}/test").json()["matching_events"] == 0
        )
        correlation = next(r for r in rules if r["key"] == "ATO_CORRELATION")
        assert (
            c.patch(
                f"/api/soc/detections/{correlation['id']}", json={"medium": 100, "critical": 50}
            ).status_code
            == 422
        )


def test_notes_ownership_evidence_integrity_and_idempotent_response():
    import hashlib
    import json

    with client() as c:
        login(c)
        incident_id = c.get("/api/soc/incidents").json()["items"][0]["id"]
        note = c.post(
            f"/api/soc/incidents/{incident_id}/notes",
            json={"content": "<script>synthetic evidence</script>"},
        ).json()
        assert (
            c.patch(
                f"/api/soc/notes/{note['id']}", json={"content": "Updated analysis"}
            ).status_code
            == 200
        )
        login(c, "admin")
        assert c.delete(f"/api/soc/notes/{note['id']}").status_code == 403
        detail = c.get(f"/api/soc/incidents/{incident_id}").json()
        for e in detail["evidence"]:
            assert (
                e["sha256"]
                == hashlib.sha256(
                    json.dumps(e["snapshot"], sort_keys=True, separators=(",", ":")).encode()
                ).hexdigest()
            )
        before = len(detail["response_actions"])
        assert c.post(f"/api/soc/incidents/{incident_id}/respond").status_code == 200
        assert len(c.get(f"/api/soc/incidents/{incident_id}").json()["response_actions"]) == before
        login(c)
        assert c.delete(f"/api/soc/notes/{note['id']}").status_code == 200


def test_seed_constraints_and_secret_redaction():
    from app.models.entities import Account, Device, SecurityEvent, Transaction, User

    with client() as c:
        login(c, "admin")
        with c.app.state.db() as db:
            for model, minimum in [
                (User, 14),
                (Account, 12),
                (Device, 24),
                (SecurityEvent, 100),
                (Transaction, 50),
            ]:
                assert db.scalar(select(func.count()).select_from(model)) >= minimum
        for path in [
            "/api/admin/users",
            "/api/soc/customers",
            "/api/soc/incidents",
            "/api/soc/events",
        ]:
            result = c.get(path)
            assert result.status_code == 200
            assert all(
                secret not in result.text
                for secret in ["password_hash", "token_hash", "csrf_token", "Admin-demo-123!"]
            )
        assert c.get("/health").status_code == 200
        assert c.get("/ready").status_code == 200
        assert c.get("/api/openapi.json").status_code == 200


def test_customer_cannot_transfer_to_another_customers_beneficiary():
    from app.models.entities import Beneficiary, User

    with client() as c:
        login(c, "customer")
        with c.app.state.db() as db:
            other = db.scalar(select(User).where(User.customer_id == "BG1002"))
            beneficiary = db.scalar(select(Beneficiary).where(Beneficiary.user_id == other.id))
            other_id = beneficiary.id
        assert (
            c.post("/api/transfers", json={"beneficiary_id": other_id, "amount": 100}).status_code
            == 404
        )
        assert (
            c.post(
                "/api/transfers", json={"beneficiary_id": str(uuid4()), "amount": 100}
            ).status_code
            == 404
        )


def test_password_change_revokes_old_session_and_origin_guard():
    with client() as c:
        login(c, "customer")
        assert (
            c.post(
                "/api/beneficiaries",
                headers={"Origin": "https://untrusted.test"},
                json={"name": "Recipient", "account_number": "BG-DEMO-5"},
            ).status_code
            == 403
        )
        r = c.post(
            "/api/security/change-password",
            json={
                "current_password": "Customer-demo-123!",
                "new_password": "New-synthetic-secret-123!",
            },
        )
        assert r.status_code == 200
        assert c.get("/api/accounts/me").status_code == 401
        assert (
            c.post(
                "/api/auth/login",
                json={"email": "customer@bankguard.test", "password": "New-synthetic-secret-123!"},
            ).status_code
            == 200
        )


def test_pause_resume_stop_and_single_active_run():
    with client() as c:
        login(c)
        run = c.post("/api/simulations", json={"scenario": "ato", "guided": True}).json()
        assert c.post("/api/simulations", json={"scenario": "ato"}).status_code == 409
        assert c.post(f"/api/simulations/{run['id']}/pause").json()["status"] == "PAUSED"
        assert c.post(f"/api/simulations/{run['id']}/continue").status_code == 409
        assert c.post(f"/api/simulations/{run['id']}/resume").json()["status"] == "RUNNING"
        assert c.post(f"/api/simulations/{run['id']}/stop").json()["status"] == "STOPPED"
        assert c.post(f"/api/simulations/{run['id']}/continue").status_code == 409


@pytest.mark.parametrize(
    "scenario,expected_risk,incident",
    [
        ("brute-force", 10, False),
        ("phishing", 10, False),
        ("suspicious-login", 45, False),
        ("large-transfer", 45, False),
        ("beneficiary-fraud", 90, True),
    ],
)
def test_focused_scenarios(scenario, expected_risk, incident):
    with client() as c:
        login(c)
        run = c.post("/api/simulations", json={"scenario": scenario, "guided": True}).json()
        for _ in range(run["total_steps"]):
            response = c.post(f"/api/simulations/{run['id']}/continue")
            assert response.status_code == 200, response.text
        result = response.json()
        assert result["risk_score"] == expected_risk
        assert bool(result["incident_id"]) == incident


def test_impossible_travel_and_expired_window():
    from app.models.entities import Device, RiskScore, SecurityEvent, User, now
    from app.siem.events import ingest

    with client() as c:
        with c.app.state.db() as db:
            user = db.scalar(select(User).where(User.customer_id == "BG1003"))
            device = db.scalar(select(Device).where(Device.user_id == user.id))
            ingest(db, user.id, "LOGIN_SUCCESS", device_id=device.id)
            event = ingest(
                db,
                user.id,
                "LOGIN_SUCCESS",
                device_id=device.id,
                location={"country": "Netherlands", "city": "Amsterdam"},
            )
            db.flush()
            score = db.scalar(select(RiskScore).where(RiskScore.event_id == event.id))
            assert score.score == 50  # Unusual location + impossible travel.
            for prior in db.scalars(select(SecurityEvent).where(SecurityEvent.user_id == user.id)):
                prior.created_at = now() - timedelta(hours=2)
            latest = ingest(db, user.id, "MFA_EVENT", device_id=device.id)
            assert db.scalar(select(RiskScore).where(RiskScore.event_id == latest.id)).score == 0


def test_expired_session_and_production_config():
    from app.models.entities import Session, User, now
    from app.core.config import Settings
    from pydantic import ValidationError

    with client() as c:
        login(c)
        with c.app.state.db() as db:
            user = db.scalar(select(User).where(User.role == "analyst"))
            for session in db.scalars(select(Session).where(Session.user_id == user.id)):
                session.expires_at = now() - timedelta(seconds=1)
            db.commit()
        assert c.get("/api/auth/me").status_code == 401
    with pytest.raises(ValidationError):
        Settings(app_env="production", cors_origins="http://localhost")
    with pytest.raises(ValidationError):
        Settings(
            app_env="production",
            cors_origins="https://lab.example.test",
            demo_admin_password="Admin-demo-123!",
        )


def test_blocked_ip_rejects_another_simulated_login():
    from app.models.entities import ThreatIntelRecord

    with client() as c:
        login(c)
        with c.app.state.db() as db:
            db.scalar(
                select(ThreatIntelRecord).where(ThreatIntelRecord.ip == "203.0.113.50")
            ).status = "BLOCKED"
            db.commit()
        run = c.post(
            "/api/simulations", json={"scenario": "suspicious-login", "guided": True}
        ).json()
        assert c.post(f"/api/simulations/{run['id']}/continue").status_code == 423
