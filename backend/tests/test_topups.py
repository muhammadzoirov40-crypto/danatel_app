"""💳 Дархостҳои пур кардан: пардохти DC City → чек (1 дақиқа) → тасдиқ/ради админ."""
from __future__ import annotations

import io
import uuid
from datetime import datetime, timedelta

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


def prepare(client: TestClient, token: str, amount: str = "25"):
    """1️⃣ Омодасозии пардохт → линки pay.dc.tj."""
    return client.post(
        "/api/balance-requests",
        headers=auth(token),
        json={"amount": amount},
    )


def send_receipt(client: TestClient, token: str, request_id: int):
    """2️⃣ Расми чек дар вақти муқарраршуда."""
    return client.post(
        f"/api/balance-requests/{request_id}/receipt",
        headers=auth(token),
        files={"file": ("c.png", io.BytesIO(PNG), "image/png")},
    )


def balance_of(client: TestClient, token: str) -> float:
    r = client.get("/api/auth/me/balance", headers=auth(token))
    assert r.status_code == 200, r.text
    return float(r.json()["balance"])


def expire_deadline(request_id: int) -> None:
    """Мӯҳлати чекро ба гузашта мегузорем (санҷиши вақт)."""
    from app.database import SessionLocal
    from app.models import BalanceRequest

    db = SessionLocal()
    try:
        row = db.get(BalanceRequest, request_id)
        assert row is not None
        row.receipt_deadline = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
    finally:
        db.close()


# =====================================================================
# 🧪 САНҶИШҲО
# =====================================================================


def test_prepare_requires_auth(client: TestClient):
    """Бе токен → 401 (ҳам омодасозӣ, ҳам рӯйхат)."""
    assert client.post("/api/balance-requests", json={"amount": "10"}).status_code == 401
    assert client.get("/api/balance-requests/mine").status_code == 401


def test_prepare_ok(client: TestClient):
    """Омодасозӣ: линки воқеии DC City + референс + мӯҳлати 1 дақиқа."""
    token = register(client)
    r = prepare(client, token, amount="25")
    assert r.status_code == 200, r.text
    body = r.json()
    url = body["payment_url"]
    assert url.startswith("https://pay.dc.tj/")
    assert "c=donatshop" in url
    assert f"f2=" in url and "f3=" in url
    assert "s=25.00" in url
    # мӯҳлат: тақрибан 1 дақиқа аз ҳозир (сервер UTC мефиристад)
    dl = datetime.fromisoformat(body["receipt_deadline"])
    if dl.tzinfo is not None:
        dl = dl.replace(tzinfo=None)
    delta = (dl - datetime.utcnow()).total_seconds()
    assert 0 < delta <= 70

    mine = client.get("/api/balance-requests/mine", headers=auth(token))
    assert mine.status_code == 200
    row = mine.json()[0]
    assert row["id"] == body["id"]
    assert row["status"] == "awaiting_receipt"
    assert row["dc_ref"]


def test_prepare_validation(client: TestClient):
    """Маблағ нодуруст → 422."""
    token = register(client)
    assert prepare(client, token, amount="0").status_code == 422
    assert prepare(client, token, amount="abc").status_code == 422


def test_second_prepare_expires_first(client: TestClient):
    """Дархости кӯҳнаи бе чек → expired; як корбар = як дархости фаъол."""
    token = register(client)
    first = prepare(client, token, amount="10").json()
    second = prepare(client, token, amount="20").json()
    assert second["id"] != first["id"]
    statuses = {
        x["id"]: x["status"]
        for x in client.get(
            "/api/balance-requests/mine", headers=auth(token)
        ).json()
    }
    assert statuses[first["id"]] == "expired"
    assert statuses[second["id"]] == "awaiting_receipt"


