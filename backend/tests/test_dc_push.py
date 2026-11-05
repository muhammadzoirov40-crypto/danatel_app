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

import asyncio
import io
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

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


# =====================================================================
# 💬 ФОРМАТИ ҶАВОБ + МУАЙЯНКУНАНДАИ МАТН
# =====================================================================
def test_format_reply_statuses_all_langs():
    """Ҳамаи 4 ҳолат × 4 забон — ҷавоб пурра ва рақамҳо дуруст."""
    from app.services.dc_push import format_reply

    for lang in ("tj", "ru", "en", "uz"):
        ok = format_reply(
            {"status": "success", "amount": 25, "balance": 125}, lang
        )
        assert "25" in ok and "125" in ok, (lang, ok)
        assert format_reply({"status": "already"}, lang).strip()
        assert format_reply({"status": "ignored"}, lang).strip()
        nf = format_reply({"status": "not_found", "amount": 50}, lang)
        assert "50" in nf, (lang, nf)


def test_looks_like_push():
    """Танҳо матни пардохт (TJS/сомонӣ) ҳамчун пуш қабул мешавад."""
    from app.services.dc_push import looks_like_push

    assert looks_like_push("25.00 TJS от +9929000123456")
    assert looks_like_push("Получено 40 сомони")
    assert not looks_like_push("салом")
    assert not looks_like_push("12345")


# =====================================================================
# 🤖 БОТ: форвард/нусхаи матни DC аз чати админ → ҳамон process_push
# =====================================================================
@pytest.fixture(scope="module")
def bot_mod():
    """Модули ботро бе Telegram-и воқеӣ мекушояд (танҳо формати токен)."""
    from app.config import settings as cfg

    saved = cfg.TELEGRAM_BOT_TOKEN
    cfg.TELEGRAM_BOT_TOKEN = "123456:TEST_FORMAT_ONLY"
    try:
        import app.bot.bot as m

        return m
    finally:
        cfg.TELEGRAM_BOT_TOKEN = saved


def _msg(chat_id: int, text: str, forwarded: bool = False) -> MagicMock:
    msg = MagicMock()
    msg.chat = SimpleNamespace(id=chat_id)
    msg.text = text
    msg.forward_origin = object() if forwarded else None
    msg.answer = AsyncMock()
    return msg


def _run(handler, msg) -> str:
    asyncio.run(handler(msg))
    return msg.answer.call_args[0][0]


def test_bot_admin_paste_auto_credits(client, bot_mod, monkeypatch):
    """Нусхаи матни DC аз чати админ → қабул + баланс +25."""
    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_CHAT_ID", "777001")
    token, phone = register(client)
    prepare(client, token, "25")

    reply = _run(
        bot_mod.on_text, _msg(777001, f"Получено 25.00 TJS от +{phone}")
    )
    assert "✅" in reply, reply
    assert balance_of(client, token) == 25.0


def test_bot_non_admin_never_processed(client, bot_mod, monkeypatch):
    """Одамони дигар ҳатто бо ҳамон матн → мизичаи оддӣ, бе қабул."""
    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_CHAT_ID", "777001")
    token, phone = register(client)
    prepare(client, token, "25")

    reply = _run(
        bot_mod.on_text, _msg(555002, f"Получено 25.00 TJS от +{phone}")
    )
    assert "✅" not in reply, reply
    assert "Хуш омадед" in reply, reply
    assert balance_of(client, token) == 0.0


def test_bot_admin_casual_text_keeps_menu(client, bot_mod, monkeypatch):
    """Матни оддии админ (бе форвард ва бе TJS/сомонӣ) → мизича, не push."""
    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_CHAT_ID", "777001")
    reply = _run(bot_mod.on_text, _msg(777001, "салом"))
    assert "Хуш омадед" in reply, reply


def test_bot_forwarded_without_amount_gets_hint(client, bot_mod, monkeypatch):
    """Форварди бе маблағ → ҷавоби «ignored» бо формат (бе амали дигар)."""
    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_CHAT_ID", "777001")
    reply = _run(bot_mod.on_text, _msg(777001, "hello", forwarded=True))
    assert "⚠️" in reply, reply
