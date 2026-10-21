"""Моделии ҷадвалҳои датабес."""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# =====================================================================
# 🧑 КОРБАРОН
# =====================================================================


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    telegram_id: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(64))
    full_name: Mapped[str | None] = mapped_column(String(128))
    language: Mapped[str] = mapped_column(String(5), default="tj")
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    orders: Mapped[list["Order"]] = relationship(back_populates="user", cascade="all, delete-orphan")


# =====================================================================
# 🎮 БОЗИҲО
# =====================================================================


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    # Номҳо ба 4 забон
    name_tj: Mapped[str] = mapped_column(String(128))
    name_ru: Mapped[str] = mapped_column(String(128), default="")
    name_en: Mapped[str] = mapped_column(String(128), default="")
    name_uz: Mapped[str] = mapped_column(String(128), default="")
    emoji: Mapped[str] = mapped_column(String(16), default="🎮")
    currency_tj: Mapped[str] = mapped_column(String(32), default="алмос")
    currency_ru: Mapped[str] = mapped_column(String(32), default="")
    currency_en: Mapped[str] = mapped_column(String(32), default="")
    currency_uz: Mapped[str] = mapped_column(String(32), default="")
    # Рӯйхати ID: бозӣ ID-ро талаб мекунад ё не
    requires_player_id: Mapped[bool] = mapped_column(Boolean, default=True)
    player_id_label_tj: Mapped[str] = mapped_column(String(64), default="Player ID")
    player_id_label_ru: Mapped[str] = mapped_column(String(64), default="")
    player_id_label_en: Mapped[str] = mapped_column(String(64), default="")
    player_id_label_uz: Mapped[str] = mapped_column(String(64), default="")
    image_url: Mapped[str | None] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    products: Mapped[list["Product"]] = relationship(
        back_populates="game", cascade="all, delete-orphan", order_by="Product.sort_order"
    )

    def get_name(self, lang: str = "tj") -> str:
        return getattr(self, f"name_{lang}", None) or self.name_tj

    def get_currency(self, lang: str = "tj") -> str:
        return getattr(self, f"currency_{lang}", None) or self.currency_tj

    def get_player_label(self, lang: str = "tj") -> str:
        return getattr(self, f"player_id_label_{lang}", None) or self.player_id_label_tj


# =====================================================================
# 💎 МАҲСУЛОТ (НАРХҲО)
# =====================================================================


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"), index=True)
    # Номи маҳсулот ба 4 забон
    name_tj: Mapped[str] = mapped_column(String(128))
    name_ru: Mapped[str] = mapped_column(String(128), default="")
    name_en: Mapped[str] = mapped_column(String(128), default="")
    name_uz: Mapped[str] = mapped_column(String(128), default="")
    # Нарх ТАНО бо сомонӣ (TJS) — ҳамчун роҳнамо
    price_tjs: Mapped[float] = mapped_column(Numeric(12, 2))
    # Миқдори аслӣ дар дохили бозӣ
    amount: Mapped[int] = mapped_column(Integer, default=0)
    # Нарх дар сомонӣ барои ҳисоб (захира)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_popular: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    game: Mapped["Game"] = relationship(back_populates="products")

    def get_name(self, lang: str = "tj") -> str:
        return getattr(self, f"name_{lang}", None) or self.name_tj


# =====================================================================
# 📦 ФАРМОИШҲО
# =====================================================================


class OrderStatus:
    PENDING = "pending"          # ⏳ интизори пардохт
    PAID = "paid"                # ✅ пардохт шуд
    DELIVERED = "delivered"      # 🎮 маҳсулот расид
    FAILED = "failed"            # ❌ ноком
    REFUNDED = "refunded"        # 💰 пул баргардонида шуд
    CANCELLED = "cancelled"      # 🚫 бекор шуд

    ALL = [PENDING, PAID, DELIVERED, FAILED, REFUNDED, CANCELLED]


class PaymentMethod:
    DC = "dc_wallet"
    ALL = [DC]


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="RESTRICT"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"))

    # Маълумоти фармоиш
    player_id: Mapped[str] = mapped_column(String(64))
    player_nickname: Mapped[str | None] = mapped_column(String(128))
    quantity: Mapped[int] = mapped_column(Integer, default=1)

    # Пул
    amount_tjs: Mapped[float] = mapped_column(Numeric(12, 2))

    # Пардохт
    payment_method: Mapped[str] = mapped_column(String(32), default=PaymentMethod.DC)
    status: Mapped[str] = mapped_column(String(24), default=OrderStatus.PENDING, index=True)

    # Калиди DC Wallet
    dc_invoice_id: Mapped[str | None] = mapped_column(String(128), index=True)
    dc_payment_url: Mapped[str | None] = mapped_column(String(512))
    transaction_id: Mapped[str | None] = mapped_column(String(128))

    # Забони дархосткунанда
    language: Mapped[str] = mapped_column(String(5), default="tj")
    # Истинодҳои Telegram
    telegram_chat_id: Mapped[str | None] = mapped_column(String(32))

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User | None"] = relationship(back_populates="orders")
    game: Mapped["Game"] = relationship()
    product: Mapped["Product"] = relationship()

    @property
    def amount_float(self) -> float:
        return float(self.amount_tjs)


# =====================================================================
# 📜 ЛОГИ АМАЛИЁТҲО (барои admin)
# =====================================================================


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_id: Mapped[int | None] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(64))
    entity: Mapped[str] = mapped_column(String(64))
    entity_id: Mapped[str | None] = mapped_column(String(64))
    details: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
