# Synthetic baseline

Run `python -m app.cli seed` from `backend/` after applying migrations and configuring `.env`. Seeding is idempotent when users already exist; destructive restoration uses the authenticated, confirmed reset endpoint.

Implementation: `backend/app/services/seed.py`. The seed creates twelve customers, two staff roles, accounts, trusted devices, 120 normal telemetry events, 60 historical transactions, detection rules, seven scenarios, the nine-action playbook and synthetic IP intelligence. It runs the actual full-chain simulator for two other customers to prepare complete incidents. Rahul's account remains active with INR 250,000 for a fresh demonstration.
