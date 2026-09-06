"""Black-box contracts for the synthetic banking/SOC boundary."""

import importlib.util
import os

os.environ.update(
    DATABASE_URL="sqlite://",
    APP_ENV="test",
    SEED_DEMO="true",
    DEMO_CUSTOMER_PASSWORD="Customer-demo-123!",
    DEMO_ANALYST_PASSWORD="Analyst-demo-123!",
    DEMO_ADMIN_PASSWORD="Admin-demo-123!",
)


def test_application_exists():
    assert importlib.util.find_spec("app") is not None, "FastAPI application must exist"


def client():
    from fastapi.testclient import TestClient
    from app.main import create_app

    return TestClient(create_app())


def login(c, role="analyst"):
    r = c.post(
        "/api/auth/login",
        json={"email": f"{role}@bankguard.test", "password": f"{role.title()}-demo-123!"},
    )
    assert r.status_code == 200, r.text
    c.headers["X-CSRF-Token"] = r.json()["csrf_token"]
    return r.json()


def test_auth_rbac_logout():
    with client() as c:
        assert c.get("/api/soc/dashboard").status_code == 401
        login(c, "customer")
        assert c.get("/api/soc/dashboard").status_code == 403
        assert c.get("/api/accounts/me").json()["number"] == "BG-SAV-1001"
        assert c.post("/api/auth/logout").status_code == 200
        assert c.get("/api/accounts/me").status_code == 401


def test_banking_validation_and_ownership():
    with client() as c:
        login(c, "customer")
        b = c.post(
            "/api/beneficiaries", json={"name": "Demo recipient", "account_number": "BG-DEMO-22"}
        ).json()
        assert "id" in b
        assert (
            c.post("/api/transfers", json={"beneficiary_id": b["id"], "amount": -1}).status_code
            == 422
        )
        t = c.post(
            "/api/transfers", json={"beneficiary_id": b["id"], "amount": 100, "reference": "Test"}
        )
        assert t.status_code == 200, t.text
        assert t.json()["status"] == "COMPLETED"
        assert c.get("/api/accounts/me").json()["balance"] == 249900


def test_full_chain_containment_report_and_reset():
    with client() as c:
        login(c)
        r = c.post("/api/simulations", json={"scenario": "ato", "guided": True})
        assert r.status_code == 200, r.text
        run = r.json()
        for _ in range(8):
            r = c.post(f"/api/simulations/{run['id']}/continue")
            assert r.status_code == 200, r.text
        run = r.json()
        assert run["status"] == "COMPLETED"
        detail = c.get(f"/api/soc/incidents/{run['incident_id']}").json()
        assert detail["incident"]["severity"] == "CRITICAL"
        assert detail["account"]["status"] == "LOCKED"
        assert any(t["status"] == "FROZEN" for t in detail["transactions"])
        assert all(s["status"] == "REVOKED" for s in detail["sessions"])
        assert detail["threat_intel"]["status"] == "BLOCKED"
        types = {e["event_type"] for e in detail["events"]}
        assert {
            "PHISHING_EMAIL_SENT",
            "NEW_DEVICE",
            "ATO_CORRELATION",
            "TRANSACTION_FROZEN",
            "INCIDENT_CONTAINED",
        } <= types
        assert len(detail["evidence"]) >= 5
        assert len(detail["response_actions"]) >= 9
        pdf = c.post(f"/api/soc/incidents/{run['incident_id']}/report")
        assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
        for status in ["REMEDIATING", "RESOLVED", "CLOSED"]:
            assert (
                c.patch(
                    f"/api/soc/incidents/{run['incident_id']}", json={"status": status}
                ).status_code
                == 200
            )
        login(c, "admin")
        assert c.post("/api/admin/reset", json={"confirmation": "wrong"}).status_code == 422
        assert (
            c.post("/api/admin/reset", json={"confirmation": "RESET BANKGUARD"}).status_code == 200
        )
        login(c, "customer")
        assert c.get("/api/accounts/me").json()["status"] == "ACTIVE"


def test_new_device_alone_does_not_lock():
    with client() as c:
        login(c)
        run = c.post("/api/simulations", json={"scenario": "new-device", "guided": True}).json()
        r = c.post(f"/api/simulations/{run['id']}/continue").json()
        assert r["status"] == "COMPLETED"
        assert r["incident_id"] is None
        assert r["risk_score"] == 15


def test_csrf_and_rate_limit():
    with client() as c:
        login(c)
        del c.headers["X-CSRF-Token"]
        assert c.post("/api/simulations", json={"scenario": "ato"}).status_code == 403
        statuses = [
            c.post(
                "/api/auth/login",
                json={"email": "no@bankguard.test", "password": "invalid-password"},
            ).status_code
            for _ in range(12)
        ]
        assert 429 in statuses
