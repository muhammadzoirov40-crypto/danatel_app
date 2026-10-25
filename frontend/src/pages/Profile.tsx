import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  CircleCheck,
  CircleX,
  Copy,
  Gamepad2,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Package,
  Save,
  Smartphone,
  User,
  Wallet,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { api, ApiError } from "../api/client";
import type { Order } from "../types";
import { STATUS_META } from "../types";
import { Ic } from "../components/Icons";
import Customers from "../components/Customers";

/**
 * 👤 ПРОФИЛИ КОРБАР (мувофиқи тарҳи дахлдор):
 *   1) Заминаи мулоими кабуди градиентӣ (`.profile-soft`)
 *   2) Корт: аватар + ном + телефон бо тугмаи «нусха» + бейҷи кабуди «Админ»
 *      → дар рост: блоки сабзи баланс «0 сомонӣ»
 *   3) Се тугма: Бозиро барои донат интихоб кунед · Панели идора · Баромад
 *   4) Корт: «Иваз кардани парол» (3 майдон)
 *   5) Фармоишҳои воқеӣ + Муштариёни воқеӣ
 *
 * Ҳеҷ маълумоти сохта нест: ном/телефон/баланс/бейҷи «Админ» ҳама аз `me`,
 * фармоишҳо аз `/api/orders/my`, муштариён аз фармоишҳои иҷрочуда.
 */
