# BankGuard SOC

**Build Status: COMPLETE**

Verified: 6 September 2026.

| Component | Result | Evidence |
|---|---|---|
| Frontend | PASS | Strict TypeScript, ESLint and Vite production build |
| Backend | PASS | 20 Pytest tests passed locally and in the Linux container |
| Database | PASS | PostgreSQL and SQLite migrations; fresh PostgreSQL schema check reports no drift |
| SIEM | PASS | Stored-event search/filtering, live SSE and database-driven dashboard verified |
| Detection Engine | PASS | All seven scenarios, thresholds, risk windows, disabled rules and rollback-only replay |
| SOAR | PASS | Nine-action execution; actual account lock, session revocation, transaction freeze and simulated IP block |
| Attack Simulator | PASS | Guided full chain, automatic playback, pause/resume/stop and reset |
| Incident Investigation | PASS | Timeline, evidence hashes, notes, ownership, assignment, lifecycle and resolution |
| Report Generation | PASS | PDF downloaded in browser; all four pages rendered and visually inspected |
| E2E Tests | PASS | Five Playwright workflows passed against the Docker/PostgreSQL application |
| Docker Build | PASS | Both images built; backend, frontend and PostgreSQL services healthy |
| Responsive UI | PASS | 375, 768, 1024, 1440 and 1920 pixel checks |
| Accessibility | PASS | No axe WCAG 2A/2AA/2.1AA violations in four tested core views; dialog keyboard dismissal verified |
| Dependency audit | PASS | npm audit: zero vulnerabilities; pip-audit: zero known vulnerabilities across 39 pinned packages |
| Source export | PASS | ZIP integrity and source-content checks; secrets, dependency folders, databases and generated artifacts excluded |

Architecture: React + FastAPI + PostgreSQL + internal SIEM + internal SOAR. SQLite compatibility is included.

Simulation: Phishing → Account Takeover → Fraud → Detection → Response. Default full-chain final risk: 110. The attempted INR 150,000 transfer is frozen before settlement.

The application is running locally at http://localhost:8080 with a restored baseline. The source archive is `BankGuard-SOC.zip`. To run elsewhere, extract it and execute `docker compose up --build` from its root.

Verification scope and implementation limits are documented in [docs/verification.md](docs/verification.md) and the README. Tests emit two non-failing upstream deprecation warnings. No real banking activity or paid cloud deployment was performed.
