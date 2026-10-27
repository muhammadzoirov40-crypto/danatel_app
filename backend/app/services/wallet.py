"""
💰 Хидмати баланс (ҳамён).

Қоидаҳои амниятӣ:
  ✅ Танҳо backend тағйир медиҳад — фронт ҳеҷ гоҳ маблағ намегӯяд
  ✅ Ҳамаи ҳисоб дар Decimal (на float)
  ✅ Санҷиш + буриш ДАР ЯК transaction (ROW LOCK)
  ✅ Ҳангоми хатогӣ → ROLLBACK → баланс бетағйир мемонад
  ✅ Таърихи пурра: User, маблағ, сана, Admin, сабаб
"""
from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    BalanceTransaction,
    BalanceTransactionKind,
    User,
)

logger = logging.getLogger("wallet")


# =====================================================================
# ❌ Хатогиҳои махсус
# =====================================================================
class WalletError(Exception):
    """Пайдавии умумии ҳамён."""

    code = "wallet_error"
    status = 400


class InsufficientBalance(WalletError):
    """Баланс нокифоя аст."""

    code = "insufficient_balance"
    status = 400


class InvalidAmount(WalletError):
    """Маблағ нодуруст (манфӣ, сифат ё хеле калон)."""

    code = "invalid_amount"
    status = 422


class UserNotFound(WalletError):
    code = "user_not_found"
    status = 404


def _to_decimal(value) -> Decimal:
    """Табдили бехатар ба Decimal бо 2 рақами ададӣ."""
    if isinstance(value, Decimal):
        d = value
    else:
        try:
            d = Decimal(str(value))
        except (InvalidOperation, ValueError) as exc:
            raise InvalidAmount("Маблағ нодуруст аст") from exc
    # 2 рақами ададӣ (масалан 50.005 -> 50.00 ё 50.01 тибқи дақиқӣ)
    return d.quantize(Decimal("0.01"))


def _validate_positive(value) -> Decimal:
    amount = _to_decimal(value)
    if amount <= Decimal("0.00"):
        raise InvalidAmount("Маблағ бояд аз сифат зиёд бошад")
    if amount > Decimal("999999999.99"):
        raise InvalidAmount("Маблағ аз ҳад зиёд аст")
    return amount


def _load_user_for_update(db: Session, user_id: int) -> User:
    """
    Гирифтани User бо қулфи сатр (SELECT ... FOR UPDATE).

    • PostgreSQL — қулфи воқеӣ: ду дархости ҳамзамон дар як сатр
      пай дар пай иҷро мешаванд → ҳисоби дуруст.
    • SQLite — `FOR UPDATE` нодида мешавад, вале SQLite навиштанҳоро
      дар як вақт сериализатсия мекунад → ҳамон натиҷа.
    """
    user = db.execute(
        select(User).where(User.id == user_id).with_for_update()
    ).scalar_one_or_none()
    if user is None:
        raise UserNotFound("Корбар ёфт нашуд")
    return user


def _write_entry(
    db: Session,
    *,
    user: User,
    kind: str,
    amount: Decimal,
    reason: str | None,
    admin_id: int | None = None,
    order_id: int | None = None,
) -> BalanceTransaction:
    """Сабти сатри таърихӣ бо баланси нав."""
    entry = BalanceTransaction(
        user_id=user.id,
        admin_id=admin_id,
        kind=kind,
        amount=amount,                      # + барои credit, - барои debit
        balance_after=user.balance,         # баланс ПАС аз тағйирот
        reason=reason,
        order_id=order_id,
    )
    db.add(entry)
    return entry


