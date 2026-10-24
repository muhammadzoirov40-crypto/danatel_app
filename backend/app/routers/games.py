"""Роутери рӯйхати бозиҳо ва маҳсулотҳо."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Game, Product
from app.schemas import GameDetailOut, GameOut, ProductOut

router = APIRouter(prefix="/api", tags=["games"])


def _lang(lang: str) -> str:
    return lang if lang in ("tj", "ru", "en", "uz") else "tj"


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
            products_count=sum(1 for p in g.products if p.is_active),
            is_popular=any(p.is_popular for p in g.products if p.is_active),
        )
        for g in games
    ]


def _min_price(g: Game):
    """Арзиши аз-рӯи арзонтарин маҳсулоти фаъоли бозӣ."""
    prices = [p.price_tjs for p in g.products if p.is_active and p.price_tjs is not None]
    return min(prices) if prices else None


@router.get("/games/{slug}", response_model=GameDetailOut)
def game_detail(slug: str, lang: str = Query("tj"), db: Session = Depends(get_db)):
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
        )
        for p in game.products
        if p.is_active
    ]

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
        # 📊 Ҳамон маълумоти промо мисли рӯйхат (бо ҳамон манбаъ)
        min_price_tjs=_min_price(game),
        products_count=len(products),
        is_popular=any(p.is_popular for p in game.products if p.is_active),
    )
