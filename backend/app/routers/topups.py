"""
💳 ДАРХОСТИ ПУР КАРДАНИ БАЛАНС (корбар → чек → тасдиқи админ).

Корбар миқдорро ворид мекунад + расми чеки пардохтро мефиристад →
ба админ дар Telegram расм бо тугмаҳои [Қабул]/[Рад] меояд ва дар
админ-панел (веб/мобил) ҳам нишон дода мешавад.
"""
from __future__ import annotations

import logging
import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ratelimit
from app.database import get_db
from app.models import BalanceRequest, User
from app.schemas import TopupOut
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


def _out(req: BalanceRequest) -> TopupOut:
    return TopupOut(
        id=req.id,
        amount_tjs=req.amount_tjs,
        status=req.status,
        receipt_file=req.receipt_file,
        created_at=req.created_at,
        decided_at=req.decided_at,
    )


# =====================================================================
# ➕ СОХТАНИ ДАРХОСТ (маблағ + чек)
# =====================================================================
@router.post("", response_model=TopupOut)
async def create_topup(
    request: Request,
    amount: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Корбар «баланси манро пур кун» → миқдор + расми чек.

    Дархост `pending` мемонад → Telegram-и админ бо расм + тугмаҳо.
    """
    # 🚦 Маҳдудсозӣ: 6 дархост дар соат барои як корбар
    ratelimit.enforce(request, "topup", 6, 3600, identifier=str(user.id))

    try:
        value = parse_amount(amount)
    except TopupError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc

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

    req = BalanceRequest(
        user_id=user.id,
        amount_tjs=value,
        receipt_file=f"/uploads/receipts/{name}",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    logger.info(
        "💳 Дархости пур кардан #%s аз user=%s: %s сомонӣ",
        req.id, user.id, value,
    )

    # 📩 Ба Telegram-и админ: расми чек + тугмаҳои [Қабул] [Рад]
    try:
        label = user.full_name or user.username or user.phone or f"#{user.id}"
        await telegram_service.notify_topup_request(
            request_id=req.id,
            user_label=label,
            amount=float(value),
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
