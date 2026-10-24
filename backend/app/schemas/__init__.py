"""Pydantic схемаҳо барои ворид ва баромади маълумот."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# =====================================================================
# 🔐 АВТОРИЗАТСИЯ
# =====================================================================


class LoginRequest(BaseModel):
    phone: str
    password: str


class RegisterRequest(BaseModel):
    """📱 Қайди корбари нав."""

    phone: str
    password: str = Field(min_length=4, max_length=128)
    full_name: str | None = Field(default=None, max_length=128)
    language: str = Field(default="tj", max_length=5)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_admin: bool = False


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    telegram_id: str | None = None
    phone: str | None = None
    username: str | None = None
    full_name: str | None = None
    language: str = "tj"
    is_admin: bool = False
    # 💰 Баланси ҷорӣ бо сомонӣ
    balance: Decimal = Decimal("0.00")
    created_at: datetime


# =====================================================================
# 🎮 БОЗӢ
# =====================================================================


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    price_tjs: Decimal
    amount: int
    is_popular: bool = False
    is_active: bool = True


class PublicStats(BaseModel):
    """📊 Омори умумӣ барои саҳифаи асосӣ (рафтори воқеӣ, ҳассос нест)."""

    orders_delivered: int = 0
    users_total: int = 0


# =====================================================================
# ⭐ ОТЗЫВҲО / РЕЙТИНГИ ВОҚЕӢ
# =====================================================================


class ReviewCreate(BaseModel):
    """Навиштани отзыв — танҳо барои муштарии бо фармоиши иҷрочуда."""

    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=5, max_length=600)
    order_id: int | None = None
    author_name: str | None = Field(default=None, max_length=64)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_name: str
    rating: int
    text: str
    created_at: datetime

    @field_validator("author_name", mode="before")
    @classmethod
    def _anon(cls, v):
        return v or "Муштарӣ"


class ReviewSummary(BaseModel):
    """Ҳисобот барои саҳифаи асосӣ."""

    rating_avg: float = 0.0
    reviews_total: int = 0
    # Оё корбари ҷорӣ ҳуқуқи навиштани отзыв дорад (фармоиши иҷрочуда)
    can_review: bool = False
    my_review_id: int | None = None


class GameOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    emoji: str
    currency: str
    # NULL-ро ба пешфарз табдил медиҳад — барои ҷадвалҳои кӯҳна
    requires_player_id: bool = True
    player_id_label: str = "Player ID"
    image_url: str | None = None
    image_pad: int = 0
    # 📊 Барои саҳифаи асосӣ (промо-картоҳо)
    min_price_tjs: Decimal | None = None
    products_count: int = 0
    is_popular: bool = False

    @field_validator("requires_player_id", mode="before")
    @classmethod
    def _req_pid(cls, v):
        return True if v is None else v

    @field_validator("player_id_label", mode="before")
    @classmethod
    def _pid_label(cls, v):
        return "Player ID" if v in (None, "") else v

    @field_validator("image_pad", mode="before")
    @classmethod
    def _img_pad(cls, v):
        return 0 if v is None else v


class GameDetailOut(GameOut):
    products: list[ProductOut] = []


# =====================================================================
# 📦 ФАРМОИШ
# =====================================================================


class OrderCreate(BaseModel):
    game_slug: str
    product_id: int
    player_id: str = Field(min_length=2, max_length=64)
    player_nickname: str | None = Field(default=None, max_length=128)
    language: str = Field(default="tj", max_length=5)

    # 💳 Усули пардохт: "dc_wallet" | "balance" (аз ҳамён)
    payment_method: str = Field(default="dc_wallet", max_length=32)
    # 🛡️ Идемпотентность — аз донати такрорӣ (дублировка) манъ мекунад
    client_token: str | None = Field(default=None, max_length=64)


# =====================================================================
# 💰 БАЛАНС / ҲАМЁН
# =====================================================================


class BalanceOut(BaseModel):
    """Баланси ҷории корбар."""

    user_id: int
    balance: Decimal


class BalanceAdjustRequest(BaseModel):
    """Admin ба баланси корбар маблағ илова мекунад."""

    user_id: int
    amount: Decimal = Field(gt=0, description="Маблағ бояд аз сифат зиёд бошад")
    reason: str | None = Field(default=None, max_length=255)


class BalanceTransactionOut(BaseModel):
    """Як сатри таърихи баланс."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    admin_id: int | None = None
    kind: str
    amount: Decimal
    balance_after: Decimal
    reason: str | None = None
    order_id: int | None = None
    created_at: datetime
    # Барои нишон дар ҷадвал
    admin_name: str | None = None


