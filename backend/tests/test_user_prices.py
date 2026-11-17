# -*- coding: utf-8 -*-
"""
💰 Нархҳои шахсии корбарон (admin panel) — таъини соҳиб, 17.11.2026:
  · GET    /api/admin/user-prices?user_id=  — нархи кӯҳна + нархи шахсӣ
  · PUT    /api/admin/user-prices/{uid}/{pid} — гузоштан (>0; == кӯҳна → reset)
  · DELETE /api/admin/user-prices/{uid}/{pid} — барқарор ба нархи кӯҳна
  · Дастрасӣ: 401 бе токен · 403 корбари оддӣ · 404 корбар/маҳсулот · 422 нодуруст
  · GET /api/games/{slug} — вуруд → нархи ШАХСИИ корбар + min_price_tjs;
    бевуруд/корбари дигар → нархи кӯҳна (умумӣ)
  · Фармоиш: order.amount_tjs = нархи самаранӣ (шахсӣ) → корбари
    дигар/бевуруд → кӯҳна. ҲЕҶ ДАРВОЗАИ ПАРДОХТ БЕ ТАҒЙИРИ МАНТИҚ.
"""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import Game, Order, Product, UserProductPrice
from app.routers.lookup import DEFAULT_REGION

PASSWORD = "TestPassw0rd!"


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def admin_token(client: TestClient) -> str:
    r = client.post(
        "/api/auth/login",
        json={"phone": settings.ADMIN_PHONE, "password": settings.ADMIN_PASSWORD},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def register(client: TestClient) -> tuple[str, int]:
    """Корбари нав → (токен, id)."""
    phone = "992" + str(uuid.uuid4().int % 1_000_000_000).zfill(9)
    r = client.post(
        "/api/auth/register",
        json={"phone": phone, "password": PASSWORD, "language": "tj"},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    me = client.get("/api/auth/me", headers=auth(token)).json()
    return token, int(me["id"])


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


def _db_row(user_id: int, product_id: int) -> UserProductPrice | None:
    db = SessionLocal()
    try:
        return (
            db.query(UserProductPrice)
            .filter(
                UserProductPrice.user_id == user_id,
                UserProductPrice.product_id == product_id,
            )
            .first()
        )
    finally:
        db.close()


def _find(items: list[dict], product_id: int) -> dict:
    row = next((i for i in items if i["product_id"] == product_id), None)
    assert row is not None, f"маҳсулоти {product_id} дар рӯйхат нест"
    return row


# =====================================================================
# 1. Дастрасӣ
# =====================================================================
def test_requires_admin(client: TestClient):
    r = client.get("/api/admin/user-prices", params={"user_id": 1})
    assert r.status_code == 401, r.text

    tok, _ = register(client)
    r = client.get(
        "/api/admin/user-prices", params={"user_id": 1}, headers=auth(tok)
    )
    assert r.status_code == 403, r.text


# =====================================================================
# 2. Гузоштан → рӯйхат → барқарорӣ (reset)
# =====================================================================
def test_set_list_reset_cycle(client: TestClient):
    adm = admin_token(client)
    _, uid = register(client)

    db = SessionLocal()
    try:
        game, product = free_fire_product(db)
        base = float(product.price_tjs)
        slug = game.slug
    finally:
        db.close()
    assert base > 0

    # 2.1 аввал танҳо нархи КӯҲНА (custom = null)
    r = client.get(
        "/api/admin/user-prices", params={"user_id": uid}, headers=auth(adm)
    )
    assert r.status_code == 200, r.text
    row = _find(r.json(), product.id)
    assert float(row["base_price_tjs"]) == base
    assert row["custom_price_tjs"] is None
    assert row["game_slug"] == slug
    assert row["name"], "номи маҳсулот холӣ"

    # 2.2 гузоштани нархи ШАХСӢ
    custom = round(base / 2, 2)
    r = client.put(
        f"/api/admin/user-prices/{uid}/{product.id}",
        headers=auth(adm),
        json={"price_tjs": custom},
    )
    assert r.status_code == 200, r.text
    assert float(r.json()["custom_price_tjs"]) == custom
    assert _db_row(uid, product.id) is not None

    r = client.get(
        "/api/admin/user-prices", params={"user_id": uid}, headers=auth(adm)
    )
    row = _find(r.json(), product.id)
    assert float(row["base_price_tjs"]) == base
    assert float(row["custom_price_tjs"]) == custom

    # 2.3 гузоштани баробари нархи КӯҳНА → сатр нест мешавад (reset)
    r = client.put(
        f"/api/admin/user-prices/{uid}/{product.id}",
        headers=auth(adm),
        json={"price_tjs": base},
    )
    assert r.status_code == 200, r.text
    assert r.json()["custom_price_tjs"] is None
    assert _db_row(uid, product.id) is None

    # 2.4 дубора гузошт → DELETE → барқарорӣ
    client.put(
        f"/api/admin/user-prices/{uid}/{product.id}",
        headers=auth(adm),
        json={"price_tjs": custom},
    )
    r = client.delete(
        f"/api/admin/user-prices/{uid}/{product.id}", headers=auth(adm)
    )
    assert r.status_code == 200, r.text
    assert r.json()["custom_price_tjs"] is None
    assert _db_row(uid, product.id) is None


# =====================================================================
# 3. Валидатсия: 422 / 404
# =====================================================================
def test_validation_and_404(client: TestClient):
    adm = admin_token(client)
    _, uid = register(client)

    db = SessionLocal()
    try:
        _, product = free_fire_product(db)
        pid = product.id
    finally:
        db.close()

    for bad in (0, -5, "abc"):
        r = client.put(
            f"/api/admin/user-prices/{uid}/{pid}",
            headers=auth(adm),
            json={"price_tjs": bad},
        )
        assert r.status_code == 422, (bad, r.status_code)

    r = client.put(
        f"/api/admin/user-prices/999999999/{pid}",
        headers=auth(adm),
        json={"price_tjs": 5},
    )
    assert r.status_code == 404

    r = client.put(
        f"/api/admin/user-prices/{uid}/999999999",
        headers=auth(adm),
        json={"price_tjs": 5},
    )
    assert r.status_code == 404

    r = client.get(
        "/api/admin/user-prices",
        params={"user_id": 999999999},
        headers=auth(adm),
    )
    assert r.status_code == 404


# =====================================================================
# 4. Саҳифаи оммавӣ: вуруд → нархи шахсӣ, бевуруд → кӯҳна
# =====================================================================
def test_public_prices_per_user(client: TestClient):
    adm = admin_token(client)
    tok_a, uid_a = register(client)
    tok_b, _ = register(client)

    db = SessionLocal()
    try:
        game, product = free_fire_product(db)
        base = float(product.price_tjs)
        slug = game.slug
    finally:
        db.close()
    custom = round(base / 2, 2)
    r = client.put(
        f"/api/admin/user-prices/{uid_a}/{product.id}",
        headers=auth(adm),
        json={"price_tjs": custom},
    )
    assert r.status_code == 200, r.text

    # 4.1 корбари А → нархи шахсӣ
    r = client.get(f"/api/games/{slug}", headers=auth(tok_a))
    assert r.status_code == 200, r.text
    body = r.json()
    mine = next((p for p in body["products"] if p["id"] == product.id), None)
    assert mine is not None
    assert float(mine["price_tjs"]) == custom

    # min_price_tjs = минимум аз ҳамон маҳсулотҳои пешфарз (бо нархи шахсӣ)
    dflt = DEFAULT_REGION.get(slug)
    prices = [
        float(p["price_tjs"])
        for p in body["products"]
        if not p.get("region") or p["region"] == dflt
    ]
    if prices:
        assert float(body["min_price_tjs"]) == min(prices)

    # 4.2 корбари Б → нархи кӯҳна
    r = client.get(f"/api/games/{slug}", headers=auth(tok_b))
    p_b = next((p for p in r.json()["products"] if p["id"] == product.id), None)
    assert float(p_b["price_tjs"]) == base

    # 4.3 бевуруд → нархи кӯҳна
    r = client.get(f"/api/games/{slug}")
    p_anon = next((p for p in r.json()["products"] if p["id"] == product.id), None)
    assert float(p_anon["price_tjs"]) == base

    # 4.4 рӯйхати бозиҳо: min барои А = кӯҳна (ин маҳсулот шояд минимуми
    #     умумӣ набошад — танҳо санҷиш: бевуруд ҳамеша кӯҳна)
    r = client.get("/api/games")
    g = next((x for x in r.json() if x["slug"] == slug), None)
    assert g is not None
    anon_min = float(g["min_price_tjs"])
    r = client.get("/api/games", headers=auth(tok_a))
    g_a = next((x for x in r.json() if x["slug"] == slug), None)
    assert float(g_a["min_price_tjs"]) <= anon_min


# =====================================================================
# 5. Фармоиш: order.amount_tjs = нархи самаранӣ (ДАРВОЗАҲО БЕ ТАҒЙИР)
# =====================================================================
def test_order_charged_effective_price(client: TestClient):
    adm = admin_token(client)
    tok_a, uid_a = register(client)
    tok_b, _ = register(client)

    db = SessionLocal()
    try:
        game, product = free_fire_product(db)
        base = float(product.price_tjs)
        slug = game.slug
    finally:
        db.close()
    custom = round(base / 2, 2)
    r = client.put(
        f"/api/admin/user-prices/{uid_a}/{product.id}",
        headers=auth(adm),
        json={"price_tjs": custom},
    )
    assert r.status_code == 200, r.text

    def make(token: str | None) -> dict:
        payload = {
            "game_slug": slug,
            "product_id": product.id,
            "player_id": "123456789",
            "language": "tj",
            "payment_method": "dc_wallet",
            "client_token": uuid.uuid4().hex,
        }
        r = client.post(
            "/api/orders", json=payload, headers=auth(token) if token else {}
        )
        assert r.status_code == 200, r.text
        return r.json()

    # 5.1 корбари А → фармоиш ба НАРХИ ШАХСӢ
    a = make(tok_a)
    assert float(a["amount_tjs"]) == custom
    db = SessionLocal()
    try:
        order = db.get(Order, a["order_id"])
        assert float(order.amount_tjs) == custom
        assert order.user_id == uid_a
    finally:
        db.close()

    # 5.2 корбари Б → НАРХИ КӯҲНА
    b = make(tok_b)
    assert float(b["amount_tjs"]) == base

    # 5.3 бевуруд → НАРХИ КӯҳНА
    anon = make(None)
    assert float(anon["amount_tjs"]) == base
