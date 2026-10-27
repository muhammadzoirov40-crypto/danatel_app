"""
💳 ДАРХОСТИ ПУР КАРДАНИ БАЛАНС (DC City пардохт → чек → тасдиқи админ).

Тартиби кор:
1. Корбар маблағро интихоб мекунад → дархост сохта мешавад + ЛИНКИ ПАРДОХТИ
   DC City (pay.dc.tj, референс дар f3 — аз коди RentFrow).
2. Корбар пардохт мекунад ва расми чекро дар давоми **1 дақиқа** мефиристад.
3. Чек ба админ дар Telegram бо тугмаҳои [Қабул]/[Рад] меояд; ҳамон чек дар
   админ-панели веб/мобил ҳам ҳаст.
4. Қабул → баланс худкор зиёд мешавад; рад → баланс тағйир намеёбад.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import ratelimit
from app.config import settings
from app.database import get_db
from app.models import BalanceRequest, BalanceRequestStatus, User
from app.schemas import TopupOut, TopupPrepareIn, TopupPrepareOut
from app.security import get_current_user
from app.services import telegram_service
from app.services.topups import TopupError, parse_amount

logger = logging.getLogger("topups")

router = APIRouter(prefix="/api/balance-requests", tags=["balance-requests"])

# Ҳамон каталоги чекҳои фармоиш (backend/uploads/receipts) —
# расм тавассути GET /uploads/receipts/{name} (танҳо админ) кушода мешавад
_RECEIPT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "uploads",
    "receipts",
)

_IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif")
_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
_RECEIPT_SECONDS = 60  # ⏱ вақти фиристодани чек: 1 дақиқа


def _out(req: BalanceRequest) -> TopupOut:
    # ⏱ мӯҳлат бо таърифи UTC (+00:00) — браузер ҳамчун UTC хонад, соат дуруст шавад
    deadline = (
        req.receipt_deadline.replace(tzinfo=timezone.utc)
        if req.receipt_deadline
        else None
    )
    return TopupOut(
        id=req.id,
        amount_tjs=req.amount_tjs,
        status=req.status,
        receipt_file=req.receipt_file,
        receipt_deadline=deadline,
        dc_ref=req.dc_ref,
        dc_payment_url=req.dc_payment_url,
        created_at=req.created_at,
        decided_at=req.decided_at,
    )


def _payment_url(user_id: int, amount, reference: str) -> str:
    """Линки пардохти DC City (ҳамон параметрҳои RentFrow: a/f1/c/s/f2/f3)."""
    return settings.PAYDC_URL + "?" + urlencode(
        [
            ("a", settings.PAYDC_ACCOUNT),
            ("f1", settings.PAYDC_ARTICUL),
            ("c", settings.PAYDC_DESCRIPTION),
            ("s", "%0.2f" % amount),
            ("f2", str(user_id)),
            ("f3", reference),
        ]
    )


# =====================================================================
# 1️⃣ ОМОДАСОЗИИ ПАРДОХТ — маблағ + линки pay.dc.tj + мӯҳлати чек
# =====================================================================
@router.post("", response_model=TopupPrepareOut)
def prepare_topup(
    request: Request,
    payload: TopupPrepareIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Корбар маблағро интихоб мекунад → линки пардохт + 1 дақиқа барои чек."""
    # 🚦 Маҳдудсозӣ: 6 дархост дар соат барои як корбар
    ratelimit.enforce(request, "topup", 6, 3600, identifier=str(user.id))

    if not settings.PAYDC_ENABLED:
        raise HTTPException(status_code=400, detail="Пардохти онлайн хомӯш аст")

    try:
        value = parse_amount(payload.amount)
    except TopupError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc

    # Дархостҳои кӯҳнаи бе чек → expired (як корбар = як дархости фаъол)
    db.execute(
        update(BalanceRequest)
        .where(
            BalanceRequest.user_id == user.id,
            BalanceRequest.status == BalanceRequestStatus.AWAITING,
        )
        .values(status=BalanceRequestStatus.EXPIRED)
    )

    reference = uuid.uuid4().hex[:24].upper()
    url = _payment_url(user.id, value, reference)
    deadline = datetime.utcnow() + timedelta(seconds=_RECEIPT_SECONDS)

    req = BalanceRequest(
        user_id=user.id,
        amount_tjs=value,
        status=BalanceRequestStatus.AWAITING,
        dc_ref=reference,
        dc_payment_url=url,
        receipt_deadline=deadline,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    logger.info(
        "💳 Пардохти дархост #%s аз user=%s: %s сомонӣ (ref=%s)",
        req.id, user.id, value, reference,
    )
    return TopupPrepareOut(
        id=req.id,
        amount_tjs=req.amount_tjs,
        payment_url=url,
        receipt_deadline=deadline.replace(tzinfo=timezone.utc),
    )


# =====================================================================
# 2️⃣ ЧЕКИ ПАРДОХТ — дар давоми 1 дақиқа → ба Telegram-и админ
# =====================================================================
@router.post("/{request_id}/receipt", response_model=TopupOut)
async def upload_topup_receipt(
    request: Request,
    request_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Расми чек → ҳолат pending → Telegram-и админ бо [Қабул]/[Рад]."""
    ratelimit.enforce(request, "topup_receipt", 10, 600, identifier=str(user.id))

    req = db.execute(
        select(BalanceRequest)
        .where(
            BalanceRequest.id == request_id,
            BalanceRequest.user_id == user.id,
        )
        .with_for_update()
    ).scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Дархост ёфт нашуд")

    if req.status != BalanceRequestStatus.AWAITING:
        raise HTTPException(
            status_code=409, detail="Ин дархост аллакай ҳал шудааст"
        )

    # ⏱ Вақти чек гузашт → expired
    if req.receipt_deadline and datetime.utcnow() > req.receipt_deadline:
        req.status = BalanceRequestStatus.EXPIRED
        db.commit()
        raise HTTPException(
            status_code=410,
            detail="Вақт гузашт (1 дақиқа) — дархости нав созед",
        )

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in _IMAGE_EXTS:
        raise HTTPException(
            status_code=422, detail="Файли расмӣ иҷозат дорад: jpg, png, webp, gif"
        )
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=422, detail="Файл холӣ аст")
    if len(raw) > _MAX_BYTES:
        raise HTTPException(status_code=422, detail="Аз 5 MB калон аст")

    # Номи беназир + нигоҳдорӣ дар uploads/receipts
    name = f"b{user.id}_{uuid.uuid4().hex[:10]}{ext}"
    os.makedirs(_RECEIPT_DIR, exist_ok=True)
    with open(os.path.join(_RECEIPT_DIR, name), "wb") as fh:
        fh.write(raw)

    req.receipt_file = f"/uploads/receipts/{name}"
    req.status = BalanceRequestStatus.PENDING
    db.commit()
    db.refresh(req)

    logger.info(
        "💳 Чек ба дархости #%s расид (user=%s, %s сомонӣ)",
        req.id, user.id, req.amount_tjs,
    )

    # 📩 Ба Telegram-и админ: расми чек + тугмаҳои [Қабул] [Рад]
    try:
        label = user.full_name or user.username or user.phone or f"#{user.id}"
        await telegram_service.notify_topup_request(
            request_id=req.id,
            user_label=label,
            amount=float(req.amount_tjs),
            receipt_file=req.receipt_file,
        )
    except Exception:  # noqa: BLE001 — Telegram набояд дархостро ноком созад
        logger.exception("Огоҳиномаи Telegram (topup #%s) ноком шуд", req.id)

    return _out(req)


# =====================================================================
# 📜 ДАРХОСТҲОИ МАН
# =====================================================================
@router.get("/mine", response_model=list[TopupOut])
def my_topups(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Рӯйхати дархостҳои худи корбар (аз навтарин)."""
    rows = db.scalars(
        select(BalanceRequest)
        .where(BalanceRequest.user_id == user.id)
        .order_by(BalanceRequest.id.desc())
        .limit(20)
    ).all()
    return [_out(r) for r in rows]
