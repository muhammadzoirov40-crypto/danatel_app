"""Роутери вуруд, қайд ва эътирофи корбар/админ."""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import (
    BalanceOut,
    LoginRequest,
    RegisterRequest,
    Token,
    UserOut,
)
from app.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _normalize_phone(phone: str) -> str:
    """Тоза кардани телефон: 992XXXXXXXXX ё +992XXXXXXXXX ё 0XXXXXXXXX."""
    p = (phone or "").strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    p = p.lstrip("+")
    # Агар бо 0 оғоз шуда бошад (масалан 0XXXXXXXXX) → 992
    if p.startswith("0") and len(p) == 9:
        p = "992" + p[1:]
    # Агар 9 рақам дошта бошад (бидеҳ иловаи 992)
    if len(p) == 9:
        p = "992" + p
    return p


@router.post("/register", response_model=Token)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """
    📱 Қайди корбари нав ( телефон + парол ).

    Баланси ибтидоӣ: 0 сомонӣ.
    """
    phone = _normalize_phone(payload.phone)
    if len(phone) < 9 or not phone.isdigit():
        raise HTTPException(status_code=422, detail="Рақами телефон нодуруст аст")

    if len(payload.password or "") < 4:
        raise HTTPException(status_code=422, detail="Парол бояд аз 4 ҳарф зиёд бошад")

    # Санҷиши такрорӣ — телефон бояд ягона бошад
    existing = db.scalar(select(User).where(User.phone == phone))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Ин телефон аллакай қайд шудааст")

    user = User(
        phone=phone,
        password_hash=hash_password(payload.password),
        full_name=(payload.full_name or "").strip() or None,
        language=payload.language if payload.language in ("tj", "ru", "en", "uz") else "tj",
        is_admin=False,
        balance=Decimal("0.00"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "admin": False})
    return Token(access_token=token, is_admin=False)


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    🔑 Вуруд.

    • Админ: телефон аз `.env` + парол аз `.env`
    • Корбар: телефон + пароли қайдшуда
    """
    phone = _normalize_phone(payload.phone)

    # ===== 🔑 Вуруди админ аз .env =====
    if (
        phone == _normalize_phone(settings.ADMIN_PHONE)
        and payload.password == settings.ADMIN_PASSWORD
    ):
        user = db.scalar(select(User).where(User.is_admin.is_(True)).limit(1))
        if user is None:
            user = User(
                full_name="Admin",
                language="tj",
                is_admin=True,
                balance=Decimal("0.00"),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        token = create_access_token({"sub": str(user.id), "admin": True})
        return Token(access_token=token, is_admin=True)

    # ===== 👤 Вуруди корбари оддӣ =====
    user = db.scalar(select(User).where(User.phone == phone))
    if user is not None and user.password_hash and verify_password(payload.password, user.password_hash):
        token = create_access_token({"sub": str(user.id), "admin": bool(user.is_admin)})
        return Token(access_token=token, is_admin=bool(user.is_admin))

    raise HTTPException(status_code=401, detail="Номи корбар ё парол нодуруст")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    """👤 Маълумоти корбар аз ҷумла БАЛАНСИ ҶОРИИ Ӯ."""
    return user


@router.get("/me/balance", response_model=BalanceOut)
def my_balance(user: User = Depends(get_current_user)):
    """
    💰 Баланси ҷорӣ бо сомонӣ.

    Танҳо аз backend гирифта мешавад — фронт ҳеҷ гоҳ маблағро
    тағйир дода наметавонад.
    """
    return BalanceOut(user_id=user.id, balance=user.balance or Decimal("0.00"))
