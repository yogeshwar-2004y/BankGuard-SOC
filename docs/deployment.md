# Deployment and operations

## Local Compose deployment

`docker compose up --build` builds React into static assets, starts PostgreSQL, runs Alembic in the backend, seeds synthetic data, then starts the unprivileged web proxy after the API is healthy. Persistent database data lives in the named `bankguard-data` volume. All services have restart policies and health checks.

Only `127.0.0.1:8080` is published. PostgreSQL and the API are private network services. `docker compose down` preserves state. Use the application reset control to restore the lab. Avoid deleting a volume containing data you intend to retain.

## Shared or cloud-hosted lab

1. Use a Linux host with Docker/Compose and sufficient memory (2GB minimum; 4GB recommended for builds).
2. Copy `.env.example` to an untracked `.env`; use unique role passwords and a database password, and set the externally visible HTTPS origin.
3. Deploy with the production override. Production mode rejects public/short seed passwords and non-HTTPS CORS origins.
4. Terminate TLS with a reverse proxy/load balancer. Forward the correct host and leave SSE buffering disabled. Restrict host access and use a private database network.
5. Back up PostgreSQL and test restoration; monitor `/ready`, container health, audit volume and disk usage.
6. Keep one backend worker. Do not scale replicas until scheduler ownership, locks, rate limiting and event fan-out are distributed.

```bash
docker compose -f docker-compose.yml -f infrastructure/deployment/compose.production.yml up --build -d
docker compose exec backend alembic current
docker compose exec postgres pg_dump -U bankguard bankguard > bankguard-backup.sql
```

The override drops Linux capabilities and sets no-new-privileges on application services. Configure storage encryption, log retention, backups, image scanning, a secret manager and access policy for your environment. No cloud services are provisioned by this repository.

## Configuration

| Variable | Meaning |
|---|---|
| APP_ENV | development/test/production behavior; Secure cookies in production |
| DATABASE_URL | SQLAlchemy URL; Compose overrides this with its private PostgreSQL host |
| CORS_ORIGINS | Comma-separated exact browser origins |
| LOG_LEVEL | Structured application log level |
| SEED_DEMO | Seed on an empty database; no duplicate seed on restarts |
| SIMULATION_INTERVAL | Automatic step interval, 0.1–60 seconds |
| SESSION_HOURS | Session expiry, 1–24 hours |
| DEMO_*_EMAIL / PASSWORD | Seed identity configuration |
| POSTGRES_* | Compose database initialization |

Opaque random sessions do not need a signing secret. Changing seed password variables does not rewrite existing users; reset through an authorized administrator if intentionally restoring the demo. Existing production data must be managed through controlled migrations and recovery procedures.

## Supply chain

Direct Python dependencies are pinned in `requirements.txt`; the complete runtime/test dependency graph is captured in `requirements-lock.txt`. Docker and local setup use the lock. npm uses exact direct versions and `package-lock.json`. CI audits both and runs builds/tests. Container base images use version tags; operators should pin approved digests and rebuild regularly for their own release process.

This configuration makes the educational lab portable. It is not a real-banking deployment certification or high-availability topology.
