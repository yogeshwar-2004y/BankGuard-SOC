# Release verification

Verified on 6 September 2026 using Python 3.13, Node 22, Chromium, PostgreSQL 17 and Docker Compose on Windows with Linux containers.

## Automated coverage

- Backend: authentication, expiry, logout, role enforcement, CSRF, origin rejection, login throttling, own-account banking, beneficiary ownership, valid/invalid money, password change/session revocation, seed volume, secret redaction and health/OpenAPI responses.
- Detection: stored-event ingestion, new-device behavior, unusual location, impossible travel, brute-force thresholds, deduplicated risk, expired windows, high/critical correlation, disabled rules, configuration validation and rollback-only replay.
- Response/investigation: incident creation, complete timeline and evidence, account lock, session revocation, pending transaction freeze, simulated IP block/enforcement, response idempotency, note ownership, SHA-256 snapshot verification, report generation, lifecycle and reset.
- Simulator: full guided ATO, every focused scenario, single active run, pause/resume/stop and safe rejection after containment.
- Browser: analyst demo through investigation/report/resolution/reset; SSE updates in a separate tab; customer beneficiary/transfer and protected routing; supporting pages and rule replay.
- Responsive UI: core routes tested at 375, 768, 1024, 1440 and 1920 pixels for overflow and mobile navigation behavior.
- Accessibility: axe WCAG 2A/2AA/2.1AA checks on overview, dashboard, simulation and event explorer; no reported violations in tested views. Radix dialog Escape behavior verified.
- PDF: four-page report opened, text extracted, all pages rendered and visually inspected for layout, headings, hashes and pagination.
- Database: Alembic upgrade and schema drift check on a separate fresh PostgreSQL database; SQLite migration to revision 0001. No drift detected.
- Infrastructure: both application images built, all three Compose services became healthy, and the browser tests ran against the Nginx/PostgreSQL deployment.
- Supply chain: npm audit reported zero vulnerabilities; pip-audit reported zero known vulnerabilities for the pinned Python graph (39 packages audited).

## Self-verification checklist

| Required outcome | Verification |
|---|---|
| Start project | Docker Compose healthy services |
| Login as analyst | Browser login flow |
| Open dashboard and simulation | Browser routing and visible database data |
| Launch ATO | Real POST to simulation API |
| Events appear live | Separate-tab SSE test |
| Detection triggers and risk increases | Backend factors and browser final risk 110 |
| Critical incident appears | Incident detail and queue queries |
| Timeline and evidence populated | Browser tabs plus API assertions |
| SOAR executes | Nine response actions recorded |
| Account locked | Database-backed detail assertion |
| Sessions revoked | All affected customer sessions asserted REVOKED |
| Transaction frozen | Actual transaction status FROZEN |
| IP blocked | Local intelligence state BLOCKED and later login rejected |
| Dashboard updates | SQL metrics read after containment |
| Resolve incident | Browser lifecycle selection |
| Generate report | Browser PDF download and render inspection |
| Reset environment | Confirmed browser admin reset; customer restored |
| Tests pass | Backend and Playwright suites |

## Scope

Browser automation used Chromium, not an exhaustive cross-browser/device certification. Axe automation does not replace a human accessibility audit. Dependency audits reflect the advisory databases at verification time. The suite emits two upstream Starlette/httpx/AnyIO deprecation warnings; they do not fail the tests. No paid cloud deployment or real banking integration was attempted. Screenshots, PDFs, databases, dependency folders and test reports are generated verification artifacts and are excluded from the source ZIP.
