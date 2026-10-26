"""
🎡 ЧАРХИ БАХТ — гардиши тангаҳо (Фаза 2).

Қоидаҳо:
  • Ҳар гардиш `SPIN_COST_COINS` танга сарф мекунад (аз `.env`)
  • Ҷоиза аз рӯйхати `SEGMENTS` бо вазни куллӣ интихоб мешавад
    (`secrets.randbelow` → ҳеҷ кас пешакӣ натиҷаро пешгӯӣ карда наметавонад)
  • Ҳар ду амал (буриши хароҷот + ҷоиза) ДАР ЯК transaction навишта мешавад
    → ҳисоб ҳеҷ гоҳ дар миён намемонад
  • Эҳтимолиётҳо аз ҳамон вазнҳо ҳисоб мешаванд, барои ҳамин ҷадвали
    саҳифа ҲЕҶ ГОҲ рақами сохта нишон намедиҳад

Ҳамаи рақамҳои ҷорӣ танҳо дар ҳамин файл ҷойгир ҳастанд.

    вазн   эҳтимол   ҷоиза
     60     30.0 %     10
     44     22.0 %     20
     32     16.0 %     30
     20     10.0 %     40
     16      8.0 %     50
     10      5.0 %     70
      8      4.0 %    100
      5      2.5 %    150
      3      1.5 %    300
      2      1.0 %    500  🏆 Ҷекпот
    ---
    200    100.0 %

Миқдори миёнаи ҷоиза ≈ 41 танга < 50 тангаи гардиш → ҳисоби лоиҳа мантиқан
дуруст мемонад ва ҳар гардиш ҳатман як ҷоиза медиҳад (ҳадди ақал 10 танга).
"""
from __future__ import annotations

import logging
import secrets

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CoinTransaction, CoinTransactionKind, User
from app.services import coins

logger = logging.getLogger("wheel")

# (тангаҳои ҷоиза, вазн) — вазнҳои куллӣ, то RNG одилона бошад
SEGMENTS: tuple[tuple[int, int], ...] = (
    (10, 60),
    (20, 44),
    (30, 32),
    (40, 20),
    (50, 16),
    (70, 10),
    (100, 8),
    (150, 5),
    (300, 3),
    (500, 2),
)

TOTAL_WEIGHT = sum(w for _, w in SEGMENTS)          # 200
JACKPOT_COINS = max(c for c, _ in SEGMENTS)         # 500
MIN_PRIZE = min(c for c, _ in SEGMENTS)             # 10
_RECENT_LIMIT = 12                                  # «бурдиҳони охирин»


# =====================================================================
# 🎯 ИНТИХОБИ ҶОИЗА
# =====================================================================
def pick_prize() -> int:
    """Ҷоиза аз рӯйхати сегментҳо бо вазни куллӣ (секретӣ, одилона)."""
    roll = secrets.randbelow(TOTAL_WEIGHT)
    acc = 0
    for value, weight in SEGMENTS:
        acc += weight
        if roll < acc:
            return value
    # Пас аз ҳамаи вазнҳо — танҳо барои ҳолати ғайриимкон
    return SEGMENTS[-1][0]


def spin_cost() -> int:
    """Хароҷоти як гардиш аз `.env` (ҳадди ақал 1)."""
    return max(1, coins._to_int(settings.SPIN_COST_COINS))


# =====================================================================
# 🎡 ЯК ГАРДИШ — ДАР ЯК TRANSACTION
# =====================================================================
def spin(db: Session, *, user_id: int) -> tuple[User, int, int]:
    """
    Як гардиши чарх: ҳазми хароҷот + ҷоиза.

    Қулфи сатри корбар → рақобат имконпазир нест; ҳар ду сатри
    `coin_transactions` («spin» ва «spin_reward») якҷоя сабт мешаванд.

    Бармегардонад: (корбар, ҷоиза, хароҷот).
    """
    price = spin_cost()

    try:
        # Ҳамон ёрдамчии хидмати coins: қулфи сатр (SELECT ... FOR UPDATE)
        user = coins._lock_user(db, user_id)
        current = coins._to_int(user.coins)

        if current < price:
            raise coins.InsufficientCoins(
                f"Танга нокифоя аст: {current} танга (лозим {price})"
            )

        prize = pick_prize()

        # ➖ хароҷоти гардиш
        user.coins = current - price
        coins._write_coin_entry(
            db,
            user=user,
            kind=CoinTransactionKind.SPIN,
            amount=-price,
            reason=f"Гардиши чарх ({price} танга)",
        )

        # ➕ ҷоиза
        user.coins = coins._to_int(user.coins) + prize
        coins._write_coin_entry(
            db,
            user=user,
            kind=CoinTransactionKind.SPIN_REWARD,
            amount=prize,
            reason=f"Ҷоизаи чарх: {prize} танга",
        )

        db.commit()
        db.refresh(user)
        logger.info(
            "🎡 Гардиш: -%s +%s → %s танга (user=%s)",
            price, prize, user.coins, user_id,
        )
        return user, prize, price

    except coins.CoinsError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Хатогии гардиши чарх (user=%s)", user_id)
        raise


# =====================================================================
# 📖 БАРОИ САҲИФАИ ЧАРХ
# =====================================================================
def segments_payload() -> list[dict]:
    """Сегментҳо бо эҳтимолиётҳои воқеӣ (аз ҳамон вазнҳо)."""
    return [
        {
            "coins": value,
            "weight": weight,
            "probability": round(weight * 100 / TOTAL_WEIGHT, 2),
            "jackpot": value == JACKPOT_COINS,
        }
        for value, weight in SEGMENTS
    ]


def recent_wins(db: Session, limit: int = _RECENT_LIMIT) -> tuple[list[dict], int]:
    """
    Охирини бурдҳои воқеӣ + шумораи умумии гардишҳо.

    Танҳо сатрҳои `spin_reward` аз DB — ҳеҷ маълумоти сохта нест.
    Ном: `full_name` → `username` → `#id` (telefon ҳеҷ гоҳ ошкор намешавад).
    """
    total = coins._to_int(
        db.scalar(
            select(func.count(CoinTransaction.id)).where(
                CoinTransaction.kind == CoinTransactionKind.SPIN_REWARD
            )
        )
    )

    rows = db.execute(
        select(CoinTransaction, User)
        .join(User, CoinTransaction.user_id == User.id, isouter=True)
        .where(CoinTransaction.kind == CoinTransactionKind.SPIN_REWARD)
        .order_by(CoinTransaction.id.desc())
        .limit(limit)
    ).all()

    wins: list[dict] = []
    for tx, usr in rows:
        name = ""
        if usr is not None:
            name = ((usr.full_name or usr.username or "").strip()) or f"#{usr.id}"
        wins.append(
            {
                "id": tx.id,
                "name": name,
                "coins": coins._to_int(tx.amount),
                "created_at": tx.created_at,
            }
        )
    return wins, total
