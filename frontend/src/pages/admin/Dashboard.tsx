import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { AdminStats } from "../../types";
import { useApp } from "../../context/AppContext";

/** Омори умумӣ */
export default function Dashboard() {
  const { t } = useApp();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((e) => setErr((e as Error)?.message ?? t("error")));
  }, [t]);

  if (err) return <div className="card p-6 text-rose-600">{err}</div>;
  if (!stats)
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card h-24 animate-pulse bg-slate-100" />
        ))}
      </div>
    );

  const cards: { label: string; value: string; icon: string; tone: string }[] = [
    {
      label: t("revenueToday"),
      value: `${stats.revenue_today_tjs.toLocaleString("tj-TJ")} ${t("currency")}`,
      icon: "💰",
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: t("revenue"),
      value: `${stats.revenue_total_tjs.toLocaleString("tj-TJ")} ${t("currency")}`,
      icon: "📈",
      tone: "bg-brand-50 text-brand-700",
    },
    { label: t("ordersToday"), value: String(stats.orders_today), icon: "🆕", tone: "bg-sky-50 text-sky-700" },
    { label: t("ordersTotal"), value: String(stats.orders_total), icon: "📦", tone: "bg-slate-100 text-slate-700" },
    { label: t("pending"), value: String(stats.orders_pending), icon: "⏳", tone: "bg-amber-50 text-amber-700" },
    { label: t("paid"), value: String(stats.orders_paid), icon: "✅", tone: "bg-emerald-50 text-emerald-700" },
    { label: t("delivered"), value: String(stats.orders_delivered), icon: "🎮", tone: "bg-sky-50 text-sky-700" },
    { label: t("users"), value: String(stats.users_total), icon: "👥", tone: "bg-violet-50 text-violet-700" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className={`card p-4 ${c.tone}`}>
          <div className="text-2xl mb-1">{c.icon}</div>
          <div className="text-lg sm:text-xl font-bold leading-tight break-words">
            {c.value}
          </div>
          <div className="text-xs opacity-80 mt-1">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
