"""Telegram Bot барои донати бозиҳо (aiogram 3)."""
from __future__ import annotations

import logging
from typing import Any

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    CallbackQuery,
    Message,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
)
from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models import Game, Order, OrderStatus, Product
from app.services import dc_service, telegram_service

logger = logging.getLogger("bot")

bot = Bot(
    token=settings.TELEGRAM_BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML),
)
dp = Dispatcher()
router = Router()
dp.include_router(router)

LANGS: dict[str, str] = {}  # chat_id -> lang

# =====================================================================
# 📝 МАТНҲО БА 4 ЗАБОН
# =====================================================================
T = {
    "welcome": {
        "tj": "👋 Хуш омадед!\n\nБозиро барои донат интихоб кунед:",
        "ru": "👋 Добро пожаловать!\n\nВыберите игру для пополнения:",
        "en": "👋 Welcome!\n\nChoose a game to top up:",
        "uz": "👋 Xush kelibsiz!\n\nTo'ldirish uchun o'yinni tanlang:",
    },
    "enter_id": {
        "tj": "📱 <b>{label}</b> -ро нависед:",
        "ru": "📱 Введите <b>{label}</b>:",
        "en": "📱 Enter your <b>{label}</b>:",
        "uz": "📱 <b>{label}</b> kiriting:",
    },
    "choose_amount": {
        "tj": "💎 Маҳсулотро интихоб кунед:",
        "ru": "💎 Выберите количество:",
        "en": "💎 Choose an amount:",
        "uz": "💎 Miqdorni tanlang:",
    },
    "bad_id": {
        "tj": "❌ ID нодуруст аст. Дубора нависед:",
        "ru": "❌ ID неверный. Попробуйте ещё раз:",
        "en": "❌ Invalid ID. Try again:",
        "uz": "❌ ID noto'g'ri. Qaytadan kiriting:",
    },
    "order_created": {
        "tj": "✅ Фармоиш <b>#{id}</b> сохта шуд!\n💰 {amount} сомонӣ\n\n⏳ Пардохтро дар DC Wallet тасдиқ кунед:",
        "ru": "✅ Заказ <b>#{id}</b> создан!\n💰 {amount} сомони\n\n⏳ Подтвердите оплату в DC Wallet:",
        "en": "✅ Order <b>#{id}</b> created!\n💰 {amount} TJS\n\n⏳ Confirm payment in DC Wallet:",
        "uz": "✅ Buyurtma <b>#{id}</b> yaratildi!\n💰 {amount} somoni\n\n⏳ DC Wallet'da to'lovni tasdiqlang:",
    },
    "back": {"tj": "⬅️ Оянда", "ru": "⬅️ Назад", "en": "⬅️ Back", "uz": "⬅️ Orqaga"},
    "cancel": {"tj": "🚫 Бекор кардан", "ru": "🚫 Отмена", "en": "🚫 Cancel", "uz": "🚫 Bekor qilish"},
    "no_games": {
        "tj": "Ҳоло бозӣ мавҷуд нест.",
        "ru": "Пока нет игр.",
        "en": "No games yet.",
        "uz": "Hozircha o'yinlar yo'q.",
    },
}


def t(key: str, lang: str = "tj", **kwargs: Any) -> str:
    entry = T.get(key, {})
    text = entry.get(lang) or entry.get("tj") or key
    return text.format(**kwargs)


def get_lang(chat_id: int | str) -> str:
    return LANGS.get(str(chat_id), "tj")


# =====================================================================
# 🧩 КЛАВИАТУРАҲО
# =====================================================================
def games_keyboard(lang: str) -> InlineKeyboardMarkup:
    with SessionLocal() as db:
        games = db.scalars(
            select(Game).where(Game.is_active.is_(True)).order_by(Game.sort_order, Game.id)
        ).all()

    if not games:
        return InlineKeyboardMarkup(inline_keyboard=[])

    rows: list[list[InlineKeyboardButton]] = []
    row: list[InlineKeyboardButton] = []
    for g in games:
        row.append(
            InlineKeyboardButton(
                text=f"{g.emoji} {g.get_name(lang)}",
                callback_data=f"game:{g.slug}",
            )
        )
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        rows.append(row)

    # Забон
    rows.append(
        [
            InlineKeyboardButton(text="🇹🇯 TJ", callback_data="lang:tj"),
            InlineKeyboardButton(text="🇷🇺 RU", callback_data="lang:ru"),
            InlineKeyboardButton(text="🇺🇸 EN", callback_data="lang:en"),
            InlineKeyboardButton(text="🇺🇿 UZ", callback_data="lang:uz"),
        ]
    )
    return InlineKeyboardMarkup(inline_keyboard=rows)


def products_keyboard(slug: str, lang: str) -> InlineKeyboardMarkup:
    with SessionLocal() as db:
        products = db.scalars(
            select(Product)
            .join(Game)
            .where(Game.slug == slug, Product.is_active.is_(True))
            .order_by(Product.sort_order, Product.id)
        ).all()

    rows = [
        [
            InlineKeyboardButton(
                text=f"{p.get_name(lang)} — {float(p.price_tjs):.0f} сомонӣ",
                callback_data=f"prod:{slug}:{p.id}",
            )
        ]
        for p in products
    ]
    rows.append([InlineKeyboardButton(text=t("back", lang), callback_data="home")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def pay_keyboard(order_id: int, url: str, lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="💳 Пардохт / Оплата / Pay", url=url or "https://t.me")],
            [InlineKeyboardButton(text=t("cancel", lang), callback_data="home")],
        ]
    )


