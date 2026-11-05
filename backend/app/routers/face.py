"""😶 FACE AUTHENTICATION — сабт ва вуруд бо чеҳра.

Талаби соҳиб (DANATEL.TJ):
  • сабти чеҳра бо розигии возеҳӣ → пайваст ба аккаунти мавҷуда;
  • вуруд бо чеҳра + Liveness (чолиши якдафъаӣ аз сервер);
  • танҳо ЯК Face Credential фаъол барои ҳар корбар;
  • маълумоти биометрӣ рамзгузоришуда (AES-256-GCM) — расм нигоҳ карда намешавад;
  • rate-limit / муҳофизат аз brute-force;
  • агар чеҳра ноком шавад → вуруд бо парол ҲЕША БАРОҲАТ боқӣ мемонад.

Ҷавоби хатои вуруд ЯГОНА аст — ифшо намешавад оё аккаунт вуҷуд дорад
ё чеҳра сабт шудааст (на аз рӯйи аккаунт, на аз рӯйи threshold).
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import random
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import ratelimit
from app.config import settings
from app.database import get_db
from app.models import FaceChallenge, FaceCredential, User
from app.routers.auth import _issue_token
from app.schemas import (
    FaceChallengeOut,
    FaceLoginRequest,
    FacePasswordRequest,
    FaceRegisterRequest,
    FaceStatusOut,
    Token,
)
from app.security import get_current_user, verify_password
from app.services import face_crypto

router = APIRouter(prefix="/api/auth/face", tags=["face-auth"])

logger = logging.getLogger("face_auth")

CHALLENGE_SECONDS = 60
ACTIONS: tuple[str, ...] = ("blink", "mouth")

# 🔑 Тасдики парол (step-up) барои сабти чеҳра: ticket 5 дақиқа ҳаёт дорад
TICKET_SECONDS = 300
CONFIRM_LIMIT, CONFIRM_WINDOW = 10, 300  # 10 тасдиқ / 5 дақиқа, корбар

# 🚦 Маҳдудсозии дархост (муҳофизат аз brute-force)
CHALLENGE_LIMIT, CHALLENGE_WINDOW = 30, 300      # 30 чолиш / 5 дақиқа, IP
LOGIN_LIMIT, LOGIN_WINDOW = 10, 300             # 10 кӯшиш / 5 дақиқа, IP
REGISTER_LIMIT, REGISTER_WINDOW = 10, 600       # 10 сабт / 10 дақиқа, корбар
DELETE_LIMIT, DELETE_WINDOW = 10, 600           # 10 несткунӣ / 10 дақиқа, корбар

# Паёми ягонаи хато — бе ифшои оё аккаунт бо чеҳра дорад ё не
LOGIN_FAILED = "Чеҳра шинохта нашуд — лутфан бо парол вуруд кунед"


# =====================================================================
# 🔑 TICKET-И ТАСДИКИ ПАРОЛ (stateless HMAC — DB лозим нест)
# =====================================================================
def _pw_sig(user_id: int, exp: int) -> str:
    key = settings.SECRET_KEY.encode()
    msg = f"danatel-face-pw:{user_id}:{exp}".encode()
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def _make_pw_ticket(user_id: int) -> tuple[str, int]:
    exp = int(time.time()) + TICKET_SECONDS
    return f"{user_id}.{exp}.{_pw_sig(user_id, exp)}", TICKET_SECONDS


def _check_pw_ticket(user_id: int, ticket: str | None) -> bool:
    """Санҷиши имзо + муҳлат + мувофиқии корбар. Такрорӣ дар 5 дақиқа ҷоиз."""
    if not ticket:
        return False
    try:
        uid_s, exp_s, sig = ticket.split(".", 2)
        uid, exp = int(uid_s), int(exp_s)
    except (ValueError, AttributeError):
        return False
    if uid != user_id or exp < int(time.time()):
        return False
    return hmac.compare_digest(sig, _pw_sig(uid, exp))


def _utcnow_naive() -> datetime:
    """Вақти UTC бе timezone (ҳамон усули security.py — 15 рӯз)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _issue_challenge(db: Session, request: Request) -> FaceChallenge:
    """🎯 Чолиши нав + тозакунӣ муҳлаташ гузаштаҳо (ҷадвали хурд)."""
    ratelimit.enforce(request, "face_challenge", CHALLENGE_LIMIT, CHALLENGE_WINDOW)
    now = _utcnow_naive()
    db.execute(delete(FaceChallenge).where(FaceChallenge.expires_at < now))
    ch = FaceChallenge(
        id=uuid.uuid4().hex,
        action=random.choice(ACTIONS),
        ip=ratelimit.client_ip(request),
        expires_at=now + timedelta(seconds=CHALLENGE_SECONDS),
    )
    db.add(ch)
    db.commit()
    db.refresh(ch)
    return ch


