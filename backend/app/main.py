"""Оғози FastAPI барои лоиҳаи danatel."""
from __future__ import annotations

import asyncio
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.routers import admin, auth, games, orders, webhook

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("danatel")

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
app.include_router(admin.router)


# ========================== Роутҳои умумӣ ==========================
@app.get("/api/health")
def health():
    return {"ok": True, "service": "danatel-api", "version": "1.0.0"}


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


# ========================== Файли статикӣ (React build) ==========================
_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
if os.path.isdir(_dist):
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
    logger.info("Сохтани React аз %s", _dist)
