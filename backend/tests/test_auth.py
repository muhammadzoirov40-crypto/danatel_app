"""🔐 Тестҳои пурраи системаи Authentication (FastAPI).

Сенарияҳо (аз рӯйи рӯйхати асосӣ):
  1  Register бо маълумоти дуруст
  2  Register бо телефони такрорӣ
  3  Login бо пароли дуруст
  4  Login бо пароли нодуруст
  5  Login бо телефони вуҷуднадошта
  6  Endpoint-и хусусӣ бе токен
  7  Токени нодуруст
  8  Токени муҳлаташ гузашта
  9  Logout → бекор шудани токен
 10  Иҷозатҳо / role-ҳо
 11  IDOR — дастрасӣ ба маълумоти корбари дигар
 12  Rate limiting
 13–15 Email verification → Лоиҳа email истифода намекунад (N/A)
 16  Password reset / ивазкунии парол
 17  Пароли аслӣ дар API response нест
 18  Маълумоти махфӣ дар frontend нест
 19  Регрессияи endpoint-ҳои асосӣ
 20  Танзимоти production (алгоритм, вебхук, docs)
"""
from __future__ import annotations

import base64
import json
import os
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import ratelimit
from app.config import settings
from app.security import ALLOWED_JWT_ALGORITHMS, create_access_token

PASSWORD = "TestPassw0rd!"
ADMIN_PASSWORD = settings.ADMIN_PASSWORD or ""

# Ҳадди маҳдудсозии вуруд (аз app/routers/auth.py)
LOGIN_LIMIT = 12


# =====================================================================
# 🧰 ЁРӣ
# =====================================================================
def new_phone() -> str:
    """Телефони беназир: 992 + 9 рақам."""
    return "992" + str(uuid.uuid4().int % 1_000_000_000).zfill(9)


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register(client: TestClient, phone: str | None = None, password: str = PASSWORD):
    """Қайди корбар → (телефон, токен, ҷавоб)."""
    phone = phone or new_phone()
    r = client.post(
        "/api/auth/register",
        json={"phone": phone, "password": password, "language": "tj"},
    )
    return phone, r


def must_register(client: TestClient, password: str = PASSWORD) -> tuple[str, str]:
    phone, r = register(client, password=password)
    assert r.status_code == 200, r.text
    return phone, r.json()["access_token"]


