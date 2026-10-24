"""Танзимоти лоиҳа аз файлҳои .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ДАТАБЕС
    DATABASE_URL: str = "postgresql+psycopg2://danatel:danatel_secret@localhost:5432/danatel"

    # АМНИЯТ
    SECRET_KEY: str = "dev_secret_change_me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # DC WALLET
    DC_MERCHANT_ID: str = ""
    DC_SECRET_KEY: str = ""
    DC_API_URL: str = "https://api.dcpay.tj"
    DC_WEBHOOK_URL: str = ""

    # 💳 ПАРДОХТИ БЕРУНӢ (линк + чек) — ҳамон усули боти Telegram
    # Линки пардохт; {amount} бо маблағи фармоиш иваз мешавад
    PAYMENT_LINK_URL: str = ""
    PAYMENT_CARD_NUMBER: str = ""
    PAYMENT_CARD_HOLDER: str = ""
    PAYMENT_PHONE: str = ""

    # TELEGRAM
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_ADMIN_CHAT_ID: str = ""

    # 🔄 ИМПОРТИ МАЪЛОМОТ аз боти Telegram (фақат DB, токен истифода намешавад)
    # Масалан: postgresql+psycopg://postgres:pass@127.0.0.1:5432/fastapi
    BOT_DATABASE_URL: str = ""

    # БАРНАМА
    FRONTEND_URL: str = "http://localhost:5173"
    ADMIN_PHONE: str = "992000000000"
    ADMIN_PASSWORD: str = "admin"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
