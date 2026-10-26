# -*- coding: utf-8 -*-
"""
🔄 Ҳамоҳангсозии маҳсулотҳо аз каталоги воқеии FireLoot.

Танҳо бозиҳои БИСЁРМИНТАҚАӣ (FF, MLBB):
 1) Адоптсия — маҳсулотҳои дасти админ минтақаи худро мегиранд:
    «MLBB CIS …» → Қирғизистон/Беларусь, «MLBB RU …» → RUSSIA, боқӣ → пешфарз.
    Нархҳои мавҷуда ҲЕҶ ГОҲ иваз намешаванд.
 2) Нархи таъинот (TJS за 1$) аз худи нархҳои шумо бароварда мешавад:
    медианаи price_tjs / FireLoot USD барои бастаҳои рақамдор.
 3) Минтақаҳои бе маҳсулот → аз каталог сохта мешавад:
    нарх = USD × таъинот (бе 10 → 0.5, аз 10 → сатрӣ),
    номҳо бо қолиби шумо («FF 25 Diamonds», «FF Level Up Pass 6» …),
    is_popular=False; SKU = калиди дубликат.
 4) Ҳамаи хатогӣ → танҳо log — оғози барнома ҲЕҶ ГОҲ вайрон намешавад.
"""
from __future__ import annotations

import logging
import re
import statistics
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Game, Product
from app.routers.lookup import (
    DEFAULT_REGION,
    SLUG_SKU_PREFIXES,
    _fireloot,
    regions_for,
)

logger = logging.getLogger("catalog")

# Бренд дар номи маҳсулот → минтақаи каталог (танҳо бозиҳои бисёрминтақаӣ)
_BRAND_REGION: tuple[tuple[str, str, str], ...] = (
    ("mobile-legends", "mlbb cis", "MLBB Кыргызстан, Беларусь"),
    ("mobile-legends", "mlbb ru", "MLBB RUSSIA"),
)


def _brand(slug: str, region: str) -> str:
    """Бренди ном: «FF», «MLBB RU», «MLBB CIS» — ҳамон қолиби шумо."""
    if slug == "free-fire":
        return "FF"
    if slug == "mobile-legends":
        return "MLBB RU" if region == "MLBB RUSSIA" else "MLBB CIS"
    return slug.split("-")[0].upper()


def _strip_brand(low: str) -> str:
    """«mlbb cis 50 diamonds» → «50 diamonds» (барои муқоисаи ном)."""
    for pref in ("mlbb cis", "mlbb ru", "ff"):
        if low.startswith(pref + " "):
            return low[len(pref) + 1:].strip()
    return low


def _amount_of(item: dict[str, Any]) -> int:
    """Миқдор аз sku (دامонҳо ҳамеша бо рақам хотима меёбанд)."""
    sku = str(item.get("sku") or "")
    tail = sku.rsplit("_", 1)[-1]
    if tail.isdigit():
        return int(tail)
    m = re.match(r"\s*(\d[\d,.]*)", str(item.get("name") or ""))
    if m:
        digits = re.sub(r"\D", "", m.group(1))
        if digits:
            return int(digits)
    return 0


def _bonus_of(item: dict[str, Any]) -> tuple[int, int] | None:
    """🎁 Тӯҳфа аз номи каталог: «32 + 3 Diamonds» → (32, 3)."""
    m = re.search(r"(\d[\d,]*)\s*\+\s*(\d[\d,]*)", str(item.get("name") or ""))
    if not m:
        return None
    base = int(re.sub(r"\D", "", m.group(1)))
    bonus = int(re.sub(r"\D", "", m.group(2)))
    return (base, bonus) if base > 0 and bonus > 0 else None


def _add_bonus(mp: Product, item: dict[str, Any]) -> None:
    """«MLBB RU 32 Diamonds» + тӯҳфаи воқеӣ → «MLBB RU 32 + 3 Diamonds»."""
    b = _bonus_of(item)
    if not b or "+" in (mp.name_tj or ""):
        return  # аллакай дорад ё тӯҳфа нест
    base, bonus = b
    old, new = f"{base} Diamonds", f"{base} + {bonus} Diamonds"
    for attr in ("name_tj", "name_ru", "name_en", "name_uz"):
        val = getattr(mp, attr) or ""
        if old in val:
            setattr(mp, attr, val.replace(old, new))


