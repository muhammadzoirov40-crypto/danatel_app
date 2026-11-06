# -*- coding: utf-8 -*-
"""
➕ Санҷиши admin_extra + Pricing-и нав (талаби соҳиб, 06.11.2026):
  · GET /api/admin/games/{slug}/full  — sku + cost_tjs дар Нархҳо
  · GET  /api/admin/orders/{id}/detail — кодҳои махфияши фармоиш
  · GET  /api/admin/stats/profit      — фоида = даромад − харид
  · POST /api/admin/products/adjust-prices mode="cost" — пойдор (такрорӣ
    ҳамон нархро медиҳад) + mode="current" қаблан чун буд
  · POST /api/admin/products/fill-costs — FireLOOT хомӯш → 400 (бе дастрасӣ)
"""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import Game, Order, OrderStatus, Product


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def admin_token(client: TestClient) -> str:
    r = client.post(
        "/api/auth/login",
        json={"phone": settings.ADMIN_PHONE, "password": settings.ADMIN_PASSWORD},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def free_fire_product(db: Session) -> tuple[Game, Product]:
    game = db.query(Game).filter(Game.slug == "free-fire").first()
    assert game is not None, "бозии seed ёфт нашуд"
    product = (
        db.query(Product)
        .filter(Product.game_id == game.id, Product.is_active.is_(True))
        .order_by(Product.id.asc())
        .first()
    )
    assert product is not None
    return game, product


# =====================================================================
# 1. /games/{slug}/full — sku + cost_tjs
# =====================================================================
def test_game_full_exposes_sku_and_cost(client: TestClient):
    token = admin_token(client)
    r = client.get("/api/admin/games/free-fire/full", headers=auth(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["slug"] == "free-fire"
    assert body["products"], "маҳсулотҳо холӣ"
    p0 = body["products"][0]
    for key in ("id", "name", "price_tjs", "amount", "region", "sku", "cost_tjs"):
        assert key in p0, f"куҷо {key}?"


def test_game_full_requires_admin(client: TestClient):
    assert client.get("/api/admin/games/free-fire/full").status_code == 401


# =====================================================================
# 2. PATCH cost_tjs → /full бармегардонад
# =====================================================================
def test_patch_cost_then_full_returns_it(client: TestClient):
    token = admin_token(client)
    db = SessionLocal()
    try:
        _, product = free_fire_product(db)
        pid = product.id
    finally:
        db.close()

    r = client.patch(
        f"/api/admin/products/{pid}", json={"cost_tjs": 5.5}, headers=auth(token)
    )
    assert r.status_code == 200, r.text

    try:
        r = client.get("/api/admin/games/free-fire/full", headers=auth(token))
        assert r.status_code == 200
        row = next((p for p in r.json()["products"] if p["id"] == pid), None)
        assert row is not None
        assert float(row["cost_tjs"]) == 5.5
    finally:
        # ↩️ Барқарорӣ → тестҳои дигар (бо product-и seed) осеб набинанд
        db = SessionLocal()
        try:
            p = db.get(Product, pid)
            p.cost_tjs = 0
            db.commit()
        finally:
            db.close()


# =====================================================================
# 3. Кодҳои махфияши фармоиш
# =====================================================================
def _mk_order(db: Session, **kw) -> Order:
    game, product = free_fire_product(db)
    order = Order(
        user_id=None,
        game_id=game.id,
        product_id=product.id,
        player_id=kw.get("player_id", "2287367355"),
        player_nickname=kw.get("player_nickname", "DAVRON"),
        quantity=kw.get("quantity", 1),
        amount_tjs=kw.get("amount_tjs", product.price_tjs),
        payment_method="dc_wallet",
        status=kw.get("status", OrderStatus.PAID),
        language="tj",
        fl_ref=kw.get("fl_ref", "ref:777"),
        transaction_id=kw.get("transaction_id", "TX-9"),
        dc_invoice_id=kw.get("dc_invoice_id", "INV-9"),
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def test_order_detail_hidden_codes(client: TestClient):
    token = admin_token(client)
    db = SessionLocal()
    try:
        order = _mk_order(db)
        oid = order.id
    finally:
        db.close()

    r = client.get(f"/api/admin/orders/{oid}/detail", headers=auth(token))
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["id"] == oid
    assert d["fl_ref"] == "ref:777"
    assert d["transaction_id"] == "TX-9"
    assert d["dc_invoice_id"] == "INV-9"
    assert d["player_nickname"] == "DAVRON"
    assert d["quantity"] == 1
    assert d["language"] == "tj"
    assert d["payment_method"] == "dc_wallet"
    assert d["created_at"]


def test_order_detail_404_and_auth(client: TestClient):
    assert client.get("/api/admin/orders/99999999/detail").status_code == 401
    token = admin_token(client)
    r = client.get("/api/admin/orders/99999999/detail", headers=auth(token))
    assert r.status_code == 404


# =====================================================================
# 4. ФОИДА = даромад − харид (танҳо маҳсулотҳои бо cost)
# =====================================================================
def test_profit_counts_costed_order(client: TestClient):
    token = admin_token(client)
    h = auth(token)

    before = client.get("/api/admin/stats/profit", headers=h)
    assert before.status_code == 200, before.text
    b = before.json()

    # 📌 Маҳсулоти АЛОҲИДАи ин тест → фармоишҳои кӯҳнаи seed ба фоида
    #    даромад намекунанд (тафовут танҳо 1.1 мешавад)
    slug, pid = _own_game_product(client, h)
    r = client.patch(f"/api/admin/products/{pid}", json={"cost_tjs": 7}, headers=h)
    assert r.status_code == 200, r.text

    db = SessionLocal()
    try:
        game = db.query(Game).filter(Game.slug == slug).first()
        assert game is not None
        # 8.1 фурӯш − 7 харид = 1.1 фоида (мисали соҳиб)
        order = Order(
            user_id=None,
            game_id=game.id,
            product_id=pid,
            player_id="2287367355",
            quantity=1,
            amount_tjs=8.1,
            payment_method="dc_wallet",
            status=OrderStatus.PAID,
            language="tj",
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        oid = order.id
    finally:
        db.close()

    try:
        after = client.get("/api/admin/stats/profit", headers=h)
        assert after.status_code == 200
        a = after.json()

        assert abs((a["profit_total_tjs"] - b["profit_total_tjs"]) - 1.1) < 0.005
        assert abs((a["profit_today_tjs"] - b["profit_today_tjs"]) - 1.1) < 0.005
        assert a["costed_orders"] == b["costed_orders"] + 1
        assert a["costed_products"] >= 1
        assert a["revenue_costed_tjs"] > b["revenue_costed_tjs"]

        # тафсилоти фармоиш ҳамон мемонад
        r = client.get(f"/api/admin/orders/{oid}/detail", headers=h)
        assert r.status_code == 200
    finally:
        # ↩️ Барқарорӣ → %-и «аз харид» дар тестҳои баъдӣ танҳо маҳсулоти
        #    худи он тестро иваз кунад
        db = SessionLocal()
        try:
            p = db.get(Product, pid)
            p.cost_tjs = 0
            db.commit()
        finally:
            db.close()


def test_profit_requires_admin(client: TestClient):
    assert client.get("/api/admin/stats/profit").status_code == 401


# =====================================================================
# 5. %-и «аз харид» — ПОЙДОР (такрорӣ ҳамон нарх)
# =====================================================================
def _own_game_product(client: TestClient, h: dict) -> tuple[str, int]:
    slug = f"t-{uuid.uuid4().hex[:10]}"
    r = client.post(
        "/api/admin/games",
        json={"slug": slug, "name_tj": "Тест", "currency_tj": "алмос"},
        headers=h,
    )
    assert r.status_code == 200, r.text
    r = client.post(
        "/api/admin/products",
        json={
            "game_id": r.json()["id"],
            "name_tj": "Бастаи тест",
            "price_tjs": 10,
            "amount": 1,
        },
        headers=h,
    )
    assert r.status_code == 200, r.text
    return slug, r.json()["id"]


def test_adjust_prices_mode_cost_is_idempotent(client: TestClient):
    token = admin_token(client)
    h = auth(token)
    slug, pid = _own_game_product(client, h)

    # харид = 10 → 70% аз харид = 17 (нархи ҷорӣ ҳам 10)
    r = client.patch(
        f"/api/admin/products/{pid}", json={"cost_tjs": 10}, headers=h
    )
    assert r.status_code == 200, r.text

    r = client.post(
        "/api/admin/products/adjust-prices",
        json={"percent": 70, "mode": "cost"},
        headers=h,
    )
    assert r.status_code == 200, r.text
    assert r.json()["mode"] == "cost"
    assert r.json()["updated"] == 1

    # ТАКРОРӢ ҳамон 70% → ҳамон 17 (нархи харид асос мемонад!)
    r = client.post(
        "/api/admin/products/adjust-prices",
        json={"percent": 70, "mode": "cost"},
        headers=h,
    )
    assert r.status_code == 200
    assert r.json()["updated"] == 0

    r = client.get(f"/api/admin/games/{slug}/full", headers=h)
    row = next(p for p in r.json()["products"] if p["id"] == pid)
    assert float(row["price_tjs"]) == 17.0
    assert float(row["cost_tjs"]) == 10.0

    # mode="current" → 17 × 1.7 = 28.9 (рафтори қаблӣ дастрас аст)
    r = client.post(
        "/api/admin/products/adjust-prices",
        json={"percent": 70, "mode": "current"},
        headers=h,
    )
    assert r.status_code == 200
    # current → ҳамаи нархҳои мусбат (миқдораш аз маҳсулотҳои дигар вобаста)
    assert r.json()["updated"] >= 1
    r = client.get(f"/api/admin/games/{slug}/full", headers=h)
    row = next(p for p in r.json()["products"] if p["id"] == pid)
    assert float(row["price_tjs"]) == 28.9


def test_adjust_prices_cost_mode_skips_products_without_cost(client: TestClient):
    token = admin_token(client)
    h = auth(token)
    slug, pid = _own_game_product(client, h)

    r = client.post(
        "/api/admin/products/adjust-prices",
        json={"percent": 50, "mode": "cost"},
        headers=h,
    )
    assert r.status_code == 200
    # cost=0 → НАРХИ ҲАМОН маҳсулот ҳеҷ иваз намешавад («аз харид» маъно надорад)
    r = client.get(f"/api/admin/games/{slug}/full", headers=h)
    row = next(p for p in r.json()["products"] if p["id"] == pid)
    assert float(row["price_tjs"]) == 10.0
    assert float(row["cost_tjs"] or 0) == 0.0


def test_adjust_prices_rejects_bad_mode(client: TestClient):
    token = admin_token(client)
    r = client.post(
        "/api/admin/products/adjust-prices",
        # percent=0 → бе ивазкунии нархҳо; танҳо санҷиши «mode нодуруст → current»
        json={"percent": 0, "mode": "hack"},
        headers=auth(token),
    )
    assert r.status_code == 200  # mode нодуруст → ба "current" мефармояд
    assert r.json()["mode"] == "current"


# =====================================================================
# 6. fill-costs — FireLoot хомӯш → 400 (бе кӯшиши дастрасии берунӣ)
# =====================================================================
def test_fill_costs_requires_fireloot(client: TestClient):
    token = admin_token(client)
    r = client.post(
        "/api/admin/products/fill-costs",
        json={"rate": 11},
        headers=auth(token),
    )
    assert r.status_code == 400


def test_fill_costs_validation(client: TestClient):
    token = admin_token(client)
    r = client.post(
        "/api/admin/products/fill-costs",
        json={"rate": -1},
        headers=auth(token),
    )
    assert r.status_code == 422
