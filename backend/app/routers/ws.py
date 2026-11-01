# -*- coding: utf-8 -*-
"""
🔌 WebSocket: `GET /api/ws?token=<JWT>` — зиндаи огоҳиномаҳои мизоҷ.

Мисол: админ дархости пур карданро тасдиқ мекунад → ба мизоҷи дар
модали «Пур кардани баланс» буда фавран `topup_updated` мефиристад →
клиент бе ягон refresh рӯйхат + баланси навро мегирад.

• Токен: ҳамон JWT-и оддӣ (`danatel_token`), дар query —
  браузер дар WebSocket сарлавҳаи Authorization дода наметавонад;
• Токен нодуруст/бекор → `close(4401)` бе accept;
• Пинги сервер ҳар 25s (майдони proxy/NAT зинда мемонад);
• Ҳар паём аз `realtime.publish` танҳо ба соҳиби `user_id` мефиристад.
"""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.database import SessionLocal
from app.security import decode_token
from app.services.realtime import subscribe, unsubscribe

router = APIRouter()
logger = logging.getLogger("ws")

_PING_EVERY = 25.0


async def _reader(ws: WebSocket) -> None:
    """Даромад: пинг/pong-и клиент (фаъол нигоҳ доштани канал)."""
    while True:
        await ws.receive_text()


async def _writer(ws: WebSocket, queue: asyncio.Queue) -> None:
    """Хуруҷ: паёмҳои realtime + пинги 25-сониявӣ."""
    while True:
        try:
            message = await asyncio.wait_for(queue.get(), timeout=_PING_EVERY)
        except asyncio.TimeoutError:
            await ws.send_text(json.dumps({"type": "ping"}))
            continue
        await ws.send_text(message)


@router.websocket("/api/ws")
async def ws_endpoint(ws: WebSocket, token: str = Query(default="")) -> None:
    user_id: int | None = None
    if token:
        try:
            with SessionLocal() as db:
                payload = decode_token(token, db)
            user_id = int(payload.get("sub") or 0) or None
        except WebSocketDisconnect:
            raise
        except Exception:  # noqa: BLE001 — JWTError / нодуруст / бекоршуда
            user_id = None
    if user_id is None:
        await ws.close(code=4401, reason="unauthorized")
        return

    await ws.accept()
    queue = subscribe(user_id)
    try:
        await ws.send_text(json.dumps({"type": "hello", "user_id": user_id}))
        t_rx = asyncio.create_task(_reader(ws))
        t_tx = asyncio.create_task(_writer(ws, queue))
        done, _pending = await asyncio.wait(
            {t_rx, t_tx}, return_when=asyncio.FIRST_COMPLETED
        )
        for t in (t_rx, t_tx):
            if not t.done():
                t.cancel()
        for t in done:
            if not t.cancelled() and t.exception() and not isinstance(
                t.exception(), WebSocketDisconnect
            ):
                logger.debug("ws: %s", t.exception())
    except WebSocketDisconnect:
        pass
    finally:
        unsubscribe(queue)
