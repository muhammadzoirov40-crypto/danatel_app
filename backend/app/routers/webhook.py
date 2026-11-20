"""Вебхукҳо: DC Wallet (пардохт)."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ratelimit
from app.config import settings
from app.database import get_db
from app.models import Order, OrderStatus
from app.services import dc_push, dc_service, delivery, telegram_service

logger = logging.getLogger("webhook")
router = APIRouter(prefix="/api/webhook", tags=["webhook"])


@router.post("/dc")
async def dc_webhook(request: Request, db: Session = Depends(get_db)):
    """Посхат аз DC Wallet дар бораи натиҷаи пардохт."""
    try:
        payload = await request.json()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="JSON нодуруст") from exc

    # ---- Санҷиши имзо ----
    if not dc_service.verify_webhook_signature(payload):
        logger.warning("Имзои вебхуки DC нодуруст: %s", payload)
        raise HTTPException(status_code=401, detail="Имзо нодуруст")

    order_id_raw = payload.get("order_id") or payload.get("invoice_id")
    status_raw = str(payload.get("status", "")).lower()
    transaction_id = payload.get("transaction_id") or payload.get("payment_id")

    try:
        order_id = int(str(order_id_raw).replace("demo-", ""))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="order_id нодуруст")

    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Фармоиш ёфт нашуд")

    # ---- Навсозии статус ----
    if status_raw in ("paid", "success", "completed", "confirmed"):
        if order.status != OrderStatus.PAID:
            order.status = OrderStatus.PAID
            if transaction_id:
                order.transaction_id = str(transaction_id)
            db.commit()
            await telegram_service.notify_order_paid(
                order.id, order.telegram_chat_id, float(order.amount_tjs)
            )
    elif status_raw in ("failed", "error", "cancelled", "canceled"):
        order.status = OrderStatus.FAILED
        db.commit()
    elif status_raw in ("refunded", "refund"):
        order.status = OrderStatus.REFUNDED
        db.commit()

    return {"ok": True, "order_id": order.id, "status": order.status}


# =====================================================================
# 🔔 ПУШ-ОГОҲИНОМАИ DC АЗ ТЕЛЕФОН → ХУДКОР ТАСДИҚИ ПАРДОХТ
# =====================================================================
class PushPayload(BaseModel):
    """Пуш аз телефони соҳиб: унвон + матни огоҳиномаи DC."""

    title: str = ""
    body: str = ""


@router.post("/dc-push")
async def dc_push_webhook(
    payload: PushPayload,
    request: Request,
    x_secret_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """🔔 Огоҳиномаи DC (аз телефон) → худкор қабули дархости баланс.

    • `X-Secret-Token` бояд баробари `DC_PUSH_TOKEN` бошад (бе он → 403;
      токени холӣ → ҳама рад, то ки хатогии танзим пулро нодуруст
      қабул накунад);
    • аз матн маблағ + рақам → дархости ҳалнашудаи корбар → ҳамон
      `approve_topup` (баланс + audit + realtime + email);
    • мувофиқат нашуд → AuditLog + огоҳинома ба админ дар Telegram.
    """
    ip = request.client.host if request.client else "unknown"
    # 🚦 60 дархост дар дақиқа барои як IP
    ratelimit.enforce(request, "dc_push", 60, 60, identifier=ip)

    if (
        not settings.DC_PUSH_TOKEN
        or not x_secret_token
        or not hmac.compare_digest(x_secret_token, settings.DC_PUSH_TOKEN)
    ):
        logger.warning("DC push: токен нодуруст (IP=%s)", ip)
        raise HTTPException(status_code=403, detail="Тасдиқ нашуд")

    if not f"{payload.title} {payload.body}".strip():
        raise HTTPException(status_code=422, detail="Матн холӣ аст")

    result = dc_push.process_push(db, title=payload.title, body=payload.body)

    admin_text = result.pop("admin_text", None)
    if admin_text:
        try:
            await telegram_service.notify_admin(admin_text)
        except Exception:  # noqa: BLE001 — Telegram набояд ҷавобро бозмедорад
            logger.exception("Огоҳиномаи Telegram (dc push) ноком шуд")
    return result


# =====================================================================
# 🎯 LEAK STUDIO BD — вебхуки статуси фармоиш (order.status)
# =====================================================================
# Имзо: `X-LS-Signature: sha256=HMAC-SHA256(raw body, LEAKSTUDIO_API_KEY)`.
# URL дар панели Leak Studio насб мешавад (кори соҳиб). Мо танҳо:
#   completed → расонда (CAS аз `paid`)
#   cancelled → ноком + баргардони пул (CAS аз `paid`)
#   pending   → ҳеҷ кор (ҳанӯз расонда нашуда)
# Ҳамаи ҳолатҳои дигар → 2xx {"ok": true} то Leak Studio дубра фиристад.
@router.post("/leakstudio")
async def leakstudio_webhook(request: Request, db: Session = Depends(get_db)):
    """🔔 Статуси фармоиши Leak Studio → расонидан/баргардон (идемпотент)."""
    ip = request.client.host if request.client else "unknown"
    ratelimit.enforce(request, "ls_webhook", 60, 60, identifier=ip)

    if not settings.LEAKSTUDIO_API_KEY:
        # Калид нест → имзо санҷида намешавад → рад (бе иттилоот)
        raise HTTPException(status_code=400, detail="LEAKSTUDIO_API_KEY нест")

    raw = await request.body()
    sig = (request.headers.get("X-LS-Signature") or "").strip()
    expected = "sha256=" + hmac.new(
        settings.LEAKSTUDIO_API_KEY.encode("utf-8"), raw, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        logger.warning("LeakStudio webhook: имзо нодуруст (IP=%s)", ip)
        raise HTTPException(status_code=401, detail="Имзо тасдиқ нашуд")

    try:
        payload = json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="JSON нодуруст") from exc

    event = str(payload.get("event") or "")
    ls_order_id = str(payload.get("order_id") or "").strip()
    status = str(payload.get("status") or "").lower()
    if event != "order.status" or not ls_order_id:
        return {"ok": True, "skipped": True}

    # Ёфтани фармоиши мо: дар `pending` мо fl_ref='LSP:<order_id>' гузоштем
    order = db.scalar(select(Order).where(Order.fl_ref == f"LSP:{ls_order_id}"))
    if order is None:
        # Нодида гирифтан бехатар: 2xx → Leak Studio дубра намефиристад
        return {"ok": True, "skipped": True}

    if status == "completed":
        await delivery._finish(db, order.id, ls_order_id, provider="LeakStudio")
    elif status in ("cancelled", "canceled", "failed"):
        # Пул дар LS харҷ шудааст → баргардон ба баланси мизоҷи мо
        await delivery._fail(db, order.id, "ls_cancelled", provider="leakstudio")
    # pending → ҳанӯз расонда нашуд — интизорӣ
    return {"ok": True}
