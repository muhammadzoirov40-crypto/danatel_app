"""💰 Формати нархи бот: бояд ҲАМОН дақиқ бошад, ки дар админ/сайт.

Қаблан дар `bot.py` ду ҷой `.0f` буд → 28.34 ба «28» табдил меёфт
(нарх гаҳр мерафт!). Ҳол `.2f` мисли `telegram_service.py` → «28.34».

⚠️ Токен: танҳо формати қалбӣ (`123456:...`) — aiogram дар вақти созиш
   танҳо форматро санҷад (ҳеҷ API), ва БАЪД барқарор мешавад →
   ҳеҷ дархости Telegram дар тестҳо намеравад.
"""
from __future__ import annotations

import re
from decimal import Decimal

import pytest
from sqlalchemy import select


@pytest.fixture(scope="module")
def bot_mod():
    from app.config import settings

    saved = settings.TELEGRAM_BOT_TOKEN
    settings.TELEGRAM_BOT_TOKEN = "123456:TEST_FORMAT_ONLY"
    try:
        import app.bot.bot as m

        return m
    finally:
        settings.TELEGRAM_BOT_TOKEN = saved


def test_products_keyboard_price_exact(client, bot_mod):
    """Тугмаи бот: 28.34 → «28.34» (НА «28») + ҳамаи сатрҳо = 2 рақами адад."""
    from app.database import SessionLocal
    from app.models import Game, Product

    with SessionLocal() as db:
        game = db.scalar(select(Game).where(Game.is_active.is_(True)).limit(1))
        assert game, "бозии фаъол дар seed нест"

        p = Product(
            game_id=game.id,
            name_tj="__санҷиши_формати_нарх__",
            price_tjs=Decimal("28.34"),
            amount=1,
            is_active=True,
        )
        db.add(p)
        db.commit()
        try:
            kb = bot_mod.products_keyboard(game.slug, "tj")
            texts = [b.text for row in kb.inline_keyboard for b in row]
            price_lines = [x for x in texts if "сомонӣ" in x]
            assert price_lines, texts

            # Нархи санҷишӣ бояд ДАҚИҚ нишон дода шавад
            hit = [x for x in price_lines if "__санҷиши" in x]
            assert hit and "28.34" in hit[0], texts

            # Ҳамаи сатрҳои нарх = формати ягона (2 рақами адад)
            for x in price_lines:
                assert re.search(r"— \d+\.\d{2} сомонӣ$", x), x
        finally:
            db.delete(p)
            db.commit()
