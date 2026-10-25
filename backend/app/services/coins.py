"""
🪙 PERS COINS — тангаҳои дохилӣ.

Қоидаҳо (ҳама аз `.env` танзим мешаванд):
  • Cashback: ҳар 1 сомонии фармоиши ИҶРОЧУДА = COINS_PER_TJS танга
    (фармоиш танҳо вақте «delivered» мешавад, ки админ онро тасдиқ кардааст)
  • Даъват: ҳангоми қайди дӯст тавассути линки шахсӣ (як дафъа)
      - даъваткунанда: +REFERRAL_COINS
      - дӯсти нав:     +REFERRAL_FRIEND_COINS
  • Иваз ба баланс: COINS_TO_TJS танга = 1 сомонӣ (адади куллӣ, ҳадди ақал
    COINS_MIN_EXCHANGE)
  • Админ: метавонад танга илова кунад бо сабаби возеҳ (сабти таърих)

Амният:
  ✅ Ҳамаи ҳисобҳо ТАНОБО дар backend — фронт ҲЕҶ ГОҲ маблағ намегӯяд
  ✅ Қулфи сатр (SELECT ... FOR UPDATE) ҳангоми тағйир → рақобат манъ
  ✅ Идемпотент: cashback барои як фармоиш ТАНҲО як дафъа
  ✅ Ҳар амалиёт бо сабти таърих дар `coin_transactions`
"""
from __future__ import annotations

import logging
import secrets
import string
from decimal import Decimal, InvalidOperation

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    BalanceTransaction,
    BalanceTransactionKind,
    CoinTransaction,
    CoinTransactionKind,
    Order,
    User,
)

logger = logging.getLogger("coins")

# Ҳарфи бе омехта: 0/O/1/I гирифта шуд, то код осон навишта шавад
_ALPHABET = string.ascii_uppercase + "23456789"
_CODE_LEN = 8

# Ҳадди амниятӣ барои миқдори танга
_MAX_COINS = 1_000_000_000


# =====================================================================
# ❌ Хатогиҳои махсус
# =====================================================================
class CoinsError(Exception):
    """Пайдавии умумии тангаҳо."""

    code = "coins_error"
    status = 400


class InsufficientCoins(CoinsError):
    """Танга нокифоя аст."""

    code = "insufficient_coins"
    status = 422


class InvalidCoins(CoinsError):
    """Миқдор нодуруст (сифат ё манфӣ)."""

    code = "invalid_coins"
    status = 422


def _to_money(value) -> Decimal:
    """Табдили бехатар ба Decimal бо 2 рақами ададӣ."""
    if isinstance(value, Decimal):
        d = value
    else:
        try:
            d = Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            return Decimal("0.00")
    return d.quantize(Decimal("0.01"))


