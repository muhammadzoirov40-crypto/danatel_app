"""Маҳдудсозии дархостҳо — муҳофизат аз brute-force / credential stuffing.

• Дар хотира (in-memory) → ҳеҷ вобастагии нав лозим нест.
• Ҳар як worker-и uvicorn сафҳои худро дорад → маҳдудият ҳадди аққал
  2 баробар зиёд аст (бо 2 worker). Ҳанӯз ҳам ҳифзи воқеӣ аз таҷовуз.
• Калид: IP (аз X-Forwarded-For охирин — аз nginx) + identifier (телефон…).
• Ҷавоб: 429 + `Retry-After` (бе ифшои оё корбар вуҷуд дорад).
"""
from __future__ import annotations

import threading
import time

from fastapi import HTTPException, Request

_LOCK = threading.Lock()
_HITS: dict[str, list[float]] = {}

# Тозакунӣ: агар калидҳо аз ин ҳад зиёд шаванд
_MAX_KEYS = 20_000


def client_ip(request: Request | None) -> str:
    """IP-и воқеӣ. Танҳо `X-Forwarded-For`-и охирин (аз nginx)."""
    if request is None:
        return "unknown"
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # nginx $proxy_add_x_forwarded_for → охирин = IP-и воқеии мизоҷ
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if parts:
            return parts[-1]
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def register_hit(key: str, limit: int, window: int) -> tuple[bool, int]:
    """Як кӯшиш ҳисоб мекунад.

    Бармегардонад: (allowed, retry_after_seconds).
    """
    now = time.monotonic()
    cutoff = now - window
    with _LOCK:
        if len(_HITS) > _MAX_KEYS:
            _purge(cutoff)
        bucket = _HITS.get(key)
        if bucket is None:
            bucket = []
            _HITS[key] = bucket
        bucket[:] = [t for t in bucket if t > cutoff]
        if len(bucket) >= limit:
            retry = int(max(1, window - (now - bucket[0])))
            return False, retry
        bucket.append(now)
        return True, 0


def enforce(
    request: Request | None,
    bucket: str,
    limit: int,
    window: int,
    identifier: str = "",
) -> None:
    """Маҳдудсозӣ. Аз ҳад гузашт → 429."""
    ip = client_ip(request)
    for key in (f"{bucket}:{ip}", f"{bucket}:{bucket}:{identifier}") if identifier else (f"{bucket}:{ip}",):
        allowed, retry = register_hit(key, limit, window)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail="Кӯшишҳо аз ҳад зиёданд. Лутфан камтар пештар санҷед",
                headers={"Retry-After": str(retry)},
            )


def reset() -> None:
    """Холӣ кардани ҳисобкунакҳо (барои тестҳо)."""
    with _LOCK:
        _HITS.clear()


def _purge(cutoff: float) -> None:
    for key in list(_HITS.keys()):
        bucket = _HITS[key]
        bucket[:] = [t for t in bucket if t > cutoff]
        if not bucket:
            _HITS.pop(key, None)
