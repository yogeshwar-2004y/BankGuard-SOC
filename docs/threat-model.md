# Threat model

## Scope and assumptions

The assets are synthetic account state, passwords for lab access, sessions, incident evidence, configuration and audit records. The threat actors considered are an unauthenticated network user, a lower-privilege customer, a malicious analyst and an operator who accidentally publishes public demo configuration. No real bank or victim is a target or dependency.

Trust boundaries: browser → Nginx → FastAPI; role dependency → service; service → database; simulator → banking service; rule evaluation → fixed SOAR allowlist; user text → React/PDF presentation. The database, host and configured administrator are trusted components in this educational deployment.

| Threat | Implemented mitigation | Remaining limitation |
|---|---|---|
| Password disclosure | Argon2 hashing, generic errors, redacted serialization | Public defaults intentionally permit demo access; replace for shared deployments |
| Session theft/reuse | Random opaque token, digest at rest, HttpOnly/Strict cookie, expiry and DB revocation | HTTPS required for transport protection |
| CSRF | Session-bound token, origin validation, SameSite cookie | XSS prevention remains essential |
| Unauthorized banking access | User-scoped queries, beneficiary ownership, role dependencies | Not a multi-tenant platform |
| SQL injection | ORM parameter binding; no user SQL endpoint | DB operator is trusted |
| Script injection | React text rendering, escaped PDF strings, CSP | API documentation uses a scoped CDN exception |
| Repeated auth attempts | Per-peer, per-process login limiter | Distributed rate limiting and trusted reverse-proxy identity needed at scale |
| Double spend or reset race | Integer money, account row lock, serialized mutation/worker/reset boundary | One backend process only; no real payment ledger |
| Arbitrary execution via rules | Typed numeric configuration and hardcoded action dispatch | Administrators can change detection outcomes by design |
| Outbound attack misuse | Finite scenarios, reserved IPs, no target/credential input or attack networking | Host/package installation still needs ordinary network access |
| Evidence tampering | Canonical JSON hashes and privileged audit records | No cryptographic signing or WORM storage; a DB administrator can alter history |
| Excessive request size | Bounded Pydantic fields, 64KB Nginx request limit, API size check | No dedicated distributed abuse service |

Production mode rejects HTTP origins and public/short seed passwords. Tokens are not stored in browser storage. The primary bank password is replaced with a random value during the simulated compromise; the simulation never exports the value.

Automated tests verify role boundaries, CSRF, origin rejection, rate limiting, beneficiary ownership, invalid values, note ownership, evidence hashing, session revocation, expiry, scenario controls and unchanged state after rule replay. A dependency scan supplements these tests; neither constitutes a penetration test or regulatory certification.
