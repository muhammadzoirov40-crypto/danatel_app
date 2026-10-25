"""
🪙 Роутери PERS COINS — тангаҳои дохилӣ.

  GET  /api/coins/me       → тангаҳо, қоидаҳо, коди даъват, таърих
  POST /api/coins/exchange → ивази танга ба баланс (100 танга = 1 сомонӣ)

Ҳамаи рақамҳо аз `.env` меоянд — фронт ҲЕҶ ГОҲ маблағ намегӯяд.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import CoinTransaction, User
from app.schemas import CoinsExchangeOut, CoinsMeOut, CoinTxOut
from app.security import get_current_user
from app.services import coins

router = APIRouter(prefix="/api/coins", tags=["coins"])

# Чанд сатри охирини таърих (барои саҳифаи профил)
_HISTORY_LIMIT = 30


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
        history=[CoinTxOut.model_validate(tx) for tx in history],
    )


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