def _consume_challenge(
    db: Session,
    request: Request,
    *,
    challenge_id: str,
    action_done: str,
    bucket: str,
    limit: int,
    window: int,
    identifier: str = "",
) -> None:
    """🎯 Санҷиш + сӯзондани якдафъаӣ (ПЕШ аз муқоиса → replay манъ)."""
    ratelimit.enforce(request, bucket, limit, window, identifier=identifier)
    ch = db.get(FaceChallenge, challenge_id)
    now = _utcnow_naive()
    if ch is None or ch.used or ch.expires_at < now:
        raise HTTPException(
            status_code=400,
            detail="Чолиш нодуруст ё муҳлаташ гузашт — аз нав оғоз кунед",
        )
    if ch.action != action_done:
        raise HTTPException(status_code=400, detail="Амали лайвлес иҷро нашуд")
    ch.used = True
    db.commit()


# =====================================================================
# 🎯 ЧОЛИШИ ЛАЙВЛЕС (пеш аз ҳар амали чеҳра)
# =====================================================================
@router.post("/challenge", response_model=FaceChallengeOut)
def face_challenge(request: Request, db: Session = Depends(get_db)):
    """
    🎯 Чолиши тасодуфӣ: `blink` (чашм пузур кардан) ё `mouth` (даҳон
    кушодан). Ҳар дафъа = амали нав, муҳлат60 сония, якдафъаӣ.

    Фронт аз рӯйи landmarkҳои чеҳра тасдиқ мекунад (liveness) →
    акси оддӣ ё видеои беамал ин амалро иҷро карда наметавонад.
    """
    ch = _issue_challenge(db, request)
    return FaceChallengeOut(
        challenge_id=ch.id, action=ch.action, expires_in=CHALLENGE_SECONDS
    )


