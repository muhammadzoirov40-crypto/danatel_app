import type { OrderStatus } from "../types";
import { useApp } from "../context/AppContext";

const MAP: Record<OrderStatus, { key: string; cls: string; icon: string }> = {
  pending: { key: "waitingPayment", cls: "bg-amber-100 text-amber-800", icon: "⏳" },
  paid: { key: "paid", cls: "bg-emerald-100 text-emerald-800", icon: "✅" },
  delivered: { key: "delivered", cls: "bg-sky-100 text-sky-800", icon: "🎮" },
  failed: { key: "failed", cls: "bg-rose-100 text-rose-800", icon: "❌" },
  refunded: { key: "refunded", cls: "bg-slate-100 text-slate-700", icon: "💰" },
  cancelled: { key: "cancelled", cls: "bg-slate-100 text-slate-600", icon: "🚫" },
};

/** Бейҷи статуси фармоиш */
export default function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useApp();
  const meta = MAP[status] ?? MAP.pending;

  return (
    <span className={`badge ${meta.cls}`}>
      <span>{meta.icon}</span>
      {t(meta.key)}
    </span>
  );
}