def _new_name(slug: str, region: str, item: dict[str, Any]) -> tuple[str, int] | None:
    """Номи маҳсулот (барои 4 забон) + миқдор (0 барои бастаҳо/вучерҳо)."""
    cat = str(item.get("category") or "").lower()
    cname = str(item.get("name") or "").strip()
    sku = str(item.get("sku") or "")
    brand = _brand(slug, region)

    if cat == "diamonds":
        n = _amount_of(item)
        if n <= 0:
            return None
        # 🎁 Тӯҳфаи воқеӣ нигоҳ дошта мешавад: «25 + 5 Diamonds»
        b = _bonus_of(item)
        if b and b[0] == n:
            return (f"{brand} {n} + {b[1]} Diamonds", n)
        return (f"{brand} {n} Diamonds", n)

    if cat == "voucher":
        low = cname.lower()
        lite = "lite" in low or "лайт" in low
        week = "week" in low or "недел" in low
        month = "month" in low or "месяц" in low
        if week:
            base = "Weekly Lite" if lite else "Weekly"
        elif month:
            base = "Monthly"
        else:
            return None
        return (f"{brand} {base} Voucher", 0)

    if cat == "pass":
        m = (
            re.search(r"levelpass[_\s]*(\d+)", sku, re.I)
            or re.search(r"(\d+)\s*LVL", cname, re.I)
            or re.search(r"level\s*(\d+)", cname, re.I)
        )
        if m:
            return (f"{brand} Level Up Pass {m.group(1)}", 0)
        nm = cname
        if not any(k in nm.lower() for k in ("pass", "level", "pack", "voucher")):
            nm = f"{nm} Pass"  # «Weekly» → «Weekly Pass» (FireLoot cat = pass)
        return (f"{brand} {nm}", 0)

    # other («Twilight» …) → бахши «ПАКЕТҲО»
    return (f"{brand} {cname}", 0) if cname else None


def _period_key(s: str) -> str:
    """«FF Weekly Lite Voucher» / «Ваучер на неделю Лайт» → «week+lite»."""
    low = s.lower()
    key = ""
    if "week" in low or "недел" in low:
        key = "week"
    elif "month" in low or "месяц" in low:
        key = "month"
    if "lite" in low or "лайт" in low:
        key += "+lite"
    return key


def _matches(mp: Product, item: dict[str, Any]) -> bool:
    """Маҳсулоти мавҷуд ↔ элементи каталог (барои пайвастани SKU)."""
    cat = str(item.get("category") or "").lower()
    amt = _amount_of(item)
    if mp.amount and amt:
        return int(mp.amount) == amt
    if cat == "pass":
        m1 = re.search(r"level\s*up\s*pass\s*(\d+)", mp.name_tj or "", re.I)
        iname = str(item.get("name") or "")
        m2 = (
            re.search(r"levelpass[_\s]*(\d+)", str(item.get("sku") or ""), re.I)
            or re.search(r"(\d+)\s*LVL", iname, re.I)
        )
        if m1 and m2:
            return m1.group(1) == m2.group(1)
    if cat == "voucher":
        a, b = _period_key(mp.name_tj or ""), _period_key(str(item.get("name") or ""))
        return bool(a) and a == b
    return _strip_brand((mp.name_tj or "").lower()) == str(item.get("name") or "").strip().lower()


def _derive_rate(existing: list[Product], items: list[tuple[str, dict[str, Any]]]) -> float | None:
    """Таъиноти нарх (TJS за 1$) аз худи нархҳои шумо: медианаи price/USD."""
    usd_by: dict[tuple[str, int], float] = {}
    for reg, it in items:
        amt = _amount_of(it)
        try:
            usd = float(it.get("price") or 0)
        except (TypeError, ValueError):
            continue
        if amt > 0 and usd > 0:
            usd_by.setdefault((reg, amt), usd)
    pairs: list[float] = []
    for mp in existing:
        if not mp.amount or not mp.price_tjs:
            continue
        usd = usd_by.get((mp.region, int(mp.amount)))
        if usd:
            pairs.append(float(mp.price_tjs) / usd)
    return float(statistics.median(pairs)) if pairs else None


def _round_tjs(x: float) -> float:
    v = round(x * 2) / 2 if x < 10 else round(x)
    return max(0.5, float(v))


