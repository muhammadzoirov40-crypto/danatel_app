"""
🪙 Роутери PERS COINS — тангаҳои дохилӣ.

  GET  /api/coins/me       → тангаҳо, қоидаҳо, коди даъват, таърих
  POST /api/coins/exchange → ивази танга ба баланс (100 танга = 1 сомонӣ)
  GET  /api/coins/wheel    → чарх: сегментҳо + эҳтимолиётҳо + бурди охирин
  POST /api/coins/spin     → як гардиш (SPIN_COST_COINS танга)

Ҳамаи рақамҳо аз `.env` меоянд — фронт ҲЕҶ ГОҲ маблағ намегӯяд.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ratelimit
from app.config import settings
from app.database import get_db
from app.models import CoinTransaction, Game, User
from app.schemas import (
    CoinsExchangeOut,
    CoinsMeOut,
    CoinsMyGameIn,
    CoinsMyGameOut,
    CoinTxOut,
    WheelOut,
    WheelSegmentOut,
    WheelRecentWinOut,
    WheelSpinOut,
)
from app.security import get_current_user
from app.services import coins, wheel

router = APIRouter(prefix="/api/coins", tags=["coins"])

# Чанд сатри охирини таърих (барои саҳифаи профил)
_HISTORY_LIMIT = 30

# Маҳдудсозии гардиш: 30 дақиқа дар 60 сония (1 ип = 1 корбар)
_SPIN_LIMIT = 30
_SPIN_WINDOW = 60


def _safe_int(value) -> int:
    """Адади бехатар (NULL/хатогӣ → 0)."""
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


# =====================================================================
# 📖 ТАНГАҲОИ МАН
# =====================================================================
@router.get("/me", response_model=CoinsMeOut)
def my_coins(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Тангаҳои корбар, қоидаҳои ҳисоб ва коди даъват."""
    # Коди даъват агар ҳанӯз набошад — ҳоло сохта мешавад
    try:
        code = coins.ensure_referral_code(db, user)
    except coins.CoinsError:
        code = (user.referral_code or "").strip()

    history = db.scalars(
        select(CoinTransaction)
        .where(CoinTransaction.user_id == user.id)
        .order_by(CoinTransaction.id.desc())
        .limit(_HISTORY_LIMIT)
    ).all()

    return CoinsMeOut(
        coins=_safe_int(user.coins),
        coins_per_tjs=max(0, _safe_int(settings.COINS_PER_TJS)),
        exchange_rate=max(1, _safe_int(settings.COINS_TO_TJS)),
        min_exchange=max(0, _safe_int(settings.COINS_MIN_EXCHANGE)),
        spin_cost=max(0, _safe_int(settings.SPIN_COST_COINS)),
        referral_code=code,
        referred_count=coins.count_referred(db, user.id),
        referral_pair_coins=max(0, _safe_int(settings.REFERRAL_PAIR_COINS)),
        history=[CoinTxOut.model_validate(tx) for tx in history],
        favorite_game=(user.favorite_game or "").strip() or None,
    )


# =====================================================================
# 🎮 БОЗИИ МАН — интихоб пеш аз гардиши чарх
# =====================================================================
@router.post("/my-game", response_model=CoinsMyGameOut)
def set_my_game(
    payload: CoinsMyGameIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Бозии интихобшудаи корбар (дар саҳифаи Чарх).

    Қоидаи соҳиб: ба ҳама нишон намедиҳем — **корбар худаш бозӣ-ро интихоб
    мекунад** ва дар ҳамон ҷо гардиш мезанад. Танҳо slug-и бозии фаъол.
    """
    slug = (payload.game_slug or "").strip().lower()
    game = db.scalar(
        select(Game).where(Game.slug == slug, Game.is_active.is_(True))
    )
    if game is None:
        raise HTTPException(status_code=404, detail="Бозӣ ёфт нашуд")

    user.favorite_game = game.slug
    db.commit()
    return CoinsMyGameOut(game_slug=game.slug)


# =====================================================================
# 💱 ИВАЗ БА БАЛАНС
# =====================================================================
@router.post("/exchange", response_model=CoinsExchangeOut)
def exchange(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    Тангаро ба баланс (сомонӣ) иваз кардан.

    Танҳо адади куллӣ: масалан 250 танга → 2 сомонӣ (50 танга мемонад).
    """
    try:
        updated, credited_tjs, spent = coins.exchange_to_balance(
            db, user_id=user.id
        )
    except coins.InsufficientCoins as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except coins.CoinsError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CoinsExchangeOut(
        coins=_safe_int(updated.coins),
        balance=updated.balance,
        credited_tjs=credited_tjs,
        spent_coins=spent,
    )


# =====================================================================
# 🎡 ЧАРХ — МАЪЛУМОТИ ОММАВӢ
# =====================================================================
@router.get("/wheel", response_model=WheelOut)
def wheel_info(db: Session = Depends(get_db)):
    """
    Саҳифаи чарх: сегментҳо бо эҳтимолиётҳои воқеӣ + бурди охирин.

    ОММАВӢ (бе токен): ҷадвали эҳтимолиёт ва бурдҳои воқеӣ барои ҳама
    намоёнанд. Баланси корбар аз ин ҷо НАМЕОМАД — барои он `/coins/me`.
    """
    wins, total = wheel.recent_wins(db)
    return WheelOut(
        cost=_safe_int(settings.SPIN_COST_COINS),
        exchange_rate=max(1, _safe_int(settings.COINS_TO_TJS)),
        min_exchange=max(0, _safe_int(settings.COINS_MIN_EXCHANGE)),
        total_spins=total,
        segments=[WheelSegmentOut.model_validate(s) for s in wheel.segments_payload()],
        recent_wins=[WheelRecentWinOut.model_validate(w) for w in wins],
    )


# =====================================================================
# 🎡 ЯК ГАРДИШ
# =====================================================================
@router.post("/spin", response_model=WheelSpinOut)
def spin(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Як гардиши чарх: `SPIN_COST_COINS` танга ҳазм мешавад ва ҷоиза
    фавран ба тангаҳо меафтомад. Ҳар ду дар як transaction.

    Ҷоиза дар backend ҳисоб мешавад — фронт онро танҳо нишон медиҳад.
    """
    ratelimit.enforce(
        request, "spin", _SPIN_LIMIT, _SPIN_WINDOW, identifier=str(user.id)
    )

    try:
        updated, prize, price = wheel.spin(db, user_id=user.id)
    except coins.InsufficientCoins as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except coins.CoinsError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return WheelSpinOut(
        prize=prize,
        jackpot=prize == wheel.JACKPOT_COINS,
        cost=price,
        coins_after=_safe_int(updated.coins),
    )
