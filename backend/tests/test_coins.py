"""🪙 Тестҳои PERS COINS — тангаҳо, даъват, иваз ва cashback.

Сенарияҳо:
  1  /api/coins/me бе токен → 401
  2  Тангаҳои ибтидоӣ = 0 ва коди даъват сохта мешавад
  3  Қайд бо линки даъват → дӯст +10 танга, даъваткунанда ҳар 2 нафар = 1 танга
  4  Коди нодуруст → қайд ҳанӯз ҳам кор мекунад (танга нест)
  4б 🎮 Интихоби бозӣ: /api/coins/my-game (401 / 404 / нишондиҳӣ дар /me)
  5  Иваз бо тангаи нокифоя → 422
  6  Иваз: танга → баланс (адади куллӣ), баланс дуруст навишта мешавад
  7  Cashback ҳангоми «delivered» + идемпотентия (ду дафъа → якдафъа)
  8  Иловакунии танга аз ҷониби админ (бо сабти таърих)
"""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.config import settings
from app.database import SessionLocal
from app.models import CoinTransaction, Game, Order, OrderStatus, Product

PASSWORD = "TestPassw0rd!"


# =====================================================================
# 🧰 Ёрӣ
# =====================================================================
def new_phone() -> str:
    return "992" + str(uuid.uuid4().int % 1_000_000_000).zfill(9)


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register(client: TestClient, referral_code: str | None = None) -> tuple[str, dict]:
    """Қайди корбар → (токен, ҷавоби пурра)."""
    payload = {"phone": new_phone(), "password": PASSWORD, "language": "tj"}
    if referral_code:
        payload["referral_code"] = referral_code
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    return body["access_token"], body


