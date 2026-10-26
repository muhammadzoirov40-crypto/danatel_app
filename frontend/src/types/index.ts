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
  /** 🎫 Токени дастрасӣ барои мизоҷи бе вуруд */
  access_token?: string | null;
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

/** 🪙 Як сатри таърихи тангаҳо (Pers Coins) */
export interface CoinTx {
  id: number;
  kind: string;
  amount: number;
  coins_after: number;
  reason?: string | null;
  created_at: string;
}

/** 🪙 Тангаҳои корбар + қоидаҳои ҳисоб (аз backend) */
export interface CoinsInfo {
  coins: number;
  coins_per_tjs: number;
  exchange_rate: number;
  min_exchange: number;
  spin_cost: number;
  referral_code: string;
  referred_count: number;
  history: CoinTx[];
}

/** 🪙 Натиҷаи ивази танга ба баланс */
export interface CoinsExchange {
  coins: number;
  balance: number;
  credited_tjs: number;
  spent_coins: number;
}

/** 🎡 Як сегменти чарх — эҳтимолиёт аз вазнҳои сервер */
export interface WheelSegment {
  coins: number;
  weight: number;
  probability: number;
  jackpot: boolean;
}

/** 🎡 Бурди охирини корбарони дигар (танҳо сатрҳои воқеии DB) */
export interface WheelRecentWin {
  id: number;
  name: string;
  coins: number;
  created_at: string;
}

/** 🎡 Маълумоти чарх (оммавӣ, бе маълумоти шахсӣ) */
export interface WheelData {
  cost: number;
  exchange_rate: number;
  min_exchange: number;
  total_spins: number;
  segments: WheelSegment[];
  recent_wins: WheelRecentWin[];
}

/** 🎡 Натиҷаи як гардиш — ҷоиза танҳо аз backend меояд */
export interface WheelSpin {
  prize: number;
  jackpot: boolean;
  cost: number;
  coins_after: number;
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

import {
  Ban,
  CircleCheck,
  CircleX,
  Clock,
  Gamepad2,
  Minus,
  Plus,
  ReceiptText,
  Undo2,
  type LucideIcon,
} from "lucide-react";

/** Усули пардохт */
export type PaymentMethodType = "dc_wallet" | "balance";

/** Нишонаҳои тағйироти баланс — иконкаи касбӣ (Lucide), на emoji */
export const TX_META: Record<
  TxKind,
  { cls: string; icon: LucideIcon; key: string }
> = {
  credit: { cls: "bg-emerald-100 text-emerald-800", icon: Plus, key: "credit" },
  debit: { cls: "bg-rose-100 text-rose-800", icon: Minus, key: "debit" },
  refund: { cls: "bg-sky-100 text-sky-800", icon: Undo2, key: "refund" },
};

/** ⭐ Отзиви воқеӣ (танҳо тасдиқшуда нишон дода мешавад) */
export interface Review {
  id: number;
  author_name: string;
  rating: number;
  text: string;
  created_at: string;
}

export interface ReviewSummary {
  rating_avg: number;
  reviews_total: number;
  can_review: boolean;
  my_review_id: number | null;
}

/** Маълумоти админ барои санҷиши отзывҳо */
export interface AdminReview {
  id: number;
  author_name: string;
  rating: number;
  text: string;
  is_approved: boolean;
  order_id: number | null;
  created_at: string | null;
}

export interface AdminReviewList {
  rating_avg: number;
  reviews_total: number;
  pending: number;
  items: AdminReview[];
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

/** Рангҳои статус + иконкаи касбӣ + калиди тарҷума */
export const STATUS_META: Record<
  OrderStatus,
  { icon: LucideIcon; cls: string; key: string }
> = {
  pending: { icon: Clock, cls: "bg-amber-100 text-amber-800", key: "waitingPayment" },
  checking: { icon: ReceiptText, cls: "bg-indigo-100 text-indigo-800", key: "checkingReceipt" },
  paid: { icon: CircleCheck, cls: "bg-emerald-100 text-emerald-800", key: "paid" },
  delivered: { icon: Gamepad2, cls: "bg-sky-100 text-sky-800", key: "delivered" },
  failed: { icon: CircleX, cls: "bg-rose-100 text-rose-800", key: "failed" },
  refunded: { icon: Undo2, cls: "bg-slate-100 text-slate-700", key: "refunded" },
  cancelled: { icon: Ban, cls: "bg-slate-100 text-slate-600", key: "cancelled" },
};

/** 🔍 Натиҷаи логини Player ID */
export interface PlayerLookupResponse {
  found: boolean;
  uid: string;
  game: string;
  nickname: string;
  region: string;
  message: string;
}
