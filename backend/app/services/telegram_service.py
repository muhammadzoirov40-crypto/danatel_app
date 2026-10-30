"""Фиристодани пасхатҳои Telegram (бот + admin)."""
from __future__ import annotations

import json
import logging
import os

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


def _bot_polling() -> bool:
    """Оё боти donatshop ҳоло дар Telegram polling мекунад?"""
    return os.getenv("DISABLE_TELEGRAM", "0") != "1"


def _approve_ui(prefix: str, ref_id: int) -> tuple[str, list[list[dict]]]:
    """Ҳангоми кори бот — тугмаҳои [Қабул][Рад] (callback).

    Агар боти donatshop ғайрифаъол бошад (пулакаи кӯҳна мувофиқ аст),
    тугмаҳои callback кор намекунанд → ба ҷои он тугмаи URL ба панели админ.
    """
    if _bot_polling():
        return (
            "Чекро санҷед ва аз ҳамин ҷо қабул ё рад кунед:",
            [
                [
                    {"text": "✅ Қабул", "callback_data": f"{prefix}:ok:{ref_id}"},
                    {"text": "❌ Рад", "callback_data": f"{prefix}:no:{ref_id}"},
                ]
            ],
        )
    url = f"{settings.FRONTEND_URL.rstrip('/')}/admin"
    buttons = (
        [[{"text": "📂 Панели админ", "url": url}]] if url.startswith("http") else []
    )
    return ("Чекро санҷед ва дар панели админ тасдиқ кунед:", buttons)


# =====================================================================
# 💳 ДАРХОСТИ ПУР КАРДАНИ БАЛАНС — расм + тугмаҳои [Қабул] [Рад]
# =====================================================================


async def send_photo_with_buttons(
    chat_id: str | int,
    photo_path: str,
    caption: str,
    buttons: list[list[dict]],
) -> bool:
    """📷 Расми чек бо тугмаҳои inline (callback)."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return False
    url = API.format(token=settings.TELEGRAM_BOT_TOKEN, method="sendPhoto")
    data = {
        "chat_id": str(chat_id),
        "caption": caption,
        "parse_mode": "HTML",
    }
    if buttons:
        data["reply_markup"] = json.dumps({"inline_keyboard": buttons})
    try:
        with open(photo_path, "rb") as fh:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, data=data, files={"photo": fh})
        if resp.status_code != 200:
            logger.error("Telegram sendPhoto хатогӣ: %s", resp.text[:300])
            return False
        return True
    except (httpx.HTTPError, OSError) as exc:
        logger.error("Telegram sendPhoto хатогӣ: %s", exc)
        return False


async def send_message_with_buttons(
    chat_id: str | int, text: str, buttons: list[list[dict]]
) -> bool:
    """📩 Паём бо тугмаҳои inline (фолбэк, агар расм нашавад)."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return False
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    }
    if buttons:
        payload["reply_markup"] = json.dumps({"inline_keyboard": buttons})
    return await _send("sendMessage", payload)


async def notify_topup_request(
    request_id: int,
    user_label: str,
    amount: float,
    receipt_file: str | None,
) -> bool:
    """💳 Дархости пур кардан → админ: расми чек + [Қабул] [Рад]."""
    if not settings.TELEGRAM_ADMIN_CHAT_ID:
        logger.warning(
            "TELEGRAM_ADMIN_CHAT_ID холӣ — дархост #%s ба Telegram намеравад",
            request_id,
        )
        return False

    hint, buttons = _approve_ui("topup", request_id)
    caption = (
        f"💳 <b>Дархости пур кардан #{request_id}</b>\n"
        f"👤 {user_label}\n"
        f"💰 {amount:.2f} сомонӣ\n\n"
        f"{hint}"
    )
    chat_id = settings.TELEGRAM_ADMIN_CHAT_ID

    if receipt_file:
        # "/uploads/receipts/x.png" → backend/uploads/receipts/x.png
        local = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "uploads",
            "receipts",
            os.path.basename(receipt_file),
        )
        if os.path.isfile(local) and await send_photo_with_buttons(
            chat_id, local, caption, buttons
        ):
            return True

    return await send_message_with_buttons(chat_id, caption, buttons)


# =====================================================================
# 🧾 ЧЕКИ ФАРМОИШ — расм + тугмаҳои [Қабул] [Рад] барои админ
# =====================================================================


def _receipt_local(receipt_file: str) -> str:
    """/uploads/receipts/x.png → backend/uploads/receipts/x.png"""
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "uploads",
        "receipts",
        os.path.basename(receipt_file),
    )


async def notify_order_receipt(
    order_id: int,
    game: str = "",
    product: str = "",
    player_id: str = "",
    amount: float = 0.0,
    receipt_file: str | None = None,
) -> bool:
    """🧾 Чеки фармоиш → админ: расми чек + [Қабул] [Рад]."""
    if not settings.TELEGRAM_ADMIN_CHAT_ID:
        logger.warning(
            "TELEGRAM_ADMIN_CHAT_ID холӣ — чеки фармоиш #%s ба Telegram намеравад",
            order_id,
        )
        return False

    hint, buttons = _approve_ui("order", order_id)
    caption = (
        f"🧾 <b>Чеки фармоиш #{order_id}</b>\n"
        f"🎮 Бозӣ: {game}\n"
        f"💎 Маҳсулот: {product}\n"
        f"🆔 ID: <code>{player_id}</code>\n"
        f"💰 Маблағ: {amount:.2f} сомонӣ\n\n"
        f"{hint}"
    )
    chat_id = settings.TELEGRAM_ADMIN_CHAT_ID

    if receipt_file:
        local = _receipt_local(receipt_file)
        if os.path.isfile(local) and await send_photo_with_buttons(
            chat_id, local, caption, buttons
        ):
            return True

    return await send_message_with_buttons(chat_id, caption, buttons)