def user_id_of(client: TestClient, token: str) -> int:
    r = client.get("/api/auth/me", headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()["id"]


def admin_token(client: TestClient) -> str:
    r = client.post(
        "/api/auth/login",
        json={"phone": settings.ADMIN_PHONE, "password": settings.ADMIN_PASSWORD},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def coins_of(client: TestClient, token: str) -> dict:
    r = client.get("/api/coins/me", headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def balance_of(client: TestClient, token: str) -> float:
    r = client.get("/api/auth/me", headers=auth(token))
    assert r.status_code == 200, r.text
    return float(r.json()["balance"])


def make_order(user_id: int) -> tuple[int, float]:
    """Фармоиш дар DB месозад (барои санҷиши cashback)."""
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
        assert product is not None
        order = Order(
            user_id=user_id,
            game_id=game.id,
            product_id=product.id,
            player_id="123456789",
            quantity=1,
            amount_tjs=product.price_tjs,
            payment_method="dc_wallet",
            status=OrderStatus.PENDING,
            language="tj",
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        return order.id, float(product.price_tjs)
    finally:
        db.close()


# =====================================================================
# 1–2. ХОНДАН
# =====================================================================
def test_me_requires_token(client: TestClient):
    assert client.get("/api/coins/me").status_code == 401


def test_me_defaults_and_referral_code(client: TestClient):
    token, _ = register(client)
    data = coins_of(client, token)

    assert data["coins"] == 0
    assert data["exchange_rate"] == settings.COINS_TO_TJS
    assert data["coins_per_tjs"] == settings.COINS_PER_TJS
    assert data["spin_cost"] == settings.SPIN_COST_COINS
    assert len(data["referral_code"]) == 8
    assert data["referred_count"] == 0
    assert data["history"] == []


# =====================================================================
# 3–4. ДАЪВАТ
# =====================================================================
def test_referral_bonus_for_both(client: TestClient):
    """1-ум дӯст = нимҷуфт: даъваткунанда ҳанӯз +0, дӯст +10 танга."""
    inviter_token, _ = register(client)
    code = coins_of(client, inviter_token)["referral_code"]

    friend_token, body = register(client, referral_code=code)
    assert body["referral_applied"] is True

    inviter = coins_of(client, inviter_token)
    friend = coins_of(client, friend_token)

    assert inviter["coins"] == 0  # ҷуфт ҳанӯз пур нашудааст (1/2)
    assert friend["coins"] == settings.REFERRAL_FRIEND_COINS
    assert inviter["referred_count"] == 1
    assert all(h["kind"] != "referral" for h in inviter["history"])
    assert friend["history"][0]["amount"] == settings.REFERRAL_FRIEND_COINS


def test_referral_pair_every_two_friends(client: TestClient):
    """Ҳар 2 даъватшуда = +1 танга: 2→1, 3→1, 4→2 (танҳо ҷуфтҳо)."""
    inviter_token, _ = register(client)
    code = coins_of(client, inviter_token)["referral_code"]

    register(client, referral_code=code)          # №1 → +0
    assert coins_of(client, inviter_token)["coins"] == 0

    register(client, referral_code=code.lower())  # №2 → ҷуфт пур → +1
    assert coins_of(client, inviter_token)["coins"] == settings.REFERRAL_PAIR_COINS

    register(client, referral_code=code)          # №3 → нимҷуфт → +0
    assert (
        coins_of(client, inviter_token)["coins"]
        == settings.REFERRAL_PAIR_COINS
    )

    register(client, referral_code=code)          # №4 → +1
    inviter = coins_of(client, inviter_token)
    assert inviter["coins"] == settings.REFERRAL_PAIR_COINS * 2
    assert inviter["referred_count"] == 4
    # Ҳар даъват танҳо як бор ҳисоб мешавад (референсҳо беназир)
    assert len({h["id"] for h in inviter["history"]}) == len(inviter["history"])


def test_unknown_referral_code_still_registers(client: TestClient):
    token, body = register(client, referral_code="NOSUCHCODE")
    assert body["referral_applied"] is False
    assert coins_of(client, token)["coins"] == 0


# =====================================================================
# 4б. 🎮 БОЗИИ ИНТИХОБШУДА (Чарх)
# =====================================================================
def test_my_game_requires_token(client: TestClient):
    assert (
        client.post("/api/coins/my-game", json={"game_slug": "free-fire"}).status_code
        == 401
    )


def test_my_game_set_switch_and_show(client: TestClient):
    """Интихоб → /me нишон медиҳад; гузариш ба бозии дигар ҳам кор мекунад."""
    token, _ = register(client)
    games = client.get("/api/games").json()
    assert len(games) >= 2
    g1, g2 = games[0], games[1]

    assert coins_of(client, token)["favorite_game"] is None

    r = client.post(
        "/api/coins/my-game", headers=auth(token), json={"game_slug": g1["slug"]}
    )
    assert r.status_code == 200, r.text
    assert r.json()["game_slug"] == g1["slug"]
    assert coins_of(client, token)["favorite_game"] == g1["slug"]

    r2 = client.post(
        "/api/coins/my-game", headers=auth(token), json={"game_slug": g2["slug"]}
    )
    assert r2.status_code == 200
    assert coins_of(client, token)["favorite_game"] == g2["slug"]


def test_my_game_unknown_slug(client: TestClient):
    """Бозии номавҷуд/ғайрифаъол → 404, интихоб бетағйир мемонад."""
    token, _ = register(client)
    games = client.get("/api/games").json()
    client.post(
        "/api/coins/my-game", headers=auth(token), json={"game_slug": games[0]["slug"]}
    )

    r = client.post(
        "/api/coins/my-game", headers=auth(token), json={"game_slug": "no-such-game"}
    )
    assert r.status_code == 404
    assert coins_of(client, token)["favorite_game"] == games[0]["slug"]


# =====================================================================
# 5–6. ИВАЗ БА БАЛАНС
# =====================================================================
def test_exchange_not_enough_coins(client: TestClient):
    token, _ = register(client)
    r = client.post("/api/coins/exchange", headers=auth(token))
    assert r.status_code == 422


def test_exchange_credits_balance(client: TestClient):
    """Иваз бо ҳамон нархи `.env` (5 танга = 1 сомонӣ ҳоло) — ҳеҷ рақами катогӣ."""
    adm = admin_token(client)
    token, _ = register(client)
    uid = user_id_of(client, token)

    rate = max(1, settings.COINS_TO_TJS)
    start = max(settings.COINS_MIN_EXCHANGE, 2 * rate)
    whole = start // rate  # танҳо адади куллӣ
    assert whole >= 2

    r = client.post(
        f"/api/admin/users/{uid}/coins",
        headers=auth(adm),
        json={"user_id": uid, "amount": start, "reason": "тест"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["coins"] == start

    r = client.post("/api/coins/exchange", headers=auth(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["spent_coins"] == whole * rate
    assert float(body["credited_tjs"]) == float(whole)
    assert body["coins"] == start - whole * rate

    assert balance_of(client, token) == float(whole)
    # Ҷамъи таърих: -(whole × rate) (exchange)
    history = coins_of(client, token)["history"]
    assert history[0]["kind"] == "exchange"
    assert history[0]["amount"] == -(whole * rate)

    # боқимонда аз ҳадди ақал камтар → боз 422
    if body["coins"] < settings.COINS_MIN_EXCHANGE:
        assert client.post("/api/coins/exchange", headers=auth(token)).status_code == 422


# =====================================================================
# 7. CASHBACK
# =====================================================================
def test_cashback_once_per_order(client: TestClient):
    adm = admin_token(client)
    token, _ = register(client)
    uid = user_id_of(client, token)
    order_id, amount = make_order(uid)

    expected = int(amount * settings.COINS_PER_TJS)
    assert expected > 0

    r = client.patch(
        f"/api/admin/orders/{order_id}",
        headers=auth(adm),
        json={"status": OrderStatus.DELIVERED},
    )
    assert r.status_code == 200, r.text
    assert coins_of(client, token)["coins"] == expected

    # ДАБИРА ба ҳамон статус → танга такрорӣ НАМЕШАВАД
    client.patch(
        f"/api/admin/orders/{order_id}",
        headers=auth(adm),
        json={"status": OrderStatus.DELIVERED},
    )
    assert coins_of(client, token)["coins"] == expected

    db = SessionLocal()
    try:
        rows = (
            db.query(CoinTransaction)
            .filter(
                CoinTransaction.order_id == order_id,
                CoinTransaction.kind == "cashback",
            )
            .count()
        )
    finally:
        db.close()
    assert rows == 1


# =====================================================================
# 8. ИЛОВАКАРДАНИ АДМИН
# =====================================================================
def test_admin_grant_coins_rejects_missing_user(client: TestClient):
    adm = admin_token(client)
    r = client.post(
        "/api/admin/users/999999/coins",
        headers=auth(adm),
        json={"user_id": 999999, "amount": 10},
    )
    assert r.status_code == 400


def test_admin_grant_requires_admin(client: TestClient):
    token, _ = register(client)
    r = client.post(
        "/api/admin/users/1/coins",
        headers=auth(token),
        json={"user_id": 1, "amount": 10},
    )
    assert r.status_code == 403
