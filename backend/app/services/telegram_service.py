"""Фиристодани пасхатҳои Telegram (бот + admin)."""
from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger("telegram")

API = "https://api.telegram.org/bot{token}/{method}"


async def _send(method: str, payload: dict) -> bool:
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN танзим нашуда")
        return False
    url = API.format(token=settings.TELEGRAM_BOT_TOKEN, method=method)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                logger.error("Telegram %s хатогӣ: %s", method, resp.text)
                return False
        return True
    except httpx.HTTPError as exc:
        logger.error("Telegram хатогӣ: %s", exc)
        return False


async def send_message(chat_id: str | int, text: str, parse_mode: str = "HTML") -> bool:
    """Пасхат ба корбар."""
    return await _send("sendMessage", {"chat_id": chat_id, "text": text, "parse_mode": parse_mode})


async def notify_admin(text: str) -> None:
    """Огоҳинома ба админ."""
    if settings.TELEGRAM_ADMIN_CHAT_ID:
        await send_message(settings.TELEGRAM_ADMIN_CHAT_ID, text)


async def notify_new_order(order_id: int, game: str, product: str,
                           player_id: str, amount: float) -> None:
    """Огоҳинома дар бораи фармоиши нав."""
    await notify_admin(
        f"🆕 <b>Фармоиши нав #{order_id}</b>\n"
        f"🎮 Бозӣ: {game}\n"
        f"💎 Маҳсулот: {product}\n"
        f"🆔 ID: <code>{player_id}</code>\n"
        f"💰 Маблағ: {amount:.2f} сомонӣ"
    )


async def notify_order_paid(order_id: int, chat_id: str | None, amount: float) -> None:
    """Огоҳинома дар бораи пардохт."""
    text = f"✅ <b>Фармоиш #{order_id} пардохт шуд!</b>\n💰 {amount:.2f} сомонӣ"
    if chat_id:
        await send_message(chat_id, text)
    await notify_admin(text)


async def notify_order_delivered(order_id: int, chat_id: str | None) -> None:
    """Огоҳинома дар бораи расидани маҳсулот."""
    text = f"🎮 <b>Фармоиш #{order_id} расид!</b>\nМаҳсулот ба ҳисоби шумо ворид шуд."
    if chat_id:
        await send_message(chat_id, text)
    await notify_admin(text)
