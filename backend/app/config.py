"""Танзимоти лоиҳа аз файлҳои .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ДАТАБЕС
    DATABASE_URL: str = "postgresql+psycopg2://danatel:danatel_secret@localhost:5432/danatel"

    # АМНИЯТ
    SECRET_KEY: str = "dev_secret_change_me"
    # ⚠️ Ин танҳо барои иттилоот аст: алгоритми воқеии имзо дар
    #    app/security.py ба `HS256` маҳкам шудааст ва аз .env ҚАБУЛ НАМЕШАВАД
    #    (то касе алгоритми `none` ё дигарро ҷорӣ карда натавонад).
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

    # ===== DC City (pay.dc.tj) — пардохти воқеӣ =====
    PAYDC_URL: str = "https://pay.dc.tj/"
    PAYDC_ENABLED: bool = True
    PAYDC_ACCOUNT: str = "9762000220865843"
    PAYDC_ARTICUL: str = "133"
    PAYDC_DESCRIPTION: str = "donatshop"

    # 🔄 ИМПОРТИ МАЪЛОМОТ аз боти Telegram (фақат DB, токен истифода намешавад)
    # Масалан: postgresql+psycopg://postgres:pass@127.0.0.1:5432/fastapi
    BOT_DATABASE_URL: str = ""

    # 🔍 ЛОГИНИ НИК (FireLoot partner API) — ҳамон калиди бот
    FIRELOOT_API_URL: str = "https://partner.firelootshop.com/api/v1"
    FIRELOOT_API_KEY: str = ""

    # 🪙 PERS COINS (тангаҳои дохилӣ) — ҳамаи рақамҳо аз .env танзим мешаванд
    #    💱 НАРХИ ТАНИМОӢ (танзими соҳиб, 2026):
    #       5 танга = 1 сомонӣ  →  50 танга = 10 сомонӣ
    #    cashback: ҳар 1 сомонии фармоиши ИҶРОЧУДА = COINS_PER_TJS танга
    #       1 танга = 0.2 сомонӣ → cashback = 20 % аз фармоиши иҷрочуда
    COINS_PER_TJS: int = 1
    #    иваз ба баланс: COINS_TO_TJS танга = 1 сомонӣ (адади куллӣ)
    COINS_TO_TJS: int = 5
    #    даъват: ҳангоми қайди дӯст тавассути линки шахсӣ (як дафъа)
    #       50 танга = 10 сомонӣ · дӯст 10 танга = 2 сомонӣ
    REFERRAL_COINS: int = 50
    REFERRAL_FRIEND_COINS: int = 10
    #    хароҷоти як гардиши чарх (Фаза 2) → 50 танга = 10 сомонӣ
    SPIN_COST_COINS: int = 50
    #    ҳадди ақал барои иваз ба баланс = хароҷоти як гардиш
    #       50 танга = 10 сомонӣ
    COINS_MIN_EXCHANGE: int = 50

    # БАРНАМА
    FRONTEND_URL: str = "http://localhost:5173"
    ADMIN_PHONE: str = "992000000000"
    ADMIN_PASSWORD: str = "admin"

    # 📧 ИМОЛА / EMAIL (SMTP)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@danatel.tj"
    SMTP_FROM_NAME: str = "Danatel.tj"

    # 🏭 МУҲИТ: production / development / test
    ENVIRONMENT: str = "production"
    # 📄 Swagger UI + OpenAPI. Дар production беҳтар хомӯш аст
    #    (ба ҷои он → хатогиҳои иттилоотӣ). Барои рушд: ENABLE_DOCS=true
    ENABLE_DOCS: bool = True

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
