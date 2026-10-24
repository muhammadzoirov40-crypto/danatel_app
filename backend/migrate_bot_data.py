#!/usr/bin/env python3
"""
🔄 MIGRATE: маълумоти боти Telegram (.almaz_tj_telegram-bot) → сайти danatel

1) Нархҳо:  bot.products  → site.products   (озмун + ислоҳ)
2) Корбарон: bot.users     → site.users      (+ баланс + audit)
3) Фармоишҳо: bot.orders   → site.orders     (таърих)

Ҳар ду DB дар PostgreSQL-и ҳамон сервер ҳастанд.
Бехатар: idempotent — бори дуюм такрорӣ намесозад.
"""
from __future__ import annotations

import os
import sys
from decimal import Decimal

from sqlalchemy import create_engine, text

BOT_DB = "postgresql+psycopg://postgres:salom123@127.0.0.1:5432/fastapi"
SITE_DB = "postgresql+psycopg://donatshop:donatshop_secret@127.0.0.1:5432/donatshop"

DRY = "--apply" not in sys.argv

bot = create_engine(BOT_DB, future=True)
site = create_engine(SITE_DB, future=True)

log = lambda *a: print(*a, flush=True)
flag = lambda: "🔍 DRY-RUN (барои татбиқ: --apply)" if DRY else "✅ APPLY"


# =====================================================================
# 🗺️ Маппинг: бозӣ (номи бот) → slug-и сайти
# =====================================================================
def game_of(name: str, sku: str | None) -> str:
    """Номи маҳсулот → slug-и бозӣ. ⚠️ Ном аввал, SKU баъд."""
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

    # --- Free Fire: ном "FF ..." ё SKU "diamonds_*" ---
    if n.startswith("ff ") or n.startswith("free fire") or "diamonds_" in s:
        return "free-fire"
    return "?"


