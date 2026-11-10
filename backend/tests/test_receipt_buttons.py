# -*- coding: utf-8 -*-
"""Тугмаҳои ✅ Қабул / ❌ Рад дар паёми «Чек расид» ба админ.

Талаби соҳиб (11.11.2026): «ва дар инҷо чаро қабул/рад нест?» →
паёми чек бояд бо тугмаҳои inline фиристад; бот ҳамон
`approve_topup` / `reject_topup`-ро иҷро мекунад (тҳано чати админ).
"""
import asyncio
from types import SimpleNamespace

from app.services import telegram_service as ts


def test_receipt_message_has_approve_reject_buttons(monkeypatch):
    """Чеки расид → ду тугма: `topup:ok:{id}` + `topup:reject:{id}`."""
    captured: dict = {}

    async def fake_send(chat_id, text, buttons):
        captured["chat_id"] = chat_id
        captured["text"] = text
        captured["buttons"] = buttons
        return True

    monkeypatch.setattr(
        ts,
        "settings",
        SimpleNamespace(
            TELEGRAM_ADMIN_CHAT_ID="8440048881",
            TELEGRAM_BOT_TOKEN="x",
        ),
    )
    monkeypatch.setattr(ts, "send_message_with_buttons", fake_send)

    ok = asyncio.run(
        ts.notify_topup_receipt(129, "muhammad · 992002119831", 200.0, None)
    )

    assert ok is True
    assert captured["chat_id"] == "8440048881"
    # Ҳамон callback-ҳое, ки боти админ (`cb_topup`) мефаҳмад
    flat = {
        b["callback_data"]
        for row in captured["buttons"]
        for b in row
    }
    assert flat == {"topup:ok:129", "topup:reject:129"}
    texts = {b["text"] for row in captured["buttons"] for b in row}
    assert "✅ Қабул" in texts
    assert "❌ Рад" in texts
    # Дархост дар матн ҳамчун рақам мемонад
    assert "#129" in captured["text"]


def test_order_receipt_message_has_buttons(monkeypatch):
    """Чеки ФАРМОИШ → ду тугма: `order:ok:{id}` + `order:reject:{id}`.

    Талаби соҳиб (11.11.2026): «дар инҷо ҳам қабул/рад бошад».
    """
    captured: dict = {}

    async def fake_send(chat_id, text, buttons):
        captured["text"] = text
        captured["buttons"] = buttons
        return True

    monkeypatch.setattr(
        ts,
        "settings",
        SimpleNamespace(
            TELEGRAM_ADMIN_CHAT_ID="8440048881",
            TELEGRAM_BOT_TOKEN="x",
        ),
    )
    monkeypatch.setattr(ts, "send_message_with_buttons", fake_send)

    ok = asyncio.run(
        ts.notify_order_receipt(
            424,
            game="Free Fire",
            product="FF Level Up Pass 6",
            player_id="6356668",
            amount=3.5,
            buyer="muhammad · 992002119831",
        )
    )

    assert ok is True
    flat = {
        b["callback_data"] for row in captured["buttons"] for b in row
    }
    assert flat == {"order:ok:424", "order:reject:424"}
    texts = {b["text"] for row in captured["buttons"] for b in row}
    assert "✅ Қабул" in texts and "❌ Рад" in texts
    assert "#424" in captured["text"]
