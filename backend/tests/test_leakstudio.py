# -*- coding: utf-8 -*-
"""🎯 LEAK STUDIO BD — провайдери нави иҷро (лайкҳо / авто-лайк).

Сенарияҳо:
  1  Модел/схема: provider + ls_kind дар ProductUpsert/ProductOut кор мекунад
  2  Клиент: ҷавоби completed / pending / лайкии рӯзӣ / 400 / 429 / сет
  3  Деливери: completed → delivered; rejected → failed + баргардон;
     pending → LSP:* (бе дубра); ambiguous → LSP:unknown:* (бе дубра);
     429 → WIP (дубра бехатар)
  4  Вебхук: имзои HMAC → completed расонда / cancelled баргардон;
     имзои нодуруст → 401
  5  Админ: /admin/leakstudio/packages (бастаҳои воқеӣ)
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import uuid

import httpx
from fastapi.testclient import TestClient

from app.config import settings
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
from app.services import delivery, leakstudio
from test_delivery_refund import PASSWORD, _balance

# Калиди тест (худи файл ҷуброн мекунад — .env-и воқеӣ дар ин ҷо нест)
_LS_KEY = "ls_test_key_0123456789"


# =====================================================================
# 🧰 Ёрӣ
# =====================================================================
def _admin_token(client: TestClient) -> str:
    r = client.post(
        "/api/auth/login",
        json={"phone": settings.ADMIN_PHONE, "password": settings.ADMIN_PASSWORD},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _register(client: TestClient) -> int:
    phone = "992" + str(uuid.uuid4().int % 1_000_000_000).zfill(9)
    r = client.post(
        "/api/auth/register",
        json={"phone": phone, "password": PASSWORD, "language": "tj"},
    )
    assert r.status_code == 200, r.text
    me = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {r.json()['access_token']}"},
    )
    assert me.status_code == 200, me.text
    return me.json()["id"]


def _ls_product_and_order(
    user_id: int, *, kind: str = "likes", amount: int = 220, sku: str = ""
) -> int:
    """Фармоиши `paid` бо маҳсулоти Leak Studio (provider=leakstudio)."""
    db = SessionLocal()
    try:
        game = db.query(Game).filter(Game.slug == "free-fire").first()
        assert game is not None, "бозии seed ёфт нашуд"
        product = Product(
            game_id=game.id,
            name_tj=f"LS {kind} {uuid.uuid4().hex[:6]}",
            price_tjs=5,
            amount=amount,
            provider="leakstudio",
            ls_kind=kind,
            sku=sku,
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        order = Order(
            user_id=user_id,
            game_id=game.id,
            product_id=product.id,
            player_id="1234567890",
            quantity=1,
            amount_tjs=5,
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


def _get_order(order_id: int) -> Order:
    db = SessionLocal()
    try:
        order = db.get(Order, order_id)
        assert order is not None
        db.expunge(order)
        return order
    finally:
        db.close()


def _run_deliver(order_id: int) -> None:
    """`_deliver` бо сессияи тоза (Telegram дар тест хомӯш)."""
    db = SessionLocal()
    try:
        order = db.get(Order, order_id)
        assert order is not None
        asyncio.run(delivery._deliver(db, order))
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


def _set_balance(user_id: int, value: float) -> None:
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        assert user is not None
        user.balance = value
        db.commit()
    finally:
        db.close()


class _FakeTransport:
    """Ҷуброни `leakstudio._transport` → (status, data) ё хато."""

    def __init__(self, status: int = 200, data=None, raise_exc: Exception | None = None):
        self.status = status
        self.data = data
        self.raise_exc = raise_exc
        self.calls: list[tuple[str, str, dict | None]] = []

    async def __call__(self, method, url, *, json_body, timeout):
        self.calls.append((method, url, json_body))
        if self.raise_exc is not None:
            raise self.raise_exc
        return self.status, self.data


# =====================================================================
# 1. МОДЕЛ / СХЕМА
# =====================================================================
def test_product_upsert_accepts_provider_fields(client: TestClient):
    """POST /admin/products provider/ls_kind/sku қабул мекунад → ProductOut."""
    adm = _admin_token(client)
    db = SessionLocal()
    try:
        game_id = db.query(Game).filter(Game.slug == "free-fire").first().id
    finally:
        db.close()
    r = client.post(
        "/api/admin/products",
        headers={"Authorization": f"Bearer {adm}"},
        json={
            "game_id": game_id,
            "name_tj": "Лайкҳо 220 (тест)",
            "price_tjs": 7,
            # 💲 мисли FireLoot: харид = BDT × курс → cost_tjs дохил мешавад
            "cost_tjs": 0.51,
            "amount": 220,
            "provider": "leakstudio",
            "ls_kind": "likes",
            "sku": "",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["provider"] == "leakstudio"
    assert body["ls_kind"] == "likes"
    assert abs(float(body["cost_tjs"]) - 0.51) < 0.005  # харид нигоҳ дошта шуд

    # Дар каталоги умумӣ низ (UI-и сомона ҳаминро мебинад)
    r2 = client.get("/api/games/free-fire", params={"lang": "tj"})
    assert r2.status_code == 200, r2.text
    got = [p for p in r2.json()["products"] if p["id"] == body["id"]]
    assert got and got[0]["provider"] == "leakstudio"
    assert got[0]["ls_kind"] == "likes"


# =====================================================================
# 2. КЛИЕНТ — ҷавобҳо
# =====================================================================
def test_client_completed_and_daily_max(monkeypatch):
    monkeypatch.setattr(settings, "LEAKSTUDIO_API_KEY", _LS_KEY)

    ok = _FakeTransport(200, {
        "success": True, "status": 1, "LikesGiven": 220,
        "trx": [{"transaction_id": "TXN1", "order_id": "API_LIK_1"}],
    })
    monkeypatch.setattr(leakstudio, "_transport", ok)
    res = asyncio.run(leakstudio.purchase("likes", uid="123", amount=220))
    assert res["outcome"] == "completed"
    assert res["ref"] == "API_LIK_1"
    # Дархост: likes = 220 (миқдори воқеӣ), uid дуруст
    assert ok.calls[0][2] == {"uid": "123", "likes": 220}

    # Лайкии рӯзӣ пур → ҳеҷ харҷ → rejected (баргардон мешавад)
    maxd = _FakeTransport(200, {
        "success": False, "status": 2, "error": "Already received max likes for today.",
    })
    monkeypatch.setattr(leakstudio, "_transport", maxd)
    res2 = asyncio.run(leakstudio.purchase("likes", uid="123", amount=220))
    assert res2["outcome"] == "rejected"
    assert res2["code"] == "already_likes_today"


def test_client_error_mapping(monkeypatch):
    monkeypatch.setattr(settings, "LEAKSTUDIO_API_KEY", _LS_KEY)

    # 400 insufficient balance → корӣ (бе дубра) + коди тоза
    monkeypatch.setattr(
        leakstudio, "_transport", _FakeTransport(400, {"message": "Insufficient balance"})
    )
    try:
        asyncio.run(leakstudio.purchase("likes", uid="1", amount=100))
        raise AssertionError("LSError интизор буд")
    except leakstudio.LSError as exc:
        assert exc.code == "insufficient_balance"
        assert exc.transient is False

    # 429 → транзиентӣ (дубра бехатар: дархост қабул нашудааст)
    monkeypatch.setattr(leakstudio, "_transport", _FakeTransport(429, {"message": "slow down"}))
    try:
        asyncio.run(leakstudio.packages("likes"))
        raise AssertionError("LSError интизор буд")
    except leakstudio.LSError as exc:
        assert exc.code == "rate_limited"
        assert exc.transient is True

    # Сет → "network" (амнияти пул: дубраи худкор = харҷи дубра)
    monkeypatch.setattr(
        leakstudio,
        "_transport",
        _FakeTransport(raise_exc=httpx.ConnectError("connection refused")),
    )
    try:
        asyncio.run(leakstudio.purchase("likes", uid="1", amount=100))
        raise AssertionError("LSError интизор буд")
    except leakstudio.LSError as exc:
        assert exc.code == "network"
        assert exc.transient is False  # → delivery: LSP:unknown (бе дубра)


# =====================================================================
# 3. ДЕЛИВЕРИ
# =====================================================================
def test_deliver_completed(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "LEAKSTUDIO_API_KEY", _LS_KEY)
    monkeypatch.setattr(
        leakstudio,
        "_transport",
        _FakeTransport(200, {
            "success": True, "status": 1,
            "trx": [{"order_id": "API_LIK_OK"}],
        }),
    )
    uid = _register(client)
    oid = _ls_product_and_order(uid)
    _run_deliver(oid)

    order = _get_order(oid)
    assert order.status == OrderStatus.DELIVERED
    assert order.fl_ref == "ref:API_LIK_OK"
    db = SessionLocal()
    try:
        audit = (
            db.query(AuditLog)
            .filter(AuditLog.entity_id == str(oid), AuditLog.action == "order_delivered")
            .first()
        )
        assert audit is not None and "LeakStudio" in audit.details
    finally:
        db.close()


def test_deliver_rejected_refunds(client: TestClient, monkeypatch):
    """Лайкии рӯзӣ пур → rejected → failed + ПУЛ БАРАМЕГАРДАД."""
    monkeypatch.setattr(settings, "LEAKSTUDIO_API_KEY", _LS_KEY)
    monkeypatch.setattr(
        leakstudio,
        "_transport",
        _FakeTransport(200, {"success": False, "status": 2, "error": "max"}),
    )
    uid = _register(client)
    oid = _ls_product_and_order(uid)
    _set_balance(uid, 10.0)

    _run_deliver(oid)

    order = _get_order(oid)
    assert order.status == OrderStatus.FAILED
    assert (order.fl_ref or "").startswith("ERR:")
    assert "already_likes_today" in (order.fl_ref or "")
    assert _refund_count(oid) == 1
    assert _balance(uid) == 15.0  # 10 + 5 баргардон


def test_deliver_pending_marks_lsp_no_retry(client: TestClient, monkeypatch):
    """pending → fl_ref=LSP:* (харҷ шуд) → ДУБРА НАКОШ (idempotent)."""
    monkeypatch.setattr(settings, "LEAKSTUDIO_API_KEY", _LS_KEY)
    transport = _FakeTransport(200, {
        "success": True, "status": "pending",
        "trx": [{"order_id": "ORD_PEND_1"}],
    })
    monkeypatch.setattr(leakstudio, "_transport", transport)
    uid = _register(client)
    oid = _ls_product_and_order(uid, kind="diamonds", sku="25_diamonds")

    _run_deliver(oid)
    order = _get_order(oid)
    assert order.status == OrderStatus.PAID
    assert order.fl_ref == "LSP:ORD_PEND_1"
    assert len(transport.calls) == 1

    # Такроран `_deliver` → claim CAS намегирад → ҳеҷ дархости дуюм
    _run_deliver(oid)
    assert len(transport.calls) == 1
    assert _get_order(oid).status == OrderStatus.PAID


def test_deliver_ambiguous_no_double_charge(client: TestClient, monkeypatch):
    """Сет/таймаут → LSP:unknown:* — бе дубра, бе баргардон (админ месанҷад)."""
    monkeypatch.setattr(settings, "LEAKSTUDIO_API_KEY", _LS_KEY)
    monkeypatch.setattr(
        leakstudio,
        "_transport",
        _FakeTransport(raise_exc=httpx.ConnectError("boom")),
    )
    uid = _register(client)
    oid = _ls_product_and_order(uid)

    _run_deliver(oid)
    order = _get_order(oid)
    assert order.status == OrderStatus.PAID
    assert (order.fl_ref or "").startswith("LSP:unknown:")
    assert _refund_count(oid) == 0  # харҷ шояд шуд → баргардон НАКОШ

    # Дубра → ҳеҷ дархости дуюм (пули воқеӣ ҳифз шуд)
    transport2 = _FakeTransport(200, {"success": True, "status": 1})
    monkeypatch.setattr(leakstudio, "_transport", transport2)
    _run_deliver(oid)
    assert len(transport2.calls) == 0


def test_deliver_429_keeps_wip(client: TestClient, monkeypatch):
    """429 → дархост қабул нашуд → WIP мемонад → дубраи баъдӣ бехатар аст."""
    monkeypatch.setattr(settings, "LEAKSTUDIO_API_KEY", _LS_KEY)
    monkeypatch.setattr(leakstudio, "_transport", _FakeTransport(429, {"message": "x"}))
    uid = _register(client)
    oid = _ls_product_and_order(uid)

    _run_deliver(oid)
    order = _get_order(oid)
    assert order.status == OrderStatus.PAID
    assert order.fl_ref == "WIP"  # → WIP-stale-reset → дубра


# =====================================================================
# 4. ВЕБХУК
# =====================================================================
def _sign(body: bytes) -> dict[str, str]:
    sig = "sha256=" + hmac.new(_LS_KEY.encode(), body, hashlib.sha256).hexdigest()
    return {"X-LS-Signature": sig, "Content-Type": "application/json"}


def test_webhook_completed_delivers(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "LEAKSTUDIO_API_KEY", _LS_KEY)
    uid = _register(client)
    oid = _ls_product_and_order(uid)
    # Чунон ки delivery дар pending гузошта буд
    db = SessionLocal()
    try:
        db.get(Order, oid).fl_ref = "LSP:ORD_WH_1"
        db.commit()
    finally:
        db.close()

    body = json.dumps({
        "event": "order.status", "order_id": "ORD_WH_1",
        "status": "completed", "occurred_at": "2026-11-20T10:00:00Z",
    }).encode()
    r = client.post("/api/webhook/leakstudio", content=body, headers=_sign(body))
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}
    assert _get_order(oid).status == OrderStatus.DELIVERED


def test_webhook_bad_signature_rejected(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "LEAKSTUDIO_API_KEY", _LS_KEY)
    body = json.dumps({"event": "order.status", "order_id": "X", "status": "completed"}).encode()
    r = client.post(
        "/api/webhook/leakstudio",
        content=body,
        headers={"X-LS-Signature": "sha256=" + "0" * 64,
                 "Content-Type": "application/json"},
    )
    assert r.status_code == 401


def test_webhook_cancelled_refunds(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "LEAKSTUDIO_API_KEY", _LS_KEY)
    uid = _register(client)
    oid = _ls_product_and_order(uid)
    _set_balance(uid, 10.0)
    db = SessionLocal()
    try:
        db.get(Order, oid).fl_ref = "LSP:ORD_WH_2"
        db.commit()
    finally:
        db.close()

    body = json.dumps({
        "event": "order.status", "order_id": "ORD_WH_2",
        "status": "cancelled", "occurred_at": "2026-11-20T10:00:00Z",
    }).encode()
    r = client.post("/api/webhook/leakstudio", content=body, headers=_sign(body))
    assert r.status_code == 200, r.text
    order = _get_order(oid)
    assert order.status == OrderStatus.FAILED
    assert _refund_count(oid) == 1
    assert _balance(uid) == 15.0


# =====================================================================
# 5. АДМИН — бастаҳои воқеӣ
# =====================================================================
def test_admin_ls_packages(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "LEAKSTUDIO_API_KEY", _LS_KEY)
    monkeypatch.setattr(
        leakstudio,
        "_transport",
        _FakeTransport(200, {
            "packages": [{"name": "100_likes", "likes": 100, "price": "4.00"}],
        }),
    )
    adm = _admin_token(client)
    r = client.get(
        "/api/admin/leakstudio/packages",
        headers={"Authorization": f"Bearer {adm}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["configured"] is True
    assert body["packages"]["likes"][0]["name"] == "100_likes"
    assert "auto_likes" in body["packages"]


def test_admin_ls_packages_requires_key(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "LEAKSTUDIO_API_KEY", "")
    adm = _admin_token(client)
    r = client.get(
        "/api/admin/leakstudio/packages",
        headers={"Authorization": f"Bearer {adm}"},
    )
    assert r.status_code == 400
