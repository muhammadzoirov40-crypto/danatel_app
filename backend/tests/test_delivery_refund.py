# -*- coding: utf-8 -*-
"""🔁 Баргардони пул ҳангоми нокомии деливери (FireLoot → failed).

Сенарияҳо:
  1  Фармоиши paid + баланс → `_fail` → статус=failed, ПУЛ ба баланс
     бармегардад (+ сатри `refund` + AuditLog-ҳо)
  2  Такроран `_fail` → ҳеҷ кор: баргаронии дубра нест (CAS + идемпотентия)
  3  Фармоиши бе корбар (user_id=None) → нокомӣ бе баргардон (сабтҳо нест)
"""
from __future__ import annotations

import asyncio
import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.models import (
    AuditLog,
    BalanceTransaction,
    BalanceTransactionKind,
    Game,
    Order,
    OrderStatus,
    Product,
    User,
)
from app.services import delivery

PASSWORD = "TestPassw0rd!"


# =====================================================================
# 🧰 Ёрӣ
# =====================================================================
def _register(client: TestClient) -> int:
    """Қайди корбар → user_id."""
    phone = "992" + str(uuid.uuid4().int % 1_000_000_000).zfill(9)
    r = client.post(
        "/api/auth/register",
        json={"phone": phone, "password": PASSWORD, "language": "tj"},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    r = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _paid_order(user_id: int, amount: float = 5.0) -> int:
    """Фармоиши `paid` (аз баланс) дар DB месозад."""
    db = SessionLocal()
    try:
        game = db.query(Game).filter(Game.slug == "free-fire").first()
        assert game is not None, "бозии seed ёфт нашуд"
        product = (
            db.query(Product)
            .filter(Product.game_id == game.id, Product.is_active.is_(True))
            .order_by(Product.id.asc())
            .first()
        )
        assert product is not None, "маҳсулоти seed ёфт нашуд"
        order = Order(
            user_id=user_id,
            game_id=game.id,
            product_id=product.id,
            player_id="123456789",
            quantity=1,
            amount_tjs=amount,
            payment_method="balance",
            status=OrderStatus.PAID,
            language="tj",
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        return order.id
    finally:
        db.close()


def _set_balance(user_id: int, value: float) -> None:
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        assert user is not None
        user.balance = value
        db.commit()
    finally:
        db.close()


def _balance(user_id: int) -> float:
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        assert user is not None
        return float(user.balance)
    finally:
        db.close()


def _fail_sync(order_id: int) -> bool:
    """`_fail` бо сесшни тоза (Telegram дар тест хомӯш)."""
    db = SessionLocal()
    try:
        return asyncio.run(delivery._fail(db, order_id, "test_failed"))
    finally:
        db.close()


def _refund_count(order_id: int) -> int:
    db = SessionLocal()
    try:
        return (
            db.query(BalanceTransaction)
            .filter(
                BalanceTransaction.order_id == order_id,
                BalanceTransaction.kind == BalanceTransactionKind.REFUND,
            )
            .count()
        )
    finally:
        db.close()


# =====================================================================
# 1–2. БАРГАРДОН + ИДЕМПОТЕНТЯ
# =====================================================================
def test_refund_on_delivery_failure(client: TestClient):
    """Нокомӣ → пул ба баланс бармегардад; дубра → ҳеҷ тағйир."""
    uid = _register(client)
    order_id = _paid_order(uid, amount=5.0)
    _set_balance(uid, 10.0)          # ҳамчун «пул аллакай канда шудааст»

    assert _fail_sync(order_id) is True

    # 💰 Баланс: 10 + 5 баргардон = 15
    assert _balance(uid) == 15.0

    db = SessionLocal()
    try:
        order = db.get(Order, order_id)
        assert order is not None
        assert order.status == OrderStatus.FAILED
        assert (order.fl_ref or "").startswith("ERR:")

        refunds = (
            db.query(BalanceTransaction)
            .filter(
                BalanceTransaction.order_id == order_id,
                BalanceTransaction.kind == BalanceTransactionKind.REFUND,
            )
            .all()
        )
        assert len(refunds) == 1
        assert float(refunds[0].amount) == 5.0
        assert float(refunds[0].balance_after) == 15.0

        # AuditLog-ҳо: нокомӣ + баргардон
        assert (
            db.query(AuditLog)
            .filter(
                AuditLog.action == "order_delivery_failed",
                AuditLog.entity_id == str(order_id),
            )
            .count()
            == 1
        )
        assert (
            db.query(AuditLog)
            .filter(
                AuditLog.action == "order_refunded",
                AuditLog.entity_id == str(order_id),
            )
            .count()
            == 1
        )
    finally:
        db.close()

    # 2️⃣ Такроран → CAS манъ мекунад: баланс, сатрҳо ҳамон
    assert _fail_sync(order_id) is False
    assert _balance(uid) == 15.0
    assert _refund_count(order_id) == 1


# =====================================================================
# 3. ФАРМОИШИ БЕ КОРБАР
# =====================================================================
def test_guest_order_fails_without_refund(client: TestClient):
    """Фармоиши бе user_id → нокомӣ бе баргардони баланс (сабтҳо нест)."""
    uid = _register(client)
    order_id = _paid_order(uid, amount=3.0)

    db = SessionLocal()
    try:
        order = db.get(Order, order_id)
        assert order is not None
        order.user_id = None          # мизоҷи меҳмон
        db.commit()
    finally:
        db.close()

    assert _fail_sync(order_id) is True

    db = SessionLocal()
    try:
        order = db.get(Order, order_id)
        assert order is not None
        assert order.status == OrderStatus.FAILED
        # ҳеҷ сатри баланс барои ин фармоиш нест
        assert _refund_count(order_id) == 0
        assert (
            db.query(AuditLog)
            .filter(
                AuditLog.action == "order_refunded",
                AuditLog.entity_id == str(order_id),
            )
            .count()
            == 0
        )
    finally:
        db.close()
