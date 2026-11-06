import { useEffect, useState } from "react";
import {
  CircleCheck,
  CirclePlus,
  Clock,
  Gamepad2,
  Info,
  Package,
  PiggyBank,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { api } from "../../api/client";
import type { AdminStats, ProfitStats } from "../../types";
import { useApp } from "../../context/AppContext";
import { Ic } from "../../components/Icons";

/** Омори умумӣ */
export default function Dashboard() {
  const { t } = useApp();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [profit, setProfit] = useState<ProfitStats | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((e) => setErr((e as Error)?.message ?? t("error")));
    // 💲 фоида — хатогӣ → садо намедиҳад (қисми боқимонда кор мекунад)
    api
      .profitStats()
      .then(setProfit)
      .catch(() => {});
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

  const cards: { label: string; value: string; icon: LucideIcon; tone: string }[] = [
    {
      label: t("revenueToday"),
      value: `${stats.revenue_today_tjs.toLocaleString("tj-TJ")} ${t("currency")}`,
      icon: Wallet,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: t("revenue"),
      value: `${stats.revenue_total_tjs.toLocaleString("tj-TJ")} ${t("currency")}`,
      icon: TrendingUp,
      tone: "bg-brand-50 text-brand-700",
    },
    /* 💲 ФОИДА = даромад − нархи харид (танҳо маҳсулотҳои бо cost_tjs) */
    {
      label: t("profitToday"),
      value: profit
        ? `${profit.profit_today_tjs.toLocaleString("tj-TJ")} ${t("currency")}`
        : "…",
      icon: PiggyBank,
      tone: "bg-teal-50 text-teal-700",
    },
    {
      label: t("profitTotal"),
      value: profit
        ? `${profit.profit_total_tjs.toLocaleString("tj-TJ")} ${t("currency")}`
        : "…",
      icon: PiggyBank,
      tone: "bg-teal-100 text-teal-800",
    },
    { label: t("ordersToday"), value: String(stats.orders_today), icon: CirclePlus, tone: "bg-sky-50 text-sky-700" },
    { label: t("ordersTotal"), value: String(stats.orders_total), icon: Package, tone: "bg-slate-100 text-slate-700" },
    { label: t("pending"), value: String(stats.orders_pending), icon: Clock, tone: "bg-amber-50 text-amber-700" },
    { label: t("paid"), value: String(stats.orders_paid), icon: CircleCheck, tone: "bg-emerald-50 text-emerald-700" },
    { label: t("delivered"), value: String(stats.orders_delivered), icon: Gamepad2, tone: "bg-sky-50 text-sky-700" },
    { label: t("users"), value: String(stats.users_total), icon: Users, tone: "bg-violet-50 text-violet-700" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={`card p-4 ${c.tone}`}>
            <div className="mb-1 opacity-80">
              <Ic icon={c.icon} size="lg" strokeWidth={1.75} />
            </div>
            <div className="text-lg sm:text-xl font-bold leading-tight break-words">
              {c.value}
            </div>
            <div className="text-xs opacity-80 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* 💲 Таъкид: фоида танҳо бо нархи харид ҳисоб мешавад */}
      {profit && profit.costed_products === 0 && (
        <div className="card inline-flex items-start gap-2 border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          <Ic icon={Info} size="xs" className="mt-0.5 shrink-0" />
          <span>{t("profitNoCost")}</span>
        </div>
      )}
    </div>
  );
}
