"""📩 Тестҳои огоҳиномаи EMAIL ҳангоми пур кардани баланси корбар.

Сенарияҳо:
  1  Админ баланс илова кард → EMAIL ба ADMIN_EMAIL бо тафсилоти маблағ
  2  SMTP холӣ → email намеравад, ВАЛЛЕ баланс ҳамон тавр сабт мешавад
  3  Функсияи email-и корбар (баланс аз дархости пур кардан) ҳам кор мекунад

⚠️ Ҳеҷ email воқеӣ намеравад: smtplib.SMTP бо қалъаи (mock) иваз мешавад.
"""
from __future__ import annotations

import smtplib

from fastapi.testclient import TestClient

from app.config import settings
from app.services import email_service

PASSWORD = "TestPassw0rd!"


# =====================================================================
# 🧰 Ёрӣ
# =====================================================================
def new_phone() -> str:
    import uuid

    return "992" + str(uuid.uuid4().int % 1_000_000_000).zfill(9)


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register(client: TestClient, password: str = PASSWORD) -> str:
    r = client.post(
        "/api/auth/register",
        json={"phone": new_phone(), "password": password, "language": "tj"},
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


class FakeSMTP:
    """Қалъаи smtplib.SMTP — ҳеҷ шабака, танҳо сабти паём."""

    sent: list = []

    def __init__(self, host: str, port: int, *args, **kwargs):
        self.host = host
        self.port = port

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self):
        return None

    def login(self, username: str, password: str):
        return None

    def send_message(self, msg):
        FakeSMTP.sent.append(msg)


def enable_smtp(monkeypatch, admin_email: str = "admin@example.tj") -> None:
    """SMTP + ADMIN_EMAIL фаъол + smtplib бо қалъа иваз мешавад."""
    FakeSMTP.sent.clear()
    monkeypatch.setattr(settings, "ADMIN_EMAIL", admin_email)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.tj")
    monkeypatch.setattr(settings, "SMTP_USERNAME", "noreply@example.tj")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "secret")
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)


def body_of(msg) -> str:
    """HTML-и паёми MIMEMultipart("alternative") — base64 decode."""
    part = msg.get_payload()[0]
    raw = part.get_payload(decode=True)
    if isinstance(raw, bytes):
        return raw.decode("utf-8", "replace")
    return str(raw)


# =====================================================================
# 1. Админ баланс илова кард → EMAIL бо тафсилоти маблағ
# =====================================================================
def test_admin_add_balance_sends_email_with_amount(client: TestClient, monkeypatch):
    """➕ Пур кардани баланс → як EMAIL ба админ бо маблағ + баланси нав."""
    enable_smtp(monkeypatch)

    user_token = register(client)
    me = client.get("/api/auth/me", headers=auth(user_token)).json()
    victim_id, victim_phone = me["id"], me["phone"]
    adm = admin_token(client)

    r = client.post(
        f"/api/admin/users/{victim_id}/balance",
        headers=auth(adm),
        json={"user_id": victim_id, "amount": 75, "reason": "тестии email"},
    )
    assert r.status_code in (200, 201), r.text

    # Як паём → ба ADMIN_EMAIL
    assert len(FakeSMTP.sent) == 1, "EMAIL ба админ нодастрас омад"
    msg = FakeSMTP.sent[0]
    assert msg["To"] == "admin@example.tj"
    assert "Баланс пур карда шуд" in msg["Subject"]

    # Тафсилоти маблағ дар матн ҳаст
    body = body_of(msg)
    assert "75.00 сомонӣ" in body, body  # маблағи илова
    assert "тестии email" in body, body  # сабаб
    assert victim_phone in body, body  # корбари ҳадаф
    assert "Баланси нав" in body, body

    # Баланс ҳам воқеан +75 шуд
    bal = client.get("/api/auth/me/balance", headers=auth(user_token)).json()
    assert float(bal["balance"]) == 75.0


# =====================================================================
# 2. SMTP холӣ → email намеравад, ВАЛЛЕ баланс сабт мешавад
# =====================================================================
def test_add_balance_works_without_smtp(client: TestClient, monkeypatch):
    """Бе SMTP: ҳеҷ email нест, баланс ҳанӯз +50 (хатогӣ ҷавобро намебарад)."""
    monkeypatch.setattr(settings, "ADMIN_EMAIL", "admin@example.tj")
    monkeypatch.setattr(settings, "SMTP_HOST", "")  # SMTP хомӯш

    calls: list = []

    class BoomSMTP:
        def __init__(self, *a, **k):
            calls.append(a)

    monkeypatch.setattr(smtplib, "SMTP", BoomSMTP)

    user_token = register(client)
    victim_id = client.get("/api/auth/me", headers=auth(user_token)).json()["id"]
    adm = admin_token(client)

    r = client.post(
        f"/api/admin/users/{victim_id}/balance",
        headers=auth(adm),
        json={"user_id": victim_id, "amount": 50, "reason": "бе SMTP"},
    )
    assert r.status_code in (200, 201), r.text
    assert calls == [], "SMTP набояд ҳатто сохта шавад"

    bal = client.get("/api/auth/me/balance", headers=auth(user_token)).json()
    assert float(bal["balance"]) == 50.0


# =====================================================================
# 3. Функсияи email-и корбар (баланс аз дархости пур кардан)
# =====================================================================
def test_user_topup_email_contains_amount(monkeypatch):
    """📧 Ба худи корбар: маблағ + баланси нав дар матн ҳаст."""
    enable_smtp(monkeypatch)

    ok = email_service.send_balance_topup_email(
        to_email="user@example.tj",
        user_id=42,
        amount_added=120.0,
        new_balance=320.0,
        date_str="2026-10-27 12:00",
    )
    assert ok is True
    assert len(FakeSMTP.sent) == 1
    body = body_of(FakeSMTP.sent[0])
    assert "120.00 somoni" in body or "120.00" in body
    assert "320.00" in body
    assert FakeSMTP.sent[0]["To"] == "user@example.tj"


# =====================================================================
# 4. Функсияи email-и админ: SMTP холӣ → False (хомӯш)
# =====================================================================
def test_admin_email_silently_skipped_without_smtp(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    ok = email_service.send_balance_admin_email(
        to_email="admin@example.tj",
        user_id=1,
        user_label="Тест",
        amount=10.0,
        new_balance=10.0,
        reason="x",
        admin_label="admin",
        date_str="2026-10-27",
    )
    assert ok is False