# Ҳолати сӯҳбат: chat_id -> {game, player_id}
SLOTS: dict[str, dict] = {}


# =====================================================================
# 🤖 ҲАНДЛЕРҲО
# =====================================================================
@router.message(CommandStart())
async def cmd_start(message: Message):
    lang = get_lang(message.chat.id)
    with SessionLocal() as db:
        from app.models import User

        user = db.scalar(select(User).where(User.telegram_id == str(message.chat.id)))
        if user is None:
            user = User(
                telegram_id=str(message.chat.id),
                username=message.from_user.username if message.from_user else None,
                full_name=message.from_user.full_name if message.from_user else None,
                language=lang,
            )
            db.add(user)
            db.commit()

    await message.answer(t("welcome", lang), reply_markup=games_keyboard(lang))


@router.callback_query(F.data.startswith("lang:"))
async def cb_lang(call: CallbackQuery):
    lang = (call.data or "").split(":")[1]
    LANGS[str(call.message.chat.id)] = lang
    await call.answer("✅")
    await call.message.edit_text(t("welcome", lang), reply_markup=games_keyboard(lang))


@router.callback_query(F.data == "home")
async def cb_home(call: CallbackQuery):
    lang = get_lang(call.message.chat.id)
    await call.answer()
    await call.message.edit_text(t("welcome", lang), reply_markup=games_keyboard(lang))


@router.callback_query(F.data.startswith("game:"))
async def cb_game(call: CallbackQuery):
    slug = (call.data or "").split(":", 1)[1]
    lang = get_lang(call.message.chat.id)
    with SessionLocal() as db:
        game = db.scalar(select(Game).where(Game.slug == slug))
        if game is None:
            await call.answer("Не найдено", show_alert=True)
            return
        label = game.get_player_label(lang)

    # Сабти слот (бозӣ + ID)
    SLOTS[str(call.message.chat.id)] = {"game": slug}

    await call.answer()
    await call.message.edit_text(
        t("enter_id", lang, label=label),
        reply_markup=InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text=t("back", lang), callback_data="home")]]
        ),
    )


@router.message(F.text)
async def on_text(message: Message):
    lang = get_lang(message.chat.id)
    slot = SLOTS.get(str(message.chat.id), {})

    # Агар ID талаб карда шудааст
    if "game" in slot and "player_id" not in slot:
        player_id = (message.text or "").strip()
        if len(player_id) < 2 or not player_id.replace("-", "").isdigit():
            await message.answer(t("bad_id", lang))
            return
        slot["player_id"] = player_id
        SLOTS[str(message.chat.id)] = slot
        await message.answer(
            t("choose_amount", lang),
            reply_markup=products_keyboard(slot["game"], lang),
        )
        return

    await message.answer(t("welcome", lang), reply_markup=games_keyboard(lang))


@router.callback_query(F.data.startswith("prod:"))
async def cb_product(call: CallbackQuery):
    _, slug, pid = (call.data or "").split(":")
    lang = get_lang(call.message.chat.id)
    slot = SLOTS.get(str(call.message.chat.id), {})
    player_id = slot.get("player_id", "unknown")

    with SessionLocal() as db:
        game = db.scalar(select(Game).where(Game.slug == slug))
        product = db.get(Product, int(pid))
        if game is None or product is None:
            await call.answer("Хатогӣ", show_alert=True)
            return

        order = Order(
            game_id=game.id,
            product_id=product.id,
            player_id=player_id,
            amount_tjs=float(product.price_tjs),
            language=lang,
            status=OrderStatus.PENDING,
            payment_method="dc_wallet",
            telegram_chat_id=str(call.message.chat.id),
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        order_id = order.id
        amount = float(product.price_tjs)

    # Оғози пардохт
    inv = await dc_service.create_invoice(
        order_id=order_id,
        amount_tjs=amount,
        description=f"{slug} - {product.get_name('tj')}",
        lang=lang,
    )

    with SessionLocal() as db:
        order = db.get(Order, order_id)
        if order is not None:
            order.dc_invoice_id = inv.get("invoice_id")
            order.dc_payment_url = inv.get("payment_url")
            db.commit()

    await call.answer()
    await call.message.edit_text(
        t("order_created", lang, id=order_id, amount=f"{amount:.0f}"),
        reply_markup=pay_keyboard(order_id, inv.get("payment_url", ""), lang),
    )
    SLOTS.pop(str(call.message.chat.id), None)


async def on_startup() -> None:
    """Санҷиши кори бот ҳангоми оғоз."""
    if not settings.TELEGRAM_BOT_TOKEN or settings.TELEGRAM_BOT_TOKEN.startswith("123456"):
        logger.warning("TELEGRAM_BOT_TOKEN танзим нашуда — бот хомӯш мемонад")
        return
    try:
        me = await bot.get_me()
        logger.info("Telegram bot оғоз ёфт: @%s", me.username)
    except Exception as exc:  # noqa: BLE001
        logger.error("Telegram bot хатогӣ: %s", exc)


async def run_bot() -> None:
    """Оғози бот дар ҳолати polling."""
    if not settings.TELEGRAM_BOT_TOKEN or settings.TELEGRAM_BOT_TOKEN.startswith("123456"):
        logger.warning("Бот хомӯш: TELEGRAM_BOT_TOKEN танзим нашудааст")
        return
    await on_startup()
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()
