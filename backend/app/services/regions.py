# -*- coding: utf-8 -*-
"""🌍 Минтақаҳои хомӯш/фаъол (талаби соҳиб 20.11.2026).

Танзимот дар `regions_enabled.json` дар папкаи backend нигоҳ дошта мешавад
(ба git намеравад — маълумоти корӣ). Минтақаҳо аз каталоги воқеии FireLoot
меоянд (`lookup.regions_for_slug`), мо танҳо рӯйхати хомӯшшудаҳоро нигоҳ
медорем ва ҳангоми додани `game.regions` онҳоро мегирем.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path

_FILE = Path(__file__).resolve().parents[2] / "regions_enabled.json"
_LOCK = threading.Lock()


def _read() -> dict[str, list[str]]:
    try:
        data = json.loads(_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def disabled(game: str) -> set[str]:
    """Минтақаҳои хомӯшшудаи як бозӣ."""
    rows = _read().get("regions", {}).get(game, [])
    return {str(x) for x in rows} if isinstance(rows, list) else set()


def set_enabled(game: str, region: str, enabled: bool) -> None:
    """Фаъол/хомӯш кардани як минтақа (дар калиди `regions`)."""
    region = str(region).strip().upper()
    if not region:
        return
    with _LOCK:
        data = _read()
        rows = set(str(x) for x in data.get("regions", {}).get(game, [])) if isinstance(data.get("regions", {}).get(game), list) else set()
        if enabled:
            rows.discard(region)
        else:
            rows.add(region)
        data.setdefault("regions", {})[game] = sorted(rows)
        _FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# =====================================================================
# 📦 ГУРӮҲҲОИ МАҲСУЛОТ (алмос / пропуск / ваучер …) — соҳиб 21.11.2026
# =====================================================================
GROUPS = ("likes", "diamonds", "currency", "vouchers", "passes", "packs")


def disabled_groups(game: str) -> set[str]:
    data = _read().get("groups", {})
    rows = data.get(game, []) if isinstance(data, dict) else []
    return {str(x) for x in rows} if isinstance(rows, list) else set()


def set_group_enabled(game: str, group: str, enabled: bool) -> None:
    if group not in GROUPS:
        return
    with _LOCK:
        data = _read()
        rows = set(str(x) for x in data.get("groups", {}).get(game, [])) if isinstance(data.get("groups", {}).get(game), list) else set()
        if enabled:
            rows.discard(group)
        else:
            rows.add(group)
        data.setdefault("groups", {})[game] = sorted(rows)
        _FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def disabled_products(game: str) -> set[int]:
    data = _read().get("products", {})
    rows = data.get(game, []) if isinstance(data, dict) else []
    return {int(x) for x in rows if str(x).isdigit()} if isinstance(rows, list) else set()


def set_product_enabled(game: str, product_id: int, enabled: bool) -> None:
    with _LOCK:
        data = _read()
        rows = set(int(x) for x in data.get("products", {}).get(game, [])
                   if str(x).isdigit()) if isinstance(data.get("products", {}).get(game), list) else set()
        if enabled:
            rows.discard(int(product_id))
        else:
            rows.add(int(product_id))
        data.setdefault("products", {})[game] = sorted(rows)
        _FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def group_of(p) -> str:
    """Гурӯҳи маҳсулот — ҳамон қоидаи `groupOf`-и OrderForm (frontend)."""
    kind = (getattr(p, "ls_kind", "") or "").strip()
    prov = (getattr(p, "provider", "") or "").strip()
    name = (getattr(p, "name_tj", "") or getattr(p, "name", "") or "").lower()
    sku = (getattr(p, "sku", "") or "").lower()
    if prov == "leakstudio" and kind in ("likes", "auto_likes"):
        return "likes"
    if "лайк" in name or "likes" in name:
        return "likes"
    if sku.startswith("voucher") or "voucher" in name or "ваучер" in name:
        return "vouchers"
    amount = int(getattr(p, "amount", 0) or 0)
    if amount > 0:
        return "diamonds" if "diamond" in name or "алмос" in name else "currency"
    if "pass" in name or "level" in name or "пропуск" in name:
        return "passes"
    return "packs"