class AdminUserOut(BaseModel):
    """Корбар дар панели Admin бо баланси ҷорӣ."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    phone: str | None = None
    username: str | None = None
    full_name: str | None = None
    language: str = "tj"
    is_admin: bool = False
    balance: Decimal
    orders_count: int = 0
    created_at: datetime


class PaymentInitOut(BaseModel):
    order_id: int
    status: str
    payment_url: str | None = None
    invoice_id: str | None = None
    amount_tjs: Decimal
    message: str = ""


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    amount_tjs: Decimal
    player_id: str
    payment_method: str
    dc_payment_url: str | None = None
    created_at: datetime
    game_name: str = ""
    product_name: str = ""
    # 🧾 Чеки пардохт
    receipt_file: str | None = None
    receipt_text: str | None = None
    # 💳 Маълумоти пардохти берунӣ (линк + рақами корта)
    payment_link: str | None = None
    payment_card: str | None = None
    payment_phone: str | None = None


class ReceiptSubmit(BaseModel):
    """Корбар чеки пардохтро мефиристад."""

    text: str | None = Field(default=None, max_length=512)


# =====================================================================
# 🔍 ЛОГИНИ PLAYER ID / НИК
# =====================================================================


class PlayerLookupRequest(BaseModel):
    """Запрос на поиск ника по Player ID."""

    uid: str = Field(min_length=3, max_length=64, description="Player ID / UID")


class PlayerLookupResponse(BaseModel):
    """Ответ с найденным ником."""

    found: bool
    uid: str
    game: str
    nickname: str = ""
    region: str = ""
    message: str = ""


# =====================================================================
# 🛠️ АДМИН
# =====================================================================


class AdminStats(BaseModel):
    orders_total: int
    orders_today: int
    orders_pending: int
    orders_paid: int
    orders_delivered: int
    orders_failed: int
    revenue_total_tjs: float
    revenue_today_tjs: float
    users_total: int
    games_active: int


# =====================================================================
# 🔄 ИМПОРТИ МАЪЛОМОТ АЗ БОТИ TELEGRAM
# =====================================================================


class BotImportReport(BaseModel):
    """Натиҷаи импорти маълумот аз боти Telegram."""

    ok: bool
    error: str | None = None
    prices: int = 0
    price_fixed: int = 0
    users: int = 0
    orders: int = 0
    skipped: int = 0


class AdminOrderUpdate(BaseModel):
    status: str
    transaction_id: str | None = None


class GameUpsert(BaseModel):
    slug: str
    name_tj: str
    name_ru: str = ""
    name_en: str = ""
    name_uz: str = ""
    emoji: str = "🎮"
    currency_tj: str = "алмос"
    currency_ru: str = ""
    currency_en: str = ""
    currency_uz: str = ""
    requires_player_id: bool = True
    player_id_label_tj: str = "Player ID"
    player_id_label_ru: str = ""
    player_id_label_en: str = ""
    player_id_label_uz: str = ""
    image_url: str | None = None
    image_pad: int = 0
    is_active: bool = True
    sort_order: int = 0


class ProductUpsert(BaseModel):
    game_id: int
    name_tj: str
    name_ru: str = ""
    name_en: str = ""
    name_uz: str = ""
    price_tjs: Decimal = Field(gt=0)
    amount: int = 0
    is_active: bool = True
    is_popular: bool = False
    sort_order: int = 0


class ProductUpdate(BaseModel):
    name_tj: str | None = None
    name_ru: str | None = None
    name_en: str | None = None
    name_uz: str | None = None
    price_tjs: Decimal | None = Field(default=None, gt=0)
    amount: int | None = None
    is_active: bool | None = None
    is_popular: bool | None = None
    sort_order: int | None = None
