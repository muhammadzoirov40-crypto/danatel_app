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
  /** 📊 Барои промо-картоҳои саҳифаи асосӣ */
  min_price_tjs?: number | null;
  products_count?: number;
  is_popular?: boolean;
}

export type OrderStatus =
  | "pending"
  | "checking"
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
  /** 🧾 Чеки пардохт (расм/матн) аз корбар */
  receipt_file?: string | null;
  receipt_text?: string | null;
  /** 💳 Маълумоти пардохти берунӣ */
  payment_link?: string | null;
  payment_card?: string | null;
  payment_phone?: string | null;
}

export interface PaymentInit {
  order_id: number;
  status: OrderStatus;
  payment_url?: string | null;
  invoice_id?: string | null;
  amount_tjs: number;
  message: string;
}

export interface User {
  id: number;
  phone?: string | null;
  username?: string | null;
  full_name?: string | null;
  language: Lang;
  is_admin: boolean;
  /** 💰 Баланси ҷорӣ бо сомонӣ */
  balance: number;
  created_at: string;
}

export interface BalanceInfo {
  user_id: number;
  balance: number;
}

export type TxKind = "credit" | "debit" | "refund";

export interface BalanceTx {
  id: number;
  user_id: number;
  admin_id?: number | null;
  kind: TxKind;
  amount: number;
  balance_after: number;
  reason?: string | null;
  order_id?: number | null;
  created_at: string;
  admin_name?: string | null;
}

export interface AdminUser {
  id: number;
  phone?: string | null;
  username?: string | null;
  full_name?: string | null;
  language: Lang;
  is_admin: boolean;
  balance: number;
  orders_count: number;
  created_at: string;
}

/** Усули пардохт */
export type PaymentMethodType = "dc_wallet" | "balance";

export const TX_META: Record<TxKind, { cls: string; icon: string; key: string }> = {
  credit: { cls: "bg-emerald-100 text-emerald-800", icon: "➕", key: "credit" },
  debit: { cls: "bg-rose-100 text-rose-800", icon: "➖", key: "debit" },
  refund: { cls: "bg-sky-100 text-sky-800", icon: "🔄", key: "refund" },
};

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
  checking: { label: "🧾", cls: "bg-indigo-100 text-indigo-800", key: "checkingReceipt" },
  paid: { label: "✅", cls: "bg-emerald-100 text-emerald-800", key: "paid" },
  delivered: { label: "🎮", cls: "bg-sky-100 text-sky-800", key: "delivered" },
  failed: { label: "❌", cls: "bg-rose-100 text-rose-800", key: "failed" },
  refunded: { label: "💰", cls: "bg-slate-100 text-slate-700", key: "refunded" },
  cancelled: { label: "🚫", cls: "bg-slate-100 text-slate-600", key: "cancelled" },
};
