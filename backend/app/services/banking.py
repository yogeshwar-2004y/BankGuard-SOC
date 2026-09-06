from fastapi import HTTPException
from sqlalchemy import select

from app.models.entities import Account, Beneficiary, Transaction
from app.siem.events import ingest, record


def account_for(db, user_id):
    account = db.scalar(select(Account).where(Account.user_id == user_id).with_for_update())
    if not account:
        raise HTTPException(404, "Customer account not found.")
    return account


def active(account):
    if account.status != "ACTIVE":
        raise HTTPException(423, "This simulated account is locked. Contact the SOC analyst.")


def add_beneficiary(db, user_id, name, number, **context):
    active(account_for(db, user_id))
    if db.scalar(
        select(Beneficiary).where(
            Beneficiary.user_id == user_id, Beneficiary.account_number == number
        )
    ):
        raise HTTPException(409, "This beneficiary already exists.")
    item = Beneficiary(user_id=user_id, name=name, account_number=number)
    db.add(item)
    db.flush()
    ingest(
        db, user_id, "NEW_BENEFICIARY", details={"beneficiary_id": item.id, "name": name}, **context
    )
    return item


def transfer(db, user_id, beneficiary_id, amount_paise, reference, **context):
    account = account_for(db, user_id)
    active(account)
    beneficiary = db.get(Beneficiary, beneficiary_id)
    if not beneficiary or beneficiary.user_id != user_id:
        raise HTTPException(404, "Beneficiary not found.")
    if amount_paise > account.balance_paise:
        raise HTTPException(400, "Insufficient simulated balance.")
    transaction = Transaction(
        account_id=account.id,
        beneficiary_id=beneficiary_id,
        amount_paise=amount_paise,
        reference=reference,
        run_id=context.get("run_id"),
    )
    db.add(transaction)
    db.flush()
    ingest(
        db,
        user_id,
        "TRANSFER_INITIATED",
        details={"transaction_id": transaction.id, "amount": amount_paise / 100},
        **context,
    )
    if transaction.status == "PENDING":
        if account.status == "LOCKED":
            transaction.status = "FROZEN"
        else:
            transaction.status = "COMPLETED"
            account.balance_paise -= amount_paise
            record(
                db,
                user_id,
                "TRANSFER_COMPLETED",
                details={"transaction_id": transaction.id, "amount": amount_paise / 100},
                **context,
            )
    return transaction
