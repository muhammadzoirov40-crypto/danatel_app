"""Роутери вуруд, қайд, хуруҷ ва ивазкунии парол."""
from __future__ import annotations

import hmac
import logging
import re
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ratelimit
from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import (
    BalanceOut,
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    Token,
    UserOut,
)
from app.security import (
    bump_token_version,
    create_access_token,
    get_current_user,
    get_token_payload,
    hash_password,
    needs_rehash,
    revoke_token,
    verify_password,
)
from app.services import coins as coins_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

logger = logging.getLogger("auth")


def _issue_token(user: User) -> str:
    """🎫 Сохтани токен барои корбар (бо `tv` — насби ҷорӣ)."""
    return create_access_token(
        {
            "sub": str(user.id),
            "admin": bool(user.is_admin),
            "tv": int(user.token_version or 0),
        }
    )

# 🚦 Маҳдудсозии дархост (муҳофизат аз brute-force)
LOGIN_LIMIT = 12          # кӯшишҳои вуруд
LOGIN_WINDOW = 300        # 5 дақиқа
REGISTER_LIMIT = 8
REGISTER_WINDOW = 600     # 10 дақиқа
CHPWD_LIMIT = 5
CHPWD_WINDOW = 900        # 15 дақиқа

_PHONE_RE = re.compile(r"^\d{10,15}$")
MIN_PASSWORD = 8

# 📵 Паёми ягона барои ҳамаи нокомиҳои вуруд — бе ифшои сабаб
LOGIN_FAILED = "Номи корбар ё парол нодуруст"


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


def _weak_password(password: str, phone: str) -> str | None:
    """Санҷиши сиёсати парол. Бармегардонад: сабаб ё None."""
    if len(password or "") < MIN_PASSWORD:
        return f"Парол бояд аз {MIN_PASSWORD} ҳарф зиёд бошад"
    if password.isdigit():
        return "Парол набояд танҳо рақам бошад"
    if password.lower() in {phone, phone[-9:], "password", "12345678", "qwertyui"}:
        return "Пароли интихобшуда хеле суст аст"
    return None


