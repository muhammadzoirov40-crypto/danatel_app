"""
🔔 Пуш-огоҳиномаҳои DC Wallet → худкор тасдиқи пардохти баланс.

Талаби соҳиб (05.11.2026): дар телефони соҳиб барномаи ҳамоҳангсоз
(масалан Tasker + AutoNotification) огоҳиномаҳои DC-ро дар бораи
воридшавии пул мегирад ва ба сервер мефиристад:

    POST /api/webhook/dc-push
    Headers: X-Secret-Token: <DC_PUSH_TOKEN>
    Body:    {"title": "...", "body": "..."}

Сервер аз матн МАБЛАҒ (TJS / сомонӣ) ва РАҚАМИ фиристодагиро меёбад,
дархости ҳалнашудаи ҳамон корбарро бо ҳамон маблағ қабул мекунад
(баъди қабул баланс дар як transaction бо сабти таърих зиёд мешавад —
ҳамон `approve_topup`, ки админ аз веб/Telegram истифода мебарад).

Амният:
  • токени махфӣ DC_PUSH_TOKEN (hmac.compare_digest) + rate-limit;
  • танҳо дархостҳои ҲАЛНАШУДА (awaiting_receipt / pending) қабул
    мешаванд → такрори такрорӣ бе пули дубора бехатар (approve бо қулф);
  • мувофиқат НАШУД → AuditLog + огоҳинома ба админ дар Telegram →
    ҳамон ҷараёни дастии имрӯза (чек → [Қабул]) идома меёбад.

⚠️ Фармоишҳои бозӣ (DC) бо ин роҳ НАВОБАСТ карда намешаванд: статуси
   «пардохтшуда»-и фармоиш → иҷрои беподарона (маҳсулот рафтанаш мумкин),
   балансро танҳо рост кардан мумкин. Фармоишҳо ҳамон тавр тасдиқи
   дастӣ мешаванд.
"""
from __future__ import annotations

import html
import logging
import re
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditLog,
    BalanceRequest,
    BalanceRequestStatus,
    User,
)
from app.services import topups

logger = logging.getLogger("dc_push")

# Маблағ: «25 TJS», «25.00 TJS», «25,50 сомонӣ», «1000 сомони»
_AMOUNT_RE = re.compile(
    r"(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:TJS|сомонӣ|сомони)",
    re.IGNORECASE,
)

# Рақам: «+992900123456», «992 900 12 34 56», «900 12 34 56», «+7 701…».
# Рақами ҳисоби/корти DC (16 рақам, масалан 9762000220865843) ҲАТМАН
# ҷудо мешавад: қабул танҳо 9 рақам (=992) ё 10–15 рақам бо «+»/«992».
_PHONE_RE = re.compile(r"(?<!\d)\+?\d[\d\s\-()]{6,22}\d(?!\d)")

_MAX_AMOUNT = Decimal("100000")


# =====================================================================
# 🔍 Хондани матни пуш
# =====================================================================
def extract_amount(text: str) -> Decimal | None:
    """Маблағи пардохт аз матн (TJS / сомонӣ) ё None."""
    m = _AMOUNT_RE.search(text)
    if not m:
        return None
    try:
        value = Decimal(m.group(1).replace(",", ".")).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None
    if value <= 0 or value > _MAX_AMOUNT:
        return None
    return value


def extract_phones(text: str) -> list[str]:
    """Номзадҳои рақами фиристодагиро (нормалшуда) меёбад.

    9 рақам → «992…» (Тоҷикистон); 10–15 рақам танҳо бо «+» ё оғози
    «992» → ҳамон тавр. Рақами ҳисоби 16-рақамӣ қабул намешавад.
    """
    out: list[str] = []
    for m in _PHONE_RE.finditer(text):
        digits = re.sub(r"\D", "", m.group(0))
        cand: str | None = None
        if len(digits) == 9:
            cand = "992" + digits
        elif 10 <= len(digits) <= 15 and (
            m.group(0).startswith("+") or digits.startswith("992")
        ):
            cand = digits
        if cand and cand not in out:
            out.append(cand)
    return out


