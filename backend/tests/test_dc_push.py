"""🔔 Пуш-огоҳиномаҳои DC → худкор тасдиқи пардохт (POST /api/webhook/dc-push).

Санҷишҳо:
  • токен (403 бе он / бо токени нодуруст);
  • хондани матн: маблағ (TJS/сомонӣ, нуқта ё вергул) + рақам
    («+992…», «992 900…», «900 12 34 56», бе «+»);
  • рақами ҳисоби DC (16 рақам) ҳамчун телефон ҚАБУЛ НАМЕШАВАД;
  • қабули pending (бо чек) ва awaiting (бе чек) → баланс +25/+40;
  • такрории пуш → «already», баланс ЯК бор зиёд мешавад;
  • бе мувофиқат → «not_found» + огоҳинома ба админ (мониторинг).
"""
from __future__ import annotations

import io
import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.services import telegram_service

PASSWORD = "TestPassw0rd!"
TOKEN = "unit_dc_push_token_0123456789"
PUSH = "/api/webhook/dc-push"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def push_headers() -> dict[str, str]:
    return {"X-Secret-Token": TOKEN}


def new_phone() -> str:
    return "992" + str(uuid.uuid4().int % 1_000_000_000).zfill(9)


def register(client: TestClient) -> tuple[str, str]:
    phone = new_phone()
    r = client.post(
        "/api/auth/register",
        json={"phone": phone, "password": PASSWORD, "language": "tj"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"], phone


def prepare(client: TestClient, token: str, amount: str = "25") -> dict:
    r = client.post(
        "/api/balance-requests",
        headers=auth(token),
        json={"amount": amount},
    )
    assert r.status_code == 200, r.text
    return r.json()


def send_receipt(client: TestClient, token: str, request_id: int) -> None:
    r = client.post(
        f"/api/balance-requests/{request_id}/receipt",
        headers=auth(token),
        files={"file": ("c.png", io.BytesIO(PNG), "image/png")},
    )
    assert r.status_code == 200, r.text


def balance_of(client: TestClient, token: str) -> float:
    r = client.get("/api/auth/me/balance", headers=auth(token))
    assert r.status_code == 200, r.text
    return float(r.json()["balance"])


def push(client: TestClient, title: str, body: str):
    return client.post(
        PUSH, json={"title": title, "body": body}, headers=push_headers()
    )


@pytest.fixture(autouse=True)
def dc_push_env(monkeypatch):
    """Токен фаол + мониторинги огоҳиномаҳо ба админ (бе Telegram-и воқеӣ)."""
    monkeypatch.setattr(settings, "DC_PUSH_TOKEN", TOKEN)
    notified: list[str] = []

    async def _record(text: str) -> None:
        notified.append(text)

    monkeypatch.setattr(telegram_service, "notify_admin", _record)
    yield notified


# =====================================================================
# 🔐 АМНИЯТ
# =====================================================================
def test_token_required(client: TestClient):
    """Бе токен ё бо токени нодуруст → 403 (ҳеҷ кор нест)."""
    r = client.post(PUSH, json={"title": "DC", "body": "25 TJS"})
    assert r.status_code == 403
    r = client.post(
        PUSH,
        json={"title": "DC", "body": "25 TJS"},
        headers={"X-Secret-Token": "wrong-token"},
    )
    assert r.status_code == 403


def test_empty_text_rejected(client: TestClient):
    """Матн холӣ → 422."""
    r = client.post(PUSH, json={}, headers=push_headers())
    assert r.status_code == 422


# =====================================================================
# 📖 ХОНДАНИ МАТН
# =====================================================================
def test_ignored_without_amount(client: TestClient):
    """Бе маблағ → «ignored», ҳеҷ амал нест."""
    r = client.post(
        PUSH,
        json={"title": "DC Wallet", "body": "Шумо ба ҳисоб ворид шудед"},
        headers=push_headers(),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "ignored"


def test_unmatched_notifies_admin(client: TestClient, dc_push_env):
    """Рақами ношинос → «not_found» + як огоҳинома ба админ."""
    r = push(client, "Получено", "50.00 TJS от +9929001112233")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "not_found"
    assert len(dc_push_env) == 1
    assert "50.00" in dc_push_env[0] or "50" in dc_push_env[0]
    assert "9929001112233" in dc_push_env[0]


def test_account_number_is_not_a_phone(client: TestClient, dc_push_env):
    """Рақами ҳисоби DC (16 рақам) ҳамчун телефон қабул НАШАВАД."""
    token, _phone = register(client)
    prepare(client, token, "25")
    r = push(client, "Получено", "25.00 TJS на счёт 9762000220865843")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "not_found"
    # ҳеҷ чиз қабул нашуд → баланс 0 мемонад
    assert balance_of(client, token) == 0.0
    assert len(dc_push_env) == 1


# =====================================================================
# ✅ ҚАБУЛ — БАЛАНС ЗИЁД МЕШАВАД
# =====================================================================
def test_approves_pending_with_receipt(client: TestClient):
    """Дархост бо чек (pending) → қабул + баланс +25."""
    token, phone = register(client)
    req = prepare(client, token, "25")
    send_receipt(client, token, req["id"])
    before = balance_of(client, token)

    r = push(client, "Получено", f"25.00 TJS от +{phone}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "success"
    assert body["request_id"] == req["id"]
    assert balance_of(client, token) == before + 25

    mine = client.get("/api/balance-requests/mine", headers=auth(token))
    assert mine.json()[0]["status"] == "approved"


def test_approves_awaiting_without_receipt(client: TestClient):
    """Дархост БЕ чек (awaiting) → пуш худ далел аст → қабул +40."""
    token, phone = register(client)
    req = prepare(client, token, "40")

    r = push(client, "Уведомление", f"Получено 40 сомони от {phone}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "success"
    assert body["request_id"] == req["id"]
    assert balance_of(client, token) == 40.0


def test_comma_amount_and_spaced_phone(client: TestClient):
    """«35,00 сомони» + рақам бо фосилаҳо («992 900 12 34 56»)."""
    token, phone = register(client)
    prepare(client, token, "35")
    spaced = f"{phone[:3]} {phone[3:6]} {phone[6:8]} {phone[8:]}"

    r = push(client, "", f"Перевод: 35,00 сомони, отправитель {spaced}")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "success"
    assert balance_of(client, token) == 35.0


def test_duplicate_push_no_double_credit(
    client: TestClient, dc_push_env
):
    """Пуш такрорӣ → «already», баланс ЯК бор, админ огоҳ НАШАВАД."""
    token, phone = register(client)
    req = prepare(client, token, "25")

    first = push(client, "Получено", f"25.00 TJS от +{phone}")
    assert first.json()["status"] == "success"
    bal = balance_of(client, token)

    second = push(client, "Получено", f"25.00 TJS от +{phone}")
    assert second.json()["status"] == "already"
    assert second.json()["request_id"] == req["id"]
    assert balance_of(client, token) == bal
    assert dc_push_env == []
