"""Моделии ҷадвалҳои датабес."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
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
    # 📱 Вуруди оддӣ ( телефон + парол )
    phone: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    # 📧 Имола / Email — барои огоҳисозни дохилӣ
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    username: Mapped[str | None] = mapped_column(String(64))
    full_name: Mapped[str | None] = mapped_column(String(128))
    language: Mapped[str] = mapped_column(String(5), default="tj")
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    # 🔐 Насби токен: ҳангоми ивазкунии парол ин рақам зиёд мешавад
    # → ҲАМАИ токенҳои пешин фавран беэътибор мешаванд (бе race-и вақт).
    # Токени нав ҳамон `tv`-ро дорад → кор мекунад.
    token_version: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, server_default="0"
    )

    # 💰 БАЛАНС ( Decimal барои дақиқии пул )
    balance: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False, server_default="0"
    )

    # 🪙 PERS COINS — тангаҳои дохилӣ (100 танга = 1 сомонӣ).
    #    Тангаҳо ТАНОБО аз бекенд ҷорӣ мешаванд: cashback, даъват, админ,
    #    иваз ба баланс. Фронт ҲЕҶ ГОҲ маблағ намегӯяд.
    coins: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, server_default="0"
    )

    # 🔗 ДАЪВАТ — коди шахсии даъват + кӣ ин корбарро даъват кард
    referral_code: Mapped[str | None] = mapped_column(
        String(12), unique=True, index=True
    )
    # ⚠️ Бе FK-и сахт: сутунҳои кӯҳна бо ALTER илова мешаванд (database.py)
    referred_by_id: Mapped[int | None] = mapped_column(
        Integer, index=True, nullable=True
    )

    # 🎮 Бозии интихобшудаи корбар (саҳифаи Чарх — пеш аз гардиш)
    favorite_game: Mapped[str | None] = mapped_column(
        String(64), nullable=True, default=None
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    orders: Mapped[list["Order"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="Order.user_id",
    )
    transactions: Mapped[list["BalanceTransaction"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        # ⚠️ Ду FK ба users ҳаст (user_id + admin_id) → бояд возеҳ нишон диҳем
        foreign_keys="BalanceTransaction.user_id",
    )

    @property
    def balance_float(self) -> float:
        return float(self.balance or 0)


class BalanceTransactionKind:
    """Навъи тағйироти баланс."""

    CREDIT = "credit"      # ➕ илова аз ҷониби Admin
    DEBIT = "debit"        # ➖ буриш ҳангоми донат
    REFUND = "refund"      # 🔄 баргардонидани пул

    ALL = [CREDIT, DEBIT, REFUND]


class BalanceTransaction(Base):
    """
    📜 Таърихи ҳамаи тағйироти баланс.

    Ҳар як сатр = як амалиёт: User, маблағ, сана, Admin, сабаб.
    Баланси ҷорӣ дар users.balance нигоҳ дошта мешавад,
    ин ҷадвал танҳо барои таърих/ҳисобот аст.
    """

    __tablename__ = "balance_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # ⬅️ Аз ҷониби кӣ: Admin-и иҷокунанда (холӣ = худи система/User)
    admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    kind: Mapped[str] = mapped_column(String(16), index=True)  # credit / debit / refund
    # Маблағ бо аломат: + илова, - буриш
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    # Баланс ПАС аз ин амалиёт
    balance_after: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    # Сабаби тағйирот
    reason: Mapped[str | None] = mapped_column(Text)
    # Истинод ба фармоиш (ҳангоми донат)
    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("orders.id", ondelete="SET NULL"), index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True
    )

    user: Mapped["User"] = relationship(foreign_keys=[user_id], back_populates="transactions")
    admin: Mapped["User | None"] = relationship(foreign_keys=[admin_id])


# =====================================================================
# 🪙 PERS COINS — ТАРИХИ ТАНГАҲО
# =====================================================================


class CoinTransactionKind:
    """Навъи тағйироти тангаҳо."""

    CASHBACK = "cashback"              # ➕ аз фармоиши иҷрочуда
    REFERRAL = "referral"              # ➕ даъвати дӯст
    REFERRAL_WELCOME = "referral_welcome"  # ➕ бонуси дӯсти нав
    ADMIN_GRANT = "admin_grant"        # ➕ аз ҷониби админ
    EXCHANGE = "exchange"              # ➖ иваз ба баланс (100 → 1 сомонӣ)
    SPIN = "spin"                      # ➖ хароҷоти гардиши чарх
    SPIN_REWARD = "spin_reward"        # ➕ ғолиби гардиши чарх

    ALL = [
        CASHBACK, REFERRAL, REFERRAL_WELCOME,
        ADMIN_GRANT, EXCHANGE, SPIN, SPIN_REWARD,
    ]


class CoinTransaction(Base):
    """
    🪙 Таърихи ҳамаи тағйироти тангаҳо (Pers Coins).

    Ҳар як сатр = як амалиёт: корбар, миқдор, навъ, сабаб,
    тангаҳои монда ПАС аз амалиёт ва сана.
    Таърих беҳри аудит аст — тангаҳои ҷорӣ дар users.coins.
    """

    __tablename__ = "coin_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Навъ: cashback / referral / exchange / ...
    kind: Mapped[str] = mapped_column(String(24), index=True)
    # Миқдор бо аломат: + илова, - буриш
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    # Тангаҳои монда ПАС аз ин амалиёт
    coins_after: Mapped[int] = mapped_column(Integer, nullable=False)
    # Сабаби тағйирот (забони оддӣ)
    reason: Mapped[str | None] = mapped_column(Text)
    # Истинод ба фармоиш (барои cashback)
    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("orders.id", ondelete="SET NULL"), index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True
    )

    user: Mapped["User"] = relationship(foreign_keys=[user_id])


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
    # Фазои дохилӣ барои лого (px) — баъзе расмҳо васеъ ҳастанд
    image_pad: Mapped[int] = mapped_column(Integer, default=0)

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
    # Минтақаи ин баста (FireLoot): "CIS", "BANGLADESH", "MLBB RUSSIA" …
    # "" = маҳсулоти дастии админ / бозии якминтақаӣ — дар ҳама минтақа нишон дода мешавад.
    # ⚠️ text("''") — SQLAlchemy рақами рӯйхатиро иқтибос илова мекард ("" 2-алифбо мешуд!)
    region: Mapped[str] = mapped_column(String(32), default="", server_default=text("''"))
    # Калиди каталоги FireLoot (барои ҳамоҳангсозии худкор; "" = дастӣ)
    sku: Mapped[str] = mapped_column(String(64), default="", server_default=text("''"))

    game: Mapped["Game"] = relationship(back_populates="products")

    def get_name(self, lang: str = "tj") -> str:
        return getattr(self, f"name_{lang}", None) or self.name_tj


# =====================================================================
# 📦 ФАРМОИШҲО
# =====================================================================


class OrderStatus:
    PENDING = "pending"          # ⏳ интизори пардохт
    CHECKING = "checking"        # 🧾 чек расид — интизори тасдиқи админ
    PAID = "paid"                # ✅ пардохт шуд
    DELIVERED = "delivered"      # 🎮 маҳсулот расид
    FAILED = "failed"            # ❌ ноком
    REFUNDED = "refunded"        # 💰 пул баргардонида шуд
    CANCELLED = "cancelled"      # 🚫 бекор шуд

    ALL = [PENDING, CHECKING, PAID, DELIVERED, FAILED, REFUNDED, CANCELLED]


class PaymentMethod:
    DC = "dc_wallet"        # 💳 Пардохти берунии DC Wallet (линк + чек)
    BALANCE = "balance"     # 💰 Аз баланси дохилӣ (ҳамён)
    ALL = [DC, BALANCE]


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="RESTRICT"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"))

    # Маълумоти фармоиш
    player_id: Mapped[str] = mapped_column(String(64))
    player_nickname: Mapped[str | None] = mapped_column(String(128))
    # 🌍 Минтақаи интихобшуда (FireLoot: CIS / BRAZIL / MLBB RUSSIA …).
    #    nullable + server_default → сутун дар ҷадвали пур аз фармоишҳо
    #    бе хато илова мешавад (мигратсияи худкори database.py).
    #    Ҳамаи хонишҳо `or ""` доранд → NULL бехатар аст.
    #    ⚠️ text("''") — String-literal бе иқтибоси дубара (сабаби баги `''`-и 2-алифбо).
    region: Mapped[str | None] = mapped_column(
        String(64), default="", server_default=text("''"), nullable=True
    )
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

    # 🧾 Чеки пардохт (линк + чек) — корбар расм/матн мефиристад
    receipt_file: Mapped[str | None] = mapped_column(String(512))
    receipt_text: Mapped[str | None] = mapped_column(String(512))
    receipt_at: Mapped[datetime | None] = mapped_column(DateTime)

    # 🛡️ Идемпотентность — аз донати такрорӣ (дублировка) манъ мекунад
    client_token: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)

    # 🎫 Токени дастрасӣ ба фармоиш барои МИЗОҶИ БЕ ВУРУД (IDOR-муҳофизат).
    # Мизоҷи бе ҳисоб токенро мегирад ва ҳангоми дархост мефиристад.
    access_token: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)

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
# ⭐ ОТЗЫВҲО (рейтинги воқеӣ — танҳо аз муштариёни бо фармоиш)
# =====================================================================


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # 🔗 Танҳо муштарие, ки фармоиши иҷрочуда дорад, метавонад нависад
    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("orders.id", ondelete="SET NULL"), index=True
    )

    rating: Mapped[int] = mapped_column(Integer, default=5)  # 1..5
    text: Mapped[str] = mapped_column(Text)
    # Номи намоишӣ (аз профил, вале метавонад танқатӣ бошад)
    author_name: Mapped[str | None] = mapped_column(String(64))

    # 🛡️ Пеш аз намоиш дар саҳифа бояд админ тасдиқ кунад
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship()
    order: Mapped["Order | None"] = relationship()


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


# =====================================================================
# 🚫 ТОКЕНҲОИ БЕКОРШУДА (Logout / ивазкунии парол)
# =====================================================================


class RevokedToken(Base):
    """Рӯйхати токенҳои бекоршуда.

    `jti` — шиносноми токен (Logout).
    `user-all:<id>` — «ҲАМАИ токенҳои ин корбар бекоранд» (ивазкунии парол).
    """

    __tablename__ = "revoked_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    jti: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    user_id: Mapped[int | None] = mapped_column(Integer, index=True)
    reason: Mapped[str] = mapped_column(String(32), default="logout")
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# =====================================================================
# 💳 ДАРХОСТҲОИ ПУР КАРДАНИ БАЛАНС (чек → тасдиқи админ / бот)
# =====================================================================


class BalanceRequestStatus:
    """Ҳолатҳои дархости пур кардани баланс."""

    AWAITING = "awaiting_receipt"  # пардохт карда шуд → чек дар давоми 1 дақиқа
    PENDING = "pending"            # чек расид → интизори тасдиқи админ
    APPROVED = "approved"          # тасдиқ → баланс + маблағ
    REJECTED = "rejected"          # рад
    EXPIRED = "expired"            # вақти фиристодани чек гузашт


class BalanceRequest(Base):
    """Дархости корбар: «баланси манро пур кун» + чеки пардохт.

    Қабул (аз веб ё Telegram) → баланс худкор зиёд мешавад
    дар як transaction бо сабти таърих (wallet.credit_balance).
    """

    __tablename__ = "balance_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    amount_tjs: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    receipt_file: Mapped[str | None] = mapped_column(String(512))
    # Пардохти DC City: референс дар f3 + линк + мӯҳлати чек (1 дақиқа)
    dc_ref: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    dc_payment_url: Mapped[str | None] = mapped_column(String(512))
    receipt_deadline: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(
        String(16), default=BalanceRequestStatus.AWAITING, index=True
    )
    decided_by_id: Mapped[int | None] = mapped_column(Integer)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User | None"] = relationship(foreign_keys=[user_id])
