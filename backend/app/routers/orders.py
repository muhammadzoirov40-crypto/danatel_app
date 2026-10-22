"""Роутери сохтани фармоиш ва пардохти DC Wallet / Баланс."""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
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

# 🧾 Ҷои нигоҳдории расмҳои чек (аз тарафи nginx/SPA дастрас)
_RECEIPT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "uploads",
    "receipts",
)

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


def _payment_link(amount_tjs: float) -> str | None:
    """Линки пардохти берунӣ (ҳамон усули бот: pay.dc.tj).

    {amount} дар линк бо маблағи фармоиш иваз мешавад.
    """
    tpl = settings.PAYMENT_LINK_URL
    if not tpl:
        return None
    # Миқдори пул: бе нуқта (100 → 100, 100.50 → 100.50)
    amt = f"{float(amount_tjs):.2f}".rstrip("0").rstrip(".")
    return tpl.replace("{amount}", amt)


def _order_out(order: Order, lang: str = "tj") -> OrderOut:
    link = order.dc_payment_url
    if not link and order.payment_method == PaymentMethod.DC:
        link = _payment_link(float(order.amount_tjs))
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
        receipt_file=order.receipt_file,
        receipt_text=order.receipt_text,
        payment_link=link,
        payment_card=settings.PAYMENT_CARD_NUMBER or None,
        payment_phone=settings.PAYMENT_PHONE or None,
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

    # ---------- 💳 ПАРДОХТ АЗ DC WALLET (линк + чек) ----------
    # Ҳамон усули бот: корбар линкро мекушояд, пардохт мекунад,
    # баъд чек (расм/матн) мефиристад → админ тасдиқ мекунад.
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

    # Линки пардохти берунӣ (бо маблағ) — ҳамон усули боти Telegram
    link = _payment_link(float(price))

    if link:
        # ✅ Линки воқеии pay.dc.tj танзим аст → ҳамон «линк + чек».
        # DC API даъват намешавад, то линки намоишӣ (demo) ба корбар дода нашавад.
        order.dc_payment_url = link
    elif settings.DC_MERCHANT_ID and settings.DC_SECRET_KEY:
        # Оянда: DC API-и воқеӣ (агар линки оддӣ танзим нашуда бошад)
        try:
            inv = await dc_service.create_invoice(
                order_id=order.id,
                amount_tjs=float(price),
                description=f"{game.get_name('tj')} - {product.get_name('tj')}",
                lang=lang,
                redirect_url=f"{settings.FRONTEND_URL}/order/{order.id}",
            )
            order.dc_payment_url = inv.get("payment_url")
            order.dc_invoice_id = inv.get("invoice_id")
        except Exception:  # noqa: BLE001
            logger.exception("Хатогии DC — фармоиш бе линк мемонад")
            order.dc_payment_url = None
    else:
        # Ҳеҷ усули пардохт танзим нашудааст
        order.dc_payment_url = None

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


# =====================================================================
# 🧾 ФИРИСТОДАНИ ЧЕКИ ПАРДОХТ (линк + чек — ҳамон усули бот)
# =====================================================================


@router.post("/{order_id}/receipt", response_model=OrderOut)
async def submit_receipt(
    order_id: int,
    file: UploadFile | None = File(default=None),
    text: str | None = Form(default=None),
    lang: str = Form(default="tj"),
    db: Session = Depends(get_db),
):
    """Корбар чеки пардохтро мефиристад (расм ё матн).

    Фармоиш → `checking` (интизори тасдиқи админ).
    """
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Фармоиш ёфт нашуд")

    if order.status not in (OrderStatus.PENDING, OrderStatus.CHECKING):
        raise HTTPException(status_code=422, detail="Чек барои ин фармоиш қабул нест")

    saved_path: str | None = None

    if file is not None and file.filename:
        # Санҷиши навъи файл — фақат расм
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
            raise HTTPException(
                status_code=422,
                detail="Файли расмӣ иҷозат дорад: jpg, png, webp, gif",
            )
        raw = await file.read()
        if len(raw) > 5 * 1024 * 1024:  # 5 MB
            raise HTTPException(status_code=422, detail="Аз 5 MB калон аст")
        if not raw:
            raise HTTPException(status_code=422, detail="Файл холӣ аст")

        # Номи беназир + нигоҳдорӣ дар uploads/receipts
        name = f"r{order.id}_{uuid.uuid4().hex[:10]}{ext}"
        os.makedirs(_RECEIPT_DIR, exist_ok=True)
        dest = os.path.join(_RECEIPT_DIR, name)
        with open(dest, "wb") as fh:
            fh.write(raw)
        saved_path = f"/uploads/receipts/{name}"

    txt = (text or "").strip()
    if not saved_path and not txt:
        raise HTTPException(
            status_code=422, detail="Чекро (расм ё матн) фиристед"
        )

    if saved_path:
        order.receipt_file = saved_path
    if txt:
        order.receipt_text = txt[:512]
    order.receipt_at = datetime.utcnow()
    order.status = OrderStatus.CHECKING
    db.commit()
    db.refresh(order)

    logger.info("🧾 Чеки фармоиш #%s қабул шуд", order.id)

    # Огоҳинома ба Telegram (админ)
    try:
        await telegram_service.notify_new_order(
            order_id=order.id,
            game=order.game.get_name("tj"),
            product=order.product.get_name("tj"),
            player_id=order.player_id,
            amount=float(order.amount_tjs),
        )
    except Exception:  # noqa: BLE001
        logger.exception("Огоҳиномаи Telegram ноком шуд")

    return _order_out(order, _lang(lang))
