"""Роутери Admin Panel — идора кардани фармоишҳо, бозиҳо, нархҳо."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AuditLog,
    Game,
    Order,
    OrderStatus,
    Product,
    User,
)
from app.schemas import (
    AdminOrderUpdate,
    AdminStats,
    GameDetailOut,
    GameOut,
    GameUpsert,
    OrderOut,
    ProductOut,
    ProductUpdate,
    ProductUpsert,
)
from app.security import require_admin
from app.services import telegram_service

router = APIRouter(
    prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)]
)


# =====================================================================
# 📊 ОМОР
# =====================================================================
@router.get("/stats", response_model=AdminStats)
def stats(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    def count(status: str) -> int:
        return db.scalar(
            select(func.count()).select_from(Order).where(Order.status == status)
        ) or 0

    revenue_total = (
        db.scalar(
            select(func.coalesce(func.sum(Order.amount_tjs), 0)).where(
                Order.status.in_([OrderStatus.PAID, OrderStatus.DELIVERED])
            )
        )
        or 0
    )
    revenue_today = (
        db.scalar(
            select(func.coalesce(func.sum(Order.amount_tjs), 0)).where(
                Order.status.in_([OrderStatus.PAID, OrderStatus.DELIVERED]),
                Order.created_at >= today_start,
            )
        )
        or 0
    )

    return AdminStats(
        orders_total=db.scalar(select(func.count()).select_from(Order)) or 0,
        orders_today=db.scalar(
            select(func.count()).select_from(Order).where(Order.created_at >= today_start)
        ) or 0,
        orders_pending=count(OrderStatus.PENDING),
        orders_paid=count(OrderStatus.PAID),
        orders_delivered=count(OrderStatus.DELIVERED),
        orders_failed=count(OrderStatus.FAILED),
        revenue_total_tjs=float(revenue_total),
        revenue_today_tjs=float(revenue_today),
        users_total=db.scalar(select(func.count()).select_from(User)) or 0,
        games_active=db.scalar(
            select(func.count()).select_from(Game).where(Game.is_active.is_(True))
        ) or 0,
    )


# =====================================================================
# 📦 ФАРМОИШҲО
# =====================================================================
@router.get("/orders", response_model=list[OrderOut])
def list_orders(
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = select(Order).order_by(Order.created_at.desc()).offset(offset).limit(limit)
    if status:
        q = q.where(Order.status == status)
    orders = db.scalars(q).all()
    return [
        OrderOut(
            id=o.id,
            status=o.status,
            amount_tjs=o.amount_tjs,
            player_id=o.player_id,
            payment_method=o.payment_method,
            dc_payment_url=o.dc_payment_url,
            created_at=o.created_at,
            game_name=o.game.get_name("tj"),
            product_name=o.product.get_name("tj"),
        )
        for o in orders
    ]


@router.patch("/orders/{order_id}", response_model=OrderOut)
async def update_order(
    order_id: int, payload: AdminOrderUpdate, db: Session = Depends(get_db)
):
    """Тағйири статуси фармоиш (бо асоси админ)."""
    if payload.status not in OrderStatus.ALL:
        raise HTTPException(status_code=422, detail="Статус нодуруст")

    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Фармоиш ёфт нашуд")

    order.status = payload.status
    if payload.transaction_id:
        order.transaction_id = payload.transaction_id

    db.add(
        AuditLog(
            action="order_status_change",
            entity="order",
            entity_id=str(order.id),
            details=f"status -> {payload.status}",
        )
    )
    db.commit()
    db.refresh(order)

    if payload.status == OrderStatus.DELIVERED:
        await telegram_service.notify_order_delivered(order.id, order.telegram_chat_id)

    return OrderOut(
        id=order.id,
        status=order.status,
        amount_tjs=order.amount_tjs,
        player_id=order.player_id,
        payment_method=order.payment_method,
        dc_payment_url=order.dc_payment_url,
        created_at=order.created_at,
        game_name=order.game.get_name("tj"),
        product_name=order.product.get_name("tj"),
    )


# =====================================================================
# 🎮 БОЗИҲО
# =====================================================================
@router.get("/games", response_model=list[GameOut])
def admin_games(db: Session = Depends(get_db)):
    games = db.scalars(select(Game).order_by(Game.sort_order, Game.id)).all()
    return [
        GameOut(
            id=g.id,
            slug=g.slug,
            name=g.name_tj,
            emoji=g.emoji,
            currency=g.currency_tj,
            requires_player_id=g.requires_player_id,
            player_id_label=g.player_id_label_tj,
            image_url=g.image_url,
            image_pad=g.image_pad,
        )
        for g in games
    ]


@router.post("/games", response_model=GameOut)
def create_game(payload: GameUpsert, db: Session = Depends(get_db)):
    if db.scalar(select(Game).where(Game.slug == payload.slug)):
        raise HTTPException(status_code=409, detail="Чунин slug аллакай ҳаст")
    game = Game(**payload.model_dump())
    db.add(game)
    db.commit()
    db.refresh(game)
    return GameOut(
        id=game.id,
        slug=game.slug,
        name=game.name_tj,
        emoji=game.emoji,
        currency=game.currency_tj,
        requires_player_id=game.requires_player_id,
        player_id_label=game.player_id_label_tj,
        image_url=game.image_url,
        image_pad=game.image_pad,
    )


@router.get("/games/{slug}", response_model=GameDetailOut)
def admin_game_detail(slug: str, db: Session = Depends(get_db)):
    game = db.scalar(select(Game).where(Game.slug == slug))
    if game is None:
        raise HTTPException(status_code=404, detail="Бозӣ ёфт нашуд")
    products = [
        ProductOut(
            id=p.id,
            name=p.name_tj,
            price_tjs=p.price_tjs,
            amount=p.amount,
            is_popular=p.is_popular,
            is_active=p.is_active,
        )
        for p in sorted(game.products, key=lambda x: x.sort_order)
    ]
    return GameDetailOut(
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
# 💎 НАРХҲО / МАҲСУЛОТҲО
# =====================================================================
@router.post("/products", response_model=ProductOut)
def create_product(payload: ProductUpsert, db: Session = Depends(get_db)):
    if db.get(Game, payload.game_id) is None:
        raise HTTPException(status_code=404, detail="Бозӣ ёфт нашуд")
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return ProductOut(
        id=product.id,
        name=product.name_tj,
        price_tjs=product.price_tjs,
        amount=product.amount,
        is_popular=product.is_popular,
        is_active=product.is_active,
    )


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Маҳсулот ёфт нашуд")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return ProductOut(
        id=product.id,
        name=product.name_tj,
        price_tjs=product.price_tjs,
        amount=product.amount,
        is_popular=product.is_popular,
        is_active=product.is_active,
    )


@router.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Маҳсулот ёфт нашуд")
    db.delete(product)
    db.commit()
    return {"ok": True}