def _unmatched(
    db: Session,
    amount: Decimal,
    phones: list[str],
    text: str,
    reason: str,
) -> dict:
    """Бе мувофиқат: AuditLog + матни огоҳинома барои админ (Telegram)."""
    detail = (
        f"+{amount} TJS | phones={','.join(phones) or '—'} | {reason} | {text[:300]}"
    )
    db.add(
        AuditLog(
            admin_id=None,
            action="dc_push_unmatched",
            entity="payment_push",
            details=detail,
        )
    )
    db.commit()
    logger.warning("DC push бе мувофиқат: %s", detail)
    admin_text = (
        "🔔 <b>Пардохти DC: %s TJS</b>\n"
        "Рақам: %s\n"
        "Сабаб: %s\n"
        "Матн: %s\n\n"
        "Тасдиқи дастӣ лозим НЕСТ — чеки корбар худкор қабул мешавад; "
        "ин танҳо огоҳинома аст."
        % (
            amount,
            ", ".join(phones) or "—",
            html.escape(reason),
            html.escape(text[:400]),
        )
    )
    return {
        "status": "not_found",
        "reason": reason,
        "amount": float(amount),
        "admin_text": admin_text,
    }


# =====================================================================
# 🔔 Коркарди пуш
# =====================================================================
def process_push(db: Session, *, title: str = "", body: str = "") -> dict:
    """Як пуш → қабули дархост / такрорӣ / бе мувофиқат / нодида.

    Бармегардонад: {"status": "success"|"already"|"not_found"|"ignored", ...}
    барои `not_found` — калиди `admin_text` (Telegram ба админ дар endpoint).
    """
    text = f"{title or ''} {body or ''}".strip()

    amount = extract_amount(text)
    if amount is None:
        logger.info("DC push: маблағ ёфт нашуд — %s", text[:120])
        return {"status": "ignored", "reason": "amount_not_found"}

    phones = extract_phones(text)
    user: User | None = None
    for cand in phones:
        user = db.scalar(select(User).where(User.phone == cand))
        if user is not None:
            break

    if user is None:
        return _unmatched(
            db, amount, phones, text, "корбар бо ин рақам ёфт нашуд"
        )

    # Дархости ҳалнашудаи ҳамон корбар бо ҳамон маблағ (навтарин)
    req = db.scalars(
        select(BalanceRequest)
        .where(
            BalanceRequest.user_id == user.id,
            BalanceRequest.amount_tjs == amount,
            BalanceRequest.status.in_(
                [BalanceRequestStatus.AWAITING, BalanceRequestStatus.PENDING]
            ),
        )
        .order_by(BalanceRequest.id.desc())
    ).first()

    if req is None:
        # Такрори такрорӣ: ҳамон корбар+маблағ аллакай 48 соат қабул
        # шудааст → бе огоҳиномаи админ ором гузарем
        since = datetime.utcnow() - timedelta(hours=48)
        done = db.scalars(
            select(BalanceRequest)
            .where(
                BalanceRequest.user_id == user.id,
                BalanceRequest.amount_tjs == amount,
                BalanceRequest.status == BalanceRequestStatus.APPROVED,
                BalanceRequest.decided_at >= since,
            )
            .order_by(BalanceRequest.id.desc())
        ).first()
        if done is not None:
            logger.info(
                "DC push: такрорӣ барои дархости #%s — бе амал", done.id
            )
            return {
                "status": "already",
                "request_id": done.id,
                "user_id": user.id,
            }
        return _unmatched(
            db, amount, phones, text, "дархости ҳалнашуда ёфт нашуд"
        )

    # Чек лозим нест: худи пуш далели пардохт аст → AWAITING ҳам
    # ба pending мегузарад ва дар ҳамон як қабул ҳал мешавад
    if req.status == BalanceRequestStatus.AWAITING:
        req.status = BalanceRequestStatus.PENDING

    try:
        decided, updated_user = topups.approve_topup(db, req.id, via="dc_push")
    except topups.TopupAlreadyDecided:
        db.rollback()  # тағйири маҳаллӣ (AWAITING→PENDING) бекор
        return {"status": "already", "request_id": req.id, "user_id": user.id}
    except topups.TopupError as exc:
        db.rollback()
        return _unmatched(db, amount, phones, text, f"хатогии қабул: {exc}")

    logger.info(
        "🔔 DC push: дархости #%s қабул шуд → user=%s +%s TJS",
        decided.id, user.id, decided.amount_tjs,
    )
    return {
        "status": "success",
        "request_id": decided.id,
        "user_id": user.id,
        "amount": float(decided.amount_tjs),
        "balance": float(updated_user.balance),
    }


