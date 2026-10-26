"""Роутери рӯйхати бозиҳо ва маҳсулотҳо."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Game, Order, OrderStatus, Product, User
from app.routers.lookup import DEFAULT_REGION, GAMES_NEED_ZONE, regions_for_slug
from app.schemas import GameDetailOut, GameOut, ProductOut, PublicStats

router = APIRouter(prefix="/api", tags=["games"])


def _lang(lang: str) -> str:
    return lang if lang in ("tj", "ru", "en", "uz") else "tj"


def _default_products(g: Game) -> list[Product]:
    """Маҳсулотҳои минтақаи пешфарз — барои омори промо-кортоҳои асосӣ.

    "" = маҳсулоти дастӣ / бозии якминтақаӣ (PUBG …) — ҳамеша дохил мешавад.
    """
    dflt = DEFAULT_REGION.get(g.slug)
    return [p for p in g.products if p.is_active and (not p.region or p.region == dflt)]


@router.get("/games", response_model=list[GameOut])
def list_games(
    lang: str = Query("tj"),
    db: Session = Depends(get_db),
):
    """Рӯйхати ҳамаи бозиҳои фаъол."""
    lang = _lang(lang)
    games = db.scalars(
        select(Game)
        .options(selectinload(Game.products))
        .where(Game.is_active.is_(True))
        .order_by(Game.sort_order, Game.id)
    ).all()
    return [
        GameOut(
            id=g.id,
            slug=g.slug,
            name=g.get_name(lang),
            emoji=g.emoji,
            currency=g.get_currency(lang),
            requires_player_id=g.requires_player_id,
            player_id_label=g.get_player_label(lang),
            image_url=g.image_url,
            image_pad=g.image_pad,
            # 📊 Маълумоти промо-картоҳои саҳифаи асосӣ
            min_price_tjs=_min_price(g),
            products_count=len(_default_products(g)),
            is_popular=any(p.is_popular for p in _default_products(g)),
        )
        for g in games
    ]


@router.get("/stats", response_model=PublicStats)
def public_stats(db: Session = Depends(get_db)):
    """📊 Омори умумӣ барои саҳифаи асосӣ — танҳо рақамҳои воқеӣ."""
    delivered = db.scalar(
        select(func.count())
        .select_from(Order)
        .where(Order.status == OrderStatus.DELIVERED)
    ) or 0
    users = db.scalar(select(func.count()).select_from(User)) or 0
    return PublicStats(orders_delivered=delivered, users_total=users)


@router.get("/customers")
def list_customers(
    limit: int = Query(24, ge=1, le=60),
    db: Session = Depends(get_db),
):
    """👥 Муштариёни воқеӣ — танҳо онҳое, ки фармоиши иҷрочуда доранд.

    Маълумоти шахсӣ пинҳон карда мешавад (nom кӯтоҳ / телефон ниқобшуда).
    Ҳеҷ рейтинги сохта нест — танҳо шумораи фармоишҳои иҷрочуда.
    """
    rows = db.execute(
        select(
            User.id,
            User.full_name,
            User.username,
            User.phone,
            func.count(Order.id).label("delivered"),
            func.max(Order.updated_at).label("last_at"),
        )
        .join(Order, Order.user_id == User.id)
        .where(Order.status == OrderStatus.DELIVERED)
        .group_by(User.id, User.full_name, User.username, User.phone)
        .order_by(func.count(Order.id).desc(), func.max(Order.updated_at).desc())
        .limit(limit)
    ).all()

    def short_name(r) -> str:
        if r.full_name and r.full_name.strip():
            return r.full_name.strip()[:24]
        if r.username and r.username.strip():
            return r.username.strip()[:24]
        if r.phone:
            # 🔒 ниқоб: 992XXXXX5678 → ****5678
            digits = "".join(c for c in r.phone if c.isdigit())
            return f"•••{digits[-4:]}" if len(digits) >= 4 else "Муштарӣ"
        return "Муштарӣ"

    return {
        "customers_total": int(
            db.scalar(
                select(func.count(func.distinct(Order.user_id))).where(
                    Order.status == OrderStatus.DELIVERED,
                    Order.user_id.is_not(None),
                )
            )
            or 0
        ),
        "items": [
            {
                "name": short_name(r),
                "delivered": int(r.delivered),
            }
            for r in rows
        ],
    }


def _min_price(g: Game):
    """Арзиши аз-рӯи арзонтарин маҳсулоти фаъоли минтақаи пешфарз."""
    prices = [p.price_tjs for p in _default_products(g) if p.price_tjs is not None]
    return min(prices) if prices else None


@router.get("/games/{slug}", response_model=GameDetailOut)
async def game_detail(slug: str, lang: str = Query("tj"), db: Session = Depends(get_db)):
    """Тафсилоти бозӣ + маҳсулотҳо (нархҳо)."""
    lang = _lang(lang)
    game = db.scalar(
        select(Game)
        .options(selectinload(Game.products))
        .where(Game.slug == slug, Game.is_active.is_(True))
    )
    if game is None:
        raise HTTPException(status_code=404, detail="Бозӣ ёфт нашуд")

    products = [
        ProductOut(
            id=p.id,
            name=p.get_name(lang),
            price_tjs=p.price_tjs,
            amount=p.amount,
            is_popular=p.is_popular,
            is_active=p.is_active,
            # 🌍 ҳамаи минтақаҳо мефуршад — филтр дар сӯи корбар
            region=p.region,
        )
        for p in game.products
        if p.is_active
    ]

    # 🌍 Минтақаҳои каталоги FireLoot (хатогӣ/холӣ → [] → интихоб пинҳон мемонад)
    try:
        regions = await regions_for_slug(game.slug)
    except Exception:  # noqa: BLE001
        regions = []

    return GameDetailOut(
        id=game.id,
        slug=game.slug,
        name=game.get_name(lang),
        emoji=game.emoji,
        currency=game.get_currency(lang),
        requires_player_id=game.requires_player_id,
        player_id_label=game.get_player_label(lang),
        image_url=game.image_url,
        image_pad=game.image_pad,
        products=products,
        regions=regions,
        needs_zone=game.slug in GAMES_NEED_ZONE,
        # 📊 Ҳамон маълумоти промо мисли рӯйхат (минтақаи пешфарз)
        min_price_tjs=_min_price(game),
        products_count=len(_default_products(game)),
        is_popular=any(p.is_popular for p in _default_products(game)),
    )
