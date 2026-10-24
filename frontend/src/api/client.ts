/**
 * Клиенти API — пайваст бо FastAPI backend.
 * Ҳамаи дархостҳо ба /api мераванд (Vite proxy).
 */
import type {
  AdminReview,
  AdminReviewList,
  AdminStats,
  AdminUser,
  BalanceInfo,
  BalanceTx,
  Game,
  Order,
  PaymentInit,
  PlayerLookupResponse,
  Review,
  ReviewSummary,
  User,
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
  lookupPlayer: (slug: string, uid: string) =>
    request<PlayerLookupResponse>(
      `/games/${encodeURIComponent(slug)}/lookup?uid=${encodeURIComponent(uid)}`,
    ),

  // ========================== ФАРМОИШ ==========================
  createOrder: (data: {
    game_slug: string;
    product_id: number;
    player_id: string;
    player_nickname?: string;
    language: string;
    /** 💳 Усули пардохт: dc_wallet | balance */
    payment_method?: "dc_wallet" | "balance";
    /** 🛡️ Идемпотентность — аз донати такрорӣ */
    client_token?: string;
  }) =>
    request<PaymentInit>("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

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
  }) => {
    const res = await request<{ access_token: string; is_admin: boolean }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(data) },
    );
    setToken(res.access_token);
    return res;
  },

  me: () => request<User>("/auth/me"),

  // ========================== 💰 БАЛАНС ==========================
  myBalance: () => request<BalanceInfo>("/auth/me/balance"),
  myOrders: (lang = "tj") => request<Order[]>(`/orders/my?lang=${lang}`),

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
};

export { ApiError };
