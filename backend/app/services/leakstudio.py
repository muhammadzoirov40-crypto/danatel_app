# -*- coding: utf-8 -*-
"""
🎯 LEAK STUDIO BD — Public API client (лайкҳои FF + авто-лайк).

   Base : https://leakstudiobd.com/api/public
   Auth : заголовок `X-API-Key` (калид дар .env → LEAKSTUDIO_API_KEY)
   Limit: 20 дархост/дақиқа/IP → 429 + Retry-After (мо = transient, дубра)

Ҷараёни харид (тамоми POST = пули калиди соҳиби дарозмуддат):
  · success=true  → пули калид ХАРҶ шуд ⇒ completed ё pending (ниг. map)
  · success=false → ҳеҷ чиз барнаёмад (масалан лайкии рӯзӣ пур) ⇒ rejected
  · HTTP 400      → параметр/пул кам (нодуруст, НЕ транзиентӣ)
  · HTTP 429      → дархост ҚАБУЛ НАШУД ⇒ транзиентӣ (дубра бехатар)
  · HTTP 5xx/сеть → «шаёб дархост коркард шуда бошад» ⇒ амнияти пули:
                     дубраи худкор ДУБОР ХАРҶ мекунад → LSP:UNKNOWN
                     (бе дубра, ба админ хабар; админ аз панели LS месанҷад)

⚠️ ИДЕМПОТЕНТИЯ: Leak Studio параметри external_id НАДОРАД (баръакси
   FireLoot) → ҳар дубраи худкор = харҷи дубраи пули воқеӣ. Барои ҳамин
   танҳо 429 (дархост қабул нашуда) бехатар барои дубра аст.
"""
from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("leakstudio")

# Ҳамаи навъҳои маҳсулот (client умумӣ аст; дар UI танҳо likes/auto_likes)
KINDS = ("likes", "auto_likes", "diamonds", "levelup", "indonesia")

_PKG_PATHS = {
    "likes": "/likes/packages",
    "auto_likes": "/auto-likes/packages",
    "diamonds": "/diamonds/packages",
    "levelup": "/levelup/packages",
    "indonesia": "/indonesia/packages",
}

_BUY_PATHS = {
    "likes": "/likes",
    "auto_likes": "/auto-likes/activate",
    "diamonds": "/diamonds",
    "levelup": "/levelup",
    "indonesia": "/indonesia",
}


class LSError(Exception):
    """Хатои Leak Studio. `transient` = бехатар барои дубра (танҳо 429)."""

    def __init__(self, code: str, *, transient: bool = False, message: str = ""):
        super().__init__(code)
        self.code = code
        self.transient = transient
        self.message = message


def configured() -> bool:
    return bool(settings.LEAKSTUDIO_API_KEY)


def _base() -> str:
    return (settings.LEAKSTUDIO_API_URL or "https://leakstudiobd.com/api/public").rstrip("/")


def _headers() -> dict[str, str]:
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-API-Key": settings.LEAKSTUDIO_API_KEY,
        "User-Agent": "DonatshopBot/1.0",
    }


def _slug(msg: str, limit: int = 40) -> str:
    """«insufficient balance» → `insufficient_balance` (коди кӯтоҳ барои fl_ref)."""
    s = re.sub(r"[^a-z0-9]+", "_", (msg or "").lower()).strip("_")
    return s[:limit] or "error"


