# -*- coding: utf-8 -*-
"""
💱 Як рақам (%) → ҲАМАИ нархҳо (талаби соҳиб, 31.10.2026).

POST /api/admin/products/adjust-prices   {"percent": 15, "mode": "current"}
  · mode="current" → ҳамаи маҳсулотҳои бо нархи мусбат: price_tjs × (1 + percent/100)
  · mode="cost"    → танҳо аз НАРХИ ХАРИД (cost_tjs, 0% фоиз): price = cost × (1 + p/100)
                     — такрории ҳамон % НАРХРО ДУБОРА НАМЕТОБОНАД (пойдор)
  · ҳисоб бо Decimal + ROUND_HALF_UP (пул дақиқ, бе хатогии float)
  · percent = 0 → ҳеҷ чиз намешавад (бе AuditLog)
  · баргардонидан = %-и манфӣ (масалан -9.09 → ҳамон нархи пешина)
  · ҳар дафъа AuditLog → дар панели админ ва логҳо намоён

POST /api/admin/products/fill-costs   {"rate": 11}
  · 💲 Нархи харид = FireLoot $ × курс (валюти худатон) барои ҳамаи sku-дорҳо
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, Product
from app.routers.lookup import _fireloot
from app.security import require_admin

router = APIRouter(
    prefix="/api/admin",
    tags=["admin-pricing"],
    dependencies=[Depends(require_admin)],
)


class PricesAdjustIn(BaseModel):
    percent: float = Field(..., description="Масалан +15 (баланд) ё -10 (арзон)")
    # "current" = аз нархи ҷорӣ · "cost" = аз нархи харид (0% фоиз, пойдор)
    mode: str = "current"


def _apply_percent(db: Session, percent: float, mode: str = "current") -> int:
    """Худи амал: ҳамаи нархҳоро мекобад. БЕ commit — барои санҷиш rollback.
    Бармегардонад: чанд маҳсулот иваз шуд.
    mode="cost" → асос = cost_tjs (нархи харид); маҳсулоти бе харид дароз мемонад."""
    factor = Decimal(1) + (Decimal(str(percent)) / Decimal(100))
    products = db.scalars(select(Product)).all()
    updated = 0
    for pr in products:
        if mode == "cost":
            base = Decimal(str(pr.cost_tjs or 0))
        else:
            base = Decimal(str(pr.price_tjs or 0))
        if base <= 0:
            continue
        new = (base * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if new <= 0:
            continue
        if new == Decimal(str(pr.price_tjs or 0)):
            continue
        pr.price_tjs = float(new)
        updated += 1
    return updated


@router.post("/products/adjust-prices")
def adjust_prices(payload: PricesAdjustIn, db: Session = Depends(get_db)):
    p = float(payload.percent)
    if p != p or abs(p) > 100000:  # NaN / Inf
        raise HTTPException(status_code=422, detail="percent нодуруст")
    if not (-95.0 <= p <= 1000.0):
        raise HTTPException(
            status_code=422, detail="percent бояд аз -95 то +1000 бошад"
        )
    mode = payload.mode if payload.mode in ("current", "cost") else "current"
    if p == 0:
        return {"updated": 0, "percent": 0.0, "mode": mode}

    updated = _apply_percent(db, p, mode)
    db.add(
        AuditLog(
            action="prices_adjusted",
            entity="product",
            entity_id="all",
            details=(
                f"{updated}× price_tjs ×{1 + p / 100:.4f} ({p:+g}%, mode={mode})"
            ),
        )
    )
    db.commit()
    return {"updated": updated, "percent": p, "mode": mode}


# =====================================================================
# 💲 НАРХИ ХАРИД = FireLoot $ × курс (барои ҳисоби ФОИДА)
# =====================================================================


class FillCostsIn(BaseModel):
    rate: float = Field(..., gt=0, le=10000, description="Курси USD → сомонӣ")


@router.post("/products/fill-costs")
async def fill_costs(payload: FillCostsIn, db: Session = Depends(get_db)):
    """Пур кардани cost_tjs барои ҳамаи маҳсулотҳои бо sku:
    cost = нархи воқеии FireLoot ($) × курси худатон. AuditLog → дар логҳо."""
    if not _fireloot.configured:
        raise HTTPException(status_code=400, detail="FireLoot API танзим нашудааст")
    try:
        items = await _fireloot.products()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502, detail=f"FireLoot дастрас нест ({exc.__class__.__name__})"
        )

    usd_by_sku: dict[str, float] = {}
    for it in items:
        sku = str(it.get("sku") or "")
        usd = float(it.get("price") or 0)
        if sku and usd > 0:
            usd_by_sku.setdefault(sku, usd)

    rate = Decimal(str(payload.rate))
    updated = 0
    for pr in db.scalars(select(Product).where(Product.sku != "")).all():
        usd = usd_by_sku.get(pr.sku or "")
        if not usd:
            continue
        pr.cost_tjs = float(
            (Decimal(str(usd)) * rate).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        )
        updated += 1

    if updated:
        db.add(
            AuditLog(
                action="costs_filled",
                entity="product",
                entity_id="all",
                details=f"{updated}× cost_tjs = USD × {payload.rate:g}",
            )
        )
        db.commit()
    return {"updated": updated, "rate": payload.rate}
