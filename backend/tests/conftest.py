"""Муҳити тест — танзимот ПЕШ аз ворид кардани барнома гузорида мешавад.

⚠️ ДАР ИН ҶО МАЪЛУМОТИ КОРБАРИ ВОҚЕӢ ИСТИФОДА НАМЕШАВАД:
   • DB  = файли муваққатии SQLite (на PostgreSQL-и сервер)
   • Telegram Bot = хомӯш (DISABLE_TELEGRAM=1)
   • Ҳеҷ дархост ба сервери production намеравад
   • Паролҳо/токенҳо дар ин ҷо танҳо барои тест сохта мешаванд
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="danatel_test_"))
_DB = _TMP / "test.db"

# ⚠️ БОЯД ПЕШ аз `from app...` бошад — app.config дар вақти import хонда мешавад
os.environ.update(
    {
        "DATABASE_URL": f"sqlite:///{_DB.as_posix()}",
        "SECRET_KEY": "unit_test_secret_key_0123456789abcdef0123456789abcdef",
        "ACCESS_TOKEN_EXPIRE_MINUTES": "60",
        "DISABLE_TELEGRAM": "1",
        "ENABLE_DOCS": "true",
        "ENVIRONMENT": "test",
        "ADMIN_PHONE": "992000000000",
        "ADMIN_PASSWORD": "test_admin_pw_12345",
        # 🔑 Сиррҳо холӣ → вебхуки DC бояд РАД шавад
        "DC_SECRET_KEY": "",
        "DC_MERCHANT_ID": "",
        "TELEGRAM_BOT_TOKEN": "",
        "PAYMENT_LINK_URL": "",
        "FIRELOOT_API_KEY": "",
    }
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import ratelimit  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client() -> TestClient:
    """Клиенти ягона — startup (init_db + seed) як дафъа иҷро мешавад."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _fresh_limits():
    """Ҳар тест аз ҳисобкунакҳои rate-limit оғоз мешавад."""
    ratelimit.reset()
    yield
    ratelimit.reset()