def _to_int(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


# =====================================================================
# 🔗 КОДИ ДАЪВАТ
# =====================================================================
def generate_referral_code() -> str:
    """Коди кӯтоҳ ва осон барои линки даъват (8 ҳарф)."""
    return "".join(secrets.choice(_ALPHABET) for _ in range(_CODE_LEN))


def ensure_referral_code(db: Session, user: User) -> str:
    """
    Коди даъватро месозад, агар ҳанӯз набошад.

    Ягонаӣ дар сатри код санҷида мешавад (дар ҷадвалҳои кӯҳна
    UNIQUE бо `ALTER TABLE` илова намешавад → дар код ҳифз мекунем).
    """
    code = (user.referral_code or "").strip()
    if code:
        return code

    for _ in range(10):
        candidate = generate_referral_code()
        taken = db.scalar(select(User.id).where(User.referral_code == candidate))
        if taken is None:
            user.referral_code = candidate
            db.commit()
            db.refresh(user)
            logger.info("🔗 Коди даъват сохта шуд (user=%s)", user.id)
            return candidate

    raise CoinsError("Натавонистем коди даъват созем — дубора кӯшиш кунед")


def find_user_by_referral_code(db: Session, code: str | None) -> User | None:
    """Ҷустҷӯи корбар аз коди даъват (бе ҳассосият ба фазо/ҳарф)."""
    if not code:
        return None
    normalized = code.strip().upper()
    if not normalized:
        return None
    return db.scalar(select(User).where(User.referral_code == normalized))


# =====================================================================
# 📝 САБТИ ТАЪРИХ
# =====================================================================
def _write_coin_entry(
    db: Session,
    *,
    user: User,
    kind: str,
    amount: int,
    reason: str | None,
    order_id: int | None = None,
) -> CoinTransaction:
    entry = CoinTransaction(
        user_id=user.id,
        kind=kind,
        amount=amount,
        coins_after=_to_int(user.coins),
        reason=reason,
        order_id=order_id,
    )
    db.add(entry)
    return entry


def _lock_user(db: Session, user_id: int) -> User:
    """Қулфи сатри корбар (ҳамон усули хидмати баланс)."""
    user = db.execute(
        select(User).where(User.id == user_id).with_for_update()
    ).scalar_one_or_none()
    if user is None:
        raise CoinsError("Корбар ёфт нашуд")
    return user


# =====================================================================
# ➕ ИЛОВА КАРДАН
# =====================================================================
def add_coins(
    db: Session,
    *,
    user_id: int,
    amount: int,
    kind: str,
    reason: str | None = None,
    order_id: int | None = None,
) -> tuple[User, CoinTransaction]:
    """Ба тангаҳои корбар илова кардан бо сабти таърих."""
    value = _to_int(amount)
    if value <= 0:
        raise InvalidCoins("Миқдори танга бояд аз сифат зиёд бошад")

    try:
        user = _lock_user(db, user_id)
        new_val = _to_int(user.coins) + value
        if new_val < 0 or new_val > _MAX_COINS:
            raise InvalidCoins("Танга аз ҳад зиёд аст")
        user.coins = new_val
        entry = _write_coin_entry(
            db, user=user, kind=kind, amount=value, reason=reason, order_id=order_id
        )
        db.commit()
        db.refresh(user)
        logger.info(
            "🪙 +%s танга → %s (user=%s, %s)", value, user.coins, user_id, kind
        )
        return user, entry

    except CoinsError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Хатогии иловаи танга (user=%s)", user_id)
        raise


# =====================================================================
# ➖ БУРИШ
# =====================================================================
def spend_coins(
    db: Session,
    *,
    user_id: int,
    amount: int,
    kind: str,
    reason: str | None = None,
) -> tuple[User, CoinTransaction]:
    """Аз тангаҳо буридан (бо санҷиши кофӣ будан)."""
    value = _to_int(amount)
    if value <= 0:
        raise InvalidCoins("Миқдори танга бояд аз сифат зиёд бошад")

    try:
        user = _lock_user(db, user_id)
        current = _to_int(user.coins)
        if current < value:
            raise InsufficientCoins(
                f"Танга нокифоя аст: {current} танга (лозим {value})"
            )
        user.coins = current - value
        entry = _write_coin_entry(
            db, user=user, kind=kind, amount=-value, reason=reason
        )
        db.commit()
        db.refresh(user)
        logger.info("🪙 -%s танга → %s (user=%s, %s)", value, user.coins, user_id, kind)
        return user, entry

    except CoinsError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Хатогии буриши танга (user=%s)", user_id)
        raise


# =====================================================================
# 🔗 ДАЪВАТИ ДӮСТ
# =====================================================================
def grant_referral(
    db: Session, *, inviter_id: int, invited_id: int
) -> tuple[int, int]:
    """
    Бонуси даъват — ДАР ЯК transaction (ҳар ду тараф).

    Танҳо як дафъа иҷро мешавад: `users.referred_by_id` як дафъа гузошта мешавад.
    """
    if inviter_id == invited_id:
        return 0, 0

    inviter_coins = _to_int(settings.REFERRAL_COINS)
    invited_coins = _to_int(settings.REFERRAL_FRIEND_COINS)
    if inviter_coins <= 0 and invited_coins <= 0:
        return 0, 0

    try:
        inviter = _lock_user(db, inviter_id)
        invited = _lock_user(db, invited_id)

        inviter.coins = _to_int(inviter.coins) + inviter_coins
        _write_coin_entry(
            db,
            user=inviter,
            kind=CoinTransactionKind.REFERRAL,
            amount=inviter_coins,
            reason=f"Даъвати корбари №{invited_id}",
        )

        invited.coins = _to_int(invited.coins) + invited_coins
        _write_coin_entry(
            db,
            user=invited,
            kind=CoinTransactionKind.REFERRAL_WELCOME,
            amount=invited_coins,
            reason=f"Шуморо корбари №{inviter_id} даъват кард",
        )

        db.commit()
        db.refresh(inviter)
        db.refresh(invited)
        logger.info(
            "🔗 Даъват: +%s (user=%s) ва +%s (user=%s)",
            inviter_coins, inviter_id, invited_coins, invited_id,
        )
        return inviter_coins, invited_coins

    except CoinsError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception(
            "Хатогии бонуси даъват (inviter=%s, invited=%s)", inviter_id, invited_id
        )
        raise


def count_referred(db: Session, user_id: int) -> int:
    """Шумораи даъватшудагони ин корбар."""
    return _to_int(
        db.scalar(
            select(func.count(User.id)).where(User.referred_by_id == user_id)
        )
    )


# =====================================================================
# 💱 ИВАЗ БА БАЛАНС
# =====================================================================
def exchange_to_balance(db: Session, *, user_id: int) -> tuple[User, Decimal, int]:
    """
    Тангаро ба баланс (сомонӣ) иваз кардан.

    • Танҳо адади куллӣ: `whole = coins // COINS_TO_TJS`
    • Ҳам тангаҳо ҲАМ баланс ДАР ЯК transaction навишта мешаванд:
      ягон хатогӣ ҳеҷ чизро дар миён намемонад.
    """
    rate = max(1, _to_int(settings.COINS_TO_TJS))

    try:
        user = _lock_user(db, user_id)
        current = _to_int(user.coins)

        whole = current // rate
        if whole < 1:
            raise InsufficientCoins(
                f"Барои иваз ба баланс {rate} танга лозим аст "
                f"(шумо {current} танга доред)"
            )

        spent = whole * rate
        value = Decimal(whole).quantize(Decimal("0.01"))

        # 🪙 буриши танга
        user.coins = current - spent
        _write_coin_entry(
            db,
            user=user,
            kind=CoinTransactionKind.EXCHANGE,
            amount=-spent,
            reason=f"Иваз ба баланс: {rate} танга = 1 сомонӣ",
        )

        # 💰 илова ба баланс
        old_balance = _to_money(user.balance)
        new_balance = old_balance + value
        if new_balance > Decimal("999999999.99"):
            raise InvalidCoins("Баланс аз ҳад зиёд мешавад")
        user.balance = new_balance
        db.add(
            BalanceTransaction(
                user_id=user.id,
                admin_id=None,
                kind=BalanceTransactionKind.CREDIT,
                amount=value,
                balance_after=user.balance,
                reason=f"Ивази {spent} танга (Pers Coins) ба баланс",
                order_id=None,
            )
        )

        db.commit()
        db.refresh(user)
        logger.info(
            "💱 Иваз: -%s танга → +%s сомонӣ (user=%s, баланс=%s)",
            spent, value, user_id, user.balance,
        )
        return user, value, spent

    except CoinsError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Хатогии ивази танга ба баланс (user=%s)", user_id)
        raise


# =====================================================================
# 🎁 CASHBACK БАРОИ ФАРМОИШИ ИҶРОЧУДА
# =====================================================================
def grant_order_cashback(db: Session, *, order: Order) -> int:
    """
    Cashback ҳангоми гузаштани фармоиш ба `delivered`.

    ТАНҲО як дафъа барои як фармоиш (идемпотент): агар барои ин
    фармоиш аллакай сатри `cashback` мавҷуд бошад — ҳеҷ чиз илова намешавад.
    """
    if order is None or order.user_id is None:
        return 0

    per_tjs = max(0, _to_int(settings.COINS_PER_TJS))
    if per_tjs <= 0:
        return 0

    coins = int(_to_money(order.amount_tjs) * per_tjs)
    if coins <= 0:
        return 0

    already = db.scalar(
        select(CoinTransaction.id)
        .where(
            CoinTransaction.order_id == order.id,
            CoinTransaction.kind == CoinTransactionKind.CASHBACK,
        )
        .limit(1)
    )
    if already is not None:
        return 0

    try:
        add_coins(
            db,
            user_id=order.user_id,
            amount=coins,
            kind=CoinTransactionKind.CASHBACK,
            reason=f"Cashback барои фармоиш №{order.id}",
            order_id=order.id,
        )
        return coins
    except Exception:  # noqa: BLE001
        # Cashback набояд вазифаи асосии админ (тағйири статус) халалдор созад
        logger.exception("Хатогии cashback (order=%s)", order.id)
        return 0
