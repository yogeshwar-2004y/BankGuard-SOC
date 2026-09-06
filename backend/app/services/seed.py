import secrets
from datetime import timedelta

from sqlalchemy import select

from app.core.security import hash_password, new_session
from app.detection.engine import RULES
from app.models.entities import (
    Account,
    Beneficiary,
    DetectionRule,
    Device,
    SOARPlaybook,
    SimulationScenario,
    ThreatIntelRecord,
    Transaction,
    User,
    now,
)
from app.services.common import audit
from app.siem.events import record
from app.simulation.scenarios import SCENARIOS
from app.soar.engine import ACTIONS

NAMES = [
    "Rahul Sharma",
    "Ananya Iyer",
    "Vikram Rao",
    "Meera Nair",
    "Arjun Patel",
    "Priya Menon",
    "Karthik Kumar",
    "Diya Shah",
    "Rohan Das",
    "Neha Singh",
    "Asha Verma",
    "Dev Mehta",
]


def seed(db, settings):
    if db.scalar(select(User.id).limit(1)):
        return
    for role in ["analyst", "admin"]:
        password = getattr(settings, f"demo_{role}_password")
        if not password:
            raise ValueError("Set demo passwords in .env before seeding. See .env.example.")
        db.add(
            User(
                email=getattr(settings, f"demo_{role}_email"),
                name=f"Demo {role.title()}",
                role=role,
                password_hash=hash_password(password),
            )
        )
    if not settings.demo_customer_password:
        raise ValueError("Set DEMO_CUSTOMER_PASSWORD before seeding.")
    customers = []
    for index, name in enumerate(NAMES):
        user = User(
            email=settings.demo_customer_email
            if index == 0
            else f"customer{index + 1}@bankguard.test",
            name=name,
            customer_id=f"BG{1001 + index}",
            role="customer",
            password_hash=hash_password(
                settings.demo_customer_password if index == 0 else secrets.token_urlsafe(32)
            ),
        )
        db.add(user)
        db.flush()
        customers.append(user)
        account = Account(user_id=user.id, number=f"BG-SAV-{1001 + index}")
        db.add(account)
        db.flush()
        beneficiary = Beneficiary(
            user_id=user.id, name="Demo Utilities", account_number=f"BG-UTIL-{1001 + index}"
        )
        db.add(beneficiary)
        devices = [
            Device(
                user_id=user.id,
                fingerprint=f"trusted-{index}-{j}",
                name=f"{name.split()[0]}-{'iPhone' if j == 0 else 'Laptop'}",
                trusted=True,
            )
            for j in range(2)
        ]
        db.add_all(devices)
        db.flush()
        new_session(db, user, settings, "192.0.2.10", devices[0].id)
        for j in range(10):
            record(
                db,
                user.id,
                "LOGIN_SUCCESS" if j % 2 == 0 else "MFA_EVENT",
                device_id=devices[j % 2].id,
                timestamp=now() - timedelta(days=10 - j, minutes=index),
                details={"baseline": True},
            )
        for j in range(5):
            db.add(
                Transaction(
                    account_id=account.id,
                    beneficiary_id=beneficiary.id,
                    amount_paise=(j + 1) * 125000,
                    reference=[
                        "Electricity",
                        "Groceries",
                        "Internet",
                        "Rent contribution",
                        "Utilities",
                    ][j],
                    status="COMPLETED",
                    created_at=now() - timedelta(days=j + 1),
                )
            )
    for key, name, description, severity, weight, config in RULES:
        db.add(
            DetectionRule(
                key=key,
                name=name,
                description=description,
                severity=severity,
                weight=weight,
                config=config,
            )
        )
    db.add(SOARPlaybook(name="Critical ATO Containment", actions=ACTIONS))
    db.add(
        ThreatIntelRecord(
            ip="203.0.113.50",
            reputation="Malicious",
            confidence=92,
            category="credential-theft",
            tags=["phishing", "credential-theft", "synthetic"],
            status="WATCHLIST",
        )
    )
    db.add(
        ThreatIntelRecord(
            ip="198.51.100.23",
            reputation="Suspicious",
            confidence=65,
            category="anonymizer",
            tags=["proxy", "synthetic"],
            status="WATCHLIST",
        )
    )
    for slug, name, description, steps in SCENARIOS:
        db.add(SimulationScenario(slug=slug, name=name, description=description, steps=steps))
    db.flush()
    # Prepared incidents are produced by the same services as fresh simulations.
    from app.simulation.runner import start, step

    actor = db.scalar(select(User).where(User.role == "analyst"))
    for user in customers[-2:]:
        db.scalar(
            select(ThreatIntelRecord).where(ThreatIntelRecord.ip == "203.0.113.50")
        ).status = "WATCHLIST"
        run = start(db, actor, "ato", True, user.id)
        for _ in range(8):
            step(db, run, settings)
    # The shared reputation dataset starts in watchlist state for Rahul's fresh demo.
    intel = db.scalar(select(ThreatIntelRecord).where(ThreatIntelRecord.ip == "203.0.113.50"))
    intel.status = "WATCHLIST"
    audit(db, "system", "DEMO_SEED", "synthetic baseline")
    db.commit()
