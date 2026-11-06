# -*- coding: utf-8 -*-
"""
➕ АДМИН-ИЛОВАҲО (талаби соҳиб, 06.11.2026) — БЕ тағйири admin.py:
  · GET /api/admin/games/{slug}/full  — Нархҳо бо sku + нархи харид (cost_tjs)
  · GET /api/admin/orders/{id}/detail — Кодҳои МАХФИЯШИ фармоиш (ник, fl_ref,
      транзаксия, ҳисоби DC, миқдор, забон, санаҳо)
  · GET /api/admin/stats/profit       — ФОИДА = даромад − нархи харид
      (танҳо аз фармоишҳои маҳсулотҳои бо cost_tjs > 0; боқимонда ҳисоб
       намешавад — 0 = ворид нашудааст, на «фоидаи баробар»)

⚠️ admin.py ҳамчун файл ҳифз аст (кори агенти дигар) — ҳамаи тафсилот
   дар ин фоидаи нав аст.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Game, Order, OrderStatus, Product
from app.schemas import GameOut
from app.security import require_admin

router = APIRouter(
    prefix="/api/admin",
    tags=["admin-extra"],
    dependencies=[Depends(require_admin)],
)


# =====================================================================
# 📚 НАРХҲО: маҳсулоти комил (sku + нархи харид)
# =====================================================================


class ProductFullOut(BaseModel):
    id: int
    name: str
    price_tjs: Decimal
    amount: int
    is_popular: bool = False
    is_active: bool = True
    region: str = ""
    # 🔥 sku дар каталоги FireLoot ($ барои намоиш)
    sku: str = ""
    # 💲 Нархи харид (TJS) — барои фоида ва %-и «аз харид»
    cost_tjs: Decimal = Decimal("0")


class GameFullOut(GameOut):
    products: list[ProductFullOut] = []


@router.get("/games/{slug}/full", response_model=GameFullOut)
def admin_game_full(slug: str, db: Session = Depends(get_db)):
    """Нархҳои комил: ҳамон GameDetail + sku + cost_tjs (admin.py дахл надорад)."""
    game = db.scalar(select(Game).where(Game.slug == slug))
    if game is None:
        raise HTTPException(status_code=404, detail="Бозӣ ёфт нашуд")
    products = [
        ProductFullOut(
            id=p.id,
            name=p.name_tj,
            price_tjs=p.price_tjs,
            amount=p.amount,
            is_popular=p.is_popular,
            is_active=p.is_active,
            region=p.region or "",
            sku=p.sku or "",
            cost_tjs=Decimal(str(p.cost_tjs or 0)),
        )
        for p in sorted(game.products, key=lambda x: x.sort_order)
    ]
    return GameFullOut(
        id=game.id,
        slug=game.slug,
        name=game.name_tj,
        emoji=game.emoji,
        currency=game.currency_tj,
        requires_player_id=game.requires_player_id,
        player_id_label=game.player_id_label_tj,
        image_url=game.image_url,
        image_pad=game.image_pad,
        products=products,
    )


# =====================================================================
# 🔍 КОДҲОИ МАХФИЯШИ ФАРМОИШ
# =====================================================================


class OrderDetailOut(BaseModel):
    id: int
    player_nickname: str | None = None
    quantity: int = 1
    # 🔥 Истиноди иҷрои FireLoot: '' | 'WIP' | 'ref:<id>' | 'ERR:<code>'
    fl_ref: str = ""
    transaction_id: str | None = None
    dc_invoice_id: str | None = None
    language: str = "tj"
    payment_method: str = ""
    created_at: datetime | None = None
    updated_at: datetime | None = None


@router.get("/orders/{order_id}/detail", response_model=OrderDetailOut)
def order_detail(order_id: int, db: Session = Depends(get_db)):
    o = db.get(Order, order_id)
    if o is None:
        raise HTTPException(status_code=404, detail="Фармоиш ёфт нашуд")
    return OrderDetailOut(
        id=o.id,
        player_nickname=o.player_nickname,
        quantity=o.quantity or 1,
        fl_ref=o.fl_ref or "",
        transaction_id=o.transaction_id,
        dc_invoice_id=o.dc_invoice_id,
        language=o.language or "",
        payment_method=o.payment_method or "",
        created_at=o.created_at,
        updated_at=o.updated_at,
    )


# =====================================================================
# 💲 ФОИДА = даромад − нархи харид
# =====================================================================


class ProfitOut(BaseModel):
    profit_total_tjs: float = 0.0
    profit_today_tjs: float = 0.0
    # Даромади танҳо аз маҳсулотҳои бо нархи харид (асоси ҳисоб)
    revenue_costed_tjs: float = 0.0
    costed_orders: int = 0
    # Даромади маҳсулотҳои БЕ нархи харид — барои таъкиди «ворид кунед»
    uncosted_revenue_tjs: float = 0.0
    # Чанд маҳсулот аллакай нархи харид дорад
    costed_products: int = 0


@router.get("/stats/profit", response_model=ProfitOut)
def stats_profit(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    paid = [OrderStatus.PAID, OrderStatus.DELIVERED]

    def _totals(extra=None):  # noqa: ANN001
        q = (
            select(
                func.coalesce(func.sum(Order.amount_tjs), 0),
                func.coalesce(
                    func.sum(
                        func.coalesce(Product.cost_tjs, 0)
                        * func.coalesce(Order.quantity, 1)
                    ),
                    0,
                ),
                func.count(),
            )
            .select_from(Order)
            .join(Product, Product.id == Order.product_id)
            .where(Order.status.in_(paid), Product.cost_tjs > 0)
        )
        if extra is not None:
            q = q.where(extra)
        return db.execute(q).one()

    rev, cost, cnt = _totals()
    rev_t, cost_t, _ = _totals(Order.created_at >= today_start)

    uncosted = (
        db.execute(
            select(func.coalesce(func.sum(Order.amount_tjs), 0))
            .select_from(Order)
            .join(Product, Product.id == Order.product_id)
            .where(
                Order.status.in_(paid),
                (Product.cost_tjs == 0) | (Product.cost_tjs.is_(None)),
            )
        ).scalar()
        or 0
    )
    costed_products = (
        db.scalar(
            select(func.count()).select_from(Product).where(Product.cost_tjs > 0)
        )
        or 0
    )

    return ProfitOut(
        profit_total_tjs=float(rev) - float(cost),
        profit_today_tjs=float(rev_t) - float(cost_t),
        revenue_costed_tjs=float(rev),
        costed_orders=int(cnt),
        uncosted_revenue_tjs=float(uncosted),
        costed_products=int(costed_products),
    )