def test_receipt_flow_approve(client: TestClient):
    """Чек → pending → қабул → баланс + маблағ → такрорӣ → 409."""
    token = register(client)
    prepared = prepare(client, token, amount="30").json()
    adm = admin_token(client)

    # ғайриадмин ба рӯйхати админ → 403
    assert (
        client.get("/api/admin/balance-requests", headers=auth(token)).status_code
        == 403
    )

    r = send_receipt(client, token, prepared["id"])
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pending"
    assert r.json()["receipt_file"].startswith("/uploads/receipts/")

    lst = client.get(
        "/api/admin/balance-requests?status=pending", headers=auth(adm)
    )
    assert lst.status_code == 200
    assert any(x["id"] == prepared["id"] for x in lst.json())

    before = balance_of(client, token)
    ok = client.post(
        f"/api/admin/balance-requests/{prepared['id']}/approve", headers=auth(adm)
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["status"] == "approved"
    assert balance_of(client, token) == before + 30.0

    assert (
        client.post(
            f"/api/admin/balance-requests/{prepared['id']}/approve",
            headers=auth(adm),
        ).status_code
        == 409
    )


def test_receipt_too_late(client: TestClient):
    """Аз 1 дақиқа гузашт → 410 + ҳолат expired, баланс тағйир намеёбад."""
    token = register(client)
    adm = admin_token(client)
    prepared = prepare(client, token, amount="15").json()
    expire_deadline(prepared["id"])

    before = balance_of(client, token)
    r = send_receipt(client, token, prepared["id"])
    assert r.status_code == 410, r.text
    assert balance_of(client, token) == before

    statuses = {
        x["id"]: x["status"]
        for x in client.get(
            "/api/balance-requests/mine", headers=auth(token)
        ).json()
    }
    assert statuses[prepared["id"]] == "expired"

    # чеки дер омада ҳеҷ чизро тағйир намедиҳад
    assert all(
        x["id"] != prepared["id"]
        for x in client.get(
            "/api/admin/balance-requests?status=pending", headers=auth(adm)
        ).json()
    )


def test_receipt_wrong_owner(client: TestClient):
    """Чеки корбари дигар → 404."""
    a = register(client)
    b = register(client)
    prepared = prepare(client, a, amount="12").json()
    r = send_receipt(client, b, prepared["id"])
    assert r.status_code == 404


def test_receipt_validation(client: TestClient):
    """Файли ғайрирасмӣ → 422."""
    token = register(client)
    prepared = prepare(client, token, amount="10").json()
    r = client.post(
        f"/api/balance-requests/{prepared['id']}/receipt",
        headers=auth(token),
        files={"file": ("x.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert r.status_code == 422


def test_reject_keeps_balance(client: TestClient):
    """Рад → баланс ҳеҷ гуна тағйир намеёбад → такрорӣ → 409."""
    token = register(client)
    adm = admin_token(client)
    prepared = prepare(client, token, amount="40").json()
    send_receipt(client, token, prepared["id"])

    before = balance_of(client, token)
    r = client.post(
        f"/api/admin/balance-requests/{prepared['id']}/reject", headers=auth(adm)
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "rejected"
    assert balance_of(client, token) == before

    assert (
        client.post(
            f"/api/admin/balance-requests/{prepared['id']}/reject",
            headers=auth(adm),
        ).status_code
        == 409
    )


def test_approve_before_receipt_refused(client: TestClient):
    """Чек навастода → қабули админ 409 (баланс намеравад)."""
    token = register(client)
    adm = admin_token(client)
    prepared = prepare(client, token, amount="25").json()

    before = balance_of(client, token)
    r = client.post(
        f"/api/admin/balance-requests/{prepared['id']}/approve", headers=auth(adm)
    )
    assert r.status_code == 409
    assert balance_of(client, token) == before


# =====================================================================
# 🔄 ВОЗВРОТКА (боз гирифтан аз ҷониби админ)
# =====================================================================


def _approve_flow(client: TestClient, amount: str = "25") -> tuple[str, int, float]:
    """Дархост то ҳолати approved: (user_token, req_id, баланси ПЕШ)."""
    token = register(client)
    before = balance_of(client, token)
    prepared = prepare(client, token, amount=amount).json()
    send_receipt(client, token, prepared["id"])
    adm = admin_token(client)
    r = client.post(
        f"/api/admin/balance-requests/{prepared['id']}/approve", headers=auth(adm)
    )
    assert r.status_code == 200, r.text
    return token, prepared["id"], before


def test_revert_after_approve_balance_exact(client: TestClient):
    """🔄 Қабул → возвратка: баланс ПАС ба ҳамон рақам, ҳолат reverted."""
    token, req_id, before = _approve_flow(client)
    adm = admin_token(client)
    assert balance_of(client, token) == before + 25.0

    r = client.post(
        f"/api/admin/balance-requests/{req_id}/revert", headers=auth(adm)
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "reverted"
    assert balance_of(client, token) == before  # ПАС ҳамон рақам

    # рӯйхати админ ҳолати навро нишон медиҳад
    rows = client.get("/api/admin/balance-requests", headers=auth(adm)).json()
    row = next(x for x in rows if x["id"] == req_id)
    assert row["status"] == "reverted"

    # таърихи баланс: сатри буриш бо истинод ба #id ҳаст
    from app.database import SessionLocal
    from sqlalchemy import text as _text

    db = SessionLocal()
    try:
        n = db.execute(
            _text(
                "SELECT count(*) FROM balance_transactions "
                "WHERE kind = 'debit' AND user_id = :u AND reason LIKE :r"
            ),
            {"u": client.get("/api/auth/me", headers=auth(token)).json()["id"],
             "r": f"%пур кардан #{req_id} (%"},
        ).scalar()
    finally:
        db.close()
    assert n == 1


def test_revert_twice_409(client: TestClient):
    """Такроран возвратка → 409, баланс дубора намешинад."""
    token, req_id, before = _approve_flow(client)
    adm = admin_token(client)

    assert (
        client.post(
            f"/api/admin/balance-requests/{req_id}/revert", headers=auth(adm)
        ).status_code
        == 200
    )
    mid = balance_of(client, token)
    assert mid == before

    r2 = client.post(
        f"/api/admin/balance-requests/{req_id}/revert", headers=auth(adm)
    )
    assert r2.status_code == 409
    assert balance_of(client, token) == mid  # баланс бетағйир


def test_revert_only_approved(client: TestClient):
    """Возвратка танҳо аз approved: awaiting / pending / rejected → 409."""
    token = register(client)
    adm = admin_token(client)
    prepared = prepare(client, token, amount="20").json()

    # awaiting_receipt
    assert (
        client.post(
            f"/api/admin/balance-requests/{prepared['id']}/revert",
            headers=auth(adm),
        ).status_code
        == 409
    )

    # pending (чек расид, ҳанӯз қабул нашуда)
    send_receipt(client, token, prepared["id"])
    assert (
        client.post(
            f"/api/admin/balance-requests/{prepared['id']}/revert",
            headers=auth(adm),
        ).status_code
        == 409
    )

    # rejected
    client.post(
        f"/api/admin/balance-requests/{prepared['id']}/reject", headers=auth(adm)
    )
    assert (
        client.post(
            f"/api/admin/balance-requests/{prepared['id']}/revert",
            headers=auth(adm),
        ).status_code
        == 409
    )


def test_revert_requires_admin(client: TestClient):
    """Ғайриадмин возвратка карда наметавонад → 403."""
    token, req_id, _ = _approve_flow(client)
    assert (
        client.post(
            f"/api/admin/balance-requests/{req_id}/revert", headers=auth(token)
        ).status_code
        == 403
    )


def test_revert_allows_negative_balance(client: TestClient):
    """Корбар сарф кардааст → возвратка ҳамеша кор мекунад (баланс манфӣ)."""
    from app.database import SessionLocal
    from app.services import wallet

    token, req_id, _ = _approve_flow(client, amount="30")  # баланс 30
    uid = client.get("/api/auth/me", headers=auth(token)).json()["id"]

    # 30-ро сарф мекунад → баланс 0
    db = SessionLocal()
    try:
        wallet.debit_balance(db, user_id=uid, amount="30", reason="санҷиши сарф")
    finally:
        db.close()
    assert balance_of(client, token) == 0.0

    adm = admin_token(client)
    r = client.post(
        f"/api/admin/balance-requests/{req_id}/revert", headers=auth(adm)
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "reverted"
    assert balance_of(client, token) == -30.0  # манфӣ — қабул аст
