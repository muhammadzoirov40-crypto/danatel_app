# -*- coding: utf-8 -*-
"""
📡 Зиндаи (realtime) огоҳиномаҳои мизоҷ — WebSocket + PostgreSQL NOTIFY.

Нарсӣ (муҳим: `--workers 2` → ду process!):
  1. Ҳар worker рӯйхати пайвастшудаҳои худашро нигоҳ медорад
     (user_id → queue + loop) — пайвастҳои ҳамон worker фавран паём мегиранд;
  2. `publish()` ҳам ба ҳамон worker мефиристад, ҳам `pg_notify`
     → worker-ҳои дигар аз тарафи thread-и `LISTEN` мегиранд;
  3. ҳар паём `origin=<pid>` дорад → ҳамон worker-и фиристанда аз тарафи
     listener-и худаш ДУБРА нафиристад (бе такрорӣ).

Ҳолатҳои содда:
  • SQLite (тест) ё `DISABLE_REALTIME=1` ё бе psycopg2
    → listener оғоз намешавад; танҳо маҳаллӣ кор мекунад (ҳамон process).
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import select
import threading

from sqlalchemy.orm import Session

from app.config import settings

logger = logging.getLogger("realtime")

_CHANNEL = "danatel_events"
_KEEPALIVE_PING = "ping"  # алоҳида — дар ws.py


class _Sub:
    """Як пайвастшавии WebSocket (ба queue-и async-loop-и худаш)."""

    __slots__ = ("user_id", "loop", "queue")

    def __init__(self, user_id: int, loop: asyncio.AbstractEventLoop, queue: asyncio.Queue):
        self.user_id = user_id
        self.loop = loop
        self.queue = queue


_subs: set[_Sub] = set()
_lock = threading.Lock()
_thread: threading.Thread | None = None
_stop = threading.Event()


# ========================== 📥 ПАЙВАСТ / БЕ ПАЙВАСТ ==========================
def subscribe(user_id: int) -> asyncio.Queue:
    """Пайвастшавӣ → queue-и паёмҳо. Ҳатман `unsubscribe(queue)` занед."""
    sub = _Sub(int(user_id), asyncio.get_running_loop(), asyncio.Queue(maxsize=50))
    with _lock:
        _subs.add(sub)
    return sub.queue


def unsubscribe(queue: asyncio.Queue) -> None:
    with _lock:
        for s in list(_subs):
            if s.queue is queue:
                _subs.discard(s)
                return


# ========================== 📨 ИРСОЛ ==========================
def _put_safe(queue: asyncio.Queue, message: str) -> None:
    try:
        queue.put_nowait(message)
    except asyncio.QueueFull:
        pass  # клиент кӯҳна мондааст — напартофтани loop муҳимтар аст


def _deliver(user_id: int, message: str) -> None:
    """Ба пайвастҳои ҲАМОН worker (аз ҳар тараф — sync ё thread)."""
    with _lock:
        targets = [s for s in _subs if s.user_id == user_id]
    for s in targets:
        try:
            s.loop.call_soon_threadsafe(_put_safe, s.queue, message)
        except RuntimeError:
            pass  # loop аллакай баста шудааст — гум накардан


def publish(
    db: Session,
    *,
    user_id: int | None,
    event: str,
    data: dict | None = None,
) -> None:
    """Огоҳинома: ба пайвастҳои маҳаллӣ + PG NOTIFY барои дигар worker-ҳо.

    • ҲАТМАН баъди `db.commit()`-и тағйирот даъват кунед —
      мизоҷи гиранда фавран refetch мекунад ва бояд ҳолати нав бинад.
    • бо SQLite (тест) танҳо маҳаллӣ кор мекунад.
    """
    if user_id is None:
        return
    message = json.dumps(
        {"type": event, "origin": os.getpid(), **(data or {})},
        ensure_ascii=False,
    )
    _deliver(int(user_id), message)

    try:
        bind = db.get_bind()
        if getattr(bind, "dialect", None) is None or bind.dialect.name != "postgresql":
            return  # SQLite/дигар → танҳо маҳаллӣ
        from sqlalchemy import text

        # Алоҳида аз сесшии корбар: ҳеҷ чизи pending-и caller-ро намебарад
        with bind.connect() as conn:
            conn.execute(
                text("SELECT pg_notify(:ch, :payload)"),
                {"ch": _CHANNEL, "payload": message},
            )
            conn.commit()  # NOTIFY дар транзаксия → бе commit намерасад
    except Exception:  # noqa: BLE001
        logger.warning("realtime: pg_notify ноком (user=%s)", user_id, exc_info=True)


# ========================== 📡 LISTENER (ҳар worker, thread алоҳида) ==========================
def _dsn() -> str:
    url = settings.DATABASE_URL or ""
    # postgresql+psycopg2://… → postgresql://… (ба psycopg2 маълум аст)
    if "+" in url[:20]:
        head, _, rest = url.partition("://")
        head = head.split("+", 1)[0]
        url = f"{head}://{rest}"
    return url


def _on_notify(payload: str) -> None:
    try:
        msg = json.loads(payload)
        # Ҳамон worker-и фиристанда — аллакай дар publish() дода шуд
        if int(msg.get("origin") or -1) == os.getpid():
            return
        uid = int(msg.get("user_id") or 0)
    except (ValueError, TypeError, AttributeError):
        return
    if uid:
        _deliver(uid, payload)


def _run(dsn: str) -> None:
    try:
        import psycopg2
    except ImportError:  # noqa: F401
        return
    while not _stop.is_set():
        conn = None
        try:
            conn = psycopg2.connect(dsn, connect_timeout=5)
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(f"LISTEN {_CHANNEL}")
            logger.info("📡 realtime: LISTEN %s фаъол", _CHANNEL)
            while not _stop.is_set():
                if select.select([conn], [], [], 1.0)[0]:
                    conn.poll()
                    while conn.notifies:
                        n = conn.notifies.pop(0)
                        _on_notify(n.payload)
        except Exception:  # noqa: BLE001
            if not _stop.is_set():
                logger.warning("realtime: listener канда шуд — 3s баъд аз нав", exc_info=True)
                _stop.wait(3.0)
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:  # noqa: BLE001
                    pass


def start_listener() -> None:
    """Оғози thread-и LISTEN (танҳо PostgreSQL + бе `DISABLE_REALTIME=1`)."""
    global _thread
    if os.getenv("DISABLE_REALTIME", "0") == "1":
        logger.info("📡 realtime хомӯш (DISABLE_REALTIME=1)")
        return
    dsn = _dsn()
    if not dsn.startswith("postgresql"):
        logger.info("📡 realtime: не PostgreSQL — танҳо маҳаллӣ (безо гузориш)")
        return
    try:
        import psycopg2  # noqa: F401
    except ImportError:
        logger.warning("📡 realtime: psycopg2 нест — listener хомӯш")
        return
    if _thread is not None and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_run, args=(dsn,), name="realtime-listen", daemon=True)
    _thread.start()


def stop_listener() -> None:
    """Ист: сигнал ба thread (select ≤1s → тез меистад)."""
    _stop.set()