export default function Profile() {
  const { t, lang, user, balance, isAdmin, authReady, logout } = useApp();
  const nav = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState("");
  const [phoneCopied, setPhoneCopied] = useState(false);

  // 📋 Нусхаи рақами телефон (маҳаллӣ — ягон дархост ба сервер намеравад)
  const copyPhone = async () => {
    if (!user?.phone) return;
    try {
      await navigator.clipboard.writeText(user.phone);
      setPhoneCopied(true);
      setTimeout(() => setPhoneCopied(false), 1800);
    } catch {
      /* иҷозат нест — нодида гирифта мешавад */
    }
  };

  // 🔐 Ивазкунии парол
  const [pwdCur, setPwdCur] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdCheck, setPwdCheck] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdOk, setPwdOk] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdMsg("");
    if (pwdNew.length < 8) {
      setPwdOk(false);
      setPwdMsg(t("passwordShort"));
      return;
    }
    if (pwdNew !== pwdCheck) {
      setPwdOk(false);
      setPwdMsg(t("passwordMismatch"));
      return;
    }
    setPwdBusy(true);
    try {
      await api.changePassword(pwdCur, pwdNew);
      setPwdOk(true);
      setPwdMsg(t("passwordChanged"));
      setPwdCur("");
      setPwdNew("");
      setPwdCheck("");
    } catch (e2) {
      setPwdOk(false);
      setPwdMsg(
        e2 instanceof ApiError && e2.status === 403
          ? t("wrongCurrentPassword")
          : e2 instanceof ApiError
            ? e2.message
            : t("error"),
      );
    } finally {
      setPwdBusy(false);
    }
  };

  // Агар токен набошад ё вуруд накарда бошад → ба саҳифаи вуруд.
  // ⚠️ Танҳо пас аз анҷоми боргирии аввалия (`authReady`) — вагарна F5 бо
  //    токени дуруст ҳангоми боргирӣ ба `/login` партофта мешуд.
  useEffect(() => {
    if (!user && authReady) nav("/login", { replace: true });
  }, [user, authReady, nav]);

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

  // Ҳангоми боргирии аввалия → скелетон (на саҳифаи холӣ, на партофт)
  if (!user) {
    if (authReady) return null; // → эффект боло ба `/login` меафтонад
    return (
      <div className="profile-soft min-h-[calc(100vh-4rem)]">
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
          <div className="card h-44 animate-pulse bg-slate-100" aria-hidden />
          <div className="card h-64 animate-pulse bg-slate-100" aria-hidden />
        </div>
      </div>
    );
  }

  const displayName = user.full_name || user.username || `#${user.id}`;
  const initial = displayName.trim().charAt(0).toUpperCase();

  return (
    /* 🌅 Заминаи мулоими кабуди градиентӣ (дар торик — таркиби торик) */
    <div className="profile-soft min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {/* ===== 1️⃣ КАРТОЧКАИ ПРОФИЛ ===== */}
        <section className="card p-6" aria-labelledby="profile-name">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Аватар + ном + телефон + бейҷа */}
            <div className="flex items-center gap-4 min-w-0">
              <div
                aria-hidden
                className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-2xl font-black select-none"
              >
                {initial ? (
                  initial
                ) : (
                  <Ic icon={User} size="xl" strokeWidth={1.75} />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 id="profile-name" className="text-xl font-bold truncate">
                    {displayName}
                  </h1>
                  {isAdmin && (
                    <span className="inline-flex items-center rounded-full bg-brand-600 text-white text-[11px] font-bold px-2.5 py-1">
                      {t("admin")}
                    </span>
                  )}
                </div>

                {user.phone && (
                  <button
                    type="button"
                    onClick={copyPhone}
                    aria-label={`${t("copy")}: ${user.phone}`}
                    className="mt-1 -mx-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm text-slate-500 transition hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                  >
                    <Ic icon={Smartphone} className="text-slate-400" />
                    <span className="tabular-nums break-all">
                      {user.phone}
                    </span>
                    <Ic
                      icon={phoneCopied ? Check : Copy}
                      size="xs"
                      className={
                        phoneCopied ? "text-emerald-600" : "text-slate-400"
                      }
                    />
                    {phoneCopied && (
                      <span className="text-xs text-emerald-600">
                        {t("copied")}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* 💰 Баланс — блоки сабз: «0 сомонӣ» */}
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-5 py-4 min-w-[160px]">
              <div className="text-xs opacity-90 inline-flex items-center gap-1.5">
                <Ic icon={Wallet} size="xs" />
                {t("balance")}
              </div>
              <div className="text-3xl font-bold tabular-nums mt-1">
                {balance.toLocaleString("tj-TJ")}
                <span className="ml-1.5 text-base font-semibold">
                  {t("currency")}
                </span>
              </div>
            </div>
          </div>

          {/* ⚡ Се амали асосӣ */}
          <div className="mt-5 flex gap-2 flex-wrap">
            <Link to="/" className="btn-primary text-sm">
              <Ic icon={Gamepad2} />
              {t("chooseGame")}
            </Link>
            {isAdmin && (
              <Link to="/admin" className="btn-ghost text-sm">
                <Ic icon={LayoutDashboard} />
                {t("adminPanel")}
              </Link>
            )}
            <button
              onClick={() => {
                logout();
                nav("/");
              }}
              className="btn-ghost text-sm"
            >
              <Ic icon={LogOut} />
              {t("logout")}
            </button>
          </div>
        </section>

        {/* ===== 2️⃣ ИВАЗКУНИИ ПАРОЛ ===== */}
        <section className="card p-6" aria-labelledby="change-pass-title">
          <h2
            id="change-pass-title"
            className="font-bold mb-1 inline-flex items-center gap-2"
          >
            <Ic icon={KeyRound} className="text-brand-600" />
            {t("changePassword")}
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            {t("currentPassword")} → {t("newPassword")} (≥ 8)
          </p>

          <form onSubmit={submitPassword} className="space-y-3 max-w-sm">
            <label className="block">
              <span className="label">{t("currentPassword")}</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={pwdCur}
                onChange={(e) => setPwdCur(e.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="label">{t("newPassword")}</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={pwdNew}
                onChange={(e) => setPwdNew(e.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="label">{t("confirmPassword")}</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={pwdCheck}
                onChange={(e) => setPwdCheck(e.target.value)}
                className="input"
              />
            </label>

            {pwdMsg && (
              <div
                role="status"
                className={`rounded-xl px-4 py-2 text-sm ${
                  pwdOk
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                    : "bg-rose-50 border border-rose-200 text-rose-700"
                }`}
              >
                <Ic icon={pwdOk ? CircleCheck : CircleX} size="xs" />
                {pwdMsg}
              </div>
            )}

            <button type="submit" disabled={pwdBusy} className="btn-primary text-sm">
              {pwdBusy ? (
                <>
                  <Ic icon={Loader2} className="animate-spin" /> {t("loading")}
                </>
              ) : (
                <>
                  <Ic icon={Save} />
                  {t("save")}
                </>
              )}
            </button>
          </form>
        </section>

        {/* ===== 3️⃣ ФАРМОИШҲО (воқеӣ) ===== */}
        <section className="card p-6" aria-labelledby="my-orders-title">
          <h2
            id="my-orders-title"
            className="font-bold mb-4 inline-flex items-center gap-2"
          >
            <Ic icon={Package} className="text-brand-600" />
            {t("orders")}
          </h2>

          {err && (
            <div
              role="alert"
              className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-4"
            >
              {err}
            </div>
          )}

          {orders.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <div className="flex justify-center mb-2 text-slate-300">
                <Ic icon={Inbox} size="xl" />
              </div>
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
                        className={`badge mt-1 !py-0.5 !px-2 text-[11px] ${meta.cls}`}
                      >
                        <Ic icon={meta.icon} size="xs" strokeWidth={2.25} />
                        {t(meta.key)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* 👥 Муштариёни воқеӣ — аз фармоишҳои иҷрочуда */}
        <Customers />
      </div>
    </div>
  );
}
