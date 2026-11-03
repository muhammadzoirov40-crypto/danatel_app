"""🎡 Тестҳои ЧАРХИ БАХТ — гардиши тангаҳо (Фаза 2).

Сенарияҳо:
  1  /api/coins/wheel бе токен → 200: сегментҳо + эҳтимолиётҳои ҷамъ = 100%
  2  /api/coins/spin бе токен → 401
  3  Гардиш бе баланс → 422
  4  Гардиш: ҳазми НАРХ АЗ БАЛАНС (сомонӣ) + ҷоиза ДАР ТАНГА
  5  Пайвастагии дафтари тангаҳо (тангаҳо танҳо илова мешаванд)
  6  «Бурдиҳои охирин» = сатрҳои воқеии DB (бе ягон маълумоти сохта)

  ⛔ Хароҷоти гардиш танга НЕСТ — SPIN_COST_COINS/COINS_TO_TJS сомонӣ
     аз баланс; тангаҳо ҳеҷ гоҳ барои гардиш ҳазм намешаванд.
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi.testclient import TestClient

from app.config import settings
from app.services import wheel

PASSWORD = "TestPassw0rd!"


# =====================================================================
# 🧰 Ёрӣ
# =====================================================================
def new_phone() -> str:
    return "992" + str(uuid.uuid4().int % 1_000_000_000).zfill(9)


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register(client: TestClient) -> str:
    r = client.post(
        "/api/auth/register",
        json={"phone": new_phone(), "password": PASSWORD, "language": "tj"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def admin_token(client: TestClient) -> str:
    r = client.post(
        "/api/auth/login",
        json={"phone": settings.ADMIN_PHONE, "password": settings.ADMIN_PASSWORD},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def set_balance(client: TestClient, token: str, amount) -> None:
    """Баланси ибтидоӣ аз ҷониби админ (ҳамон роҳи production)."""
    adm = admin_token(client)
    me = client.get("/api/auth/me", headers=auth(token))
    assert me.status_code == 200, me.text
    uid = me.json()["id"]
    r = client.post(
        f"/api/admin/users/{uid}/balance",
        headers=auth(adm),
        json={"user_id": uid, "amount": amount, "reason": "тест"},
    )
    assert r.status_code in (200, 201), r.text


def coins_of(client: TestClient, token: str) -> dict:
    r = client.get("/api/coins/me", headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def balance_of(client: TestClient, token: str) -> float:
    r = client.get("/api/auth/me", headers=auth(token))
    assert r.status_code == 200, r.text
    return float(r.json()["balance"])


def price() -> Decimal:
    """Нархи гардиш дар сомонӣ: SPIN_COST_COINS/COINS_TO_TJS."""
    return wheel.spin_price_tjs()


PRIZES = {value for value, _ in wheel.SEGMENTS}


# =====================================================================
# 1. МАЪЛУМОТИ ОММАВӢ
# =====================================================================
def test_wheel_is_public_with_real_probabilities(client: TestClient):
    r = client.get("/api/coins/wheel")
    assert r.status_code == 200, r.text
    data = r.json()

    # Нархи гардиш дар СОМОНИИ (аз баланс) — на дар танга
    assert Decimal(str(data["cost_tjs"])) == price()
    assert data["exchange_rate"] == settings.COINS_TO_TJS
    assert data["min_exchange"] == settings.COINS_MIN_EXCHANGE
    assert data["total_spins"] >= 0
    assert isinstance(data["recent_wins"], list)

    segs = data["segments"]
    assert len(segs) == len(wheel.SEGMENTS)
    assert {s["coins"] for s in segs} == PRIZES

    # Эҳтимолиёт = 100 % (дар ҳамон дақиқӣ, на «тақрибан»)
    total = round(sum(s["probability"] for s in segs), 2)
    assert total == 100.0, total

    # Ҷекпот танҳо дар бузургтарин ҷоиза
    jacks = [s["coins"] for s in segs if s["jackpot"]]
    assert jacks == [wheel.JACKPOT_COINS]

    # Вазнҳо ҳамон вазнҳои хидматанд → рақами сохта нест
    by_coins = {s["coins"]: s["weight"] for s in segs}
    assert by_coins == dict(wheel.SEGMENTS)


# =====================================================================
# 2–3. ИҶОЗАТ ВА БАЛАНС
# =====================================================================
def test_spin_requires_token(client: TestClient):
    assert client.post("/api/coins/spin").status_code == 401


def test_spin_without_balance_is_422(client: TestClient):
    """Корбари нав: баланс 0 → 422 (тангаҳо ба ҳисоб гирифта намешаванд)."""
    token = register(client)
    assert balance_of(client, token) == 0
    assert coins_of(client, token)["coins"] == 0
    assert client.post("/api/coins/spin", headers=auth(token)).status_code == 422


# =====================================================================
# 4. ГАРДИШ: ҲАЗМИ НАРХ АЗ БАЛАНС + ҶОИЗА ДАР ТАНГА
# =====================================================================
def test_spin_debits_balance_and_credits_prize(client: TestClient):
    p = price()
    token = register(client)
    set_balance(client, token, float(p) + 50)

    bal_before = balance_of(client, token)
    r = client.post("/api/coins/spin", headers=auth(token))
    assert r.status_code == 200, r.text
    body = r.json()

    # Нарх дар сомонӣ, ҷоиза дар танга
    assert Decimal(str(body["cost_tjs"])) == p
    assert body["prize"] in PRIZES
    assert body["jackpot"] == (body["prize"] == wheel.JACKPOT_COINS)

    # Танга барои гардиш ҲАЗМ НАМЕШАВАД — танҳо ҷоиза меафтомад
    assert body["coins_after"] == body["prize"]

    # Баланс рости паноҳ аз нарх
    assert abs(balance_of(client, token) - (bal_before - float(p))) < 0.005

    data = coins_of(client, token)
    assert data["coins"] == body["coins_after"]

    # Ду сатри таърих: охирӣ = ҷоиза, охирин аз он = гардиш (amount=0)
    assert data["history"][0]["kind"] == "spin_reward"
    assert data["history"][0]["amount"] == body["prize"]
    assert data["history"][1]["kind"] == "spin"
    assert data["history"][1]["amount"] == 0


# =====================================================================
# 5. ДАФТРИ ТАНГАҲО: ТАНГА ТАНҲО ИЛОВА МЕШАВАНД
# =====================================================================
def test_spin_ledger_stays_consistent(client: TestClient):
    p = price()
    token = register(client)
    set_balance(client, token, float(p) * 6)

    expected = 0
    made = 0
    for _ in range(12):
        if balance_of(client, token) < float(p):
            break
        r = client.post("/api/coins/spin", headers=auth(token))
        assert r.status_code == 200, r.text
        body = r.json()
        made += 1

        # Ҳар гардиш: тангаҳо танҳо ИЛОВА мешаванд (ҳеҷ хароҷот дар танга)
        assert body["coins_after"] == expected + body["prize"]
        assert body["coins_after"] >= 0
        assert body["prize"] in PRIZES
        expected = body["coins_after"]

    assert made >= 1
    assert coins_of(client, token)["coins"] == expected

    # Ҳамагӣ 2 сатр барои ҳар гардиш
    hist = coins_of(client, token)["history"]
    assert sum(1 for h in hist if h["kind"] == "spin") == made
    assert sum(1 for h in hist if h["kind"] == "spin_reward") == made

    # Баланс нокифоя шуд → 422, бе такрории нодуруст
    assert balance_of(client, token) < float(p)
    assert client.post("/api/coins/spin", headers=auth(token)).status_code == 422


# =====================================================================
# 6. «БУРДҲОИ ОХИРИН» = ДАТАБЕСИ ВОҚЕӢ
# =====================================================================
def test_recent_wins_comes_from_db(client: TestClient):
    token = register(client)
    r = client.post("/api/coins/spin", headers=auth(token))
    assert r.status_code == 422  # баланс нест → ҳеҷ бурд нест

    before = client.get("/api/coins/wheel").json()
    assert all(w["coins"] != 0 for w in before["recent_wins"])

    set_balance(client, token, float(price()) + 40)
    r = client.post("/api/coins/spin", headers=auth(token))
    assert r.status_code == 200, r.text
    prize = r.json()["prize"]

    after = client.get("/api/coins/wheel").json()
    assert after["total_spins"] >= before["total_spins"] + 1
    assert after["recent_wins"], "после гардиш бояд бурд нишон дода шавад"
    top = after["recent_wins"][0]
    assert top["coins"] == prize
    assert top["name"], "ном ё рақами корбар бояд бошад"
    # Телефон ҳеҷ гоҳ дар рӯйхати оммавӣ намеояд
    assert "992" not in top["name"]
