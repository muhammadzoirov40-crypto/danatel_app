# -*- coding: utf-8 -*-
"""💰 Нархи самаранӣ (effective price): нархи ШАХСӢ ё УМУМИИ корбар.

Админ дар admin panel барои ЯК корбар × ЯК маҳсулот нархи шахсӣ таъин
мекунад (ҷадвали `user_product_prices`). Ҳеҷ сатр = нархи умумӣ
(`products.price_tjs`).

⚠️ Фармоиш ҳангоми сохтан ҳамин нархи самаранӣ дар `order.amount_tjs`
   сабт мешавад → ҳамаи дарвозаҳои тасдиқи пардохт (dc-push, чеки
   админ, баланс) ҳамон тавр кор мекунанд — МАНТИҚИ ОНҲО БЕ ТАҒЙИР.
"""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Product, User, UserProductPrice


def overrides_for(db: Session, user_id: int | None) -> dict[int, Decimal]:
    """Ҳамаи нархҳои шахсии корбар: {product_id: narx} (холӣ → {})."""
    if not user_id:
        return {}
    rows = db.execute(
        select(UserProductPrice.product_id, UserProductPrice.price_tjs).where(
            UserProductPrice.user_id == user_id
        )
    ).all()
    return {int(pid): Decimal(str(pr)) for pid, pr in rows}


def price_of(product: Product, overrides: dict[int, Decimal]) -> Decimal:
    """Нархи самаранӣ аз рӯйхати тайёр (барои рӯйхатҳои бисёр-маҳсулота)."""
    custom = overrides.get(product.id)
    if custom is not None:
        return custom
    return Decimal(str(product.price_tjs))


def effective_price(db: Session, user: User | None, product: Product) -> Decimal:
    """Нархи самаранӣ барои як маҳсулот (лаҳзаи сохтани фармоиш)."""
    if user is None:
        return Decimal(str(product.price_tjs))
    custom = db.scalar(
        select(UserProductPrice.price_tjs).where(
            UserProductPrice.user_id == user.id,
            UserProductPrice.product_id == product.id,
        )
    )
    if custom is not None:
        return Decimal(str(custom))
    return Decimal(str(product.price_tjs))
