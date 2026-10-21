"""Pydantic схемаҳо барои ворид ва баромади маълумот."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

# =====================================================================
# 🔐 АВТОРИЗАТСИЯ
# =====================================================================


class LoginRequest(BaseModel):
    phone: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_admin: bool = False


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    telegram_id: str | None = None
    username: str | None = None
    full_name: str | None = None
    language: str = "tj"
    is_admin: bool = False
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


class GameOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    emoji: str
    currency: str
    requires_player_id: bool = True
    player_id_label: str = "Player ID"
    image_url: str | None = None
    image_pad: int = 0


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
