"""
💳 Дархостҳои пур кардани баланс: қабул / радкунӣ.

ЯК хидмат барои ҳам веб (админ-панел) ва ҳам боти Telegram —
дархост танҳо ЯК дафъа ҳал мешавад (бо қулфи сатр), пас аз қабул
баланс дар як transaction бо сабти таърих зиёд мешавад.
"""
from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditLog,
    BalanceRequest,
    BalanceRequestStatus,
    User,
)
from app.services import wallet

logger = logging.getLogger("topups")


# =====================================================================
# ❌ Хатогиҳо
# =====================================================================
class TopupError(Exception):
    """Пайдавии қабул/радкунии дархост."""

    status = 400

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        if status is not None:
            self.status = status


class TopupNotFound(TopupError):
    status = 404


class TopupAlreadyDecided(TopupError):
    status = 409


# =====================================================================
# 🔍 ЯРДАМЧӢҲО
# =====================================================================
def parse_amount(value) -> Decimal:
    """Санҷиши маблағ: 0.01 … 999999999.99 (сомонӣ)."""
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError) as exc:
        raise TopupError("Маблағ нодуруст аст", 422) from exc
    if amount <= Decimal("0.00"):
        raise TopupError("Маблағ бояд аз сифат зиёд бошад", 422)
    if amount > Decimal("999999999.99"):
        raise TopupError("Маблағ аз ҳад зиёд аст", 422)
    return amount


def _admin_for(db: Session, admin_user_id: int | None) -> int | None:
    """ID-и админ барои сабти таърих (аз Telegram — аккаунти пайвастшуда)."""
    if admin_user_id:
        return admin_user_id
    fallback = db.scalar(
        select(User).where(User.is_admin.is_(True)).order_by(User.id)
    )
    return fallback.id if fallback else None


def admin_id_for_chat(db: Session, chat_id: int | str) -> int | None:
    """Админ аз ID-и чати Telegram: аккаунти пайвастшуда → аввалин админ."""
    user = db.scalar(select(User).where(User.telegram_id == str(chat_id)))
    if user is not None and user.is_admin:
        return user.id
    return _admin_for(db, None)


def _load_locked(db: Session, request_id: int) -> BalanceRequest:
    """Дархост бо қулфи сатр (муқоисаи ҳамзамон аз веб ё Telegram)."""
    req = db.execute(
        select(BalanceRequest)
        .where(BalanceRequest.id == request_id)
        .with_for_update()
    ).scalar_one_or_none()
    if req is None:
        raise TopupNotFound("Дархост ёфт нашуд")
    return req


# =====================================================================
# ✅ ҚАБУЛ — баланс + маблағ
# =====================================================================
def approve_topup(
    db: Session,
    request_id: int,
    *,
    admin_user_id: int | None = None,
    via: str = "web",
) -> tuple[BalanceRequest, User]:
    """Ҷойгузинии ҳолат → approved + иловаи баланс дар ЯК transaction.

    Агар барнома аз веб ва ҳам аз Telegram ҳамзамон қабул кунад —
    яке TopupAlreadyDecided (409) мегирад, баланс ЯК бор зиёд мешавад.
    """
    req = _load_locked(db, request_id)
    if req.status == BalanceRequestStatus.AWAITING:
        raise TopupError("Корбари ҳанӯз чек навастодааст", 409)
    if req.status != BalanceRequestStatus.PENDING:
        raise TopupAlreadyDecided("Дархост аллакай ҳал шудааст")
    if req.user_id is None:
        raise TopupError("Корбари дархост ёфт нашуд", 404)

    admin_id = _admin_for(db, admin_user_id)

    # Ҳолат + audit ПЕШ аз credit → ҳама дар як commit;
    # агар credit ноком шавад → ROLLBACK → ҳолат ҳам барқарор мешавад
    req.status = BalanceRequestStatus.APPROVED
    req.decided_by_id = admin_id
    req.decided_at = datetime.utcnow()
    db.add(
        AuditLog(
            admin_id=admin_id,
            action="topup_approve",
            entity="balance_request",
            entity_id=str(req.id),
            details=f"+{req.amount_tjs} TJS | user={req.user_id} | {via}",
        )
    )

    user, _entry = wallet.credit_balance(
        db,
        user_id=req.user_id,
        amount=req.amount_tjs,
        reason=f"Дархости пур кардан #{req.id} ({via})",
        admin_id=admin_id or 0,
    )

    # 📧 Email-и огоҳинома (агар SMTP танзим бошад) — ҳеҷ гоҳ хатогӣ نакунад
    if user.email:
        try:
            from app.services.email_service import send_balance_topup_email

            send_balance_topup_email(
                to_email=user.email,
                user_id=user.id,
                amount_added=float(req.amount_tjs),
                new_balance=float(user.balance),
                date_str=datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
            )
        except Exception:  # noqa: BLE001
            logger.warning("Email-и огоҳинома ноком шуд (topup #%s)", req.id)

    logger.info(
        "💳 Дархости #%s қабул шуд (%s): +%s → %s",
        req.id, via, req.amount_tjs, user.balance,
    )
    db.refresh(req)
    return req, user


# =====================================================================
# ❌ РАД — баланс тағйир намеёбад
# =====================================================================
def reject_topup(
    db: Session,
    request_id: int,
    *,
    admin_user_id: int | None = None,
    via: str = "web",
) -> BalanceRequest:
    """Радкунии дархост — баланс ҲЕҶ гуна тағйир намеёбад."""
    req = _load_locked(db, request_id)
    if req.status == BalanceRequestStatus.AWAITING:
        raise TopupError("Корбари ҳанӯз чек навастодааст", 409)
    if req.status != BalanceRequestStatus.PENDING:
        raise TopupAlreadyDecided("Дархост аллакай ҳал шудааст")

    admin_id = _admin_for(db, admin_user_id)
    req.status = BalanceRequestStatus.REJECTED
    req.decided_by_id = admin_id
    req.decided_at = datetime.utcnow()
    db.add(
        AuditLog(
            admin_id=admin_id,
            action="topup_reject",
            entity="balance_request",
            entity_id=str(req.id),
            details=f"{req.amount_tjs} TJS | user={req.user_id} | {via}",
        )
    )
    db.commit()
    db.refresh(req)
    logger.info("💳 Дархости #%s рад шуд (%s)", req.id, via)
    return req
