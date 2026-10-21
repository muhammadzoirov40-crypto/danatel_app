/** Типҳои муштарак барои API ва UI */
export type Lang = "tj" | "ru" | "en" | "uz";

export interface Product {
  id: number;
  name: string;
  price_tjs: number;
  amount: number;
  is_popular?: boolean;
  is_active?: boolean;
}

export interface Game {
  id: number;
  slug: string;
  name: string;
  emoji: string;
  currency: string;
  requires_player_id: boolean;
  player_id_label: string;
  image_url?: string | null;
  /** Фазои дохилӣ барои лого (px) */
  image_pad?: number;
  products?: Product[];
}

export type OrderStatus =
  | "pending"
  | "paid"
  | "delivered"
  | "failed"
  | "refunded"
  | "cancelled";

export interface Order {
  id: number;
  status: OrderStatus;
  amount_tjs: number;
  player_id: string;
  payment_method: string;
  dc_payment_url?: string | null;
  created_at: string;
  game_name?: string;
  product_name?: string;
}

export interface PaymentInit {
  order_id: number;
  status: OrderStatus;
  payment_url?: string | null;
  invoice_id?: string | null;
  amount_tjs: number;
  message: string;
}

export interface AdminStats {
  orders_total: number;
  orders_today: number;
  orders_pending: number;
  orders_paid: number;
  orders_delivered: number;
  orders_failed: number;
  revenue_total_tjs: number;
  revenue_today_tjs: number;
  users_total: number;
  games_active: number;
}

/** Рангҳои статус + калиди тарҷума */
export const STATUS_META: Record<
  OrderStatus,
  { label: string; cls: string; key: string }
> = {
  pending: { label: "⏳", cls: "bg-amber-100 text-amber-800", key: "waitingPayment" },
  paid: { label: "✅", cls: "bg-emerald-100 text-emerald-800", key: "paid" },
  delivered: { label: "🎮", cls: "bg-sky-100 text-sky-800", key: "delivered" },
  failed: { label: "❌", cls: "bg-rose-100 text-rose-800", key: "failed" },
  refunded: { label: "💰", cls: "bg-slate-100 text-slate-700", key: "refunded" },
  cancelled: { label: "🚫", cls: "bg-slate-100 text-slate-600", key: "cancelled" },
};