# =====================================================================
# 🔑 ТАСДИКИ ПАРОЛ (дарвозаи парол пеш аз сабти чеҳра)
# =====================================================================
@router.post("/confirm-password")
def face_confirm_password(
    payload: FacePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    🔑 Тасдики парол (step-up) барои сабти чеҳра.

    • Пароли дуруст → `ticket`-и stateless HMAC (300 сония) бармегардад;
      дар `/register` ҳатмӣ санҷида мешавад (428 бе он).
    • Парол нодуруст → **403** (на 401 — 401 дар клиент сеансро мешиканад).
    • Rate-limit: 10 тасдиқ / 5 дақиқа, корбар.
    """
    ratelimit.enforce(
        request,
        "face_confirm_pw",
        CONFIRM_LIMIT,
        CONFIRM_WINDOW,
        identifier=str(user.id),
    )
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=403, detail="Парол нодуруст аст")
    ticket, expires_in = _make_pw_ticket(user.id)
    logger.info("🔑 Тасдики парол барои сабти чеҳра (user=%s)", user.id)
    return {"ok": True, "ticket": ticket, "expires_in": expires_in}


# =====================================================================
# 😶 САБТИ ЧЕҲРА (танҳо корбари вурудкарда)
# =====================================================================
@router.post("/register", response_model=FaceStatusOut)
def face_register(
    payload: FaceRegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    😶 Сабти чеҳра → пайваст ба аккаунти ҷорӣ.

    • Розигии возеҳӣ ҲАТМИСТ (`consent=true`) — вақти розигӣ дар DB.
    • 🔑 Тасдики парол ҲАТМИСТ (`pw_ticket` аз `/confirm-password`) —
      бе он **428** (чолиш сӯзонда намешавад).
    • Descriptor (128 уҷа) → AES-256-GCM → танҳо байтҳои рамзшуда дар DB.
    • Танҳо ЯК credential барои ҳар корбар (сабти дубра = навсозӣ).
    • Чолиши якдафъаӣ + rate-limit (10/10 дақиқа, корбар).
    """
    if not payload.consent:
        raise HTTPException(
            status_code=422,
            detail="Розигии шумо барои сабти маълумоти чеҳра лозим аст",
        )
    if not _check_pw_ticket(user.id, payload.pw_ticket):
        raise HTTPException(
            status_code=428,
            detail="Парол тасдиқ нашуд ё вақташ гузашт — аввал паролро ворид кунед",
        )
    _consume_challenge(
        db,
        request,
        challenge_id=payload.challenge_id,
        action_done=payload.action_done,
        bucket="face_register",
        limit=REGISTER_LIMIT,
        window=REGISTER_WINDOW,
        identifier=str(user.id),
    )
    try:
        # normalize → дар DB танҳо вектори якдахм (баъдҳо дуруст муқоиса шавад)
        blob = face_crypto.encrypt_descriptor(face_crypto.normalize(payload.descriptor))
    except ValueError:
        raise HTTPException(status_code=422, detail="Додани чеҳра нодуруст аст")

    now = _utcnow_naive()
    cred = db.scalar(select(FaceCredential).where(FaceCredential.user_id == user.id))
    if cred is not None:
        cred.descriptor_enc = blob
        cred.model_version = face_crypto.MODEL_VERSION
        cred.consent_at = now
    else:
        cred = FaceCredential(
            user_id=user.id,
            descriptor_enc=blob,
            model_version=face_crypto.MODEL_VERSION,
            consent_at=now,
        )
        db.add(cred)
    db.commit()
    db.refresh(cred)
    logger.info("😶 Чеҳра сабт шуд (user=%s)", user.id)
    return FaceStatusOut(registered=True, registered_at=cred.consent_at)


# =====================================================================
# 😶 ВУРУД БО ЧЕҲРА
# =====================================================================
@router.post("/login", response_model=Token)
def face_login(
    payload: FaceLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    😶 Вуруд бо чеҳра → ҳамон токени JWT-и вуруди оддӣ (`/api/auth/login`).

    • Чолиши якдафъаӣ (лайвлес) + rate-limit (10/5 дақиқа, IP).
    • Муқоиса бо ҳамаи credentialҳои мавҷуд (дар DB танҳо байти
      рамзшуда → ҳамчун байти беҳуда менамоянд).
    • Ҷавоби хато ЯГОНА аст — аккаунт/чҳоя ифшо намешавад.
    • Парол ҲЕҶ ГОҲ аз байн намеравад: нокомии чеҳра → `/login`.
    """
    _consume_challenge(
        db,
        request,
        challenge_id=payload.challenge_id,
        action_done=payload.action_done,
        bucket="face_login",
        limit=LOGIN_LIMIT,
        window=LOGIN_WINDOW,
    )
    try:
        probe = face_crypto.normalize(payload.descriptor)
    except ValueError:
        raise HTTPException(status_code=422, detail="Додани чеҳра нодуруст аст")

    threshold = float(settings.FACE_MATCH_THRESHOLD)
    best_user: User | None = None
    best_dist = 999.0
    creds = db.scalars(select(FaceCredential)).all()
    for cred in creds:
        try:
            stored = face_crypto.decrypt_descriptor(cred.descriptor_enc)
        except Exception:  # noqa: BLE001 — калид иваз шудааст ё вайрон
            logger.warning("⚠️ Face credential декод нашуд (user=%s)", cred.user_id)
            continue
        dist = face_crypto.distance(probe, stored)
        if dist < best_dist:
            best_dist = dist
            best_user = db.get(User, cred.user_id)
        if best_dist <= threshold:
            break

    if best_user is None or best_dist > threshold:
        raise HTTPException(status_code=401, detail=LOGIN_FAILED)

    logger.info("😶 Вуруд бо чеҳра (user=%s, d=%.3f)", best_user.id, best_dist)
    return Token(
        access_token=_issue_token(best_user), is_admin=bool(best_user.is_admin)
    )


# =====================================================================
# 📌 ВАЗЪИ ЧЕҲРА + 🗑️ НЕСТ КАРДАН
# =====================================================================
@router.get("/status", response_model=FaceStatusOut)
def face_status(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """😶 Оё барои ин корбар чеҳра сабт шудааст?"""
    cred = db.scalar(select(FaceCredential).where(FaceCredential.user_id == user.id))
    if cred is None:
        return FaceStatusOut(registered=False)
    return FaceStatusOut(registered=True, registered_at=cred.consent_at)


@router.delete("/credential")
def face_credential_delete(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """🗑️ Нест кардани Face Credential (ҳуқуқи нест кардани биометрӣ)."""
    ratelimit.enforce(
        request,
        "face_delete",
        DELETE_LIMIT,
        DELETE_WINDOW,
        identifier=str(user.id),
    )
    db.execute(delete(FaceCredential).where(FaceCredential.user_id == user.id))
    db.commit()
    logger.info("🗑️ Face credential нест карда шуд (user=%s)", user.id)
    return {"ok": True}
