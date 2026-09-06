# API reference and usage

OpenAPI: `/api/openapi.json`; interactive documentation: `/api/docs` and `/api/redoc`. FastAPI validates request schemas and provides typed responses. All normal responses exclude password hashes, session token hashes and stored CSRF tokens. The authentication endpoints intentionally return the current CSRF token.

## Authentication example

```python
import httpx

with httpx.Client(base_url="http://localhost:8080") as client:
    login = client.post("/api/auth/login", json={
        "email": "analyst@bankguard.test",
        "password": "Analyst-demo-123!",  # synthetic demo only
    })
    login.raise_for_status()
    client.headers["X-CSRF-Token"] = login.json()["csrf_token"]
    result = client.post("/api/simulations", json={"scenario": "ato", "guided": True})
    result.raise_for_status()
    run = result.json()
    for _ in range(run["total_steps"]):
        progress = client.post(f"/api/simulations/{run['id']}/continue")
        progress.raise_for_status()
    client.post("/api/auth/logout").raise_for_status()
```

The cookie is handled by the client; no bearer token is needed. Use `.env` for non-public credentials. Do not place actual credentials in example source.

## Routes

| Group | Endpoints | Access |
|---|---|---|
| Auth | POST `/auth/login`, GET `/auth/me`, POST `/auth/logout` | Login public; others authenticated |
| Banking | GET `/accounts/me`, `/accounts/me/transactions`, `/beneficiaries`, `/transfers`; POST `/beneficiaries`, `/transfers` | Own customer data |
| Security | POST `/security/change-password`, GET `/security/activity` | Own user |
| SIEM | GET `/soc/dashboard`, `/soc/events`, `/soc/events/{id}`, `/soc/alerts` | Analyst/admin |
| Incidents | GET `/soc/incidents`, `/soc/incidents/{id}`; PATCH `/soc/incidents/{id}` | Analyst/admin |
| Investigation | POST incident `/notes`, `/evidence`; PATCH/DELETE `/soc/notes/{id}` | Analyst/admin; own notes only |
| Response | GET `/soc/playbooks`, `/soc/response-history`; POST incident `/respond` | Analyst/admin |
| Reporting | GET `/soc/reports`; POST incident `/report` | Analyst/admin |
| Detections | GET `/soc/detections`; POST `/{id}/test`; PATCH `/{id}` | Read/test analyst; change admin |
| Context | GET `/soc/customers`, `/soc/transactions`, `/soc/beneficiaries`, `/soc/threat-intel` | Analyst/admin |
| Simulation | GET `/scenarios`, `/simulations`, `/simulations/{id}`; POST `/simulations`, `/simulations/{id}/{continue,pause,resume,stop}` | Analyst/admin |
| Configuration | PATCH `/scenarios/{id}` | Admin |
| System | GET `/admin/users`, `/admin/health`; PATCH `/admin/users/{id}`; POST `/admin/reset` | Admin |
| Audit | GET `/admin/audit` | Analyst/admin |
| Live | GET `/stream` | Analyst/admin; reauthorized during stream |

All paths above are prefixed with `/api`. Health probes `/health` and `/ready` are outside the prefix. Nginx exposes its own `/health` for the web service.

Event filters: `q`, `event_type`, `severity`, `user_id` (UUID or BG number), `ip`, `since`, `until`, `run_id`, `page`, `limit`, `hunt`. Pagination defaults to 25, capped at 100; `items` and `total` are returned. Incident filters support severity and status. UUID route parameters reject malformed identifiers.

Typical errors: 401 unauthenticated, 403 unauthorized/CSRF, 404 unknown record, 409 invalid lifecycle/current state, 422 input validation, 423 account/IP contained and 429 rate limit. Production responses omit exception stacks and paths.