async def _transport(
    method: str, url: str, *, json_body: dict | None, timeout: float
) -> tuple[int, Any]:
    """Ягона дарвозаи HTTP (дар тест ҷуброн мешавад). → (status, parsed|None)."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.request(method, url, json=json_body, headers=_headers())
    try:
        return resp.status_code, resp.json()
    except ValueError:
        return resp.status_code, None


async def _req(
    method: str, path: str, *, json_body: dict | None = None, timeout: float = 25.0
) -> dict[str, Any]:
    if not configured():
        raise LSError("not_configured")
    url = f"{_base()}/{path.lstrip('/')}"
    try:
        status, data = await _transport(method, url, json_body=json_body, timeout=timeout)
    except (httpx.HTTPError, OSError) as exc:
        # Сет/таймаут: дархост шояд расид ⇒ дубраи худкор = харҷи дубра
        raise LSError("network", message=str(exc)) from exc

    if status == 429:
        # Дархост ҚАБУЛ НАШУД → бехатар барои дубра
        raise LSError("rate_limited", transient=True)
    if status >= 500:
        # «The request may not have been processed» → ноумеди амнияти пул
        raise LSError(f"http_{status}", message="server_error")
    if status >= 400:
        if isinstance(data, dict):
            msg = str(data.get("message") or data.get("error") or "")
            raise LSError(_slug(msg) if msg else f"bad_request_{status}", message=msg)
        raise LSError(f"bad_request_{status}")
    if not isinstance(data, dict):
        raise LSError("invalid_response")
    return data


async def packages(kind: str) -> list[dict[str, Any]]:
    """Рӯйхати бастаҳо (нархи воқеӣ дар BDT) барои як навъ."""
    if kind not in _PKG_PATHS:
        raise LSError("bad_kind")
    data = await _req("GET", _PKG_PATHS[kind])
    items = data.get("packages")
    return items if isinstance(items, list) else []


def _ok(outcome: str, ref: str = "", **extra: Any) -> dict[str, Any]:
    return {"outcome": outcome, "ref": ref, "code": "", **extra}


def _rejected(code: str, message: str = "") -> dict[str, Any]:
    return {"outcome": "rejected", "ref": "", "code": _slug(code), "message": message}


async def purchase(
    kind: str, *, uid: str, sku: str = "", amount: int = 0, quantity: int = 1
) -> dict[str, Any]:
    """Харид → {"outcome": completed|pending|rejected, "ref", "code"}.

    · completed → расонда шуд
    · pending   → қабул+харҷ шуд, интизори webhook/админ (ДУБРА НАКОШ!)
    · rejected  → ҳеҷ чиз барнаёмад (бехатар баргардон мешавад)
    """
    if kind not in _BUY_PATHS:
        return _rejected("bad_kind")
    if not uid:
        return _rejected("missing_uid")

    quantity = max(1, min(int(quantity or 1), 100))

    # ---- Бадани дархост (мутобиқ ба докс) ----
    if kind == "likes":
        # likes: int (бастаи фармоишгар ё миқдори фармоиш) — packages id НАДОРАД
        likes = int(amount or 0)
        if likes <= 0:
            return _rejected("bad_amount")
        body: dict[str, Any] = {"uid": uid, "likes": likes}
    elif kind == "auto_likes":
        # activate: {uid, days(2-120) | package_id}
        body = {"uid": uid}
        sku_s = (sku or "").strip()
        if sku_s.isdigit():
            body["package_id"] = int(sku_s)
        elif 2 <= int(amount or 0) <= 120:
            body["days"] = int(amount)
        else:
            return _rejected("bad_package")
    else:  # diamonds / levelup / indonesia → {player_id, package_id, quantity}
        sku_s = (sku or "").strip()
        if not sku_s:
            return _rejected("bad_package")
        body = {"player_id": uid, "package_id": sku_s, "quantity": quantity}

    data = await _req("POST", _BUY_PATHS[kind], json_body=body, timeout=30.0)

    # ---- Ҳамён (нодуруст) аз бадани ҷавоб ----
    success = bool(data.get("success"))
    st = data.get("status")
    st_s = str(st).lower() if st is not None else ""
    ref = ""
    trx = data.get("trx")
    if isinstance(trx, list) and trx and isinstance(trx[0], dict):
        ref = str(trx[0].get("order_id") or "")
    ref = ref or str(data.get("order_id") or "")

    if kind == "likes":
        # status 1 = расонда; 2/3 = лайкии имрӯза пур (ҲЕЧ ХАРҶ НАШУД)
        if success:
            return _ok("completed", ref)
        # 20.11.2026: ҷавоби пурраи провайдер ба лог — сабаби рад шудан дида шавад
        logger.warning(
            "leakstudio: likes rejected uid=%s likes=%s status=%s error=%s message=%s resp_uid=%s",
            uid, likes, st_s, data.get("error"), data.get("message"), data.get("UID"),
        )
        if st_s in ("2", "3"):
            return _rejected("already_likes_today")
        return _rejected(
            str(data.get("error") or "rejected"), str(data.get("message") or "")
        )

    if not success:
        return _rejected(
            str(data.get("error") or "rejected"), str(data.get("message") or "")
        )

    # success=true = пули калид харҷ шуд:
    # auto-likes: ҷавоб status НАДОРАД → расонда (ҳамон лаҳза)
    if kind == "auto_likes" or st_s in ("completed", "success", "1"):
        return _ok("completed", ref)
    if st_s in ("pending", "processing"):
        return _ok("pending", ref)
    # status номаълум бо харҷ → бехатар: pending (на дубра, на баргардон)
    return _ok("pending", ref)
