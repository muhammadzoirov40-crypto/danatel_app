"""🔐 Рамзгузории маълумоти биометрӣ (Face Authentication).

Қоидаҳо:
  • Танҳо VECTOR-и 128-уҷаи (descriptor) рамзгузорӣ мешавад —
    расм/видео ҲЕҶ ГОҲ ба сервер намефиристад ва дар DB нест.
  • AES-256-GCM (authenticated encryption):
    nonce(12) || ciphertext || tag(16).
  • Калид: `FACE_ENCRYPTION_KEY` (base64, 32 байт) аз .env; агар холӣ
    ё нодуруст бошад → SHA-256("danatel-face-enc:v1:" + SECRET_KEY) —
    бе танзими иловагӣ дар ҳамаи муҳитҳо кор мекунад ва устувор аст.
  • Ҳангоми ивазкунии SECRET_KEY credentialҳои кӯҳна декод намешаванд
    → корбарон аз нав чеҳра сабт мекунанд (рафтори бехатар).
"""
from __future__ import annotations

import base64
import hashlib
import os
import struct
from math import sqrt

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

MODEL_VERSION = "faceapi_v1"
_DESC_LEN = 128
_NONCE_LEN = 12
_AAD = b"danatel-face-v1"

_key_cache: bytes | None = None


def _key() -> bytes:
    """Калиди AES-256 (32 байт) — як бор ҳисоб мешавад."""
    global _key_cache
    if _key_cache is None:
        raw = (settings.FACE_ENCRYPTION_KEY or "").strip()
        key = b""
        if raw:
            try:
                decoded = base64.b64decode(raw, validate=True)
                if len(decoded) == 32:
                    key = decoded
            except Exception:  # noqa: BLE001
                key = b""
        if not key:
            key = hashlib.sha256(
                b"danatel-face-enc:v1:" + settings.SECRET_KEY.encode()
            ).digest()
        _key_cache = key
    return _key_cache


def encrypt_descriptor(descriptor: list[float]) -> bytes:
    """128 float32 → nonce || AESGCM(...). Хатогии додан → ValueError."""
    if len(descriptor) != _DESC_LEN:
        raise ValueError("descriptor must contain exactly 128 values")
    vals = [float(v) for v in descriptor]
    for v in vals:
        if v != v or v in (float("inf"), float("-inf")):
            raise ValueError("descriptor contains non-finite value")
    blob = struct.pack(f"<{_DESC_LEN}f", *vals)
    nonce = os.urandom(_NONCE_LEN)
    return nonce + AESGCM(_key()).encrypt(nonce, blob, _AAD)


def decrypt_descriptor(blob: bytes) -> list[float]:
    """nonce||ciphertext → 128 float. Вайрон → ValueError (нодида гирифта мешавад)."""
    if not blob or len(blob) < _NONCE_LEN + 16:
        raise ValueError("encrypted blob too short")
    nonce, data = blob[:_NONCE_LEN], blob[_NONCE_LEN:]
    plain = AESGCM(_key()).decrypt(nonce, data, _AAD)
    if len(plain) != _DESC_LEN * 4:
        raise ValueError("unexpected plaintext length")
    return list(struct.unpack(f"<{_DESC_LEN}f", plain))


def normalize(descriptor: list[float]) -> list[float]:
    """L2-normalized + санҷиши миқдор (нодуруст → ValueError)."""
    if len(descriptor) != _DESC_LEN:
        raise ValueError("descriptor must contain exactly 128 values")
    vals = [float(v) for v in descriptor]
    for v in vals:
        if v != v or v in (float("inf"), float("-inf")):
            raise ValueError("descriptor contains non-finite value")
    n = sqrt(sum(v * v for v in vals))
    if n <= 0:
        raise ValueError("descriptor is zero-length")
    return [v / n for v in vals]


def distance(a: list[float], b: list[float]) -> float:
    """Евклидӣ байни векторҳои L2-normalized (ҳамон чӣ face-api.js).

    Диапазон: 0 = якхела … ~2 = комилан фарқ. Худаш normalize мекунад
    → агар яке аз тарафҳо нонормалӣ бошад ҳам натиҷа дуруст мемонад.
    """
    na = sqrt(sum(x * x for x in a))
    nb = sqrt(sum(y * y for y in b))
    if na <= 0 or nb <= 0:
        return 999.0
    return sqrt(sum((x / na - y / nb) ** 2 for x, y in zip(a, b)))
