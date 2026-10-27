/**
 * Клиенти API — пайваст бо FastAPI backend.
 * Ҳамаи дархостҳо ба /api мераванд (Vite proxy).
 */
import type {
  AdminReview,
  AdminReviewList,
  AdminStats,
  AdminTopup,
  AdminUser,
  BalanceInfo,
  BalanceTx,
  CoinsExchange,
  CoinsInfo,
  FirelootBalance,
  FirelootCatalog,
  Game,
  Order,
  PaymentInit,
  PlayerLookupResponse,
  Review,
  ReviewSummary,
  Topup,
  TopupPrepare,
  User,
  WheelData,
  WheelSpin,
} from "../types";

const BASE = "/api";

let token: string | null = localStorage.getItem("danatel_token");

export function setToken(v: string | null) {
  token = v;
  if (v) localStorage.setItem("danatel_token", v);
  else localStorage.removeItem("danatel_token");
}

export function getToken(): string | null {
  return token;
}

// ========================== 🎫 ТОКЕНИ ФАРМОИШ (мизоҷи бе вуруд) ==========================
// Мизоҷи бе ҳисоб ҳангоми сохтани фармоиш токени дастрасӣ мегирад.
// Ӯ танҳо тавассути ҳамин токен ба /orders/{id} дастрасӣ дорад (муҳофизат аз IDOR).
const orderTokenKey = (id: number | string) => `danatel_ot_${id}`;

function saveOrderToken(orderId: number, tok?: string | null) {
  try {
    if (tok) localStorage.setItem(orderTokenKey(orderId), tok);
  } catch {
    /* localStorage дастрс нест — бе токен мемонад */
  }
}