def main() -> None:
    log("=" * 70)
    log(f"🔄 MIGRATE бот → сайт   {flag()}")
    log("=" * 70)

    # ------------------------------------------------------------------
    # 1) НАРХҲО — озмун
    # ------------------------------------------------------------------
    log("\n1️⃣  НАРХҲО (bot.products → site.products)")

    with bot.connect() as bc:
        # ⚠️ ТАНҲО фаъолҳо: сайт танҳо маҳсулотҳои фаъоли бот-ро дорад
        bot_rows = bc.execute(text(
            "SELECT id, name, diamonds, price, sku, is_active FROM products WHERE is_active = true"
        )).mappings().all()
    with site.connect() as sc:
        site_rows = sc.execute(text(
            "SELECT p.id, p.game_id, g.slug, p.name_ru, p.price_tjs, p.amount, p.is_active "
            "FROM products p JOIN games g ON g.id = p.game_id"
        )).mappings().all()

    # Гурӯҳбандии site: slug → [(amount, price, id)]
    site_by_game: dict[str, list] = {}
    site_by_name: dict[str, dict] = {}
    for r in site_rows:
        item = {"id": r["id"], "amount": int(r["amount"] or 0),
                "price": Decimal(str(r["price_tjs"])), "name": r["name_ru"], "active": r["is_active"]}
        site_by_game.setdefault(r["slug"], []).append(item)
        if r["name_ru"]:
            site_by_name[(r["slug"], r["name_ru"].strip().lower())] = item

    bot_by_game: dict[str, list] = {}
    for r in bot_rows:
        g = game_of(r["name"], r["sku"])
        if g == "?":
            continue
        bot_by_game.setdefault(g, []).append(
            {"id": r["id"], "amount": int(r["diamonds"] or 0),
             "price": Decimal(str(r["price"])), "name": r["name"], "active": r["is_active"]}
        )

    fixes = 0
    matched = 0
    unmatched = 0
    for g, bprods in sorted(bot_by_game.items()):
        sprods = site_by_game.get(g, [])
        if not sprods:
            log(f"   ⚠️  {g}: дар сайт маҳсулот нест (бот: {len(bprods)})")
            continue
        # Мувофиқкунӣ: 1) бО НОМ (дақиқ) → 2) бо amount
        used: set[int] = set()
        for b in bprods:
            cand = site_by_name.get((g, (b["name"] or "").strip().lower()))
            if cand is not None and cand["id"] in used:
                cand = None
            if cand is None:
                cand = next(
                    (s for s in sprods if s["id"] not in used and s["amount"] == b["amount"]),
                    None,
                )
            if cand is None:
                unmatched += 1
                log(f"   ⚠️  {g}: бе ҷавоб — «{b['name']}» ({b['amount']}) {b['price']}")
                continue
            used.add(cand["id"])
            matched += 1
            if cand["price"] != b["price"]:
                fixes += 1
                log(f"   🔧 {g}: «{cand['name']}» {cand['price']} → {b['price']}")
                if not DRY:
                    with site.begin() as sc:
                        sc.execute(text("UPDATE products SET price_tjs=:p WHERE id=:i"),
                                   {"p": b["price"], "i": cand["id"]})
            # Статуси фаъолият
            if cand["active"] != b["active"] and not DRY:
                with site.begin() as sc:
                    sc.execute(text("UPDATE products SET is_active=:a WHERE id=:i"),
                               {"a": b["active"], "i": cand["id"]})

    log(f"   📊 Мувофиқ: {matched} | бе ҷавоб: {unmatched} | Ислоҳи нарх: {fixes}")

    # ------------------------------------------------------------------
    # 2) КОРБАРОН
    # ------------------------------------------------------------------
    log("\n2️⃣  КОРБАРОН (bot.users → site.users)")

    with bot.connect() as bc:
        users = bc.execute(text(
            "SELECT id, telegram_id, username, first_name, balance, is_admin, lang, is_active, created_at "
            "FROM users"
        )).mappings().all()
    with site.connect() as sc:
        exist = {str(r[0]) for r in sc.execute(text("SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL"))}

    new_u = 0
    upd_u = 0
    for u in users:
        tid = str(u["telegram_id"])
        if tid in exist:
            continue
        new_u += 1
        bal = Decimal(str(u["balance"] or 0))
        lang = (u["lang"] or "tj")[:5]
        if lang not in ("tj", "ru", "en", "uz"):
            lang = "tj"
        if not DRY:
            with site.begin() as sc:
                r = sc.execute(text(
                    "INSERT INTO users (telegram_id, username, full_name, balance, language, is_admin, created_at) "
                    "VALUES (:t, :un, :fn, :b, :l, :a, :c) "
                    "ON CONFLICT (telegram_id) DO NOTHING RETURNING id"
                ), {"t": tid, "un": (u["username"] or None), "fn": (u["first_name"] or None),
                    "b": bal, "l": lang, "a": bool(u["is_admin"]), "c": u["created_at"]})
                row = r.first()
                if row and bal > 0:
                    # 📜 Audit: сабаби баланси гузарондашуда
                    sc.execute(text(
                        "INSERT INTO balance_transactions "
                        " (user_id, admin_id, kind, amount, balance_after, reason, created_at) "
                        "VALUES (:uid, NULL, 'credit', :amt, :amt, :rs, now())"
                    ), {"uid": row[0], "amt": bal, "rs": "Гузаронидан аз боти Telegram (мигратсия)"})
        exist.add(tid)
    log(f"   📊 Нав: {new_u} | аллакай ҳаст: {len(users) - new_u}")

    # ------------------------------------------------------------------
    # 3) ФАРМОИШҲО
    # ------------------------------------------------------------------
    log("\n3️⃣  ФАРМОИШҲО (bot.orders → site.orders)")

    with bot.connect() as bc:
        orders = bc.execute(text(
            "SELECT o.id, o.user_id, o.product_id, o.free_fire_uid, o.amount, o.status, "
            "       o.created_at, p.name AS pname, p.diamonds, p.price, p.sku "
            "FROM orders o LEFT JOIN products p ON p.id = o.product_id ORDER BY o.id"
        )).mappings().all()
        bot_prod = {r["id"]: r for r in bc.execute(text(
            "SELECT id, name, diamonds, price, sku FROM products")).mappings()}
        bot_user_tid = {r["id"]: str(r["telegram_id"]) for r in bc.execute(text(
            "SELECT id, telegram_id FROM users")).mappings()}

    with site.connect() as sc:
        # (slug, amount, price) → site product id
        site_key = {}
        for r in sc.execute(text(
            "SELECT p.id, g.slug, p.amount, p.price_tjs "
            "FROM products p JOIN games g ON g.id=p.game_id"
        )):
            site_key[(r[1], int(r[2] or 0), Decimal(str(r[3])))] = r[0]
        site_slug_amount = {}
        for r in sc.execute(text(
            "SELECT p.id, g.slug, p.amount "
            "FROM products p JOIN games g ON g.id=p.game_id"
        )):
            site_slug_amount.setdefault((r[1], int(r[2] or 0)), r[0])
        exist_o = {str(r[0]) for r in sc.execute(
            text("SELECT client_token FROM orders WHERE client_token IS NOT NULL"))}
        uid_map = {str(r[0]): r[1] for r in sc.execute(
            text("SELECT telegram_id, id FROM users WHERE telegram_id IS NOT NULL"))}
        gid_map = {r[0]: r[1] for r in sc.execute(text("SELECT slug, id FROM games"))}

    STATUS = {"COMPLETED": "delivered", "PAID": "paid", "FAILED": "failed",
              "CANCELLED": "cancelled", "PENDING": "pending", "PROCESSING": "checking"}
    new_o = 0
    no_prod = 0
    for o in orders:
        key = f"bot:{o['id']}"
        if key in exist_o:
            continue
        bp = bot_prod.get(o["product_id"])
        g = game_of(o["pname"] or (bp["name"] if bp else ""), bp["sku"] if bp else None)
        amt = int(o["amount"] or 0)
        price = Decimal(str(o["amount"] or 0))
        sid = None
        if bp:
            sid = site_key.get((g, int(bp["diamonds"] or 0), Decimal(str(bp["price"]))))
            if sid is None:
                sid = site_slug_amount.get((g, int(bp["diamonds"] or 0)))
        if sid is None:
            sid = site_slug_amount.get((g, amt))
        if sid is None or g not in gid_map:
            no_prod += 1
            continue

        site_uid = None
        if o["user_id"] and o["user_id"] in bot_user_tid:
            site_uid = uid_map.get(bot_user_tid[o["user_id"]])

        with site.begin() as sc:
            sc.execute(text(
                "INSERT INTO orders (user_id, game_id, product_id, player_id, quantity, amount_tjs, "
                " payment_method, status, language, client_token, created_at, updated_at) "
                "VALUES (:u,:g,:p,:pid,1,:amt,'balance',:st,'ru',:ct,:ca,:ca) "
                "ON CONFLICT (client_token) DO NOTHING"
            ), {"u": site_uid, "g": gid_map[g], "p": sid, "pid": str(o["free_fire_uid"] or ""),
                "amt": price, "st": STATUS.get((o["status"] or "").upper(), "pending"),
                "ct": key, "ca": o["created_at"]})
        new_o += 1
        exist_o.add(key)
    log(f"   📊 Нав: {new_o} | бе маҳсулот: {no_prod} | аллакай ҳаст: {len(orders) - new_o - no_prod}")

    log("\n" + "=" * 70)
    log(f"✅ ТАМОМ — {flag()}")
    log("=" * 70)


if __name__ == "__main__":
    if not DRY:
        os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    main()
