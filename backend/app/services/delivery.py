# -*- coding: utf-8 -*-
"""
🎮 Иҷрои худкори фармоишҳои пардохтшуда — FireLoot partner API
   (ҳамон API-и боти кӯҳнаи DANAT.TJ: POST /order → GET /order/{ref}).

Ҷараён (poller-и доимӣ, ҳар 30 сония, дар ҳар worker):
  status=paid & fl_ref=''        → CAS-эълон ('WIP') → POST /order
      · completed  → paid → delivered (CAS) + cashback + Telegram «расид»
      · processing → fl_ref='ref:<id>' → дар давраҳои баъдӣ GET /order/{ref}
            · completed → delivered
            · failed/refunded → status=failed + БАРГАРДОНИИ ПУЛ ба баланси
              мизоҷ (пули ноком гум намешавад) + AuditLog + хабар ба админ
      · хато       → мувофиқи код: гузаришӣ (network/429/5xx) → дубра таҳо
                     3 дақиқа; корӣ (invalid_uid, insufficient_balance, …)
                     → fl_ref='ERR:<code>' — бе кӯшиши дубра, дар лог + админ

Идемпотентӣ (муҳим: пул воқеӣ харҷ мешавад!):
  · ҳамаи гузаришҳо бо `UPDATE … WHERE status='paid'` (CAS) → байни worker-ҳо
    ҳам як дафъа;
  · танҳо фармоишҳои ТОЗА (updated_at ≤ 24 соат) ба кор мераванд — фармоишҳои
    кӯҳнаи paid (админ дастӣ иҷро карда буд, вале статусро нодида гирифтааст)
    АЗ ДАСТ ДОРЕ НАМЕРОВАНД → хатогии дубра-фурӯш нест;
  · cashback худаш идемпотент аст (coins.grant_order_cashback);
  · баргардони пул ҳам бо CAS (`status='paid'`), ҳам бо сатри
    `refund`-и ягона барои ҳар фармоиш → ҳеҷ гоҳ баргардонии дубра нест.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from decimal import Decimal

import httpx
from sqlalchemy import or_, select, true, update
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import (
    AuditLog,
    BalanceTransaction,
    BalanceTransactionKind,
    Order,
    OrderStatus,
    Product,
)
from app.services import coins, telegram_service, wallet

logger = logging.getLogger("delivery")

_FRESH_HOURS = 24          # тозаӣ: танҳо фармоишҳои ≤24 соат
_WIP_STALE_MIN = 3         # WIP-и кӯҳна = кӯшиши паст → барқарор → дубра
_POLL_EVERY = 30.0

_CLAIM = "WIP"
_REF_PFX = "ref:"
_ERR_PFX = "ERR:"

# Гузаришӣ = дубра таҳо (баъди WIP-stale-reset); корӣ = бе кӯшиши дубра
_TRANSIENT_MARKS = ("network", "timeout", "rate_limited", "http_5", "service_unavailable")


def configured() -> bool:
    return bool(settings.FIRELOOT_API_URL and settings.FIRELOOT_API_KEY)


def _base() -> str:
    return (settings.FIRELOOT_API_URL or "https://partner.firelootshop.com/api/v1").rstrip("/")


async def _fl(method: str, path: str, *, json: dict | None = None, timeout: float = 20.0) -> dict:
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.FIRELOOT_API_KEY}",
        "User-Agent": "DonatshopBot/1.0",
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.request(method, f"{_base()}/{path.lstrip('/')}", json=json, headers=headers)
    data = None
    try:
        data = resp.json()
    except ValueError:
        pass
    if resp.status_code >= 400:
        code = ""
        if isinstance(data, dict):
            err = data.get("error") if isinstance(data.get("error"), dict) else {}
            code = str(err.get("code") or data.get("code") or "")
        raise RuntimeError(code or f"http_{resp.status_code}")
    if not isinstance(data, dict):
        raise RuntimeError("invalid_response")
    return data


def _cas(db: Session, order_id: int, where_extra, **values) -> int:
    """Амният: танҳо аз `paid` (бо шарти иловагӣ) + ҳамаи ивазҳо дар як UPDATE."""
    res = db.execute(
        update(Order)
        .where(Order.id == order_id, Order.status == OrderStatus.PAID, where_extra)
        .values(**values)
    )
    db.commit()
    return int(res.rowcount or 0)


async def _notify_failed(
    order_id: int, code: str, refunded: Decimal | None = None
) -> None:
    extra = (
        f"\n💰 Пул ба баланси мизоҷ баргардонда шуд: +{refunded} TJS"
        if refunded
        else ""
    )
    try:
        await telegram_service.notify_admin(
            f"❌ Фармоиш #{order_id} ба бозигар расонда нашуд: <code>{code}</code>\n"
            f"Аз панели админ дастӣ ҷо кунед.{extra}"
        )
    except Exception:  # noqa: BLE001
        logger.warning("delivery: notify_admin ноком (#%s)", order_id, exc_info=True)


async def _finish(db: Session, order_id: int, ref: str) -> bool:
    """paid → delivered (CAS) + cashback + AuditLog + Telegram. Агар каси дигар
    пештар расонида бошад — ҳеҷ кор намекунад (rowcount=0)."""
    stored = f"{_REF_PFX}{ref}" if ref else ""
    if _cas(db, order_id, true(), status=OrderStatus.DELIVERED, fl_ref=stored) != 1:
        db.rollback()
        return False
    order = db.get(Order, order_id)
    try:
        coins.grant_order_cashback(db, order=order)
        db.add(
            AuditLog(
                action="order_delivered",
                entity="order",
                entity_id=str(order_id),
                details=f"auto (FireLoot {ref or 'ok'})",
            )
        )
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.warning("delivery: cashback/audit ноком (#%s)", order_id, exc_info=True)
    try:
        await telegram_service.notify_order_delivered(order_id, order.telegram_chat_id)
    except Exception:  # noqa: BLE001
        logger.warning("delivery: notify ноком (#%s)", order_id, exc_info=True)
    logger.info("🎮 Фармоиш #%s расид (FireLoot %s)", order_id, ref or "-")
    return True


def _refund_order(db: Session, order: Order, code: str) -> Decimal:
    """💰 Пули пардохтшудаи фармоиши ноком → баланси мизоҷ.

    Идемпотент: танҳо як сатри `refund` барои як фармоиш — баргардонии
    дубра ғайриимкон аст. Ҳамаи намудҳои пардохт (balance / dc_wallet)
    → балансҳои дохилии сайт: мол расонда нашуд → пул бояд баргардад."""
    if order.user_id is None:
        return Decimal("0.00")
    try:
        amount = Decimal(str(order.amount_tjs or 0))
    except Exception:  # noqa: BLE001
        logger.warning("delivery: маблағи нодуруст (#%s): %r", order.id, order.amount_tjs)
        return Decimal("0.00")
    if amount <= 0:
        return Decimal("0.00")

    exists = db.scalar(
        select(BalanceTransaction.id)
        .where(
            BalanceTransaction.order_id == order.id,
            BalanceTransaction.kind == BalanceTransactionKind.REFUND,
        )
        .limit(1)
    )
    if exists is not None:
        return Decimal("0.00")

    # AuditLog ПЕШ аз пул: дар як commit бо баланс мемонад
    # (агар баргардон ноком шавад → rollback ҳардуро пок мекунад).
    db.add(
        AuditLog(
            action="order_refunded",
            entity="order",
            entity_id=str(order.id),
            details=f"+{amount} TJS → user {order.user_id} ({code})",
        )
    )
    try:
        wallet.refund_balance(
            db,
            user_id=order.user_id,
            amount=amount,
            reason=f"Баргардон: фармоиши ноком №{order.id} ({code})",
            order_id=order.id,
        )
    except Exception:  # noqa: BLE001
        logger.exception("delivery: баргардон ноком (#%s)", order.id)
        return Decimal("0.00")
    return amount


async def _fail(db: Session, order_id: int, code: str) -> bool:
    """paid → failed (CAS — танҳо як бор) + БАРГАРДОНИИ ПУЛ + AuditLog + Telegram.

    Мол расонда нашод → пул фавран ба баланси мизоҷ бармегардад
    (пули фармоиши ноком беҷуброн гум намешавад).
    Ҳифз аз дубра: CAS (`status='paid'`) + сатри `refund`-и ягона.
    Барқарори дастӣ: админ ба `delivered` мегузорад — баргардонро дар он
    ҳолат аз баланс бурдан лозим (панели админ → баланс)."""
    if (
        _cas(
            db,
            order_id,
            true(),
            status=OrderStatus.FAILED,
            fl_ref=f"{_ERR_PFX}{code}"[:64],
        )
        != 1
    ):
        return False  # каси дигар пештар ноком кард — такрор манъ

    order = db.get(Order, order_id)
    refunded = _refund_order(db, order, code) if order is not None else Decimal("0.00")
    db.add(
        AuditLog(
            action="order_delivery_failed",
            entity="order",
            entity_id=str(order_id),
            details=f"fireloot: {code}"
            + (f" | баргардон: +{refunded} TJS" if refunded else ""),
        )
    )
    db.commit()
    logger.error("🎮 Фармоиш #%s иҷро ноком: %s", order_id, code)
    await _notify_failed(order_id, code, refunded)
    return True


async def _deliver(db: Session, order: Order) -> None:
    """CAS-эълон → POST /order → (completed | processing | хато)."""
    product = db.get(Product, order.product_id) if order.product_id else None
    sku = (product.sku if product else "") or ""
    uid = (order.player_id or "").strip()
    if not sku or not uid:
        await _fail(db, order.id, f"missing_{'sku' if not sku else 'uid'}")
        return

    # Эълон: ягона дар байни worker-ҳо (баъди эълон updated_at нав мешавад)
    if _cas(db, order.id, or_(Order.fl_ref.is_(None), Order.fl_ref == ""), fl_ref=_CLAIM) != 1:
        return

    try:
        data = await _fl(
            "POST",
            "/order",
            json={"external_id": f"order-{order.id}", "sku": sku, "uid": uid},
            timeout=30.0,
        )
    except Exception as exc:  # noqa: BLE001
        code = str(exc).strip() or exc.__class__.__name__
        if any(m in code for m in _TRANSIENT_MARKS):
            # гузаришӣ: WIP мемонад → 3 дақиқа баъд сикл аз сар кӯшиш мекунад
            logger.warning("delivery: гузаришӣ (#%s) — дубра таҳо: %s", order.id, code)
        else:
            await _fail(db, order.id, code)
        return

    st = str(data.get("status") or "").lower()
    ref = str(data.get("order_id") or data.get("reference") or "").strip()
    if st == "completed":
        await _finish(db, order.id, ref)
    elif st == "processing" and ref:
        _cas(db, order.id, true(), fl_ref=f"{_REF_PFX}{ref}")
        logger.info("🎮 Фармоиш #%s → FireLoot processing (%s)", order.id, ref)
    else:
        await _fail(db, order.id, st or "unknown_status")


async def _poll_ref(db: Session, order: Order, ref: str) -> None:
    try:
        data = await _fl("GET", f"/order/{ref}", timeout=15.0)
    except Exception as exc:  # noqa: BLE001
        logger.warning("delivery: санҷиши %s ноком: %s", ref, exc)
        return
    st = str(data.get("status") or "").lower()
    if st == "completed":
        await _finish(db, order.id, ref)
    elif st in ("failed", "refunded"):
        await _fail(db, order.id, f"fireloot_{st}")
    elif st == "processing":
        pass  # интизорӣ
    else:
        logger.warning("delivery: статуси номаълум барои %s: %r", ref, st)


async def poller_once() -> None:
    if not configured():
        return
    cutoff = datetime.utcnow() - timedelta(hours=_FRESH_HOURS)
    stale_wip = datetime.utcnow() - timedelta(minutes=_WIP_STALE_MIN)
    with SessionLocal() as db:
        rows = db.scalars(
            select(Order).where(
                Order.status == OrderStatus.PAID,
                Order.updated_at >= cutoff,
                or_(
                    Order.fl_ref.is_(None),
                    Order.fl_ref == "",
                    Order.fl_ref == _CLAIM,
                    Order.fl_ref.like(f"{_REF_PFX}%"),
                ),
            )
        ).all()
        for order in rows:
            ref = (order.fl_ref or "").strip()
            try:
                if ref.startswith(_REF_PFX):
                    await _poll_ref(db, order, ref[len(_REF_PFX):])
                elif ref == _CLAIM:
                    updated = order.updated_at or datetime.utcnow()
                    if updated <= stale_wip:
                        # кӯшиши паст монд → иҷозати дубра
                        _cas(db, order.id, Order.fl_ref == _CLAIM, fl_ref="")
                        logger.info("delivery: WIP-и кӯҳна барқарор шуд (#%s)", order.id)
                elif ref == "":
                    await _deliver(db, order)
                # ERR:* → бе кӯшиш (аллакай дар лог/аудит/Telegram)
            except Exception:  # noqa: BLE001
                logger.warning("delivery: хатогии фармоиш #%s", order.id, exc_info=True)
                try:
                    db.rollback()
                except Exception:  # noqa: BLE001
                    pass


async def poller_loop() -> None:
    if not configured():
        logger.info("🎮 Delivery poller: FIRELOOT_API_KEY нест — хомӯш")
        return
    logger.info("🎮 Delivery poller оғоз ёфт (ҳар %ss, тозаӣ=%sh)", int(_POLL_EVERY), _FRESH_HOURS)
    while True:
        try:
            await poller_once()
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.warning("delivery: хатогии давр", exc_info=True)
        await asyncio.sleep(_POLL_EVERY)