def make_order(client: TestClient, token: str | None = None) -> dict:
    """Фармоиши воқеӣ (dc_wallet) → маълумоти ҷавоб, аз ҷумла access_token."""
    headers = auth(token) if token else {}
    games = client.get("/api/games?lang=tj", headers=headers).json()
    assert games, "seed накард — бозиҳо нест"
    slug = games[0]["slug"]
    detail = client.get(f"/api/games/{slug}?lang=tj", headers=headers).json()
    product_id = detail["products"][0]["id"]
    r = client.post(
        "/api/orders",
        headers=headers,
        json={
            "game_slug": slug,
            "product_id": product_id,
            "player_id": "123456789",
            "language": "tj",
            "payment_method": "dc_wallet",
            "client_token": uuid.uuid4().hex,
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


def b64url(data: dict) -> str:
    raw = json.dumps(data).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


# =====================================================================
# 1–2. РЕГИСТРАТСИЯ
# =====================================================================
def test_register_ok(client: TestClient):
    """1. Register бо маълумоти дуруст → 200 + токен + баланс 0."""
    phone, r = register(client)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"]
    assert body["is_admin"] is False

    # Токени нав дуруст кор мекунад
    me = client.get("/api/auth/me", headers=auth(body["access_token"]))
    assert me.status_code == 200
    assert me.json()["phone"] == phone
    assert float(me.json()["balance"]) == 0.0


def test_register_duplicate_phone(client: TestClient):
    """2. Register бо телефони такрорӣ → 409."""
    phone, _ = register(client)
    _, r2 = register(client, phone=phone)
    assert r2.status_code == 409


def test_register_weak_password_rejected(client: TestClient):
    """Пароли кӯтоҳ / танҳо рақам → 422 (ба қайд гирифта намешавад)."""
    _, short = register(client, password="1234")
    assert short.status_code == 422

    _, digits = register(client, password="123456789012")
    assert digits.status_code == 422

    _, empty = register(client, password="")
    assert empty.status_code == 422


def test_register_bad_phone_rejected(client: TestClient):
    """Телефони нодуруст (ғайрирақамӣ) → 422."""
    r = client.post(
        "/api/auth/register",
        json={"phone": "abc+992!!!", "password": PASSWORD},
    )
    assert r.status_code == 422


# =====================================================================
# 3–5. ВУРУД
# =====================================================================
def test_login_ok(client: TestClient):
    """3. Login бо пароли дуруст → токен."""
    phone, _ = register(client)
    r = client.post("/api/auth/login", json={"phone": phone, "password": PASSWORD})
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]
    assert r.json()["is_admin"] is False


def test_login_wrong_password(client: TestClient):
    """4. Login бо пароли нодуруст → 401 + паёми ягона."""
    phone, _ = register(client)
    r = client.post("/api/auth/login", json={"phone": phone, "password": "WrongPass99!"})
    assert r.status_code == 401
    assert "detail" in r.json()


def test_login_unknown_user(client: TestClient):
    """5. Login бо телефони вуҷуднадошта → 401 (ҲАМОН паём = бе ифшо)."""
    unknown = new_phone()
    r = client.post("/api/auth/login", json={"phone": unknown, "password": PASSWORD})
    r2 = client.post(
        "/api/auth/login",
        json={"phone": new_phone(), "password": "totally-wrong-pass"},
    )
    assert r.status_code == 401
    assert r2.status_code == 401
    # Паём бояд якхела бошад → корбар вуҷуд дорад ё не фаҳмидан мумкин нест
    assert r.json()["detail"] == r2.json()["detail"]


def test_admin_login(client: TestClient):
    """Вуруди админ (телефон+парол аз .env) → is_admin=true."""
    r = client.post(
        "/api/auth/login",
        json={"phone": settings.ADMIN_PHONE, "password": ADMIN_PASSWORD},
    )
    assert r.status_code == 200, r.text
    assert r.json()["is_admin"] is True


# =====================================================================
# 6–8. ТОКЕНҲО
# =====================================================================
def test_private_endpoint_without_token(client: TestClient):
    """6. Дастрасӣ ба endpoint-и хусусӣ бе токен → 401."""
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me/balance").status_code == 401
    assert client.get("/api/orders/my").status_code == 401


def test_invalid_token(client: TestClient):
    """7. Токени нодуруст / дуздӣ / дурустии имзо вайрон → 401."""
    cases = [
        "totally-invalid",
        "abc.def.ghi",
        "Bearer",  # бе қисмҳо
    ]
    for tok in cases:
        assert client.get("/api/auth/me", headers=auth(tok)).status_code == 401, tok

    # Имзо дуруст карда шуд (як ҳарф иваз)
    _, token = must_register(client)
    head, body, sig = token.split(".")
    tampered = f"{head}.{body}.{('a' if sig[0] != 'a' else 'b') + sig[1:]}"
    assert client.get("/api/auth/me", headers=auth(tampered)).status_code == 401

    # Алгоритми `none` (имзо нест) → РАД
    unsigned = f"{b64url({'alg': 'none', 'typ': 'JWT'})}.{b64url({'sub': '1', 'tv': 0, 'iat': 1, 'exp': 4102444800, 'iss': 'danatel.tj', 'jti': 'x'})}."
    assert client.get("/api/auth/me", headers=auth(unsigned)).status_code == 401

    # Бе имзо/бо имзои нодуруст → рад
    assert client.get(
        "/api/auth/me",
        headers=auth(
            f"{b64url({'alg': 'HS256', 'typ': 'JWT'})}."
            f"{b64url({'sub': '1', 'tv': 0, 'iat': 1, 'exp': 4102444800, 'jti': 'y'})}.x"
        ),
    ).status_code == 401


def test_expired_token(client: TestClient):
    """8. Токени муҳлаташ гузашта → 401."""
    expired = create_access_token(
        {"sub": "1", "admin": False, "tv": 0}, expires_minutes=-1
    )
    assert client.get("/api/auth/me", headers=auth(expired)).status_code == 401


def test_token_claims(client: TestClient):
    """Токен бояд `exp`, `iat`, `jti`, `iss`, `tv` дошта бошад."""
    import base64 as _b64

    _, token = must_register(client)
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    claims = json.loads(_b64.urlsafe_b64decode(payload))
    for claim in ("exp", "iat", "jti", "iss", "sub", "tv"):
        assert claim in claims, claim
    assert claims["iss"] == "danatel.tj"
    assert claims["tv"] == 0


def test_alg_allowlist_is_pinned():
    """Алгоритми имзо аз .env қабул намешавад — танҳо HS256."""
    assert ALLOWED_JWT_ALGORITHMS == ("HS256",)


# =====================================================================
# 9. LOGOUT → бекор шудани сеанс
# =====================================================================
def test_logout_revokes_token(client: TestClient):
    """9. Logout → токени ҳамон лаҳза дигар кор намекунад."""
    _, token = must_register(client)
    assert client.get("/api/auth/me", headers=auth(token)).status_code == 200

    out = client.post("/api/auth/logout", headers=auth(token))
    assert out.status_code == 200, out.text
    assert out.json()["ok"] is True

    # Ҳамон токен беэътибор
    assert client.get("/api/auth/me", headers=auth(token)).status_code == 401


def test_logout_with_bad_token(client: TestClient):
    assert client.post("/api/auth/logout").status_code == 401
    assert client.post("/api/auth/logout", headers=auth("bad.token.here")).status_code == 401


# =====================================================================
# 10. ИҶОЗАТҲО / ROLE
# =====================================================================
def test_admin_endpoints_require_admin(client: TestClient):
    """10. Ғайриадмин ба /api/admin/* → 401 (бе токен) / 403 (корбар)."""
    assert client.get("/api/admin/stats").status_code == 401

    _, user_token = must_register(client)
    assert client.get("/api/admin/stats", headers=auth(user_token)).status_code == 403
    assert (
        client.get("/api/admin/users", headers=auth(user_token)).status_code == 403
    )
    # Тағйири баланси корбар → танҳо админ
    _, victim_token = must_register(client)
    victim_id = client.get("/api/auth/me", headers=auth(victim_token)).json()["id"]
    r = client.post(
        f"/api/admin/users/{victim_id}/balance",
        headers=auth(user_token),
        json={"user_id": victim_id, "amount": 9999, "reason": "hack"},
    )
    assert r.status_code == 403
    # Баланси қурбонӣ ҳанӯз 0
    bal = client.get("/api/auth/me/balance", headers=auth(victim_token)).json()
    assert float(bal["balance"]) == 0.0

    # Админ → 200
    admin_token = client.post(
        "/api/auth/login",
        json={"phone": settings.ADMIN_PHONE, "password": ADMIN_PASSWORD},
    ).json()["access_token"]
    assert client.get("/api/admin/stats", headers=auth(admin_token)).status_code == 200


def test_admin_balance_change_works_for_admin(client: TestClient):
    """Санҷиши он, ки тағйири баланс танҳо аз админ кор мекунад (регрессия)."""
    _, victim_token = must_register(client)
    victim_id = client.get("/api/auth/me", headers=auth(victim_token)).json()["id"]
    admin_token = client.post(
        "/api/auth/login",
        json={"phone": settings.ADMIN_PHONE, "password": ADMIN_PASSWORD},
    ).json()["access_token"]

    r = client.post(
        f"/api/admin/users/{victim_id}/balance",
        headers=auth(admin_token),
        json={"user_id": victim_id, "amount": 150, "reason": "test"},
    )
    assert r.status_code in (200, 201), r.text
    bal = client.get("/api/auth/me/balance", headers=auth(victim_token)).json()
    assert float(bal["balance"]) == 150.0


def test_admin_balance_deduct_works(client: TestClient):
    """➖ Буриши баланс аз админ: +150 −60 = 90; зиёд аз баланс → манфӣ."""
    _, victim_token = must_register(client)
    victim_id = client.get("/api/auth/me", headers=auth(victim_token)).json()["id"]
    admin_token = client.post(
        "/api/auth/login",
        json={"phone": settings.ADMIN_PHONE, "password": ADMIN_PASSWORD},
    ).json()["access_token"]

    client.post(
        f"/api/admin/users/{victim_id}/balance",
        headers=auth(admin_token),
        json={"user_id": victim_id, "amount": 150, "reason": "test"},
    )

    # −60 → 90
    r = client.post(
        f"/api/admin/users/{victim_id}/balance/deduct",
        headers=auth(admin_token),
        json={"user_id": victim_id, "amount": 60, "reason": "test deduct"},
    )
    assert r.status_code in (200, 201), r.text
    bal = client.get("/api/auth/me/balance", headers=auth(victim_token)).json()
    assert float(bal["balance"]) == 90.0

    # зиёд аз баланс (200 аз 90) → админ ҳамеша метавонад: манфӣ мешавад
    r = client.post(
        f"/api/admin/users/{victim_id}/balance/deduct",
        headers=auth(admin_token),
        json={"user_id": victim_id, "amount": 200, "reason": "to minus"},
    )
    assert r.status_code in (200, 201), r.text
    bal = client.get("/api/auth/me/balance", headers=auth(victim_token)).json()
    assert float(bal["balance"]) == -110.0

    # маблағи нодуруст (0) → 422, баланс бетағйир
    r = client.post(
        f"/api/admin/users/{victim_id}/balance/deduct",
        headers=auth(admin_token),
        json={"user_id": victim_id, "amount": 0},
    )
    assert r.status_code == 422

    # ғайриадмин → 403, баланс бетағйир
    _, user_token = must_register(client)
    r = client.post(
        f"/api/admin/users/{victim_id}/balance/deduct",
        headers=auth(user_token),
        json={"user_id": victim_id, "amount": 1},
    )
    assert r.status_code == 403
    bal = client.get("/api/auth/me/balance", headers=auth(victim_token)).json()
    assert float(bal["balance"]) == -110.0


# =====================================================================
# 11. IDOR — маълумоти корбари дигар
# =====================================================================
def test_order_idor_blocked(client: TestClient):
    """11. Корбар (мизоҷ) наметавонад фармоиши дигарро бихурад → 404."""
    order = make_order(client)
    oid = order["order_id"]
    otok = order["access_token"]
    assert otok, "access_token баргардонида нашуд"

    # Бе токен → 404 (на 403, то вуҷуди фармоиш ифшо нашавад)
    assert client.get(f"/api/orders/{oid}").status_code == 404
    # Токени нодуруст → 404
    assert (
        client.get(f"/api/orders/{oid}", headers={"X-Order-Token": "deadbeef"}).status_code
        == 404
    )
    # Соҳиби токен → 200
    ok = client.get(f"/api/orders/{oid}", headers={"X-Order-Token": otok})
    assert ok.status_code == 200, ok.text

    # Корбари дигари вурудкарда ҳам 404 мегирад
    _, other_token = must_register(client)
    assert (
        client.get(f"/api/orders/{oid}", headers=auth(other_token)).status_code == 404
    )
    # Вале худи соҳиб (агар фармоиш бо ҳисоб сохта шуда бошад) → 200
    owner_order = make_order(client, token=other_token)
    assert (
        client.get(
            f"/api/orders/{owner_order['order_id']}", headers=auth(other_token)
        ).status_code
        == 200
    )


def test_receipt_idor_blocked(client: TestClient):
    """Фиристодани чек ба фармоиши бегона → 404 (иҷозат нест)."""
    order = make_order(client)
    oid = order["order_id"]
    r = client.post(f"/api/orders/{oid}/receipt", data={"text": "9999 1111 2222 3333"})
    assert r.status_code == 404

    # Соҳиби токен → қабул мешавад
    ok = client.post(
        f"/api/orders/{oid}/receipt",
        headers={"X-Order-Token": order["access_token"]},
        data={"text": "9999 1111 2222 3333"},
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["status"] == "checking"


def test_receipt_image_requires_admin(client: TestClient):
    """Расми чек (маълумоти корт) танҳо барои админ кушода мешавад."""
    # 1) Бе токен → 401
    assert client.get("/uploads/receipts/anything.jpg").status_code in (401, 403)
    # 2) Корбари оддӣ → 403
    _, user_token = must_register(client)
    assert (
        client.get("/uploads/receipts/anything.jpg", headers=auth(user_token)).status_code
        in (401, 403)
    )

    # 3) Админ → файл воқеӣ кушода мешавад (регрессияи функсия)
    from app.main import _RECEIPTS

    os.makedirs(_RECEIPTS, exist_ok=True)
    name = f"test_{uuid.uuid4().hex[:8]}.png"
    path = os.path.join(_RECEIPTS, name)
    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\nfake")
    try:
        admin_token = client.post(
            "/api/auth/login",
            json={"phone": settings.ADMIN_PHONE, "password": ADMIN_PASSWORD},
        ).json()["access_token"]

        ok = client.get(f"/uploads/receipts/{name}", headers=auth(admin_token))
        assert ok.status_code == 200, ok.text
        assert ok.headers.get("content-type", "").startswith("image/")
        # Ҷавоб набояд дар cache монад (маълумоти шахсӣ)
        assert "no-store" in ok.headers.get("cache-control", "")

        # 4) Файли вуҷуднадошта → 404 (на мӯҳтавои SPA / index.html)
        assert (
            client.get(
                "/uploads/receipts/nope_12345.png", headers=auth(admin_token)
            ).status_code
            == 404
        )
        # 5) Роҳи берунӣ (`..`) ҳам ба 404/400 меафтад — 200 бо файл нест
        assert (
            client.get("/uploads/receipts/%2E%2E", headers=auth(admin_token)).status_code
            != 200
        )
    finally:
        if os.path.isfile(path):
            os.remove(path)


def test_orders_my_isolation(client: TestClient):
    """Фармоишҳои /orders/my танҳо фармоишҳои худи корбарро медиҳад."""
    _, token_a = must_register(client)
    _, token_b = must_register(client)
    order_a = make_order(client, token=token_a)

    ids_a = [o["id"] for o in client.get("/api/orders/my", headers=auth(token_a)).json()]
    ids_b = [o["id"] for o in client.get("/api/orders/my", headers=auth(token_b)).json()]

    assert order_a["order_id"] in ids_a
    assert order_a["order_id"] not in ids_b


# =====================================================================
# 12. RATE LIMITING
# =====================================================================
def test_login_rate_limit(client: TestClient):
    """12. 13 кӯшиши беҳуда → 429 + Retry-After."""
    phone = new_phone()
    client.post("/api/auth/register", json={"phone": phone, "password": PASSWORD})

    statuses = []
    for i in range(LOGIN_LIMIT + 1):
        r = client.post(
            "/api/auth/login",
            json={"phone": phone, "password": f"WrongPass{i}!"},
        )
        statuses.append(r.status_code)

    assert statuses.count(401) == LOGIN_LIMIT
    last = statuses[-1]
    assert last == 429, f"после {LOGIN_LIMIT} кӯшиш бояд 429 шавад, гирифт: {last}"

    # Ҷавоб бояд Retry-After дошта бошад
    r = client.post("/api/auth/login", json={"phone": phone, "password": "x"})
    assert r.status_code == 429
    assert r.headers.get("retry-after")


def test_register_rate_limit(client: TestClient):
    """Маҳдудсозии қайд: аз ҳад зиёд ҳисоби нав → 429."""
    last = None
    for _ in range(9):
        last = client.post(
            "/api/auth/register",
            json={"phone": new_phone(), "password": PASSWORD},
        )
        if last.status_code == 429:
            break
    assert last is not None and last.status_code == 429


def test_rate_limit_persists_after_failed_login(client: TestClient):
    """Ҳисобкунак пас аз нокомӣ ҳам кор мекунад (на танҳо 200)."""
    seen_429 = False
    for i in range(LOGIN_LIMIT + 2):
        r = client.post(
            "/api/auth/login",
            json={"phone": new_phone(), "password": f"bad{i}"},
        )
        if r.status_code == 429:
            seen_429 = True
            break
    assert seen_429


# =====================================================================
# 13–15. EMAIL VERIFICATION → N/A
# =====================================================================
@pytest.mark.skip(
    reason=(
        "N/A: лоиҳа тавассути Email қайд намекунад (телефон+парол), "
        "бахши Email verification вуҷуд надорад ва SMTP истифода намешавад."
    )
)
def test_email_verification_wrong_code():
    ...  # pragma: no cover


@pytest.mark.skip(reason="N/A: ҳамон сабаб — суроғаи email дар лоиҳа нест")
def test_email_verification_expired_code():
    ...  # pragma: no cover


@pytest.mark.skip(reason="N/A: ҳамон сабаб — рамзи тасдиқи email вуҷуд надорад")
def test_email_verification_reuse_code():
    ...  # pragma: no cover


# =====================================================================
# 16. ИВАЗКУНИИ ПАРОЛ
# =====================================================================
def test_password_change_requires_correct_current(client: TestClient):
    """Пароли кӯҳна нодуруст → 403; парол иваз намешавад."""
    phone, token = must_register(client)
    r = client.post(
        "/api/auth/password/change",
        headers=auth(token),
        json={"current_password": "WrongOld99!", "new_password": "BrandNewPass1!"},
    )
    assert r.status_code == 403

    # Пароли кӯҳна ҳанӯз кор мекунад
    assert (
        client.post(
            "/api/auth/login", json={"phone": phone, "password": PASSWORD}
        ).status_code
        == 200
    )


def test_password_change_ok_revokes_old_tokens(client: TestClient):
    """Ивазкунии дуруст → токени нав кор мекунад, кӯҳнаҳо беэътибор."""
    phone, old_token = must_register(client)
    r = client.post(
        "/api/auth/password/change",
        headers=auth(old_token),
        json={"current_password": PASSWORD, "new_password": "BrandNewPass1!"},
    )
    assert r.status_code == 200, r.text
    new_token = r.json()["access_token"]
    assert new_token

    # Токени нав → 200
    assert client.get("/api/auth/me", headers=auth(new_token)).status_code == 200
    # Токени кӯҳна → 401 (все токенҳои пешин беэътибор)
    assert client.get("/api/auth/me", headers=auth(old_token)).status_code == 401

    # Вуруд бо пароли кӯҳна → 401, бо нав → 200
    assert (
        client.post("/api/auth/login", json={"phone": phone, "password": PASSWORD}).status_code
        == 401
    )
    ok = client.post(
        "/api/auth/login", json={"phone": phone, "password": "BrandNewPass1!"}
    )
    assert ok.status_code == 200


def test_password_change_rejects_weak_new(client: TestClient):
    _, token = must_register(client)
    for weak in ("123456789012", "short", PASSWORD):
        r = client.post(
            "/api/auth/password/change",
            headers=auth(token),
            json={"current_password": PASSWORD, "new_password": weak},
        )
        assert r.status_code == 422, weak  # кӯтоҳ / рақамӣ / такрорӣ


def test_password_change_requires_auth(client: TestClient):
    r = client.post(
        "/api/auth/password/change",
        json={"current_password": PASSWORD, "new_password": "BrandNewPass1!"},
    )
    assert r.status_code == 401


def test_password_reset_without_channel_not_exposed(client: TestClient):
    """Ҳеҷ endpoint-и беэътимоди «reset» вуҷуд надорад → 404.

    (Бе каналҳои тасдиқи шахсият reset-и бехатар сохтан мумкин нест.)
    """
    r = client.post(
        "/api/auth/password/reset",
        json={"phone": new_phone()},
    )
    # Роҳи «reset» вуҷуд надорад → 404 (ё 405 аз рӯи сабти SPA)
    assert r.status_code in (404, 405)

    # Дар рӯйхати роутҳо ҳеҷ reset/forgot вуҷуд надорад
    from app.main import app as _app

    paths = [getattr(route, "path", "") for route in _app.router.routes]
    assert not [p for p in paths if "reset" in p or "forgot" in p or "forgot" in p]


# =====================================================================
# 17. ПАРОЛ ДАР ҶАВОБ НЕСТ
# =====================================================================
def test_password_never_in_response(client: TestClient):
    phone, r = register(client)
    assert PASSWORD not in r.text
    assert "password_hash" not in r.text

    token = r.json()["access_token"]
    me = client.get("/api/auth/me", headers=auth(token))
    assert PASSWORD not in me.text
    assert "password_hash" not in me.text
    assert "password" not in me.json()

    login = client.post("/api/auth/login", json={"phone": phone, "password": PASSWORD})
    assert "password_hash" not in login.text
    assert "password" not in login.json()


def test_password_hash_is_argon2id(client: TestClient):
    """Дар база пароли одиро нигоҳ намедоранд — Argon2id."""
    from app.database import SessionLocal
    from app.models import User

    phone, _ = register(client)
    with SessionLocal() as db:
        user = db.query(User).filter(User.phone == phone).one()
        assert user.password_hash
        assert user.password_hash.startswith("$argon2id$"), user.password_hash[:30]
        assert PASSWORD not in user.password_hash


def test_legacy_bcrypt_hash_is_upgraded_on_login(client: TestClient):
    """Корбари кӯҳна бо bcrypt → дар вуруди муваффақ ба Argon2id навсозӣ мешавад."""
    from app.database import SessionLocal
    from app.models import User
    from app.security import hash_password

    phone = new_phone()
    # Ҳосси bcrypt-и кӯҳна сохтан
    import passlib.context as _pc

    legacy_ctx = _pc.CryptContext(schemes=["bcrypt"], deprecated="auto")
    legacy = legacy_ctx.hash(PASSWORD)

    with SessionLocal() as db:
        db.add(
            User(
                phone=phone,
                password_hash=legacy,
                language="tj",
                is_admin=False,
                balance=0,
            )
        )
        db.commit()

    r = client.post("/api/auth/login", json={"phone": phone, "password": PASSWORD})
    assert r.status_code == 200, r.text

    with SessionLocal() as db:
        user = db.query(User).filter(User.phone == phone).one()
        assert user.password_hash.startswith("$argon2id$"), "навсозӣ нашуд"


# =====================================================================
# 18. МАЪЛУМОТИ МАХФӢ ДАР FRONTEND
# =====================================================================
def test_no_secrets_in_frontend_build():
    """18. Дар build-и frontend ҳеҷ сирр (SECRET_KEY, bot token, API key) нест."""
    dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    files = list(dist.rglob("*.js")) + list(dist.rglob("*.html")) if dist.is_dir() else []
    if not files:
        pytest.skip("frontend/dist сохта нашудааст — санҷиш дахлдор нест")

    forbidden = [
        "change_this_to_a_long_random_string",
        "dev_secret_change_me",
        "AAGt5Rq",        # токени боти Telegram
        "fl_live_",       # калиди FireLoot
        "DC_SECRET_KEY",
        "SECRET_KEY=",
        "BEGIN RSA",
    ]
    offenders = []
    for f in files:
        try:
            text = f.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for bad in forbidden:
            if bad in text:
                offenders.append(f"{f.name}: {bad}")
    assert not offenders, f"Сирр дар frontend: {offenders}"


# =====================================================================
# 19. РЕГРЕССИЯИ ENDPOINT-ҲОИ АСОСӢ
# =====================================================================
def test_health(client: TestClient):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["ok"] is True


def test_games_and_stats_public(client: TestClient):
    for path in (
        "/api/games?lang=tj",
        "/api/stats",
        "/api/reviews/summary",
        "/api/customers",
        "/api/reviews?limit=3",
    ):
        r = client.get(path)
        assert r.status_code == 200, f"{path} → {r.status_code}"


def test_order_flow_regression(client: TestClient):
    """Фармоиш → чек → санҷиши статус (бо токени фармоиш)."""
    order = make_order(client)
    oid, otok = order["order_id"], order["access_token"]
    h = {"X-Order-Token": otok}

    assert client.get(f"/api/orders/{oid}/status", headers=h).status_code == 200
    receipt = client.post(
        f"/api/orders/{oid}/receipt", headers=h, data={"text": "1234 5678 9012 3456"}
    )
    assert receipt.status_code == 200
    status = client.get(f"/api/orders/{oid}/status", headers=h)
    assert status.status_code == 200
    assert status.json()["status"] == "checking"

    # Админ метавонад фармоишро бинад ва қабул кунад
    admin_token = client.post(
        "/api/auth/login",
        json={"phone": settings.ADMIN_PHONE, "password": ADMIN_PASSWORD},
    ).json()["access_token"]
    got = client.get(f"/api/orders/{oid}", headers=auth(admin_token))
    assert got.status_code == 200
    upd = client.patch(
        f"/api/admin/orders/{oid}",
        headers=auth(admin_token),
        json={"status": "delivered"},
    )
    assert upd.status_code == 200
    assert upd.json()["status"] == "delivered"


def test_order_idempotency(client: TestClient):
    """Ҳамон client_token → ҳамон фармоиш (бе дублировка)."""
    games = client.get("/api/games?lang=tj").json()
    slug = games[0]["slug"]
    pid = client.get(f"/api/games/{slug}?lang=tj").json()["products"][0]["id"]
    ct = uuid.uuid4().hex
    payload = {
        "game_slug": slug,
        "product_id": pid,
        "player_id": "123456789",
        "language": "tj",
        "payment_method": "dc_wallet",
        "client_token": ct,
    }
    a = client.post("/api/orders", json=payload)
    b = client.post("/api/orders", json=payload)
    assert a.status_code == 200 and b.status_code == 200
    assert a.json()["order_id"] == b.json()["order_id"]
    # Токени дастрасӣ ҳам бармегардад → мизоҷ метавонад саҳифаро кушояд
    assert b.json().get("access_token")


# =====================================================================
# 20. ТАНЗИМОТИ PRODUCTION
# =====================================================================
def test_secret_key_is_not_default():
    assert settings.SECRET_KEY not in (
        "",
        "dev_secret_change_me",
        "change_this_to_a_long_random_string",
    )
    assert len(settings.SECRET_KEY) >= 32


def test_webhook_rejected_without_secret():
    """20. Вебхуки DC бе калиди махфӣ → РАД (на «имзо санҷида нашуд»)."""
    from app.services import dc_service

    assert dc_service.verify_webhook_signature({"status": "paid"}) is False
    assert dc_service.verify_webhook_signature({}) is False


def test_webhook_http_rejected(client: TestClient):
    r = client.post(
        "/api/webhook/dc",
        json={"invoice_id": "demo-1", "status": "paid", "order_id": "1"},
    )
    assert r.status_code == 401


def test_docs_responds_when_enabled(client: TestClient):
    assert client.get("/api/openapi.json").status_code == 200


def test_security_headers(client: TestClient):
    r = client.get("/api/health")
    assert r.headers.get("x-content-type-options") == "nosniff"
    assert r.headers.get("x-frame-options") == "DENY"


def test_spa_fallback_blocks_path_traversal(client: TestClient):
    """🛡️ `..%2F` набояд аз дохили frontend/dist ба берун барорад.

    Пеш аз ислоҳ: `GET /..%2F..%2Fbackend%2F.env` → мӯҳтавои .env
    (SECRET_KEY, ADMIN_PASSWORD, калиди DC) ба ҳама фиристода мешуд.
    """
    r = client.get("/..%2F..%2Fbackend%2F.env")
    assert r.status_code in (200, 404)
    assert "SECRET_KEY=" not in r.text, "path traversal фаъол аст!"
    assert "ADMIN_PASSWORD=" not in r.text
    assert "DC_SECRET_KEY=" not in r.text


def test_cors_origins_are_restricted():
    """CORS танҳо барои origin-ҳои таҳкурсӣ (на wildcard)."""
    from app.main import app as _app

    cors = [m for m in _app.user_middleware if "CORS" in str(m)]
    assert cors, "CORS middleware нест"
    opts = cors[0].kwargs
    assert opts.get("allow_origins") != ["*"]
    assert opts.get("allow_credentials") is True
