"""Маълумоти ибтидоӣ: бозиҳо + нархҳо (фақат тоҷикӣ).

⚠️ НАРХҲО ДАР ИН ҶО ҲАМЧУН ПЕШНИҲОД ҲАСТ.
Барои тағйири воқеӣ → Admin Panel → Бозиҳо / Нархҳо
Ё аз Telegram bot: @ONLAYN_ALMAZ_TJ_bot
"""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Game, Product

logger = logging.getLogger("seed")

# =====================================================================
# 🎮 БОЗИҲО + 💎 НАРХҲО (СОМОНӢ / TJS)
# =====================================================================
SEED_GAMES: list[dict] = [
    {
        "slug": "free-fire",
        "emoji": "🔥",
        "name_tj": "Free Fire",
        "name_ru": "Free Fire",
        "name_en": "Free Fire",
        "name_uz": "Free Fire",
        "currency_tj": "алмос",
        "currency_ru": "алмазы",
        "currency_en": "diamonds",
        "currency_uz": "olmazlar",
        "player_id_label_tj": "Player ID",
        "player_id_label_ru": "Player ID",
        "player_id_label_en": "Player ID",
        "player_id_label_uz": "Player ID",
        "sort_order": 1,
        "products": [
            {"name_tj": "100 алмос", "name_ru": "100 алмазов", "name_en": "100 diamonds", "name_uz": "100 olmaz", "price_tjs": 100, "amount": 100, "is_popular": False, "sort_order": 1},
            {"name_tj": "310 алмос", "name_ru": "310 алмазов", "name_en": "310 diamonds", "name_uz": "310 olmaz", "price_tjs": 300, "amount": 310, "is_popular": True, "sort_order": 2},
            {"name_tj": "520 алмос", "name_ru": "520 алмазов", "name_en": "520 diamonds", "name_uz": "520 olmaz", "price_tjs": 500, "amount": 520, "sort_order": 3},
            {"name_tj": "1060 алмос", "name_ru": "1060 алмазов", "name_en": "1060 diamonds", "name_uz": "1060 olmaz", "price_tjs": 950, "amount": 1060, "is_popular": True, "sort_order": 4},
            {"name_tj": "2180 алмос", "name_ru": "2180 алмазов", "name_en": "2180 diamonds", "name_uz": "2180 olmaz", "price_tjs": 1900, "amount": 2180, "sort_order": 5},
            {"name_tj": "5600 алмос", "name_ru": "5600 алмазов", "name_en": "5600 diamonds", "name_uz": "5600 olmaz", "price_tjs": 4800, "amount": 5600, "sort_order": 6},
        ],
    },
    {
        "slug": "pubg-mobile",
        "emoji": "🎯",
        "name_tj": "PUBG Mobile",
        "name_ru": "PUBG Mobile",
        "name_en": "PUBG Mobile",
        "name_uz": "PUBG Mobile",
        "currency_tj": "UC",
        "currency_ru": "UC",
        "currency_en": "UC",
        "currency_uz": "UC",
        "player_id_label_tj": "Character ID",
        "player_id_label_ru": "Character ID",
        "player_id_label_en": "Character ID",
        "player_id_label_uz": "Character ID",
        "sort_order": 2,
        "products": [
            {"name_tj": "60 UC", "name_ru": "60 UC", "name_en": "60 UC", "name_uz": "60 UC", "price_tjs": 80, "amount": 60, "is_popular": True, "sort_order": 1},
            {"name_tj": "325 UC", "name_ru": "325 UC", "name_en": "325 UC", "name_uz": "325 UC", "price_tjs": 390, "amount": 325, "sort_order": 2},
            {"name_tj": "660 UC", "name_ru": "660 UC", "name_en": "660 UC", "name_uz": "660 UC", "price_tjs": 780, "amount": 660, "sort_order": 3},
            {"name_tj": "1800 UC", "name_ru": "1800 UC", "name_en": "1800 UC", "name_uz": "1800 UC", "price_tjs": 2050, "amount": 1800, "is_popular": True, "sort_order": 4},
            {"name_tj": "3850 UC", "name_ru": "3850 UC", "name_en": "3850 UC", "name_uz": "3850 UC", "price_tjs": 4300, "amount": 3850, "sort_order": 5},
            {"name_tj": "8100 UC", "name_ru": "8100 UC", "name_en": "8100 UC", "name_uz": "8100 UC", "price_tjs": 8900, "amount": 8100, "sort_order": 6},
        ],
    },
    {
        "slug": "blood-strike",
        "emoji": "🩸",
        "name_tj": "Blood Strike",
        "name_ru": "Blood Strike",
        "name_en": "Blood Strike",
        "name_uz": "Blood Strike",
        "currency_tj": "кристалл",
        "currency_ru": "кристаллы",
        "currency_en": "crystals",
        "currency_uz": "kristallar",
        "sort_order": 3,
        "products": [
            {"name_tj": "100 кристалл", "name_ru": "100 кристаллов", "name_en": "100 crystals", "name_uz": "100 kristall", "price_tjs": 110, "amount": 100, "sort_order": 1},
            {"name_tj": "500 кристалл", "name_ru": "500 кристаллов", "name_en": "500 crystals", "name_uz": "500 kristall", "price_tjs": 520, "amount": 500, "is_popular": True, "sort_order": 2},
            {"name_tj": "1500 кристалл", "name_ru": "1500 кристаллов", "name_en": "1500 crystals", "name_uz": "1500 kristall", "price_tjs": 1450, "amount": 1500, "sort_order": 3},
        ],
    },
    {
        "slug": "arena-breakout",
        "emoji": "💚",
        "name_tj": "Arena Breakout",
        "name_ru": "Arena Breakout",
        "name_en": "Arena Breakout",
        "name_uz": "Arena Breakout",
        "currency_tj": "тилло",
        "currency_ru": "золото",
        "currency_en": "gold",
        "currency_uz": "oltin",
        "sort_order": 4,
        "products": [
            {"name_tj": "600 тилло", "name_ru": "600 золота", "name_en": "600 gold", "name_uz": "600 oltin", "price_tjs": 90, "amount": 600, "sort_order": 1},
            {"name_tj": "3000 тилло", "name_ru": "3000 золота", "name_en": "3000 gold", "name_uz": "3000 oltin", "price_tjs": 420, "amount": 3000, "is_popular": True, "sort_order": 2},
            {"name_tj": "6800 тилло", "name_ru": "6800 золота", "name_en": "6800 gold", "name_uz": "6800 oltin", "price_tjs": 890, "amount": 6800, "sort_order": 3},
        ],
    },
    {
        "slug": "arena-breakout-infinite",
        "emoji": "💥",
        "name_tj": "Arena Breakout: Infinite",
        "name_ru": "Arena Breakout: Infinite",
        "name_en": "Arena Breakout: Infinite",
        "name_uz": "Arena Breakout: Infinite",
        "currency_tj": "тилло",
        "currency_ru": "золото",
        "currency_en": "gold",
        "currency_uz": "oltin",
        "sort_order": 5,
        "products": [
            {"name_tj": "600 тилло", "name_ru": "600 золота", "name_en": "600 gold", "name_uz": "600 oltin", "price_tjs": 90, "amount": 600, "sort_order": 1},
            {"name_tj": "3000 тилло", "name_ru": "3000 золота", "name_en": "3000 gold", "name_uz": "3000 oltin", "price_tjs": 420, "amount": 3000, "is_popular": True, "sort_order": 2},
        ],
    },
    {
        "slug": "honor-of-kings",
        "emoji": "👑",
        "name_tj": "Honor of Kings",
        "name_ru": "Honor of Kings",
        "name_en": "Honor of Kings",
        "name_uz": "Honor of Kings",
        "currency_tj": "токен",
        "currency_ru": "токены",
        "currency_en": "tokens",
        "currency_uz": "tokenlar",
        "sort_order": 6,
        "products": [
            {"name_tj": "80 токен", "name_ru": "80 токенов", "name_en": "80 tokens", "name_uz": "80 token", "price_tjs": 100, "amount": 80, "sort_order": 1},
            {"name_tj": "400 токен", "name_ru": "400 токенов", "name_en": "400 tokens", "name_uz": "400 token", "price_tjs": 470, "amount": 400, "is_popular": True, "sort_order": 2},
            {"name_tj": "1500 токен", "name_ru": "1500 токенов", "name_en": "1500 tokens", "name_uz": "1500 token", "price_tjs": 1700, "amount": 1500, "sort_order": 3},
        ],
    },
    {
        "slug": "marvel-rivals",
        "emoji": "🦸",
        "name_tj": "Marvel Rivals",
        "name_ru": "Marvel Rivals",
        "name_en": "Marvel Rivals",
        "name_uz": "Marvel Rivals",
        "currency_tj": "Lattice",
        "currency_ru": "Lattice",
        "currency_en": "Lattice",
        "currency_uz": "Lattice",
        "sort_order": 7,
        "products": [
            {"name_tj": "1000 Lattice", "name_ru": "1000 Lattice", "name_en": "1000 Lattice", "name_uz": "1000 Lattice", "price_tjs": 150, "amount": 1000, "sort_order": 1},
            {"name_tj": "2000 Lattice", "name_ru": "2000 Lattice", "name_en": "2000 Lattice", "name_uz": "2000 Lattice", "price_tjs": 290, "amount": 2000, "is_popular": True, "sort_order": 2},
        ],
    },
    {
        "slug": "mobile-legends",
        "emoji": "🌐",
        "name_tj": "Mobile Legends: Bang Bang (CIS)",
        "name_ru": "Mobile Legends: Bang Bang (СНГ)",
        "name_en": "Mobile Legends: Bang Bang (CIS)",
        "name_uz": "Mobile Legends: Bang Bang (CIS)",
        "currency_tj": "алмос",
        "currency_ru": "алмазы",
        "currency_en": "diamonds",
        "currency_uz": "olmazlar",
        "sort_order": 8,
        "products": [
            {"name_tj": "86 алмос", "name_ru": "86 алмазов", "name_en": "86 diamonds", "name_uz": "86 olmaz", "price_tjs": 100, "amount": 86, "sort_order": 1},
            {"name_tj": "172 алмос", "name_ru": "172 алмаза", "name_en": "172 diamonds", "name_uz": "172 olmaz", "price_tjs": 195, "amount": 172, "sort_order": 2},
            {"name_tj": "257 алмос", "name_ru": "257 алмазов", "name_en": "257 diamonds", "name_uz": "257 olmaz", "price_tjs": 290, "amount": 257, "is_popular": True, "sort_order": 3},
            {"name_tj": "706 алмос", "name_ru": "706 алмазов", "name_en": "706 diamonds", "name_uz": "706 olmaz", "price_tjs": 780, "amount": 706, "sort_order": 4},
            {"name_tj": "1412 алмос", "name_ru": "1412 алмазов", "name_en": "1412 diamonds", "name_uz": "1412 olmaz", "price_tjs": 1550, "amount": 1412, "sort_order": 5},
        ],
    },
]


