"""
🔄 Импорти маълумоти боти Telegram → сайти мо (бо FastAPI).

Танҳо МАЪЛОМОТ: нархҳо, корбарон, фармоишҳо.
⚠️ Роботи Telegram даст назада мешавад — токен истифода намешавад.

Idempotent: бори дуюм такрорӣ намесозад (барои синхронизатсияи давомӣ).
"""
from __future__ import annotations

import logging
from decimal import Decimal

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.config import settings

logger = logging.getLogger("bot_import")

# =====================================================================
# 🗺️ Маппинг: номи маҳсулоти бот → slug-и бозии сайти
# =====================================================================


def game_slug(name: str, sku: str | None = None) -> str:
    """Номи маҳсулоти бот → slug-и бозӣ. ⚠️ Ном аввал, SKU баъд."""
    n = (name or "").lower().strip()
    s = (sku or "").lower()

    # --- Номи бозӣ (дақиқтар) ---
    if "infinite" in n:
        return "arena-breakout-infinite"
    if "mlbb" in n or "mobile legends" in n or n.startswith("ml "):
        return "mobile-legends"
    if "pubg" in n:
        return "pubg-mobile"
    if "blood strike" in n or n.startswith("blood"):
        return "blood-strike"
    if "arena breakout" in n or "arena" in n:
        return "arena-breakout"
    if "honor" in n or "hok" in n or "kings" in n:
        return "honor-of-kings"
    if "marvel" in n:
        return "marvel-rivals"
    if "stars" in n or "telegram" in n:
        return "telegram-stars"

    # --- Сипас: аз рӯи SKU ---
    if s.startswith("pubg"):
        return "pubg-mobile"
    if s.startswith("mlbb") or s.startswith("ml_"):
        return "mobile-legends"
    if "blood" in s:
        return "blood-strike"
    if "infinite" in s:
        return "arena-breakout-infinite"
    if s.startswith("ab_") or "arena" in s:
        return "arena-breakout"

    # --- Free Fire ---
    if n.startswith("ff ") or n.startswith("free fire") or "diamonds_" in s:
        return "free-fire"
    return "?"


# Статусҳои бот → статусҳои сайти
_STATUS_MAP = {
    "COMPLETED": "delivered",
    "PAID": "paid",
    "FAILED": "failed",
    "CANCELLED": "cancelled",
    "PENDING": "pending",
    "PROCESSING": "checking",
}


def _bot_engine() -> Engine | None:
    """Движоки DB-и бот (агар танзим нашудааст → None)."""
    url = (settings.BOT_DATABASE_URL or "").strip()
    if not url:
        return None
    try:
        eng = create_engine(url, future=True, pool_pre_ping=True)
        with eng.connect() as c:
            c.execute(text("SELECT 1"))
        return eng
    except Exception as exc:  # noqa: BLE001
        logger.warning("Bot DB дастрас нест: %s", exc)
        return None


# =====================================================================
# 🔄 Импорт
# =====================================================================


