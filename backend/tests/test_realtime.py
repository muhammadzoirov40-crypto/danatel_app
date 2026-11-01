# -*- coding: utf-8 -*-
"""📡 Realtime: WebSocket + огоҳиномаи зиндаи тасдиқи дархост.

Сенарияҳо:
  1  /api/ws бо токени дуруст → `hello` (user_id)
  2  бе токен → баста мешавад (4401) бе қабул
  3  `realtime.publish()` → ҳамон пайваст фавран паём мегирад
  4  E2E: чек → тасдики админ → мизоҷ тавассути WS `topup_updated`
     мегирад; баланси ниҳоӣ дуруст
"""
from __future__ import annotations

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.database import SessionLocal
from app.services import realtime
from test_topups import (
    admin_token,
    auth,
    balance_of,
    prepare,
    register,
    send_receipt,
)


def _uid(client: TestClient, token: str) -> int:
    r = client.get("/api/auth/me", headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()["id"]


# =====================================================================
# 1–2. ПАЙВАСТ / РАД
# =====================================================================
def test_ws_hello(client: TestClient):
    """Токени дуруст → саломи `hello` бо user_id."""
    token = register(client)
    uid = _uid(client, token)
    with client.websocket_connect(f"/api/ws?token={token}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "hello"
        assert msg["user_id"] == uid


def test_ws_no_token_closed(client: TestClient):
    """Бе токен → `close(4401)`, пайваст қабул намешавад."""
    try:
        with client.websocket_connect("/api/ws") as ws:
            ws.receive_text()
    except WebSocketDisconnect as exc:
        assert exc.code == 4401
        return
    raise AssertionError("пайваст бояд рад шавад")


def test_ws_bad_token_closed(client: TestClient):
    """Токени бардурӯг → ҳамон 4401."""
    try:
        with client.websocket_connect("/api/ws?token=garbage.token.here") as ws:
            ws.receive_text()
    except WebSocketDisconnect as exc:
        assert exc.code == 4401
        return
    raise AssertionError("пайваст бояд рад шавад")


# =====================================================================
# 3. PUBLISH → ПАЙВАСТ
# =====================================================================
def test_ws_publish_delivers(client: TestClient):
    """publish() → ҳамон пайваст фавран `topup_updated` мегирад."""
    token = register(client)
    uid = _uid(client, token)
    with client.websocket_connect(f"/api/ws?token={token}") as ws:
        assert ws.receive_json()["type"] == "hello"
        with SessionLocal() as db:
            realtime.publish(
                db,
                user_id=uid,
                event="topup_updated",
                data={"request_id": 1, "status": "approved"},
            )
        msg = ws.receive_json()
        assert msg["type"] == "topup_updated"
        assert msg["request_id"] == 1
        assert msg["status"] == "approved"


# =====================================================================
# 4. E2E: ТАСДИҚИ АДМИН → WS ДАР МИЗОҶ
# =====================================================================
def test_topup_approve_pushes_over_ws(client: TestClient):
    """Админ тасдиқ мекунад → мизоҷ тавассути WS хабар мегирад."""
    token = register(client)
    prepared = prepare(client, token, amount="30").json()
    adm = admin_token(client)
    assert send_receipt(client, token, prepared["id"]).status_code == 200

    with client.websocket_connect(f"/api/ws?token={token}") as ws:
        assert ws.receive_json()["type"] == "hello"
        r = client.post(
            f"/api/admin/balance-requests/{prepared['id']}/approve",
            headers=auth(adm),
        )
        assert r.status_code == 200, r.text
        msg = ws.receive_json()
        assert msg["type"] == "topup_updated"
        assert msg["request_id"] == prepared["id"]
        assert msg["status"] == "approved"

    # баланс пас аз тасдиқ: +30 (сентинҳои ибтидоӣ = 0)
    assert balance_of(client, token) == 30.0
