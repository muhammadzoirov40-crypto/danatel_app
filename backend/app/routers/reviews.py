"""⭐ Роутери ОТЗЫВҲО — танҳо рақами воқеӣ, танҳо аз муштариён.

Қоидаҳои «воқеӣ»:
  • танҳо корбари вурудкарда метавонад нависад;
  • танҳо он касе, ки фармоиши иҷрочуда (delivered) дорад;
  • ҳар фармоиш = ҳамагӣ як отзыв;
  • пеш аз намоиш бояд админ тасдиқ кунад (is_approved).
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Order, OrderStatus, Review, User
from app.schemas import ReviewCreate, ReviewOut, ReviewSummary
from app.security import get_current_user, get_current_user_optional, require_admin

router = APIRouter(prefix="/api", tags=["reviews"])

_MIN_TEXT = 5
_MAX_TEXT = 600


# =====================================================================
# 📖 ХОНДАН (оммавӣ)
# =====================================================================
@router.get("/reviews", response_model=list[ReviewOut])
def list_reviews(
    limit: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Танҳо отзывҳои тасдиқшуда — ба тартиби навтарин."""
    rows = db.scalars(
        select(Review)
        .where(Review.is_approved.is_(True))
        .order_by(Review.created_at.desc(), Review.id.desc())
        .limit(limit)
    ).all()
    return rows


@router.get("/reviews/summary", response_model=ReviewSummary)
def review_summary(
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Ҳисоботи рейтинги воқеӣ + оё корбари ҷорӣ ҳуқуқи навиштан дорад."""
    avg = db.scalar(
        select(func.avg(Review.rating)).where(Review.is_approved.is_(True))
    )
    total = (
        db.scalar(
            select(func.count()).select_from(Review).where(
                Review.is_approved.is_(True)
            )
        )
        or 0
    )

    can_review = False
    my_review_id = None
    if user is not None:
        delivered = db.scalar(
            select(func.count())
            .select_from(Order)
            .where(Order.user_id == user.id, Order.status == OrderStatus.DELIVERED)
        )
        can_review = bool(delivered)
        my_review_id = db.scalar(
            select(Review.id).where(Review.user_id == user.id).limit(1)
        )

    return ReviewSummary(
        rating_avg=round(float(avg or 0), 1),
        reviews_total=int(total),
        can_review=can_review,
        my_review_id=my_review_id,
    )


# =====================================================================
# ✍️ НАВИШТАН (танҳо муштарии воқеӣ)
# =====================================================================
@router.post("/reviews", response_model=ReviewOut, status_code=201)
def create_review(
    payload: ReviewCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1) бояд фармоиши иҷрочуда дошта бошад — ин кафолати «воқеӣ» аст
    delivered_ids = db.scalars(
        select(Order.id)
        .where(Order.user_id == user.id, Order.status == OrderStatus.DELIVERED)
        .order_by(Order.created_at.desc())
    ).all()
    if not delivered_ids:
        raise HTTPException(
            status_code=403,
            detail="Отзив танҳо барои муштариёни бо фармоиши иҷрочуда",
        )

    # 2) ҳар фармоиш = як отзыв
    if payload.order_id is not None and payload.order_id not in delivered_ids:
        raise HTTPException(status_code=400, detail="Ин фармоиш барои отзыв дастрас нест")
    order_id = payload.order_id or delivered_ids[0]

    if db.scalar(select(Review.id).where(Review.order_id == order_id)):
        raise HTTPException(status_code=409, detail="Барои ин фармоиш аллакай отзыв ҳаст")

    text = (payload.text or "").strip()
    if len(text) < _MIN_TEXT:
        raise HTTPException(status_code=400, detail="Матн хеле кӯтоҳ аст")
    if len(text) > _MAX_TEXT:
        raise HTTPException(status_code=400, detail="Матн хеле дароз аст")

    name = (payload.author_name or "").strip() or (user.full_name or "").strip()
    if not name:
        name = (user.phone or "Муштарӣ")[-9:]

    review = Review(
        user_id=user.id,
        order_id=order_id,
        rating=max(1, min(5, int(payload.rating))),
        text=text,
        author_name=name,
        # 🛡️ пеш аз намоиш бояд админ тасдиқ кунад
        is_approved=False,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


class ReviewModerate(BaseModel):
    is_approved: bool


# =====================================================================
# 🛡️ АДМИН — санҷиш / нест кардан
# =====================================================================
@router.get("/admin/reviews")
def admin_reviews(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Ҳамаи отзывҳо + омори умумӣ барои панели админ."""
    rows = db.scalars(
        select(Review)
        .options(selectinload(Review.user))
        .order_by(Review.is_approved, Review.created_at.desc())
    ).all()
    pending = sum(1 for r in rows if not r.is_approved)
    approved = [r for r in rows if r.is_approved]
    avg = (
        round(sum(r.rating for r in approved) / len(approved), 1)
        if approved
        else 0.0
    )
    return {
        "rating_avg": avg,
        "reviews_total": len(approved),
        "pending": pending,
        "items": [
            {
                "id": r.id,
                "author_name": r.author_name or "Муштарӣ",
                "rating": r.rating,
                "text": r.text,
                "is_approved": r.is_approved,
                "order_id": r.order_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.patch("/admin/reviews/{review_id}", response_model=ReviewOut)
def moderate_review(
    review_id: int,
    payload: ReviewModerate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """✅ Тасдиқ кардан / ❌ рад кардани отзыв."""
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Отзив ёфт нашуд")
    review.is_approved = payload.is_approved
    db.commit()
    db.refresh(review)
    return review


@router.delete("/admin/reviews/{review_id}", status_code=204)
def delete_review(
    review_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Отзив ёфт нашуд")
    db.delete(review)
    db.commit()
