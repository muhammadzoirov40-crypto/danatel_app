"""Пайваст ба PostgreSQL бо SQLAlchemy.

Агар PostgreSQL дастрас набошад → ба SQLite фолбэк мекунад,
то лоиҳа бе танзими иловагӣ ҳам кор кунад (барои санҷиш).
"""
from __future__ import annotations

import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings

logger = logging.getLogger("db")

SQLITE_URL = "sqlite:///./danatel.db"

engine = None
_using_sqlite = False


def _build_engine():
    """Сохтани engine — аввал PostgreSQL, агар ноком → SQLite."""
    global _using_sqlite
    url = settings.DATABASE_URL

    if url.startswith("sqlite"):
        _using_sqlite = True
        return create_engine(url, connect_args={"check_same_thread": False}, future=True)

    try:
        eng = create_engine(url, pool_pre_ping=True, pool_size=10, max_overflow=20, future=True)
        with eng.connect():
            pass  # санҷиши пайваст
        logger.info("✅ Пайваст ба PostgreSQL: муваффақ")
        return eng
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "⚠️ PostgreSQL дастрас нест (%s)\n"
            "   → Фолбэк ба SQLite: %s",
            exc.__class__.__name__,
            SQLITE_URL,
        )
        _using_sqlite = True
        return create_engine(
            SQLITE_URL,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            future=True,
        )


engine = _build_engine()

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Синфҳои моделии ҳамаи ҷадвалҳо."""


def get_db():
    """Сессияи DB барои ҳар дархост."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Сохтани ҷадвалҳо (дар вақти оғоз)."""
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    logger.info("Ҷадвалҳо тайёр (DB: %s)", "SQLite" if _using_sqlite else "PostgreSQL")


def using_sqlite() -> bool:
    return _using_sqlite
