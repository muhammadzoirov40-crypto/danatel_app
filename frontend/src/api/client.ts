/**
 * Клиенти API — пайваст бо FastAPI backend.
 * Ҳамаи дархостҳо ба /api мераванд (Vite proxy).
 */
import type {
  AdminStats,
  Game,
  Order,
  PaymentInit,
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
  game: (slug: string, lang: string) =>
    request<Game>(`/games/${encodeURIComponent(slug)}?lang=${lang}`),

  // ========================== ФАРМОИШ ==========================
  createOrder: (data: {
    game_slug: string;
    product_id: number;
    player_id: string;
    player_nickname?: string;
    language: string;
  }) =>
    request<PaymentInit>("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  order: (id: number, lang = "tj") => request<Order>(`/orders/${id}?lang=${lang}`),
  orderStatus: (id: number) =>
    request<{ order_id: number; status: string }>(`/orders/${id}/status`),

  // ========================== АДМИН ==========================
  login: async (phone: string, password: string) => {
    const res = await request<{ access_token: string; is_admin: boolean }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ phone, password }) },
    );
    setToken(res.access_token);
    return res;
  },

  stats: () => request<AdminStats>("/admin/stats"),
  adminOrders: (status?: string) =>
    request<Order[]>(`/admin/orders${status ? `?status=${status}` : ""}`),
  updateOrder: (id: number, status: string) =>
    request<Order>(`/admin/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
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
