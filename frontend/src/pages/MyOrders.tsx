import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Copy, Gamepad2, Inbox, Loader2, PackageOpen, RefreshCw } from "lucide-react";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";
import type { Order } from "../types";
import StatusBadge from "../components/StatusBadge";
import BackButton from "../components/BackButton";
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
  const [copiedPid, setCopiedPid] = useState<string | null>(null);

  // 🎮 IDҳои бозӣ — аз фармоишҳои воқеӣ (ягона, бе такрор).
  // Аз профил ба ин ҷо оварда шуд (талаби корбар).
  const gameIds = useMemo(() => {
    const seen = new Map<string, { id: string; game: string }>();
    for (const o of orders) {
      const pid = (o.player_id || "").trim();
      if (pid && !seen.has(pid)) {
        seen.set(pid, { id: pid, game: o.game_name || "" });
      }
    }
    return [...seen.values()];
  }, [orders]);

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
        {/* ⬅️ Тугмаи бозгашт (услуби якхела дар ҳамаи саҳифаҳо) */}
        <BackButton />
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

        {/* 🎮 IDҲОИ БОЗИИ МАН — аз профил ба ин ҷо оварда шуд (талаби корбар):
            ягона, бе такрор; ҳар як ID бо тугмаи нусха */}
        {!loading && !err && gameIds.length > 0 && (
          <section className="card p-4" aria-label={t("gameIds")}>
            <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-slate-700 dark:text-slate-200">
              <Ic icon={Gamepad2} className="text-brand-600" />
              {t("gameIds")}
            </h2>
            <ul className="mt-3 space-y-2">
              {gameIds.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-white/10"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold tabular-nums break-all">
                      {g.id}
                    </div>
                    {g.game && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {g.game}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(g.id)
                        .then(() => {
                          setCopiedPid(g.id);
                          setTimeout(() => setCopiedPid(null), 1500);
                        })
                        .catch(() => undefined);
                    }}
                    aria-label={`${t("copy")}: ${g.id}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:bg-white/10 dark:text-slate-300"
                  >
                    <Ic
                      icon={copiedPid === g.id ? Check : Copy}
                      size="sm"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
