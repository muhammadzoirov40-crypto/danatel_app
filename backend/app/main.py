"""Оғози FastAPI барои лоиҳаи danatel."""
from __future__ import annotations

import asyncio
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.routers import admin, auth, games, lookup, orders, reviews, webhook

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
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
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

# ========================== Роутерҳо ==========================
app.include_router(auth.router)
app.include_router(games.router)
app.include_router(orders.router)
app.include_router(webhook.router)
app.include_router(lookup.router)
app.include_router(admin.router)
app.include_router(reviews.router)


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
async def receipt_image(name: str):
    """Нишон додани расми чеки пардохт барои админ."""
    from fastapi import HTTPException

    # Танҳо номи оддӣ (бе ../) — амният
    safe = os.path.basename(name)
    path = os.path.join(_RECEIPTS, safe)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Расм ёфт нашуд")
    return FileResponse(path)


# ========================== Оғоз ==========================
@app.on_event("startup")
async def on_startup() -> None:
    init_db()
    from app.seed import seed_if_empty

    seed_if_empty()
    logger.info("✅ danatel API оғоз ёфт")

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
    if full_path:
        file_path = os.path.join(_dist, full_path.replace("/", os.sep))
        if os.path.isfile(file_path):
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