# =====================================================================
# ➕ ИЛОВА КАРДАН (танҳо Admin)
# =====================================================================
def credit_balance(
    db: Session,
    *,
    user_id: int,
    amount,
    reason: str | None,
    admin_id: int,
) -> tuple[User, BalanceTransaction]:
    """
    Ба баланси User маблағ илова кардан.

    Дар ЯК transaction:
      1. Қулфи сатри User
      2. Баланс + маблағ
      3. Сабти таърих (User, маблағ, сана, Admin, сабаб)
    """
    value = _validate_positive(amount)

    try:
        user = _load_user_for_update(db, user_id)
        old = _to_decimal(user.balance or 0)
        user.balance = old + value

        entry = _write_entry(
            db,
            user=user,
            kind=BalanceTransactionKind.CREDIT,
            amount=value,
            reason=reason or "Иловаи баланс аз ҷониби Admin",
            admin_id=admin_id,
        )
        db.commit()
        db.refresh(user)
        logger.info(
            "💰 Баланс +%s → %s (user=%s, admin=%s)",
            value, user.balance, user_id, admin_id,
        )
        return user, entry

    except WalletError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Хатогии иловаи баланс (user=%s)", user_id)
        raise


# =====================================================================
# ➖ БУРИШ (донат аз баланс)
# =====================================================================
def debit_balance(
    db: Session,
    *,
    user_id: int,
    amount,
    reason: str | None,
    order_id: int | None = None,
    admin_id: int | None = None,
    allow_negative: bool = False,
) -> tuple[User, BalanceTransaction]:
    """
    Аз баланс маблағ буридан (донат).

    Дар ЯК transaction:
      1. Қулфи сатри User
      2. Санҷиш: balance >= amount ?
           Не → InsufficientBalance → ROLLBACK (баланс бетағйир)
           (лағв мешавад, агар `allow_negative=True` — возвраткаи админ)
      3. Баланс - маблағ
      4. Сабти таърихи буриш (бо admin_id, агар дода шуда бошад)
      5. COMMIT

    Агар ҳамаи қадамҳо муваффақ набошанд → ROLLBACK,
    яъне ҲЕҶ гуна тағйирот дар база намемонад.
    """
    value = _validate_positive(amount)

    try:
        user = _load_user_for_update(db, user_id)
        current = _to_decimal(user.balance or 0)

        # ===== 🛡️ САНҶИШИ БАЛАНС =====
        if not allow_negative:
            if current <= Decimal("0.00"):
                raise InsufficientBalance("Баланс сифат аст — донат ғайриимкон аст")
            if current < value:
                raise InsufficientBalance(
                    f"Баланс нокифоя аст: {current} сомонӣ (лозим {value} сомонӣ)"
                )

        # ===== ➖ БУРИШ =====
        user.balance = current - value

        _write_entry(
            db,
            user=user,
            kind=BalanceTransactionKind.DEBIT,
            amount=-value,                   # бо аломати манфӣ
            reason=reason or "Донат аз баланс",
            admin_id=admin_id,
            order_id=order_id,
        )

        db.commit()
        db.refresh(user)
        logger.info(
            "💸 Баланс-%s → %s (user=%s, order=%s)",
            value, user.balance, user_id, order_id,
        )
        return user, _latest_entry(db, user.id)

    except WalletError:
        # ❌ Ҳеҷ тағйирот намемонад
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Хатогии буриши баланс (user=%s)", user_id)
        raise


def _latest_entry(db: Session, user_id: int) -> BalanceTransaction | None:
    return db.scalar(
        select(BalanceTransaction)
        .where(BalanceTransaction.user_id == user_id)
        .order_by(BalanceTransaction.id.desc())
        .limit(1)
    )


# =====================================================================
# 🔍 ХИЗМАТҲОИ ХОНЕДАН
# =====================================================================
def get_balance(db: Session, user_id: int) -> Decimal:
    user = db.get(User, user_id)
    if user is None:
        raise UserNotFound("Корбар ёфт нашуд")
    return _to_decimal(user.balance or 0)


def list_transactions(db: Session, user_id: int, limit: int = 50):
    """Таърихи тағйирот (аз навтарин)."""
    return db.scalars(
        select(BalanceTransaction)
        .where(BalanceTransaction.user_id == user_id)
        .order_by(BalanceTransaction.id.desc())
        .limit(max(1, min(limit, 200)))
    ).all()
