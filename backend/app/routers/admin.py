"""Роутери Admin Panel — идора кардани фармоишҳо, бозиҳо, нархҳо."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AuditLog,
    BalanceTransaction,
    Game,
    Order,
    OrderStatus,
    Product,
    User,
)
from app.schemas import (
    AdminOrderUpdate,
    AdminStats,
    AdminUserOut,
    BalanceAdjustRequest,
    BalanceOut,
    BalanceTransactionOut,
    GameDetailOut,
    GameOut,
    GameUpsert,
    OrderOut,
    ProductOut,
    ProductUpdate,
    ProductUpsert,
)
from app.security import require_admin
from app.services import telegram_service, wallet

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


# =====================================================================
# 💰 ИДОРАКУНИИ БАЛАНСИ КОРБАРОН (танҳо Admin)
# =====================================================================


@router.get("/users", response_model=list[AdminUserOut])
def list_users(db: Session = Depends(get_db)):
    """
    📋 Рӯйхати корбарон бо баланси ҷорӣ.

    Барои ҳар як корбар: телефон, ном, баланс, шумораи фармоишҳо.
    """
    orders_count = (
        select(Order.user_id, func.count(Order.id).label("cnt"))
        .group_by(Order.user_id)
        .subquery()
    )

    rows = db.execute(
        select(User, func.coalesce(orders_count.c.cnt, 0))
        .outerjoin(orders_count, orders_count.c.user_id == User.id)
        .order_by(User.id.desc())
    ).all()

    return [
        AdminUserOut(
            id=u.id,
            phone=u.phone,
            username=u.username,
            full_name=u.full_name,
            language=u.language,
            is_admin=u.is_admin,
            balance=u.balance or 0,
            orders_count=int(cnt or 0),
            created_at=u.created_at,
        )
        for u, cnt in rows
    ]


@router.post("/users/{user_id}/balance", response_model=AdminUserOut)
def add_balance(
    user_id: int,
    payload: BalanceAdjustRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    ➕ Ба баланси корбар маблағ илова кардан.

    Мисол: Admin ба User 50 сомонӣ медиҳад → баланс +50 сомонӣ.
    Ҳамаи тағйирот дар як transaction сабт мешавад (таърих + баланс).
    """
    # Агар дархост бо path user_id номувофиқ бошад — аз body истифода мебарем
    target_id = payload.user_id or user_id

    try:
        user, entry = wallet.credit_balance(
            db,
            user_id=target_id,
            amount=payload.amount,
            reason=payload.reason,
            admin_id=admin.id,
        )
    except wallet.UserNotFound as exc:
        raise HTTPException(status_code=404, detail="Корбар ёфт нашуд") from exc
    except wallet.InvalidAmount as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # 📜 Сабти audit-log
    db.add(
        AuditLog(
            admin_id=admin.id,
            action="balance_credit",
            entity="user",
            entity_id=str(user.id),
            details=f"+{payload.amount} TJS | {payload.reason or '-'}",
        )
    )
    db.commit()

    orders_count = db.scalar(
        select(func.count(Order.id)).where(Order.user_id == user.id)
    ) or 0

    return AdminUserOut(
        id=user.id,
        phone=user.phone,
        username=user.username,
        full_name=user.full_name,
        language=user.language,
        is_admin=user.is_admin,
        balance=user.balance,
        orders_count=orders_count,
        created_at=user.created_at,
    )


@router.get("/users/{user_id}/transactions", response_model=list[BalanceTransactionOut])
def user_transactions(user_id: int, db: Session = Depends(get_db)):
    """
    📜 Таърихи ҳамаи тағйироти баланси корбар.

    Ҳар як сатр: User, маблағ, сана, Admin, сабаб.
    """
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Корбар ёфт нашуд")

    rows = db.execute(
        select(BalanceTransaction, User.full_name)
        .outerjoin(User, User.id == BalanceTransaction.admin_id)
        .where(BalanceTransaction.user_id == user_id)
        .order_by(BalanceTransaction.id.desc())
        .limit(200)
    ).all()

    return [
        BalanceTransactionOut(
            id=t.id,
            user_id=t.user_id,
            admin_id=t.admin_id,
            kind=t.kind,
            amount=t.amount,
            balance_after=t.balance_after,
            reason=t.reason,
            order_id=t.order_id,
            created_at=t.created_at,
            admin_name=admin_name,
        )
        for t, admin_name in rows
    ]


@router.get("/me/balance", response_model=BalanceOut)
def my_balance(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """💰 Баланси ҷории худи Admin (санҷишӣ)."""
    return BalanceOut(user_id=admin.id, balance=admin.balance or 0)