function orderTokenFor(path: string): string | null {
  const m = /^\/orders\/(\d+)/.exec(path);
  if (!m) return null;
  try {
    return localStorage.getItem(orderTokenKey(m[1]));
  } catch {
    return null;
  }
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  // 🎫 Токени фармоиш барои дархостҳои /orders/{id}
  const orderToken = orderTokenFor(path);
  if (orderToken) headers["X-Order-Token"] = orderToken;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    setToken(null);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ========================== БОЗИҲО ==========================
export const api = {
  games: (lang: string) => request<Game[]>(`/games?lang=${lang}`),
  /** 📊 Омори воқеӣ: фармоишҳои иҷрочуда + муштариён */
  publicStats: () =>
    request<{ orders_delivered: number; users_total: number }>("/stats"),

  // ========================== ⭐ ОТЗЫВҲО ==========================
  reviews: (limit = 12) => request<Review[]>(`/reviews?limit=${limit}`),
  reviewSummary: () => request<ReviewSummary>("/reviews/summary"),
  createReview: (data: {
    rating: number;
    text: string;
    order_id?: number | null;
    author_name?: string;
  }) => request<Review>("/reviews", { method: "POST", body: JSON.stringify(data) }),
  /** 👥 Рӯйхати муштариёни воқеӣ (бо фармоиши иҷрочуда) */
  customers: (limit = 24) =>
    request<{ customers_total: number; items: { name: string; delivered: number }[] }>(
      `/customers?limit=${limit}`,
    ),
  adminReviews: () => request<AdminReviewList>("/admin/reviews"),
  moderateReview: (id: number, is_approved: boolean) =>
    request<Review>(`/admin/reviews/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_approved }),
    }),
  deleteReview: (id: number) =>
    request<void>(`/admin/reviews/${id}`, { method: "DELETE" }),
  game: (slug: string, lang: string) =>
    request<Game>(`/games/${encodeURIComponent(slug)}?lang=${lang}`),

  // ========================== 🔍 ЛОГИНИ НИК ==========================
  lookupPlayer: (slug: string, uid: string, region = "") =>
    request<PlayerLookupResponse>(
      `/games/${encodeURIComponent(slug)}/lookup?uid=${encodeURIComponent(uid)}${
        region ? `&region=${encodeURIComponent(region)}` : ""
      }`,
    ),

  // ========================== ФАРМОИШ ==========================
  createOrder: async (data: {
    game_slug: string;
    product_id: number;
    player_id: string;
    player_nickname?: string;
    /** 🌍 Минтақаи интихобшуда (CIS / BRAZIL / MLBB RUSSIA …) */
    region?: string;
    language: string;
    /** 💳 Усули пардохт: dc_wallet | balance */
    payment_method?: "dc_wallet" | "balance";
    /** 🛡️ Идемпотентность — аз донати такрорӣ */
    client_token?: string;
  }) => {
    const res = await request<PaymentInit>("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    });
    // 🎫 Нигоҳдошани токени дастрасӣ (барои саҳифаи /order/{id} бе вуруд)
    saveOrderToken(res.order_id, res.access_token);
    return res;
  },

  order: (id: number, lang = "tj") => request<Order>(`/orders/${id}?lang=${lang}`),
  orderStatus: (id: number) =>
    request<{ order_id: number; status: string }>(`/orders/${id}/status`),

  /**
   * 🧾 Фиристодани чеки пардохт (расм ё матн) — multipart/form-data.
   * Content-Type-ро дастӣ намегузорем, то браузер boundary-и худашро гузорад.
   */
  submitReceipt: async (
    id: number,
    data: { text?: string; file?: File | null; lang?: string },
  ): Promise<Order> => {
    const fd = new FormData();
    if (data.text && data.text.trim()) fd.append("text", data.text.trim());
    if (data.file) fd.append("file", data.file);
    fd.append("lang", data.lang ?? "tj");

    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const orderToken = orderTokenFor(`/orders/${id}/receipt`);
    if (orderToken) headers["X-Order-Token"] = orderToken;

    const res = await fetch(`${BASE}/orders/${id}/receipt`, {
      method: "POST",
      headers,
      body: fd,
    });

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body.detail ?? detail;
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, detail);
    }
    return (await res.json()) as Order;
  },

  // ========================== АВТОРИЗАТСИЯ ==========================
  login: async (phone: string, password: string) => {
    const res = await request<{ access_token: string; is_admin: boolean }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ phone, password }) },
    );
    setToken(res.access_token);
    return res;
  },

  register: async (data: {
    phone: string;
    password: string;
    full_name?: string;
    language?: string;
    /** 🔗 Коди даъвати дӯст (аз линки ?ref=) */
    referral_code?: string;
  }) => {
    const res = await request<{ access_token: string; is_admin: boolean }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(data) },
    );
    setToken(res.access_token);
    return res;
  },

  me: () => request<User>("/auth/me"),

  /** 🚪 Хуруҷ — токен дар сервер БЕКОР мешавад (на танҳо дар браузер) */
  logout: async () => {
    try {
      return await request<{ ok: boolean }>("/auth/logout", { method: "POST" });
    } catch {
      return { ok: false };
    }
  },

  /** 🔐 Ивазкунии парол — токени нав бармегардонад, кӯҳнаҳо бекор мешавад */
  changePassword: async (current_password: string, new_password: string) => {
    const res = await request<{ access_token: string; is_admin: boolean }>(
      "/auth/password/change",
      { method: "POST", body: JSON.stringify({ current_password, new_password }) },
    );
    setToken(res.access_token); // сеанс ҷорӣ идома меёбад
    return res;
  },

  /**
   * 🧾 Гирифтани расми чек барои админ.
   * Расмҳои чек (маълумоти корти шахсӣ) бе токени админ кушода намешавад.
   */
  fetchReceipt: async (path: string): Promise<string> => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, { headers });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  // ========================== 💳 ДАРХОСТҲОИ ПУР КАРДАН ==========================
  /** 1️⃣ Омодасозии пардохт: миқдор → линки pay.dc.tj + мӯҳлати чек (1 дақиқа) */
  prepareTopup: (amount: number) =>
    request<TopupPrepare>("/balance-requests", {
      method: "POST",
      body: JSON.stringify({ amount: String(amount) }),
    }),

  /** 2️⃣ Расми чек дар вақти муқарраршуда → Telegram-и админ */
  submitTopupReceipt: async (id: number, file: File): Promise<Topup> => {
    const fd = new FormData();
    fd.append("file", file);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}/balance-requests/${id}/receipt`, {
      method: "POST",
      headers,
      body: fd,
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body.detail ?? detail;
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, detail);
    }
    return (await res.json()) as Topup;
  },

  /** 📜 Дархостҳои худи корбар */
  myTopups: () => request<Topup[]>("/balance-requests/mine"),

  /** 📋 Рӯйхати админ (бо филтри ҳолат) */
  adminTopups: (status?: string) =>
    request<AdminTopup[]>(
      `/admin/balance-requests${status ? `?status=${status}` : ""}`,
    ),

  /** ✅ Қабули дархост → баланс + маблағ */
  adminTopupApprove: (id: number) =>
    request<{ id: number; status: string }>(
      `/admin/balance-requests/${id}/approve`,
      { method: "POST" },
    ),

  /** ❌ Радкунии дархост */
  adminTopupReject: (id: number) =>
    request<{ id: number; status: string }>(
      `/admin/balance-requests/${id}/reject`,
      { method: "POST" },
    ),

  // ========================== 💰 БАЛАНС ==========================
  myBalance: () => request<BalanceInfo>("/auth/me/balance"),
  myOrders: (lang = "tj") => request<Order[]>(`/orders/my?lang=${lang}`),

  // ========================== 🪙 PERS COINS ==========================
  /** Тангаҳо + қоидаҳои ҳисоб + коди даъват + таърих */
  myCoins: () => request<CoinsInfo>("/coins/me"),
  /** 💱 Ивази танга ба баланс (танҳо адади куллӣ, N танга = 1 сомонӣ — аз .env) */
  exchangeCoins: () =>
    request<CoinsExchange>("/coins/exchange", { method: "POST" }),

  // ========================== 🎡 ЧАРХ ==========================
  /** Сегментҳо + эҳтимолиётҳои воқеӣ + бурди охирин (оммавӣ) */
  wheel: () => request<WheelData>("/coins/wheel"),
  /** Як гардиш (SPIN_COST_COINS танга) — ҷоиза дар backend ҳисоб мешавад */
  spinWheel: () => request<WheelSpin>("/coins/spin", { method: "POST" }),

  // ========================== АДМИН ==========================
  stats: () => request<AdminStats>("/admin/stats"),
  adminOrders: (status?: string) =>
    request<Order[]>(`/admin/orders${status ? `?status=${status}` : ""}`),
  updateOrder: (id: number, status: string) =>
    request<Order>(`/admin/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // 👥 Корбарон + баланс
  adminUsers: () => request<AdminUser[]>("/admin/users"),
  addBalance: (userId: number, amount: number, reason?: string) =>
    request<AdminUser>(`/admin/users/${userId}/balance`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, amount, reason }),
    }),
  userTransactions: (userId: number) =>
    request<BalanceTx[]>(`/admin/users/${userId}/transactions`),
  adminGames: () => request<Game[]>("/admin/games"),
  adminGame: (slug: string) => request<Game>(`/admin/games/${slug}`),
  createGame: (data: Record<string, unknown>) =>
    request<Game>("/admin/games", { method: "POST", body: JSON.stringify(data) }),
  createProduct: (data: Record<string, unknown>) =>
    request<{ id: number }>("/admin/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateProduct: (id: number, data: Record<string, unknown>) =>
    request<{ id: number }>(`/admin/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteProduct: (id: number) =>
    request<{ ok: boolean }>(`/admin/products/${id}`, { method: "DELETE" }),
  // 🔥 FireLoot — баланс, каталоги воқеӣ, ҳамоҳангсозӣ (танҳо админ)
  flBalance: () => request<FirelootBalance>("/admin/fireloot/balance"),
  flCatalog: () => request<FirelootCatalog>("/admin/fireloot/catalog"),
  flSync: () =>
    request<{ created: number; adopted: number; attached: number }>(
      "/admin/fireloot/sync",
      { method: "POST" },
    ),
};

export { ApiError };
