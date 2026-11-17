# -*- coding: utf-8 -*-
"""💰 Нархҳои шахсии корбарон — admin panel (талаби соҳиб 17.11.2026).

Ҳар корбар барои ҳар маҳсулот НАРХИ ШАХСИИ худ дорад:
  · НАРХИ КӯҲНА (кӯҳна/умумӣ) = `products.price_tjs`
  · НАРХИ ШАХСӢ (нав)         = `user_product_prices` (админ таъин мекунад)
Ҳеҷ сатр → корбар ҳамон нархи умумиро мепардозад.

⚠️ Фармоиш ҳангоми сохтан ҳамин нархи самаранӣ дар `order.amount_tjs`
   сабт мешавад → дарвозаҳои тасдиқи пардохт БЕ ТАҒЙИРИ МАНТИҚ.
"""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Game, Product, User, UserProductPrice
from app.schemas import UserPriceItem, UserPriceSet
from app.security import require_admin

router = APIRouter(
    prefix="/api/admin/user-prices",
    tags=["user-prices"],
    dependencies=[Depends(require_admin)],
)


def _lang(lang: str) -> str:
    return lang if lang in ("tj", "ru", "en", "uz") else "tj"


def _custom_map(db: Session, user_id: int) -> dict[int, Decimal]:
    rows = db.execute(
        select(UserProductPrice.product_id, UserProductPrice.price_tjs).where(
            UserProductPrice.user_id == user_id
        )
    ).all()
    return {int(pid): Decimal(str(pr)) for pid, pr in rows}


def _item(g: Game, p: Product, custom: Decimal | None, lang: str) -> UserPriceItem:
    return UserPriceItem(
        product_id=p.id,
        game_id=g.id,
        game_slug=g.slug,
        game_name=g.get_name(lang),
        game_image_url=g.image_url,
        name=p.get_name(lang),
        amount=p.amount,
        base_price_tjs=Decimal(str(p.price_tjs)),
        custom_price_tjs=custom,
    )


def _user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Корбар ёфт нашуд")
    return user


def _product_or_404(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Маҳсулот ёфт нашуд")
    return product


@router.get("", response_model=list[UserPriceItem])
def list_user_prices(
    user_id: int = Query(..., ge=1),
    lang: str = Query("tj"),
    db: Session = Depends(get_db),
):
    """Ҳамаи маҳсулотҳои фаъол бо НАРХИ КӯҲНА + НАРХИ ШАХСИИ корбар."""
    lang = _lang(lang)
    _user_or_404(db, user_id)
    games = db.scalars(
        select(Game)
        .options(selectinload(Game.products))
        .where(Game.is_active.is_(True))
        .order_by(Game.sort_order, Game.id)
    ).all()
    customs = _custom_map(db, user_id)
    return [
        _item(g, p, customs.get(p.id), lang)
        for g in games
        for p in g.products
        if p.is_active
    ]


@router.put("/{user_id}/{product_id}", response_model=UserPriceItem)
def set_user_price(
    user_id: int,
    product_id: int,
    payload: UserPriceSet,
    lang: str = Query("tj"),
    db: Session = Depends(get_db),
):
    """Нархи шахсӣ гузоштан (ё пок: агар баробари нархи кӯҳна бошад)."""
    lang = _lang(lang)
    _user_or_404(db, user_id)
    product = _product_or_404(db, product_id)
    base = Decimal(str(product.price_tjs))
    new = Decimal(str(payload.price_tjs))
    row = db.scalar(
        select(UserProductPrice).where(
            UserProductPrice.user_id == user_id,
            UserProductPrice.product_id == product_id,
        )
    )
    if new == base:
        # Нархи шахсӣ БАРОБАРИ нархи кӯҳна → сатр лозим нест (reset)
        if row is not None:
            db.delete(row)
    elif row is not None:
        row.price_tjs = new
    else:
        db.add(
            UserProductPrice(
                user_id=user_id, product_id=product_id, price_tjs=new
            )
        )
    db.commit()
    customs = _custom_map(db, user_id)
    return _item(product.game, product, customs.get(product.id), lang)


@router.delete("/{user_id}/{product_id}", response_model=UserPriceItem)
def reset_user_price(
    user_id: int,
    product_id: int,
    lang: str = Query("tj"),
    db: Session = Depends(get_db),
):
    """Барқарор ба нархи кӯҳна (умумӣ)."""
    lang = _lang(lang)
    _user_or_404(db, user_id)
    product = _product_or_404(db, product_id)
    row = db.scalar(
        select(UserProductPrice).where(
            UserProductPrice.user_id == user_id,
            UserProductPrice.product_id == product_id,
        )
    )
    if row is not None:
        db.delete(row)
        db.commit()
    return _item(product.game, product, None, lang)
