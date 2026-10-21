import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";
import type { Order } from "../types";
import { STATUS_META } from "../types";

/**
 * 👤 Профили корбар:
 *   - Баланси ҷорӣ бо сомонӣ
 *   - Таърихи фармоишҳо
 */
export default function Profile() {
  const { t, lang, user, balance, isAdmin, logout } = useApp();
  const nav = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState("");

  // Агар вуруд накарда бошад → ба саҳифаи вуруд
  useEffect(() => {
    if (!user) nav("/login", { replace: true });
  }, [user, nav]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      // Фармоишҳои корбари ҷорӣ
      const all = await api.myOrders();
      setOrders(all);
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    }
  }, [user, t]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* Сарлавҳа + баланс */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-4xl mb-2">👤</div>
            <h1 className="text-xl font-bold">
              {user.full_name || user.username || `#${user.id}`}
            </h1>
            {user.phone && (
              <p className="text-sm text-slate-500 mt-0.5">📱 {user.phone}</p>
            )}
            {isAdmin && (
              <span className="inline-block mt-2 rounded-lg bg-brand-100 text-brand-700 text-xs px-2 py-0.5">
                ⚙️ {t("admin")}
              </span>
            )}
          </div>

          {/* 💰 Баланси ҷорӣ */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-5 py-4 min-w-[180px]">
            <div className="text-xs opacity-90">💰 {t("balance")}</div>
            <div className="text-3xl font-bold tabular-nums mt-1">
              {balance.toLocaleString("tj-TJ")}
            </div>
            <div className="text-sm opacity-90">{t("currency")}</div>
          </div>
        </div>

        <div className="mt-5 flex gap-2 flex-wrap">
          <Link to="/" className="btn-primary text-sm">
            🎮 {t("chooseGame")}
          </Link>
          {isAdmin && (
            <Link to="/admin" className="btn-ghost text-sm">
              🛠️ {t("adminPanel")}
            </Link>
          )}
          <button
            onClick={() => {
              logout();
              nav("/");
            }}
            className="btn-ghost text-sm"
          >
            ⎋ {t("logout")}
          </button>
        </div>
      </div>

      {/* 📦 Фармоишҳо */}
      <div className="card p-6">
        <h2 className="font-bold mb-4">📦 {t("orders")}</h2>

        {err && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-4">
            {err}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <div className="text-3xl mb-2">📭</div>
            {t("noOrders")}
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const meta = STATUS_META[o.status];
              return (
                <Link
                  key={o.id}
                  to={`/order/${o.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 hover:border-brand-300 transition"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">
                      #{o.id} — {o.game_name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {o.product_name} ·{" "}
                      {new Date(o.created_at).toLocaleDateString(lang)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm">
                      {Number(o.amount_tjs).toLocaleString("tj-TJ")}{" "}
                      {t("currency")}
                    </div>
                    <span
                      className={`inline-block mt-1 rounded-lg text-[11px] px-2 py-0.5 ${meta.cls}`}
                    >
                      {meta.label} {t(meta.key)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