# =====================================================================
# 📱 ҚАЙДИ КОРБАР
# =====================================================================
@router.post("/register", response_model=Token)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """
    📱 Қайди корбари нав ( телефон + парол ).

    • Маҳдудсозии дархост (муҳофизат аз эҷоди ҳисобҳои зиёд)
    • Парол ≥ 8 ҳарф, ҳосси Argon2id
    • Баланси ибтидоӣ: 0 сомонӣ
    """
    ratelimit.enforce(
        request, "register", REGISTER_LIMIT, REGISTER_WINDOW,
        identifier=_normalize_phone(payload.phone),
    )

    phone = _normalize_phone(payload.phone)
    if not _PHONE_RE.match(phone):
        raise HTTPException(status_code=422, detail="Рақами телефон нодуруст аст")

    weak = _weak_password(payload.password, phone)
    if weak:
        raise HTTPException(status_code=422, detail=weak)

    # Санҷиши такрорӣ — телефон бояд ягона бошад
    existing = db.scalar(select(User).where(User.phone == phone))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Ин телефон аллакай қайд шудааст")

    # 🔗 Даъват: коди дӯст аз линки шахсӣ (агар нодуруст бошад — нодида мегирем,
    #    то қайд бо сабаби линки вайрон қатъ нашавад)
    inviter = coins_service.find_user_by_referral_code(db, payload.referral_code)
    referral_applied = inviter is not None
    if payload.referral_code and not referral_applied:
        logger.warning("🔗 Коди даъват нодуруст ҳангоми қайд (phone=…%s)", phone[-4:])

    user = User(
        phone=phone,
        password_hash=hash_password(payload.password),
        full_name=(payload.full_name or "").strip()[:128] or None,
        language=payload.language if payload.language in ("tj", "ru", "en", "uz") else "tj",
        is_admin=False,
        balance=Decimal("0.00"),
        coins=0,
        referred_by_id=inviter.id if inviter is not None else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 🪙 Бонуси даъват (як дафъа): +даъваткунанда, +дӯсти нав
    if inviter is not None:
        try:
            coins_service.grant_referral(
                db, inviter_id=inviter.id, invited_id=user.id
            )
        except Exception:  # noqa: BLE001
            # Қайд набояд ноком шавад, вале хатогӣ бояд дида шавад
            logger.exception("Хатогии бонуси даъват (inviter=%s)", inviter.id)

    token = _issue_token(user)
    return Token(access_token=token, is_admin=False, referral_applied=referral_applied)


# =====================================================================
# 🔑 ВУРУД
# =====================================================================
@router.post("/login", response_model=Token)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    🔑 Вуруд.

    • Маҳдудсозӣ: 12 кӯшиш / 5 дақиқа (барои ҳар IP ва ҳар телефон)
    • Админ: телефон + парол аз `.env` (санҷиши вақти-доимӣ)
    • Корбар: телефон + пароли қайдшуда
    • Ҷавоби хато ЯГОНА аст → аз рӯйи он корбар вуҷуд дорад ё не фаҳмидан мумкин нест
    """
    phone = _normalize_phone(payload.phone)
    ratelimit.enforce(
        request, "login", LOGIN_LIMIT, LOGIN_WINDOW, identifier=phone
    )

    admin_phone = _normalize_phone(settings.ADMIN_PHONE)
    admin_password = settings.ADMIN_PASSWORD or ""

    # ===== 🔑 Вуруди админ аз .env (вақти-доимӣ, бе ифшои сабаб) =====
    if admin_password and hmac.compare_digest(phone, admin_phone) and hmac.compare_digest(
        payload.password or "", admin_password
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
        token = _issue_token(user)
        return Token(access_token=token, is_admin=True)

    # ===== 👤 Вуруди корбари оддӣ =====
    user = db.scalar(select(User).where(User.phone == phone))
    if user is not None and user.password_hash and verify_password(
        payload.password, user.password_hash
    ):
        # 🔄 Мигратсияи бехатар: bcrypt-и кӯҳна → Argon2id
        if needs_rehash(user.password_hash):
            user.password_hash = hash_password(payload.password)
            db.commit()
        token = _issue_token(user)
        return Token(access_token=token, is_admin=bool(user.is_admin))

    raise HTTPException(status_code=401, detail=LOGIN_FAILED)


# =====================================================================
# 🚪 ХУРУҷ (бекор кардани токени ҷорӣ)
# =====================================================================
@router.post("/logout")
def logout(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    """🚪 Хуруҷ — токени ҷорӣ бекор мешавад (дигар кор намекунад)."""
    try:
        user_id: int | None = int(payload.get("sub"))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        user_id = None
    revoke_token(db, payload.get("jti"), user_id, payload.get("exp"))
    return {"ok": True}


# =====================================================================
# 🔐 ИВАЗКУНИИ ПАРОЛ
# =====================================================================
@router.post("/password/change", response_model=Token)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    🔐 Ивазкунии парол (танҳо барои корбари вурудкарда).

    • Пароли кӯҳна ҳатмист
    • Пароли нав ≥ 8 ҳарф ва набояд такрорӣ бошад
    • Баъди ивазкунӣ ҲАМАИ токенҳои кӯҳна бекор мешавад
      ва токени нав баргардонида мешавад (сеанс ҷорӣ идома меёбад)
    """
    ratelimit.enforce(
        request, "password_change", CHPWD_LIMIT, CHPWD_WINDOW,
        identifier=str(user.id),
    )

    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=403, detail="Пароли кӯҳна нодуруст аст")

    new = payload.new_password or ""
    weak = _weak_password(new, user.phone or "")
    if weak:
        raise HTTPException(status_code=422, detail=weak)
    if hmac.compare_digest(new, payload.current_password or ""):
        raise HTTPException(status_code=422, detail="Пароли нав набояд бо кӯҳна як хел бошад")

    user.password_hash = hash_password(new)
    db.commit()

    # 🚫 Ҳамаи токенҳои кӯҳна (аз ҷумла токени ҷорӣ) беэътибор мешавад
    bump_token_version(db, user)

    token = _issue_token(user)
    return Token(access_token=token, is_admin=bool(user.is_admin))


# =====================================================================
# 👤 МАЪЛУМОТИ КОРБАР
# =====================================================================
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
