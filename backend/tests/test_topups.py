"""💳 Дархостҳои пур кардани баланс: чек → тасдиқ/ради админ."""
from __future__ import annotations

import io
import uuid

from fastapi.testclient import TestClient

from app.config import settings

PASSWORD = "TestPassw0rd!"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64  # танҳо барои санҷиш


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def new_phone() -> str:
    return "992" + str(uuid.uuid4().int % 1_000_000_000).zfill(9)


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


def create(client: TestClient, token: str, amount: str = "25"):
    return client.post(
        "/api/balance-requests",
        headers=auth(token),
        data={"amount": amount},
        files={
            "file": ("c.png", io.BytesIO(PNG), "image/png"),
        },
    )


def balance_of(client: TestClient, token: str) -> float:
    r = client.get("/api/auth/me/balance", headers=auth(token))
    assert r.status_code == 200, r.text
    return float(r.json()["balance"])


# =====================================================================
# 🧪 САНҶИШҲО
# =====================================================================


def test_topup_requires_auth(client: TestClient):
    """Бе токен → 401 (ҳам эҷод, ҳам рӯйхат)."""
    r = client.post(
        "/api/balance-requests",
        data={"amount": "10"},
        files={"file": ("c.png", io.BytesIO(PNG), "image/png")},
    )
    assert r.status_code == 401
    assert client.get("/api/balance-requests/mine").status_code == 401


def test_topup_create_ok(client: TestClient):
    """Эҷод: pending + чек сабт + рӯйхати шахсӣ."""
    token = register(client)
    r = create(client, token, amount="25")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "pending"
    assert float(body["amount_tjs"]) == 25.0
    assert body["receipt_file"].startswith("/uploads/receipts/")

    mine = client.get("/api/balance-requests/mine", headers=auth(token))
    assert mine.status_code == 200
    assert mine.json()[0]["id"] == body["id"]


def test_topup_validation(client: TestClient):
    """Маблағ/файл нодуруст → 422."""
    token = register(client)
    assert create(client, token, amount="0").status_code == 422
    assert create(client, token, amount="abc").status_code == 422
    r = client.post(
        "/api/balance-requests",
        headers=auth(token),
        data={"amount": "10"},
        files={"file": ("x.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert r.status_code == 422


def test_topup_admin_list_and_approve(client: TestClient):
    """Админ мебинад → қабул → баланс + маблағ → такрорӣ → 409."""
    token = register(client)
    created = create(client, token, amount="30").json()
    adm = admin_token(client)

    # ғайриадмин ба рӯйхати админ → 403
    assert (
        client.get("/api/admin/balance-requests", headers=auth(token)).status_code
        == 403
    )

    lst = client.get(
        "/api/admin/balance-requests?status=pending", headers=auth(adm)
    )
    assert lst.status_code == 200
    assert any(x["id"] == created["id"] for x in lst.json())

    before = balance_of(client, token)
    ok = client.post(
        f"/api/admin/balance-requests/{created['id']}/approve", headers=auth(adm)
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["status"] == "approved"
    after = balance_of(client, token)
    assert after == before + 30.0

    # такрорӣ → 409 (балансро дубора зиёд НАмекунад)
    assert (
        client.post(
            f"/api/admin/balance-requests/{created['id']}/approve",
            headers=auth(adm),
        ).status_code
        == 409
    )
    assert balance_of(client, token) == after


def test_topup_reject_keeps_balance(client: TestClient):
    """Рад → баланс ҳеҷ гуна тағйир намеёбад → такрорӣ → 409."""
    token = register(client)
    created = create(client, token, amount="40").json()
    adm = admin_token(client)

    before = balance_of(client, token)
    r = client.post(
        f"/api/admin/balance-requests/{created['id']}/reject", headers=auth(adm)
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "rejected"
    assert balance_of(client, token) == before

    assert (
        client.post(
            f"/api/admin/balance-requests/{created['id']}/reject",
            headers=auth(adm),
        ).status_code
        == 409
    )


def test_topup_admin_list_shows_decided(client: TestClient):
    """Филтри ҳолат: пас аз қабул аз pending меравад, ба approved меояд."""
    token = register(client)
    created = create(client, token, amount="15").json()
    adm = admin_token(client)

    client.post(
        f"/api/admin/balance-requests/{created['id']}/approve", headers=auth(adm)
    )
    pending = client.get(
        "/api/admin/balance-requests?status=pending", headers=auth(adm)
    ).json()
    assert all(x["id"] != created["id"] for x in pending)
    approved = client.get(
        "/api/admin/balance-requests?status=approved", headers=auth(adm)
    ).json()
    assert any(x["id"] == created["id"] for x in approved)
