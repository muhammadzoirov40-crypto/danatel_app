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


# =====================================================================
# 💳 ДАРХОСТИ ПУР КАРДАНИ БАЛАНС — чек = ДАЛЕЛ, танҳо хабар ба админ
#    (талаби соҳиб 09.11.2026: «то пул ба корти ман накунад — баланс
#    пур нашавад» → бе тугмаҳои қабул; қабул аз пуш DC / панели админ)
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


async def notify_topup_receipt(
    request_id: int,
    user_label: str,
    amount: float,
    receipt_file: str | None,
) -> bool:
    """🧾 Чек расид → хабар ба админ + ТУГМАҲОи қабул/рад.

    Талаби соҳиб (09.11.2026): «то пул ба корти ман накунад — баланс
    пур нашавад» → қабул танҳо: худкор аз пуш DC (пули воқеӣ) ё тасдиқи
    ДАСТИИ админ. Талаби нави соҳиб (11.11.2026 «чаро қабул/рад нест»):
    тугмаҳои ✅ Қабул / ❌ Рад дар ҳамон паёми Telegram → аз инҷо ростқавл
    қабул/рад мешавад (бот `topup:ok` / `topup:reject` → ҳамон
    `approve_topup` / `reject_topup`, audit + `via="telegram"`).
    """
    if not settings.TELEGRAM_ADMIN_CHAT_ID:
        logger.warning(
            "TELEGRAM_ADMIN_CHAT_ID холӣ — дархост #%s ба Telegram намеравад",
            request_id,
        )
        return False

    caption = (
        f"🧾 <b>Чек расид — далел</b>\n"
        f"💳 Дархости пур кардан #{request_id}\n"
        f"👤 {user_label}\n"
        f"💰 {amount:.2f} сомонӣ\n\n"
        f"⚠️ Баланс НАМЕАФЗАД: танҳо пас аз расидани пули воқеӣ ба корт "
        f"(пуш DC худкор) ё тасдиқи ДАСТИИ шумо — тугмаҳо дар ҳамин "
        f"ҷо ё панели админ."
    )
    # ✅/❌ тугмаҳои inline → боти админ ҳамон `approve_topup` /
    # `reject_topup`-ро иҷро мекунад (тҳано чати админ; ғайриадмин ⛔).
    buttons: list[list[dict]] = [
        [
            {"text": "✅ Қабул", "callback_data": f"topup:ok:{request_id}"},
            {"text": "❌ Рад", "callback_data": f"topup:reject:{request_id}"},
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
# 🧾 ЧЕКИ ФАРМОИШ — фармоиш `checking` + тугмаҳои ✅/❌ барои админ
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
    buyer: str | None = None,
) -> bool:
    """🧾 Чеки фармоиш расид → хабар + ТУГМАҲОи қабул/рад.

    Талаби соҳиб (09.11.2026): «то пул ба корти ман накунад» — тасдиқ
    танҳо ДАСТИӢ (панели админ). Талаби нави соҳиб (11.11.2026 «дар инҷо
    ҳам қабул/рад бошад»): тугмаҳои ✅/❌ дар ҳамон паёми Telegram →
    бот `order:ok` / `order:reject` → ҳамон тасдиқи дастӣ: `paid` ё
    `failed` + audit (бе ягон худкорӣ; танҳо чати админ).
    `buyer` — ҳузвати харидор (ном · @username · рақам).
    """
    if not settings.TELEGRAM_ADMIN_CHAT_ID:
        logger.warning(
            "TELEGRAM_ADMIN_CHAT_ID холӣ — чеки фармоиш #%s ба Telegram намеравад",
            order_id,
        )
        return False

    buyer_line = f"👤 Харидор: {buyer}\n" if buyer else ""
    caption = (
        f"🧾 <b>Чеки фармоиш #{order_id} расид — далел</b>\n"
        f"{buyer_line}"
        f"🎮 Бозӣ: {game}\n"
        f"💎 Маҳсулот: {product}\n"
        f"🆔 ID: <code>{player_id}</code>\n"
        f"💰 Маблағ: {amount:.2f} сомонӣ\n\n"
        f"Фармоиш дар ҳолати «checking» — тасдиқ танҳо пас аз пардохти "
        f"воқеӣ: тугмаҳо дар ҳамин ҷо ё панели админ."
    )
    # ✅/❌ inline → боти админ (`cb_order`) фармоишро `paid`/`failed`
    # мекунад (тҳано чати админ; ғайриадмин ⛔; ҳалшуда → манъ).
    buttons: list[list[dict]] = [
        [
            {"text": "✅ Қабул", "callback_data": f"order:ok:{order_id}"},
            {"text": "❌ Рад", "callback_data": f"order:reject:{order_id}"},
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
