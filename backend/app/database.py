"""Пайваст ба PostgreSQL бо SQLAlchemy.

Агар PostgreSQL дастрас набошад → ба SQLite фолбэк мекунад,
то лоиҳа бе танзими иловагӣ ҳам кор кунад (барои санҷиш).
"""
from __future__ import annotations

import logging
import time

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

logger = logging.getLogger("db")

SQLITE_URL = "sqlite:///./danatel.db"

engine = None
_using_sqlite = False


def _make_sqlite_engine(url: str):
    """Engine барои SQLite.

    ВАЖЕМ: StaticPool-ро истифода НАМЕБАРЕМ. Барои SQLite-и файлӣ
    ҳар дархост бояд пайвасти худро дошта бошад, вагарна дар ҳамзамонӣ
    (await-и Telegram ҳангоми нигоҳ доштани сессия) пайваст вайрон мешавад
    → "bad parameter or other API misuse".
    """
    eng = create_engine(
        url,
        connect_args={"check_same_thread": False, "timeout": 30},
        future=True,
    )

    @event.listens_for(eng, "connect")
    def _set_pragmas(dbapi_conn, _record):  # noqa: ANN001
        cur = dbapi_conn.cursor()
        # WAL = хондан ва навиштан дар як вақт + эътимоднокӣ
        cur.execute("PRAGMA journal_mode=WAL")
        # Мунтазир шудан ҳангоми қулф ба ҷои хатогӣ
        cur.execute("PRAGMA busy_timeout=30000")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.close()

    return eng


def _build_engine():
    """Сохтани engine — аввал PostgreSQL, агар ноком → SQLite."""
    global _using_sqlite
    url = settings.DATABASE_URL

    if url.startswith("sqlite"):
        _using_sqlite = True
        return _make_sqlite_engine(url)

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
        return _make_sqlite_engine(SQLITE_URL)


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
    _ensure_missing_columns()
    logger.info("Ҷадвалҳо тайёр (DB: %s)", "SQLite" if _using_sqlite else "PostgreSQL")


# =====================================================================
# 🔄 МИГРАТСИЯИ САБУК — илова кардани сутунҳои нав ба ҷадвалҳои кӯҳна
# =====================================================================
#
# `create_all` сутунҳои нав ба ҷадвали мавҷуда илова НАМЕКАРДААД.
# Ин функсия ҳангоми оғоз сутунҳои нопурраро меёбад ва илова мекунад,
# то лоиҳаи кӯҳна бе дастдодан нав шавад.
def _ensure_missing_columns() -> None:
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    # 1) Ҷадвалҳои нав (масалан: balance_transactions, revoked_tokens)
    #    ⚠️ uvicorn бо 2 worker ҳамзамон оғоз мешавад → ҳар ду як ҷадвалро
    #       сохтан мехоҳанд → яке «already exists» мегирад. Ин НАБОЯД
    #       оғози барномаро ноком созад (дар як лаҳза як бор retry мекунем).
    for attempt in (1, 2, 3):
        try:
            Base.metadata.create_all(bind=engine, checkfirst=True)
            break
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "⚠️ create_all (дафъаи %s, ҳамзамонӣ): %s",
                attempt,
                exc.__class__.__name__,
            )
            if attempt == 3:
                raise
            time.sleep(0.4)

    # 2) Сутунҳои нав дар ҷадвалҳои мавҷуда
    wanted: dict[str, list[str]] = {
        "users": ["phone", "password_hash", "balance", "token_version"],
        "orders": [
            "client_token",
            "payment_method",
            "user_id",
            "receipt_file",
            "receipt_text",
            "receipt_at",
            "access_token",
        ],
        "games": ["image_pad"],
    }

    with engine.begin() as conn:
        for table, cols in wanted.items():
            if table not in existing_tables:
                continue
            have = {c["name"] for c in inspector.get_columns(table)}
            for col in cols:
                if col in have:
                    
                    continue
                ddl = _column_ddl(table, col)
                if not ddl:
                    continue
                try:
                    conn.execute(text(ddl))
                    logger.info("🔄 Миграция: илова шуд %s.%s", table, col)
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "⚠️ Миграция ноком %s.%s: %s", table, col, exc.__class__.__name__
                    )


def _column_ddl(table: str, col: str) -> str | None:
    """DDL-и иловаи сутун (мутобиқ ба SQLite ва PostgreSQL)."""
    rules = {
        ("users", "phone"): "ALTER TABLE users ADD COLUMN phone VARCHAR(32)",
        ("users", "password_hash"): "ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)",
        ("users", "balance"): "ALTER TABLE users ADD COLUMN balance NUMERIC(14,2) NOT NULL DEFAULT 0",
        # 🔐 Насби токен (бекоркунии ҳамаи токенҳо ҳангоми ивазкунии парол)
        ("users", "token_version"): "ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0",
        ("orders", "client_token"): "ALTER TABLE orders ADD COLUMN client_token VARCHAR(64)",
        ("orders", "payment_method"): "ALTER TABLE orders ADD COLUMN payment_method VARCHAR(32) DEFAULT 'dc_wallet'",
        ("orders", "user_id"): "ALTER TABLE orders ADD COLUMN user_id INTEGER",
        ("orders", "receipt_file"): "ALTER TABLE orders ADD COLUMN receipt_file VARCHAR(512)",
        ("orders", "receipt_text"): "ALTER TABLE orders ADD COLUMN receipt_text VARCHAR(512)",
        ("orders", "receipt_at"): "ALTER TABLE orders ADD COLUMN receipt_at TIMESTAMP",
        # 🎫 Токени дастрасии мизоҷи бе вуруд (муҳофизат аз IDOR)
        ("orders", "access_token"): "ALTER TABLE orders ADD COLUMN access_token VARCHAR(64)",
        ("games", "image_pad"): "ALTER TABLE games ADD COLUMN image_pad INTEGER NOT NULL DEFAULT 0",
    }
    return rules.get((table, col))


def using_sqlite() -> bool:
    return _using_sqlite
