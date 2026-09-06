"""Perform a small ordinary transfer in the synthetic bank for comparison."""

import getpass
import os
from uuid import uuid4

import httpx
from dotenv import load_dotenv

load_dotenv()
with httpx.Client(base_url="http://localhost:8080", timeout=30) as client:
    login = client.post(
        "/api/auth/login",
        json={
            "email": os.getenv("DEMO_CUSTOMER_EMAIL", "customer@bankguard.test"),
            "password": os.getenv("DEMO_CUSTOMER_PASSWORD")
            or getpass.getpass("Synthetic customer password: "),
        },
    )
    login.raise_for_status()
    client.headers["X-CSRF-Token"] = login.json()["csrf_token"]
    beneficiary = client.post(
        "/api/beneficiaries",
        json={
            "name": "Normal demo recipient",
            "account_number": f"BG-NORMAL-{uuid4().hex[:8].upper()}",
        },
    )
    beneficiary.raise_for_status()
    transfer = client.post(
        "/api/transfers",
        json={
            "beneficiary_id": beneficiary.json()["id"],
            "amount": 100,
            "reference": "Normal synthetic activity",
        },
    )
    transfer.raise_for_status()
    print(transfer.json())