# =====================================================================
# 💬 ҶАВОБ БА БОТ (4 забон) + муайянкунандаи матни пардохт
# =====================================================================
# Ҳамон вебхук, ки боти Telegram (форвард/нусхаи матни DC аз чати
# админ) истифода мебарад — формати ҷавобҳо дар якҷо нигоҳ дошта
# мешавад, то веб ва бот як забон бошанд.

_PAY_HINT = re.compile(r"TJS|сомонӣ|сомони", re.IGNORECASE)

_REPLIES: dict[str, dict[str, str]] = {
    "success": {
        "tj": "✅ Пардохт қабул шуд: <b>{amount} TJS</b>\nБаланс: <b>{balance} TJS</b>",
        "ru": "✅ Платёж принят: <b>{amount} TJS</b>\nБаланс: <b>{balance} TJS</b>",
        "en": "✅ Payment accepted: <b>{amount} TJS</b>\nBalance: <b>{balance} TJS</b>",
        "uz": "✅ To'lov qabul qilindi: <b>{amount} TJS</b>\nBalans: <b>{balance} TJS</b>",
    },
    "already": {
        "tj": "♻️ Аллакай қабул шудааст — баланс дубора зиёд нашуд.",
        "ru": "♻️ Уже принято — баланс повторно не увеличен.",
        "en": "♻️ Already accepted — balance was not increased again.",
        "uz": "♻️ Allaqabon qilingan — balans qayta oshirilmadi.",
    },
    "ignored": {
        "tj": (
            "⚠️ Маблағ дар матн ёфт нашуд.\n"
            "Формат: <code>25.00 TJS</code> ё <code>25 сомонӣ</code> "
            "+ рақами фиристодагар."
        ),
        "ru": (
            "⚠️ Сумма в тексте не найдена.\n"
            "Формат: <code>25.00 TJS</code> или <code>25 сомони</code> "
            "+ номер отправителя."
        ),
        "en": (
            "⚠️ Amount not found in text.\n"
            "Format: <code>25.00 TJS</code> or <code>25 somoni</code> "
            "+ sender number."
        ),
        "uz": (
            "⚠️ Summa matndan topilmadi.\n"
            "Format: <code>25.00 TJS</code> yoki <code>25 somoni</code> "
            "+ yuboruvchi raqami."
        ),
    },
    "not_found": {
        "tj": (
            "❌ Дархости мувофиқ ёфт нашуд ({amount} TJS).\n"
            "Матн дар таърих сабт шуд — чеки корбар худкор қабул мешавад."
        ),
        "ru": (
            "❌ Подходящий запрос не найден ({amount} TJS).\n"
            "Текст записан в историю — чек клиента подтверждается автоматически."
        ),
        "en": (
            "❌ No matching request ({amount} TJS).\n"
            "Text logged — the customer's receipt is confirmed automatically."
        ),
        "uz": (
            "❌ Mos so'rov topilmadi ({amount} TJS).\n"
            "Matn tarixga yozildi — mijoz cheki avtomatik tasdiqlanadi."
        ),
    },
}


def looks_like_push(text: str) -> bool:
    """Матн эҳтимолан огоҳиномаи пардохт аст (TJS / сомонӣ)."""
    return bool(_PAY_HINT.search(text or ""))


def _num(value: Any) -> str:
    """25.00 → «25», 25.50 → «25.5» (барои ҷавоби бот)."""
    try:
        return f"{float(value):.2f}".rstrip("0").rstrip(".")
    except (TypeError, ValueError):
        return "—"


def format_reply(result: dict, lang: str = "tj") -> str:
    """Ҷавоби кӯтоҳ барои бот аз натиҷаи `process_push` (HTML)."""
    status = str(result.get("status") or "ignored")
    table = _REPLIES.get(status, _REPLIES["ignored"])
    tpl = table.get(lang) or table["tj"]
    return tpl.format(
        amount=_num(result.get("amount")),
        balance=_num(result.get("balance")),
    )