async def sync_catalog(db: Session) -> dict[str, int]:
    """Ҳамоҳангсозӣ: минтақаҳои нав аз каталоги воқеӣ сохта мешавад."""
    summary: dict[str, int] = {"created": 0, "attached": 0, "adopted": 0}
    if not _fireloot.configured:
        return summary
    try:
        catalog = await _fireloot.products()
    except Exception as exc:  # noqa: BLE001
        logger.warning("🔄 Каталог дастрас нест — ҳамоҳангсозӣ гузаронида шуд: %s", exc)
        return summary
    if not catalog:
        return summary

    # Индекси қисмӣ: (game_id, sku) ягона (барои маҳсулотҳои худкор)
    try:
        db.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_products_game_sku "
            "ON products (game_id, sku) WHERE sku <> ''"
        ))
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.warning("🔄 Индекси sku сохта нашуд", exc_info=True)

    order = {"diamonds": 0, "voucher": 1, "pass": 2}
    for slug, prefixes in SLUG_SKU_PREFIXES.items():
        try:
            game = db.scalar(select(Game).where(Game.slug == slug, Game.is_active.is_(True)))
            if game is None:
                continue
            regions = regions_for(slug, catalog)
            if len(regions) < 2:
                continue  # якминтақаӣ — маҳсулотҳои ҳозира мувофиқанд
            default = DEFAULT_REGION.get(slug) or regions[0]
            cat_items = [
                (str(it.get("region") or "").strip(), it)
                for it in catalog
                if str(it.get("sku") or "").startswith(prefixes)
                and str(it.get("region") or "").strip() in regions
            ]
            existing = list(db.scalars(select(Product).where(Product.game_id == game.id)))

            # 1️⃣ Адоптсия: бе минтақа → минтақаи воқеӣ (нарх иваз НАМЕШАВАД)
            adopted = 0
            for mp in existing:
                if mp.region:
                    continue
                low = (mp.name_tj or "").lower()
                reg = default
                for s, pref, r in _BRAND_REGION:
                    if s == slug and low.startswith(pref):
                        reg = r
                        break
                mp.region = reg
                adopted += 1
            if adopted:
                db.commit()
                summary["adopted"] += adopted

            stocked = {mp.region for mp in existing if mp.region}
            rate = _derive_rate([mp for mp in existing if mp.region], cat_items)

            for reg in regions:
                items = [it for r, it in cat_items if r == reg]
                if not items:
                    continue
                if reg in stocked:
                    # Танҳо пайвастани SKU (бе ивази нарх!)
                    for it in items:
                        sku = str(it.get("sku") or "")
                        if not sku:
                            continue
                        if any((mp.sku or "") == sku for mp in existing if mp.region == reg):
                            continue
                        target = next(
                            (mp for mp in existing if mp.region == reg and not (mp.sku or "") and _matches(mp, it)),
                            None,
                        )
                        if target is not None:
                            target.sku = sku
                            # 🎁 Тӯҳфаи каталог ба номи маҳсулоти шумо илова мешавад
                            _add_bonus(target, it)
                            summary["attached"] += 1
                    db.commit()
                    continue

                # Минтақаи нав → аз каталог
                if rate is None:
                    logger.info("🔄 %s/%s: бе таъиноти нарх — сохта нашуд", slug, reg)
                    continue
                items_sorted = sorted(
                    items,
                    key=lambda it: (order.get(str(it.get("category")).lower(), 3), _amount_of(it)),
                )
                for i, it in enumerate(items_sorted):
                    made = _new_name(slug, reg, it)
                    if not made:
                        continue
                    name, amount = made
                    try:
                        usd = float(it.get("price") or 0)
                    except (TypeError, ValueError):
                        usd = 0
                    if usd <= 0:
                        continue
                    db.add(Product(
                        game_id=game.id,
                        name_tj=name, name_ru=name, name_en=name, name_uz=name,
                        price_tjs=_round_tjs(usd * rate),
                        amount=amount,
                        is_active=True, is_popular=False,
                        sort_order=1000 + i,
                        region=reg,
                        sku=str(it.get("sku") or ""),
                    ))
                    try:
                        db.commit()
                        summary["created"] += 1
                    except IntegrityError:
                        db.rollback()  # worker-и дигар пештар сохт
        except Exception:  # noqa: BLE001
            db.rollback()
            logger.warning("🔄 Ҳамоҳангсозии %s ноком шуд", slug, exc_info=True)

    if any(summary.values()):
        logger.info(
            "🔄 Каталог: +%s маҳсулот, %s минтақа, %s SKU",
            summary["created"], summary["adopted"], summary["attached"],
        )
    return summary
