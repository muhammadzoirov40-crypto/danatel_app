"""Фиристодани пасхатҳои Telegram (бот + admin)."""
from __future__ import annotations

import html
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


def user_label(user) -> str | None:
    """Ҳузвати харидор барои эълони админ: `Ном · @username · 📞 рақам`.

    Танҳо ҷузъҳои мавҷудбуда нишон дода мешаванд (ҳатто ягонҷузъ
    набуд → `#id`). Агар user холӣ бошад → None (сатр илова намешавад).

    Duck-typing — `app.models` намеорад, то хидмат аз моделҳо вобаста набошад.
    HTML-escape: номи корбар истифодабаранда аст → `<` набояд паёмро халал расонад.
    """
    if user is None:
        return None
    parts: list[str] = []
    name = str(getattr(user, "full_name", None) or "").strip()
    uname = str(getattr(user, "username", None) or "").strip().lstrip("@")
    phone = str(getattr(user, "phone", None) or "").strip()
    uid = getattr(user, "id", None)
    if name:
        parts.append(html.escape(name))
    if uname:
        parts.append("@" + html.escape(uname))
    if phone:
        parts.append("📞 " + html.escape(phone))
    if not parts and uid is not None:
        parts.append(f"#{uid}")
    return " · ".join(parts) if parts else None


async def notify_new_order(order_id: int, game: str, product: str,
                           player_id: str, amount: float,
                           buyer: str | None = None) -> None:
    """Огоҳинома дар бораи фармоиши нав.

    `buyer` — ҳузвати харидор аз `user_label()` (ном · @username · рақам);
    мизоҷи бе ҳисоб → None → сатр илова намешавад.
    """
    buyer_line = f"👤 Харидор: {buyer}\n" if buyer else ""
    await notify_admin(
        f"🆕 <b>Фармоиши нав #{order_id}</b>\n"
        f"{buyer_line}"
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


# =====================================================================
# 💳 ДАРХОСТИ ПУР КАРДАНИ БАЛАНС — ХУДКОР ҚАБУЛ: танҳо хабар ба админ
#    (талаби соҳиб 09.11.2026: «аз Telegram қабул намекунам» —
#    қабул худкор мешавад, Telegram фақат огоҳинома + возвратка)
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


async def notify_topup_auto(
    request_id: int,
    user_label: str,
    amount: float,
    receipt_file: str | None,
    new_balance: float | None = None,
) -> bool:
    """✅ Чек → худкор қабул: танҳо хабар ба админ (бе тугмаҳои қабул/рад).

    Тугмаи «🔄 Боз гирифт» танҳо ҳангоми кори бот боқӣ мемонад —
    барои бекор кардани ҳолати ғайримустақим (пули барқароршаванда),
    на барои қабул.
    """
    if not settings.TELEGRAM_ADMIN_CHAT_ID:
        logger.warning(
            "TELEGRAM_ADMIN_CHAT_ID холӣ — дархост #%s ба Telegram намеравад",
            request_id,
        )
        return False

    bal_line = (
        f"\n🏦 Баланс: {new_balance:.2f} сомонӣ"
        if new_balance is not None
        else ""
    )
    caption = (
        f"✅ <b>Чек қабул ШУД (худкор)</b>\n"
        f"💳 Дархости пур кардан #{request_id}\n"
        f"👤 {user_label}\n"
        f"💰 {amount:.2f} сомонӣ → баланс зиёд шуд{bal_line}\n\n"
        f"Тасдиқи дастӣ лозим нест — тугмаҳои [Қабул]/[Рад] нест."
    )
    buttons: list[list[dict]] = []
    if _bot_polling():
        buttons = [
            [
                {
                    "text": "🔄 Боз гирифт",
                    "callback_data": f"topup:revert:{request_id}",
                }
            ]
        ]
    chat_id = settings.TELEGRAM_ADMIN_CHAT_ID

    if receipt_file:
        local = _receipt_local(receipt_file)
        if os.path.isfile(local) and await send_photo_with_buttons(
            chat_id, local, caption, buttons
        ):
            return True

    return await send_message_with_buttons(chat_id, caption, buttons)


# =====================================================================
# 🧾 ЧЕКИ ФАРМОИШ — ХУДКОР ТАСДИҚ: танҳо хабар ба админ (бе тугмаҳо)
# =====================================================================


def _receipt_local(receipt_file: str) -> str:
    """/uploads/receipts/x.png → backend/uploads/receipts/x.png"""
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "uploads",
        "receipts",
        os.path.basename(receipt_file),
    )


async def notify_order_auto(
    order_id: int,
    game: str = "",
    product: str = "",
    player_id: str = "",
    amount: float = 0.0,
    receipt_file: str | None = None,
    buyer: str | None = None,
) -> bool:
    """✅ Чеки фармоиш → худкор тасдиқ: танҳо хабар (бе тугмаҳо).

    Талаби соҳиб (09.11.2026): «аз Telegram қабул намекунам» —
    чек расид → фармоиш худкор `paid` → поллер худкор иҷро мекунад.
    `buyer` — ҳузвати харидор (ном · @username · рақам), агар мавҷуд бошад.
    """
    if not settings.TELEGRAM_ADMIN_CHAT_ID:
        logger.warning(
            "TELEGRAM_ADMIN_CHAT_ID холӣ — чеки фармоиш #%s ба Telegram намеравад",
            order_id,
        )
        return False

    buyer_line = f"👤 Харидор: {buyer}\n" if buyer else ""
    caption = (
        f"✅ <b>Фармоиш #{order_id} — пардохт тасдиқ шуд (худкор)</b>\n"
        f"{buyer_line}"
        f"🎮 Бозӣ: {game}\n"
        f"💎 Маҳсулот: {product}\n"
        f"🆔 ID: <code>{player_id}</code>\n"
        f"💰 Маблағ: {amount:.2f} сомонӣ\n\n"
        f"Тасдиқи дастӣ лозим нест — тугмаҳои [Қабул]/[Рад] нест. "
        f"Маҳсулот худкор иҷро мешавад."
    )
    chat_id = settings.TELEGRAM_ADMIN_CHAT_ID

    if receipt_file:
        local = _receipt_local(receipt_file)
        if os.path.isfile(local) and await send_photo_with_buttons(
            chat_id, local, caption, []
        ):
            return True

    return await send_message_with_buttons(chat_id, caption, [])
