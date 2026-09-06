from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.core.security import CurrentUser, DB
from app.models.entities import Beneficiary, SecurityEvent, Transaction
from app.schemas.requests import BeneficiaryInput, TransferInput
from app.services.banking import account_for, add_beneficiary, transfer
from app.services.common import audit, public

router = APIRouter(prefix="/api", tags=["Simulated banking"])


@router.get("/accounts/me")
def account(db: DB, user: CurrentUser) -> dict:
    item = account_for(db, user.id)
    data = public(item)
    held = db.scalar(
        select(func.coalesce(func.sum(Transaction.amount_paise), 0)).where(
            Transaction.account_id == item.id, Transaction.status.in_(["PENDING", "FROZEN"])
        )
    )
    data.update(available_balance=max(0, item.balance_paise - held) / 100, customer=public(user))
    return data


@router.get("/accounts/me/transactions")
@router.get("/transfers")
def transactions(
    db: DB, user: CurrentUser, page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=100)
) -> dict:
    item = account_for(db, user.id)
    query = select(Transaction).where(Transaction.account_id == item.id)
    return {
        "items": [
            public(t)
            for t in db.scalars(
                query.order_by(Transaction.created_at.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ],
        "total": db.scalar(select(func.count()).select_from(query.subquery())),
    }


@router.get("/beneficiaries")
def beneficiaries(db: DB, user: CurrentUser) -> list[dict]:
    return [
        public(b)
        for b in db.scalars(
            select(Beneficiary)
            .where(Beneficiary.user_id == user.id)
            .order_by(Beneficiary.created_at.desc())
            .limit(100)
        )
    ]


@router.post("/beneficiaries")
def create_beneficiary(payload: BeneficiaryInput, db: DB, user: CurrentUser) -> dict:
    item = add_beneficiary(db, user.id, payload.name, payload.account_number)
    audit(db, user.email, "NEW_BENEFICIARY", item.id)
    db.commit()
    return public(item)


@router.post("/transfers")
def create_transfer(payload: TransferInput, db: DB, user: CurrentUser) -> dict:
    item = transfer(
        db, user.id, str(payload.beneficiary_id), int(payload.amount * 100), payload.reference
    )
    audit(db, user.email, "TRANSFER", item.id)
    db.commit()
    return public(item)


@router.get("/security/activity")
def activity(db: DB, user: CurrentUser) -> list[dict]:
    return [
        public(e)
        for e in db.scalars(
            select(SecurityEvent)
            .where(SecurityEvent.user_id == user.id)
            .order_by(SecurityEvent.created_at.desc())
            .limit(100)
        )
    ]
