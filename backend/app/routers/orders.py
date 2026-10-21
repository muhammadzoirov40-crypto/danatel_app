"""Роутери сохтани фармоиш ва пардохти DC Wallet."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Game, Order, OrderStatus, Product, User
from app.schemas import OrderCreate, OrderOut, PaymentInitOut
from app.services import dc_service, telegram_service

logger = logging.getLogger("orders")
router = APIRouter(prefix="/api/orders", tags=["orders"])


def _lang(lang: str) -> str:
    return lang if lang in ("tj", "ru", "en", "uz") else "tj"


def _order_out(order: Order, lang: str = "tj") -> OrderOut:
    return OrderOut(
        id=order.id,
        status=order.status,
        amount_tjs=order.amount_tjs,
        player_id=order.player_id,
        payment_method=order.payment_method,
        dc_payment_url=order.dc_payment_url,
        created_at=order.created_at,
        game_name=order.game.get_name(lang),
        product_name=order.product.get_name(lang),
    )


@router.post("", response_model=PaymentInitOut)
async def create_order(
    payload: OrderCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Сохтани фармоиш + оғози пардохти DC Wallet."""
    lang = _lang(payload.language)

    game = db.scalar(select(Game).where(Game.slug == payload.game_slug, Game.is_active.is_(True)))
    if game is None:
        raise HTTPException(status_code=404, detail="Бозӣ ёфт нашуд")

    product = db.scalar(
        select(Product).where(
            Product.id == payload.product_id,
            Product.game_id == game.id,
            Product.is_active.is_(True),
        )
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Маҳсулот ёфт нашуд")

    player_id = payload.player_id.strip()
    if len(player_id) < 2:
        raise HTTPException(status_code=422, detail="Player ID нодуруст аст")

    # ---------- Сохтани фармоиш ----------
    order = Order(
        game_id=game.id,
        product_id=product.id,
        player_id=player_id,
        player_nickname=(payload.player_nickname or "").strip() or None,
        amount_tjs=float(product.price_tjs),
        language=lang,
        payment_method="dc_wallet",
        status=OrderStatus.PENDING,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # ---------- Оғози пардохти DC ----------
    try:
        inv = await dc_service.create_invoice(
            order_id=order.id,
            amount_tjs=float(product.price_tjs),
            description=f"{game.get_name('tj')} - {product.get_name('tj')}",
            lang=lang,
            redirect_url=f"{settings.FRONTEND_URL}/order/{order.id}",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Хатогии DC барои фармоиш %s", order.id)
        order.status = OrderStatus.FAILED
        db.commit()
        raise HTTPException(status_code=502, detail=f"Хатогии DC: {exc}") from exc

    order.dc_invoice_id = inv.get("invoice_id")
    order.dc_payment_url = inv.get("payment_url")
    db.commit()
    db.refresh(order)

    # ---------- Огоҳинома ба Telegram ----------
    try:
        await telegram_service.notify_new_order(
            order_id=order.id,
            game=game.get_name("tj"),
            product=product.get_name("tj"),
            player_id=player_id,
            amount=float(product.price_tjs),
        )
    except Exception:  # noqa: BLE001
        logger.exception("Огоҳиномаи Telegram ноком шуд")

    return PaymentInitOut(
        order_id=order.id,
        status=order.status,
        payment_url=order.dc_payment_url,
        invoice_id=order.dc_invoice_id,
        amount_tjs=order.amount_tjs,
        message="Пардохтро дар DC Wallet тасдиқ кунед",
    )


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, lang: str = "tj", db: Session = Depends(get_db)):
    """Гирифтани маълумоти фармоиш."""
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Фармоиш ёфт нашуд")
    return _order_out(order, _lang(lang))


@router.get("/{order_id}/status")
async def order_status(order_id: int, db: Session = Depends(get_db)):
    """Санҷиши статус (аз DC ҳам санҷида мешавад)."""
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Фармоиш ёфт нашуд")

    # Агар ҳанӯз pending бошад — аз DC санҷед
    if order.status == OrderStatus.PENDING and order.dc_invoice_id:
        if not order.dc_invoice_id.startswith("demo-"):
            st = await dc_service.get_invoice_status(order.dc_invoice_id)
            if st in ("paid", "success"):
                order.status = OrderStatus.PAID
                db.commit()
                await telegram_service.notify_order_paid(
                    order.id, order.telegram_chat_id, float(order.amount_tjs)
                )

    return {"order_id": order.id, "status": order.status}
