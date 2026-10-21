"""Вебхукҳо: DC Wallet (пардохт)."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Order, OrderStatus
from app.services import dc_service, telegram_service

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
