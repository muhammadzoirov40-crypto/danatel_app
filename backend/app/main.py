"""Оғози FastAPI барои лоиҳаи danatel."""
from __future__ import annotations

import asyncio
import logging
import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.models import User
from app.routers import admin, auth, coins, games, lookup, orders, reviews, webhook
from app.security import require_admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("danatel")

# ========================== Роҳи React build ==========================
# Муштарак барои SPA fallback ва Mount("/")
_dist = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist"
)
if not os.path.isdir(_dist):
    _dist = ""

app = FastAPI(
    title="danatel.tj — Донати бозиҳо",
    description="Сайти фурӯши кредитҳои бозӣ (FastAPI + React + PostgreSQL)",
    version="1.0.0",
    # 📄 Дар production хомӯш (ENABLE_DOCS=false) → бе ифшои схемаи API
    docs_url="/api/docs" if settings.ENABLE_DOCS else None,
    openapi_url="/api/openapi.json" if settings.ENABLE_DOCS else None,
    redoc_url="/api/redoc" if settings.ENABLE_DOCS else None,
)

# ========================== CORS ==========================
_origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://danatel.tj",
    "https://www.danatel.tj",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in _origins if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========================== 🛡️ Сарлавияҳои амниятӣ ==========================
@app.middleware("http")
async def security_headers(request, call_next):
    """Сарлавияҳои бехатарии браузер (ба CORS таъсир намерасонад)."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    return response

# ========================== Роутерҳо ==========================
app.include_router(auth.router)
app.include_router(games.router)
app.include_router(orders.router)
app.include_router(webhook.router)
app.include_router(lookup.router)
app.include_router(admin.router)
app.include_router(reviews.router)
app.include_router(coins.router)


# ========================== Роутҳои умумӣ ==========================
@app.get("/api/health")
def health():
    return {"ok": True, "service": "danatel-api", "version": "1.0.0"}


# ========================== 🧾 Расмҳои чеки пардохт ==========================
# Бо _RECEIPT_DIR дар orders.py бояд якхела бошад (backend/uploads/receipts).
_RECEIPTS = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "uploads",
    "receipts",
)


@app.get("/uploads/receipts/{name}", include_in_schema=False)
async def receipt_image(
    name: str,
    admin: User = Depends(require_admin),  # noqa: ARG001 — танҳо админ
):
    """Нишон додани расми чеки пардохт.

    🛑 Танҳо барои АДМИН: дар расм маълумоти корти шахсӣ (рақам, ном)
    мавҷуд аст → бе токени админ кушода намешавад.
    """
    from fastapi import HTTPException

    # Танҳо номи оддӣ (бе ../) — амният
    safe = os.path.basename(name)
    path = os.path.join(_RECEIPTS, safe)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Расм ёфт нашуд")
    return FileResponse(path, headers={"Cache-Control": "private, no-store"})


# ========================== Оғоз ==========================
@app.on_event("startup")
async def on_startup() -> None:
    init_db()
    from app.seed import seed_if_empty

    seed_if_empty()
    logger.info("✅ danatel API оғоз ёфт")

    # 🔄 Ҳамоҳангсозии каталоги FireLoot: минтақаҳои нав (маҳсулотҳо + нарх)
    if os.getenv("DISABLE_CATALOG_SYNC", "0") != "1":
        try:
            from app.database import SessionLocal
            from app.services.catalog_sync import sync_catalog

            with SessionLocal() as db:
                await sync_catalog(db)
        except Exception:  # noqa: BLE001
            logger.warning("🔄 Ҳамоҳангсозии каталог ноком шуд", exc_info=True)

    # Оғози Telegram Bot дар ҳолати алоҳида
    if os.getenv("DISABLE_TELEGRAM", "0") != "1":
        from app.bot.bot import run_bot

        asyncio.create_task(run_bot())


# ========================== SPA fallback (React Router) ==========================
# Роутҳои клиентӣ, мисли /login, /profile, /admin, /game/free-fire,
# дар сервер вуҷуд надоранд — бояд index.html баргардонем.
#
# ВАЖЕМ: ин бояд ПЕШ аз Mount("/") сабт шавад, вагарна Mount тамоми
# роутҳоро мегирад ва fallback ҳеҷ гоҳ кор намекунад.
@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    """Агар файли статикӣ набошад → index.html (React Router)."""
    # Роутҳои /api/* набояд ҳамчун SPA сабт шаванд — онҳо бояд 404 баргардонанд
    if full_path.startswith("api/"):
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="API роут ёфт нашуд")

    if not _dist:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Файли статикӣ ёфт нашуд")

    # Агар файли воқеӣ вуҷуд дошта бошад → ҳамонро бидиҳед
    # 🛡️ Танҳо дар дохили dist — `../` (path traversal) иҷозат нест,
    #    вагарна `..%2F..%2F.env` метавонад сиррҳоро фиристад.
    if full_path:
        root = os.path.abspath(_dist)
        file_path = os.path.abspath(os.path.join(root, full_path.replace("/", os.sep)))
        inside = file_path == root or file_path.startswith(root + os.sep)
        if inside and os.path.isfile(file_path):
            return FileResponse(file_path)

    # Вагарна → index.html (SPA routing)
    index = os.path.join(_dist, "index.html")
    if os.path.isfile(index):
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    from fastapi import HTTPException

    raise HTTPException(status_code=404, detail="Файли статикӣ ёфт нашуд")


# ========================== Файли статикӣ (React build) ==========================
if _dist:
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
    logger.info("Сохтани React аз %s", _dist)
