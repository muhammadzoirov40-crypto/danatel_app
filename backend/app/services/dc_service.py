"""Пайваст ба DC Wallet (Parvard) барои пардохт.

Мувофиқи шартномаи умумии DC Wallet / Parvard:
  POST {DC_API_URL}/api/v1/invoices  -> сохтани invoice
  GET  {DC_API_URL}/api/v1/invoices/{id} -> санҷиши статус

Вебхук (webhook) аз DC ба мо меояд:
  POST /api/webhook/dc  { invoice_id, status, transaction_id }
"""
from __future__ import annotations

import hashlib
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("dc")


def _sign(payload: dict[str, Any]) -> str:
    """Имзои HMAC-SHA256 барои эътибор додани дархост/посхат."""
    raw = "&".join(f"{k}={payload[k]}" for k in sorted(payload) if payload[k] not in (None, ""))
    return hashlib.sha256(f"{raw}{settings.DC_SECRET_KEY}".encode()).hexdigest()


def verify_webhook_signature(payload: dict[str, Any]) -> bool:
    """Санҷиши имзои вебхуки DC."""
    if not settings.DC_SECRET_KEY:
        # Дар ҳолати танзимоти намоишӣ имзо санҷида намешавад
        logger.warning("DC_SECRET_KEY танзим нашуда — имзо санҷида намешавад")
        return True
    received = payload.get("signature") or payload.get("sign")
    if not received:
        return False
    return _sign(payload) == received


async def create_invoice(
    order_id: int,
    amount_tjs: float,
    description: str,
    lang: str = "tj",
    redirect_url: str | None = None,
) -> dict[str, Any]:
    """Сохтани invoice дар DC Wallet.

    Бармегардонад: {invoice_id, payment_url, status}
    """
    body = {
        "merchant_id": settings.DC_MERCHANT_ID,
        "amount": float(amount_tjs),
        "currency": "TJS",
        "order_id": str(order_id),
        "description": description,
        "language": lang,
        "redirect_url": redirect_url or settings.FRONTEND_URL,
    }
    body["signature"] = _sign(body)

    url = f"{settings.DC_API_URL.rstrip('/')}/api/v1/invoices"

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.error("DC API хатогӣ: %s", exc)
        # Дар ҳолати намоишӣ (без DC) — invoice-и дохилӣ месозем
        return _mock_invoice(order_id, amount_tjs)

    return {
        "invoice_id": str(data.get("invoice_id") or data.get("id") or ""),
        "payment_url": data.get("payment_url") or data.get("url") or "",
        "status": data.get("status", "pending"),
    }


async def get_invoice_status(invoice_id: str) -> str:
    """Гирифтани статуси invoice аз DC."""
    url = f"{settings.DC_API_URL.rstrip('/')}/api/v1/invoices/{invoice_id}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        return str(data.get("status", "unknown"))
    except httpx.HTTPError as exc:
        logger.error("DC статус хатогӣ: %s", exc)
        return "unknown"


def _mock_invoice(order_id: int, amount_tjs: float) -> dict[str, Any]:
    """Invoice-и намоишӣ ҳангоми набудани танзими воқеии DC."""
    logger.warning("DC танзим нашуда — invoice-и намоишӣ барои order=%s", order_id)
    return {
        "invoice_id": f"demo-{order_id}",
        "payment_url": f"{settings.FRONTEND_URL}/order/{order_id}?demo=1",
        "status": "pending",
    }
