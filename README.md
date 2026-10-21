# 💎 danatel.tj — Сайти фурӯши донати бозиҳо

Лоиҳаи **фулл-стек** барои фурӯши кредитҳои бозӣ бо пардохти **DC Wallet**.

## 🛠️ Технологияҳо

| Қисм | Технология |
|------|-----------|
| Backend | **FastAPI** + **SQLAlchemy** + **PostgreSQL** |
| Frontend | **React** + **TypeScript** + **Tailwind CSS** |
| Бот | **Telegram Bot** (aiogram 3) |
| Пардохт | **DC Wallet** (Parvard) |
| Идоракунӣ | **Admin Panel** (JWT) |
| Забонҳо | 🇹🇯 TJ · 🇷🇺 RU · 🇺🇸 EN · 🇺🇿 UZ |

## 🎮 Бозиҳо

🔥 Free Fire · 🎯 PUBG Mobile · 🩸 Blood Strike · 💚 Arena Breakout ·
💥 Arena Breakout: Infinite · 👑 Honor of Kings · 🦸 Marvel Rivals · 🌐 Mobile Legends (CIS)

---

## 🚀 ОҒОЗИ ЗУД (бо Docker)

```bash
cd danatel
cp backend/.env.example .env      # танзимотҳоро тағйир диҳед
docker compose up --build
```

| Хидмат | Адрес |
|--------|-------|
| 🌐 Сайт | http://localhost:8080 |
| ⚙️ API | http://localhost:8000/api/docs |
| 🗄️ PostgreSQL | localhost:5432 |

---

## 🖥️ ОҒОЗИ ДАР МАҲАЛЛӣ (бе Docker)

### 1️⃣ ДАТАБЕС (PostgreSQL)

```bash
createdb danatel
# ё дар Docker:
docker run -d --name danatel_pg -e POSTGRES_USER=danatel \
  -e POSTGRES_PASSWORD=danatel_secret -e POSTGRES_DB=danatel \
  -p 5432:5432 postgres:16-alpine
```

### 2️⃣ BACKEND

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
cp .env.example .env           # танзимотро пур кунед

uvicorn app.main:app --reload --port 8000
```

✅ Ҷадвалҳо **худкор** сохта мешаванд + **бозиҳо ва нархҳо** илова мешаванд.

### 3️⃣ FRONTEND

```bash
cd frontend
npm install
npm run dev
```

🌐 http://localhost:5173 (бо proxy ба :8000)

### 4️⃣ TELEGRAM BOT (ихтиёрӣ)

Дар `.env`:
```env
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_ADMIN_CHAT_ID=123456789
```

Бот **худкор** ҳангоми оғози backend кор мекунад.

---

## ⚙️ ТАНЗИМОТИ `.env`

| Калид | Тавсиф |
|-------|--------|
| `DATABASE_URL` | Пайваст ба PostgreSQL |
| `SECRET_KEY` | Калиди JWT (бод 100 ҳарфӣ!) |
| `DC_MERCHANT_ID` | ID-и тиҷорат дар DC Wallet |
| `DC_SECRET_KEY` | Сирри имзои DC |
| `TELEGRAM_BOT_TOKEN` | Токени bot |
| `ADMIN_PHONE` | Телефони вуруди админ |
| `ADMIN_PASSWORD` | Пароли вуруди админ |

---

## 🛠️ ADMIN PANEL

🌐 **http://localhost:5173/admin**

1. Бо `ADMIN_PHONE` + `ADMIN_PASSWORD` вуруд кунед
2. **📊 Омор** — даромад ва фармоишҳо
3. **📦 Фармоишҳо** — тағйири статус, ҳамчун "расида" белабедан
4. **💎 Нархҳо** — илова/тағйири/ҳазфи нархҳо

---

## 📁 СОХТОР

```
danatel/
├── backend/          FastAPI + SQLAlchemy + Bot
│   └── app/
│       ├── main.py       Оғози API
│       ├── config.py     Танзимот (.env)
│       ├── database.py   Пайваст ба PostgreSQL
│       ├── models.py     Ҷадвалҳо
│       ├── seed.py       Бозиҳо + нархҳо
│       ├── security.py   JWT + парол
│       ├── routers/      auth, games, orders, admin, webhook
│       ├── services/     dc_service, telegram_service
│       └── bot/          Telegram Bot
├── frontend/         React + TS + Tailwind
│   └── src/
│       ├── i18n/         🌍 4 забон
│       ├── components/   Navbar, GameCard, OrderForm
│       ├── pages/        Home, GameDetail, OrderPage, admin/
│       ├── api/          Клиенти API
│       └── context/      Забон + вуруд
└── docker-compose.yml
```

---

## 💳 ТАРТИБИ ПАРДОХТ

```
Корбар → Бозӣ → Player ID → DC Wallet
   ↓
FastAPI → DC API → invoice
   ↓
DC → webhook → статус "paid"
   ↓
Telegram bot → ба корбар ✅
```

---

## ⚠️ БЕХАТАРӢ

- 🔒 Сиррҳо танҳо дар `.env` (ба гит нависед!)
- 🔑 Вуруди админ бо **JWT**
- 🆔 Корбар **фақат Player ID** медиҳад — **парол ҳеҷ гоҳ**
- ✍️ Вебхуки DC бо **HIMZO (HMAC-SHA256)** санҷида мешавад

---

## 🌍 ЗАБОНҲО

Тарҷума ба **4 забон** — дар `frontend/src/i18n/index.ts`:

🇹🇯 Тоҷикӣ (пешфарз) · 🇷🇺 Русский · 🇺🇸 English · 🇺🇿 Oʻzbek

Барои иловаи забон: танҳо объектро дар `dictionaries` илова кунед.

---

## 📌 НАРХҲО

Нархҳо дар `backend/app/seed.py` ҳамчун **пешниҳод** ҳастанд.
Барои тағйири воқеӣ → **Admin Panel → 💎 Нархҳо**

➡️ Нархҳои расмӣ: [@ONLAYN_ALMAZ_TJ_bot](https://t.me/ONLAYN_ALMAZ_TJ_bot)
