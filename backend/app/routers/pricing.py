# -*- coding: utf-8 -*-
"""
💱 Як рақам (%) → ҲАМАИ нархҳо (талаби соҳиб, 31.10.2026).

POST /api/admin/products/adjust-prices   {"percent": 15}
  · ҳамаи маҳсулотҳои бо нархи мусбат: price_tjs × (1 + percent/100)
  · ҳисоб бо Decimal + ROUND_HALF_UP (пул дақиқ, бе хатогии float)
  · percent = 0 → ҳеҷ чиз намешавад (бе AuditLog)
  · баргардонидан = %-и манфӣ (масалан -9.09 → ҳамон нархи пешина)
  · ҳар дафъа AuditLog → дар панели админ ва логҳо намоён
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, Product
from app.security import require_admin

router = APIRouter(
    prefix="/api/admin",
    tags=["admin-pricing"],
    dependencies=[Depends(require_admin)],
)


class PricesAdjustIn(BaseModel):
    percent: float = Field(..., description="Масалан +15 (баланд) ё -10 (арзон)")


def _apply_percent(db: Session, percent: float) -> int:
    """Худи амал: ҳамаи нархҳоро мекобад. БЕ commit — барои санҷиш rollback.
    Бармегардонад: чанд маҳсулот иваз шуд."""
    factor = Decimal(1) + (Decimal(str(percent)) / Decimal(100))
    products = db.scalars(select(Product)).all()
    updated = 0
    for pr in products:
        old = Decimal(str(pr.price_tjs or 0))
        if old <= 0:
            continue
        new = (old * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if new <= 0 or new == old:
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
    if p == 0:
        return {"updated": 0, "percent": 0.0}

    updated = _apply_percent(db, p)
    db.add(
        AuditLog(
            action="prices_adjusted",
            entity="product",
            entity_id="all",
            details=f"{updated}× price_tjs ×{1 + p / 100:.4f} ({p:+g}%)",
        )
    )
    db.commit()
    return {"updated": updated, "percent": p}
