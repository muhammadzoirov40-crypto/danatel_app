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
    rows = _read().get(game, [])
    return {str(x) for x in rows} if isinstance(rows, list) else set()


def set_enabled(game: str, region: str, enabled: bool) -> None:
    """Фаъол/хомӯш кардани як минтақа."""
    region = str(region).strip().upper()
    if not region:
        return
    with _LOCK:
        data = _read()
        rows = set(str(x) for x in data.get(game, [])) if isinstance(data.get(game), list) else set()
        if enabled:
            rows.discard(region)
        else:
            rows.add(region)
        data[game] = sorted(rows)
        _FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