# =====================================================================
# 🖼️ РАСМҲОИ ЛОГО (аз маҳаллӣ: frontend/public/images/)
# =====================================================================
GAME_IMAGES: dict[str, str] = {
    "free-fire": "/images/free-fire.png",
    "pubg-mobile": "/images/pubg-mobile.png",
    "blood-strike": "/images/blood-strike.png",
    "arena-breakout": "/images/arena-breakout.png",
    "arena-breakout-infinite": "/images/arena-breakout-infinite.jpg",
    "honor-of-kings": "/images/honor-of-kings.png",
    "marvel-rivals": "/images/marvel-rivals.png",
    "mobile-legends": "/images/mobile-legends.svg",
}

# Ғафсии лого: баъзе расмҳо калимаҳои васеъ ҳастанд → фазои бештар
IMAGE_PAD: dict[str, int] = {
    "free-fire": 20,
    "pubg-mobile": 14,
    "mobile-legends": 22,
    "honor-of-kings": 16,
    "marvel-rivals": 16,
    "arena-breakout-infinite": 0,
    "blood-strike": 0,
    "arena-breakout": 0,
}


def seed_if_empty() -> None:
    """Агар ҷадвалҳо холӣ бошанд — маълумоти ибтидоӣ мегузорад."""
    with SessionLocal() as db:  # type: Session
        existing = db.scalar(select(Game).limit(1))
        if existing is not None:
            logger.info("Маълумоти ибтидоӣ аллакай ҳаст — сар накард")
            return

        for g in SEED_GAMES:
            products = g.pop("products")
            slug = g.get("slug", "")
            g["image_url"] = GAME_IMAGES.get(slug)
            g["image_pad"] = IMAGE_PAD.get(slug, 0)
            game = Game(**g, is_active=True)
            db.add(game)
            db.flush()
            for p in products:
                db.add(Product(game_id=game.id, **p, is_active=True))

        db.commit()
        logger.info("✅ %d бозӣ бо нархҳо сохта шуд", len(SEED_GAMES))
