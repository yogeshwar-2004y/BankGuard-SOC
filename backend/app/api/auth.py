from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import select

from app.core.security import CurrentUser, DB, hash_password, new_session, verify_password
from app.models.entities import Account, Device, Session, User
from app.schemas.requests import Login, PasswordInput
from app.services.common import audit, public
from app.siem.events import ingest

router = APIRouter(prefix="/api", tags=["Authentication"])


@router.post("/auth/login", summary="Create an expiring, server-revocable demo session")
def login(payload: Login, request: Request, response: Response, db: DB) -> dict:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    valid = verify_password(
        user.password_hash if user else request.app.state.dummy_hash, payload.password
    )
    if not valid or not user or not user.enabled:
        if user:
            ingest(db, user.id, "LOGIN_FAILURE")
        audit(db, "anonymous", "LOGIN_FAILURE", "authentication", result="DENIED")
        db.commit()
        raise HTTPException(401, "Email or password is incorrect.")
    account = db.scalar(select(Account).where(Account.user_id == user.id))
    if account and account.status == "LOCKED":
        raise HTTPException(
            423, "Account contained by SOC. Reset the demo or contact your analyst."
        )
    device = db.scalar(select(Device).where(Device.user_id == user.id, Device.trusted.is_(True)))
    token, session = new_session(
        db, user, request.app.state.settings, device_id=device.id if device else None
    )
    ingest(db, user.id, "LOGIN_SUCCESS", device_id=device.id if device else None)
    audit(db, user.email, "LOGIN", user.id)
    db.commit()
    response.set_cookie(
        "bankguard_session",
        token,
        httponly=True,
        secure=request.app.state.settings.secure_cookies,
        samesite="strict",
        max_age=request.app.state.settings.session_hours * 3600,
        path="/",
    )
    return {"user": public(user), "csrf_token": session.csrf_token}


@router.get("/auth/me")
def me(request: Request, user: CurrentUser) -> dict:
    return {"user": public(user), "csrf_token": request.state.session.csrf_token}


@router.post("/auth/logout")
def logout(request: Request, response: Response, db: DB, user: CurrentUser) -> dict:
    request.state.session.status = "REVOKED"
    audit(db, user.email, "LOGOUT", user.id)
    db.commit()
    response.delete_cookie("bankguard_session", path="/")
    return {"ok": True}


@router.post("/security/change-password")
def change_password(payload: PasswordInput, db: DB, user: CurrentUser) -> dict:
    if not verify_password(user.password_hash, payload.current_password):
        raise HTTPException(400, "Current password is incorrect.")
    user.password_hash = hash_password(payload.new_password)
    for session in db.scalars(select(Session).where(Session.user_id == user.id)):
        session.status = "REVOKED"
    ingest(db, user.id, "PASSWORD_CHANGED")
    audit(db, user.email, "PASSWORD_CHANGED", user.id)
    db.commit()
    return {"message": "Password changed. Please sign in again."}
