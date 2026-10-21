"""Роутери сохтани фармоиш ва пардохти DC Wallet / Баланс."""
from __future__ import annotations

import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Game, Order, OrderStatus, PaymentMethod, Product, User
from app.schemas import OrderCreate, OrderOut, PaymentInitOut
from app.security import get_current_user, get_current_user_optional
from app.services import dc_service, telegram_service, wallet

logger = logging.getLogger("orders")
router = APIRouter(prefix="/api/orders", tags=["orders"])

# Паёми «Баланс нокифоя аст» (4 забон)
_BALANCE_MSG = {
    "tj": "Баланс нокифоя аст",
    "ru": "Недостаточно средств на балансе",
    "en": "Insufficient balance",
    "uz": "Balans yetarli emas",
}
_ZERO_MSG = {
    "tj": "Баланс сифат аст — аввал балансро афзоед",
    "ru": "Баланс нулевой — сначала пополните баланс",
    "en": "Balance is zero — top up your balance first",
    "uz": "Balans nol — avval balansni to'ldiring",
}


def _lang(lang: str) -> str:
    return lang if lang in ("tj", "ru", "en", "uz") else "tj"


def _bal_msg(lang: str, zero: bool = False) -> str:
    table = _ZERO_MSG if zero else _BALANCE_MSG
    return table.get(lang, table["tj"])


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
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Сохтани фармоиш.

    💳 `dc_wallet` — пардохти берунӣ аз DC Wallet (бе вуруд ҳам мумкин)
    💰 `balance`   — пардохт аз ҳамён (ҳатмии вуруд + баланси кофӣ)
    """
    lang = _lang(payload.language)

    # 0️⃣ Идемпотентность — агар ҳамон client_token аллакай фармоиш сохта бошад,
    #    яъне клики такрорӣ аст → ҳамон фармоишро бармегардонем (пул наканда бошад).
    if payload.client_token:
        existing = db.scalar(
            select(Order).where(Order.client_token == payload.client_token)
        )
        if existing is not None:
            return PaymentInitOut(
                order_id=existing.id,
                status=existing.status,
                payment_url=existing.dc_payment_url,
                invoice_id=existing.dc_invoice_id,
                amount_tjs=existing.amount_tjs,
                message="Фармоиш аллакай сохта шуд",
            )

    # 1️⃣ Санҷиши усули пардохт
    method = payload.payment_method or PaymentMethod.DC
    if method not in PaymentMethod.ALL:
        raise HTTPException(status_code=422, detail="Усули пардохт нодуруст аст")

    # 2️⃣ Пардохт аз баланс танҳо барои корбари вурудкарда
    user: User | None = None
    if method == PaymentMethod.BALANCE:
        if current_user is None:
            raise HTTPException(
                status_code=401,
                detail="Барои пардохт аз баланс вуруд кунед",
            )
        if current_user.is_admin:
            # Админ барои санҷиш ҳам иҷозат дорад — идома медиҳем
            pass
        user = current_user

    # 3️⃣ Ёфтани бозӣ ва маҳсулот
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

    price = Decimal(str(product.price_tjs))

    # ---------- 💰 ПАРДОХТ АЗ БАЛАНС ----------
    if method == PaymentMethod.BALANCE:
        return await _pay_from_balance(
            db=db,
            user=user,
            game=game,
            product=product,
            player_id=player_id,
            price=price,
            lang=lang,
            client_token=payload.client_token,
        )

    # ---------- 💳 ПАРДОХТ АЗ DC WALLET ----------
    order = Order(
        game_id=game.id,
        product_id=product.id,
        user_id=user.id if user else None,
        player_id=player_id,
        player_nickname=(payload.player_nickname or "").strip() or None,
        amount_tjs=float(price),
        language=lang,
        payment_method=PaymentMethod.DC,
        status=OrderStatus.PENDING,
        client_token=payload.client_token,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # ---------- Оғози пардохти DC ----------
    try:
        inv = await dc_service.create_invoice(
            order_id=order.id,
            amount_tjs=float(price),
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
            amount=float(price),
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


async def _pay_from_balance(
    *,
    db: Session,
    user: User,
    game: Game,
    product: Product,
    player_id: str,
    price: Decimal,
    lang: str,
    client_token: str | None,
) -> PaymentInitOut:
    """
    💰 Донат аз баланси корбар.

    Тартиби амниятӣ:
      1. Санҷиши баланс ДАР як transaction (бо қулфи сатр)
      2. Баланс кофӣ аст? → буриш + сабти таърих + фармоиш PAID
      3. Баланс нокифоя? → InsufficientBalance → ROLLBACK → баланс бетағйир
      4. Ҳар хатогии дигар → ROLLBACK → ҲЕҶ тағйир намемонад
    """
    # Агар client_token аллакай фармоиш дошта бошад — такрорӣ нест
    if client_token:
        existing = db.scalar(select(Order).where(Order.client_token == client_token))
        if existing is not None:
            return PaymentInitOut(
                order_id=existing.id,
                status=existing.status,
                payment_url=existing.dc_payment_url,
                invoice_id=existing.dc_invoice_id,
                amount_tjs=existing.amount_tjs,
                message="Фармоиш аллакай иҷро шуд",
            )

    # 🛡️ Санҷиши пешакӣ барои паёми возеҳ (дар ҳолати нокомӣ → ROLLBACK)
    bal_now = Decimal(str(user.balance or 0))
    if bal_now <= 0:
        raise HTTPException(status_code=400, detail=_bal_msg(lang, zero=True))
    if bal_now < price:
        raise HTTPException(status_code=400, detail=_bal_msg(lang))

    try:
        # 1️⃣ Фармоишро месозем (лаҳзаи ҳолӣ — ҳанӯз пул наканда)
        order = Order(
            game_id=game.id,
            product_id=product.id,
            user_id=user.id,
            player_id=player_id,
            player_nickname=None,
            amount_tjs=float(price),
            language=lang,
            payment_method=PaymentMethod.BALANCE,
            status=OrderStatus.PENDING,
            client_token=client_token,
        )
        db.add(order)
        db.flush()  # order.id мегирем

        # 2️⃣ Буриши баланс ДАР ҲАМОН transaction + сабти таърих
        wallet.debit_balance(
            db,
            user_id=user.id,
            amount=price,
            reason=f"Донат: {game.get_name('tj')} — {product.get_name('tj')} (#{order.id})",
            order_id=order.id,
        )

        # 3️⃣ Фармоишро PAID мекунем (пул аллакай аз баланс рафт)
        order.status = OrderStatus.PAID
        db.commit()
        db.refresh(order)

    except wallet.WalletError as exc:
        db.rollback()
        logger.info("Донат манъ шуд (user=%s): %s", user.id, exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Хатогии донат аз баланс (user=%s)", user.id)
        raise HTTPException(status_code=500, detail="Донат ноком шуд — баланс бетағйир монад")

    # 4️⃣ Огоҳинома (хатогӣ балансро тағйир намедиҳад — аллакай commit шуд)
    try:
        await telegram_service.notify_new_order(
            order_id=order.id,
            game=game.get_name("tj"),
            product=product.get_name("tj"),
            player_id=player_id,
            amount=float(price),
        )
    except Exception:  # noqa: BLE001
        logger.exception("Огоҳиномаи Telegram ноком шуд")

    return PaymentInitOut(
        order_id=order.id,
        status=order.status,
        payment_url=None,
        invoice_id=None,
        amount_tjs=order.amount_tjs,
        message="Донат аз баланс муваффақ анҷом ёфт",
    )


@router.get("/my", response_model=list[OrderOut])
def my_orders(
    lang: str = "tj",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Фармоишҳои корбари ҷорӣ (бо вуруд)."""
    lang = _lang(lang)
    orders = db.scalars(
        select(Order)
        .where(Order.user_id == user.id)
        .order_by(Order.id.desc())
    ).all()
    return [_order_out(o, lang) for o in orders]


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
