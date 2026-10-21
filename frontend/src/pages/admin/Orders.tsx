import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Order, OrderStatus } from "../../types";
import { STATUS_META } from "../../types";
import { useApp } from "../../context/AppContext";

const FILTERS: (OrderStatus | "all")[] = [
  "all",
  "pending",
  "paid",
  "delivered",
  "failed",
];

/** Идораи фармоишҳо */
export default function Orders() {
  const { t } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.adminOrders(filter === "all" ? undefined : filter);
      setOrders(d);
      setErr("");
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: number, status: OrderStatus) => {
    setBusy(id);
    try {
      await api.updateOrder(id, status);
      await load();
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Филтрҳо */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn text-xs whitespace-nowrap ${
              filter === f
                ? "bg-brand-600 text-white"
                : "bg-white border border-slate-200 text-slate-700"
            }`}
          >
            {f === "all" ? "🌐 " + t("orders") : STATUS_META[f as OrderStatus].label}{" "}
            {f === "all" ? "" : t(STATUS_META[f as OrderStatus].key ?? "status")}
          </button>
        ))}
      </div>

      {err && <div className="card p-4 text-rose-600 text-sm">{err}</div>}

      {/* Мобилӣ: корт — Десктоп: ҷадвал */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card h-16 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          <div className="text-3xl mb-2">📭</div>
          {t("noOrders")}
        </div>
      ) : (
        <>
          {/* Десктоп */}
          <div className="card hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">{t("game")}</th>
                  <th className="text-left px-4 py-3">{t("product")}</th>
                  <th className="text-left px-4 py-3">Player ID</th>
                  <th className="text-right px-4 py-3">{t("amount")}</th>
                  <th className="text-left px-4 py-3">{t("status")}</th>
                  <th className="text-right px-4 py-3">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono">#{o.id}</td>
                    <td className="px-4 py-3">{o.game_name}</td>
                    <td className="px-4 py-3">{o.product_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{o.player_id}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {Number(o.amount_tjs).toLocaleString("tj-TJ")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_META[o.status].cls}`}>
                        {STATUS_META[o.status].label} {t(STATUS_META[o.status].key ?? "status")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActions order={o} busy={busy === o.id} onSet={setStatus} t={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Мобилӣ */}
          <div className="md:hidden space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold">#{o.id}</span>
                  <span className={`badge ${STATUS_META[o.status].cls}`}>
                    {STATUS_META[o.status].label} {t(STATUS_META[o.status].key ?? "status")}
                  </span>
                </div>
                <div className="text-sm text-slate-600 space-y-1">
                  <div>
                    {o.game_name} — {o.product_name}
                  </div>
                  <div className="font-mono text-xs">ID: {o.player_id}</div>
                  <div className="font-semibold text-brand-700">
                    {Number(o.amount_tjs).toLocaleString("tj-TJ")} {t("currency")}
                  </div>
                </div>
                <div className="mt-3">
                  <RowActions order={o} busy={busy === o.id} onSet={setStatus} t={t} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RowActions({
  order,
  busy,
  onSet,
  t,
}: {
  order: Order;
  busy: boolean;
  onSet: (id: number, s: OrderStatus) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="flex gap-1.5 justify-end flex-wrap">
      {order.status !== "delivered" && (
        <button
          disabled={busy}
          onClick={() => onSet(order.id, "delivered")}
          className="btn bg-sky-600 text-white text-xs px-3 py-1.5 hover:bg-sky-700"
        >
          🎮 {t("markDelivered")}
        </button>
      )}
      {order.status === "pending" && (
        <button
          disabled={busy}
          onClick={() => onSet(order.id, "failed")}
          className="btn-danger text-xs px-3 py-1.5"
        >
          ❌
        </button>
      )}
    </div>
  );
}