def import_bot_data(db) -> dict:
    """
    Маълумоти бот → сайти мо.

    1) Нархҳо   bot.products → site.products
    2) Корбарон bot.users     → site.users (+ баланс + audit)
    3) Фармоишҳо bot.orders   → site.orders

    `db` — Session-и FastAPI (сайти мо).
    Бармегардонад: {ok, prices, users, orders, error?}
    """
    bot = _bot_engine()
    if bot is None:
        return {
            "ok": False,
            "error": "BOT_DATABASE_URL танзим нашудааст ё DB дастрас нест",
            "prices": 0,
            "users": 0,
            "orders": 0,
        }

    report = {"ok": True, "prices": 0, "users": 0, "orders": 0,
              "price_fixed": 0, "skipped": 0, "error": None}

    # ------------------------------------------------------------------
    # 1) НАРХҲО
    # ------------------------------------------------------------------
    with bot.connect() as bc:
        bot_products = bc.execute(text(
            "SELECT name, diamonds, price, sku FROM products WHERE is_active = true"
        )).mappings().all()

    # site: (slug, name) → (id, price)  ва  (slug, amount) → id
    rows = db.execute(text(
        "SELECT p.id, g.slug, p.name_ru, p.amount, p.price_tjs "
        "FROM products p JOIN games g ON g.id = p.game_id"
    )).all()

    by_name: dict[tuple, int] = {}
    by_amount: dict[tuple, int] = {}
    cur_price: dict[int, Decimal] = {}
    for pid, slug, pname, amount, price in rows:
        if pname:
            by_name[(slug, pname.strip().lower())] = pid
        by_amount.setdefault((slug, int(amount or 0)), pid)
        cur_price[pid] = Decimal(str(price))

    for bp in bot_products:
        g = game_slug(bp["name"], bp["sku"])
        if g == "?":
            continue
        key = (g, (bp["name"] or "").strip().lower())
        pid = by_name.get(key)
        if pid is None:
            pid = by_amount.get((g, int(bp["diamonds"] or 0)))
        if pid is None:
            report["skipped"] += 1
            continue
        report["prices"] += 1
        new_price = Decimal(str(bp["price"]))
        if cur_price.get(pid) != new_price:
            db.execute(text("UPDATE products SET price_tjs = :p WHERE id = :i"),
                       {"p": new_price, "i": pid})
            report["price_fixed"] += 1

    # ------------------------------------------------------------------
    # 2) КОРБАРОН
    # ------------------------------------------------------------------
    with bot.connect() as bc:
        bot_users = bc.execute(text(
            "SELECT telegram_id, username, first_name, balance, is_admin, lang, created_at "
            "FROM users"
        )).mappings().all()

    existing = {str(r[0]) for r in db.execute(
        text("SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL"))}

    for u in bot_users:
        tid = str(u["telegram_id"])
        if tid in existing:
            continue
        bal = Decimal(str(u["balance"] or 0))
        lang = (u["lang"] or "tj")[:5]
        if lang not in ("tj", "ru", "en", "uz"):
            lang = "tj"
        res = db.execute(text(
            "INSERT INTO users (telegram_id, username, full_name, balance, language, is_admin, created_at) "
            "VALUES (:t, :un, :fn, :b, :l, :a, :c) "
            "ON CONFLICT (telegram_id) DO NOTHING RETURNING id"
        ), {"t": tid, "un": u["username"] or None, "fn": u["first_name"] or None,
            "b": bal, "l": lang, "a": bool(u["is_admin"]), "c": u["created_at"]})
        row = res.first()
        if row:
            report["users"] += 1
            if bal > 0:
                # 📜 Таърихи баланс (audit)
                db.execute(text(
                    "INSERT INTO balance_transactions "
                    " (user_id, admin_id, kind, amount, balance_after, reason, created_at) "
                    "VALUES (:uid, NULL, 'credit', :amt, :amt, :rs, now())"
                ), {"uid": row[0], "amt": bal,
                    "rs": "Гузаронидан аз боти Telegram (импорт)"})
        existing.add(tid)

    # ------------------------------------------------------------------
    # 3) ФАРМОИШҲО
    # ------------------------------------------------------------------
    with bot.connect() as bc:
        bot_orders = bc.execute(text(
            "SELECT o.id, o.user_id, o.product_id, o.free_fire_uid, o.amount, o.status, "
            "       o.created_at, p.name AS pname, p.diamonds, p.price, p.sku "
            "FROM orders o LEFT JOIN products p ON p.id = o.product_id ORDER BY o.id"
        )).mappings().all()
        bot_prod = {r["id"]: r for r in bc.execute(text(
            "SELECT id, name, diamonds, price, sku FROM products")).mappings()}
        bot_tid = {r["id"]: str(r["telegram_id"]) for r in bc.execute(text(
            "SELECT id, telegram_id FROM users")).mappings()}

    slug_id = {r[0]: r[1] for r in db.execute(text("SELECT slug, id FROM games"))}
    # (slug, amount, price) → site product id
    site_key = {(r[0], int(r[1] or 0), Decimal(str(r[2]))): r[3]
                for r in db.execute(text(
                    "SELECT g.slug, p.amount, p.price_tjs, p.id "
                    "FROM products p JOIN games g ON g.id = p.game_id"))}
    site_amt = {}
    for r in db.execute(text(
        "SELECT g.slug, p.amount, p.id FROM products p JOIN games g ON g.id = p.game_id"
    )):
        site_amt.setdefault((r[0], int(r[1] or 0)), r[2])

    uid_map = {str(r[0]): r[1] for r in db.execute(
        text("SELECT telegram_id, id FROM users WHERE telegram_id IS NOT NULL"))}
    exist_o = {str(r[0]) for r in db.execute(
        text("SELECT client_token FROM orders WHERE client_token IS NOT NULL"))}

    for o in bot_orders:
        token = f"bot:{o['id']}"
        if token in exist_o:
            continue
        bp = bot_prod.get(o["product_id"])
        g = game_slug(o["pname"] or (bp["name"] if bp else ""),
                      bp["sku"] if bp else None)
        if g == "?" or g not in slug_id:
            continue
        sid = None
        if bp:
            sid = site_key.get((g, int(bp["diamonds"] or 0), Decimal(str(bp["price"]))))
            if sid is None:
                sid = site_amt.get((g, int(bp["diamonds"] or 0)))
        if sid is None:
            sid = site_amt.get((g, int(o["amount"] or 0)))
        if sid is None:
            continue

        site_uid = None
        if o["user_id"] and o["user_id"] in bot_tid:
            site_uid = uid_map.get(bot_tid[o["user_id"]])

        db.execute(text(
            "INSERT INTO orders (user_id, game_id, product_id, player_id, quantity, amount_tjs, "
            " payment_method, status, language, client_token, created_at, updated_at) "
            "VALUES (:u, :g, :p, :pid, 1, :amt, 'balance', :st, 'ru', :ct, :ca, :ca) "
            "ON CONFLICT (client_token) DO NOTHING"
        ), {"u": site_uid, "g": slug_id[g], "p": sid,
            "pid": str(o["free_fire_uid"] or ""),
            "amt": Decimal(str(o["amount"] or 0)),
            "st": _STATUS_MAP.get((o["status"] or "").upper(), "pending"),
            "ct": token, "ca": o["created_at"]})
        report["orders"] += 1
        exist_o.add(token)

    db.commit()
    logger.info("Импорти бот: %s", report)
    return report
