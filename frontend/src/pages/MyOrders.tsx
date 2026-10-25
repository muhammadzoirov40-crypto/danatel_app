import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Inbox, Loader2, PackageOpen, RefreshCw } from "lucide-react";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";
import type { Order } from "../types";
import StatusBadge from "../components/StatusBadge";
import { Ic } from "../components/Icons";

/**
 * 📦 ФАРМОИШҲОИ МАН — саҳифаи алоҳидаи ТАНҲО фармоишҳои корбари ҷорӣ.
 *
 * Аз сарлавҳа («Фармоишҳои ман») бевосита ба ин ҷо меафтомад,
 * на ба профил (таъхири талаботи корбар).
 *
 * Ҳеҷ маълумоти сохта нест: ҳама аз `GET /api/orders/my`,
 * статусҳо аз ягонаи манбаи `STATUS_META`.
 */
export default function MyOrders() {
  const { t, lang, user, authReady } = useApp();
  const nav = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  // Ҳангоми боргирии аввалия анҷом ёфт → агар вуруд накарда бошад, ба /login
  useEffect(() => {
    if (!user && authReady) nav("/login", { replace: true });
  }, [user, authReady, nav]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErr("");
    try {
      setOrders(await api.myOrders());
    } catch (e) {
      setErr((e as Error)?.message || t("error"));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Скелетон ҲАМЕША пас аз `authReady` → дар саҳифаи холӣ намеистад
  if (!user) {
    if (authReady) return null; // → эффект боло ба `/login` меафтонад
    return (
      <div className="profile-soft min-h-[calc(100vh-4rem)]">
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
          <div className="card h-12 w-64 animate-pulse bg-slate-100" aria-hidden />
          <div className="card h-40 animate-pulse bg-slate-100" aria-hidden />
          <div className="card h-40 animate-pulse bg-slate-100" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="profile-soft min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        {/* ===== САРЛАВҲА ===== */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            {t("myOrders")}
          </h1>
          {!loading && !err && (
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {orders.length} / {t("orders")}
            </span>
          )}
        </div>

        {err && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            <div>{err}</div>
            <button type="button" onClick={() => void load()} className="btn-ghost mt-2 text-sm">
              <Ic icon={RefreshCw} />
              {t("loading")}
            </button>
          </div>
        )}

        {/* ===== БОРГИРӢ ===== */}
        {loading && (
          <div
            className="card flex items-center justify-center gap-2 py-10 text-sm text-slate-500"
            role="status"
          >
            <Ic icon={Loader2} className="animate-spin" />
            {t("loading")}
          </div>
        )}

        {/* ===== ХОЛИӢ ===== */}
        {!loading && !err && orders.length === 0 && (
          <div className="card py-12 text-center">
            <div className="mb-3 flex justify-center text-slate-300 dark:text-slate-600">
              <Ic icon={PackageOpen} size="xl" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("noOrders")}
            </p>
            <Link to="/" className="btn-primary mt-4 text-sm">
              <Ic icon={Inbox} />
              {t("chooseGame")}
            </Link>
          </div>
        )}

        {/* ===== РӶЙХАТИ ФАРМОИШҲО ===== */}
        {!loading && orders.length > 0 && (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/order/${o.id}`}
                  className="card flex items-center justify-between gap-3 p-4 transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      #{o.id} — {o.game_name}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {o.product_name}
                      {o.player_id ? ` · ID: ${o.player_id}` : ""} ·{" "}
                      {new Date(o.created_at).toLocaleDateString(lang)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold tabular-nums">
                      {Number(o.amount_tjs).toLocaleString("tj-TJ")}{" "}
                      {t("currency")}
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
