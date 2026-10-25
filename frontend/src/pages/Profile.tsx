import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Check,
  ChevronRight,
  CircleCheck,
  CircleX,
  Coins,
  Copy,
  Gamepad2,
  Gift,
  History,
  Inbox,
  LayoutDashboard,
  Loader2,
  LogOut,
  Package,
  Plus,
  Save,
  ShieldCheck,
  Smartphone,
  UserRound,
  Wallet,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { api, ApiError } from "../api/client";
import type { CoinsInfo, Order } from "../types";
import { STATUS_META } from "../types";
import { GoldCoin, Ic } from "../components/Icons";
import Customers from "../components/Customers";
import TopUpModal from "../components/TopUpModal";

/**
 * 👤 ПРОФИЛИ КОРБАР
 *
 * Тарҳ (ба талаботи тасвир):
 *   1) Картҳои гурӯҳӣ бо рӯйхатҳои иттилоотӣ (accordion):
 *      Фармоишҳо · IDҳои бозии ман | Маълумоти шахсӣ · Амният |
 *      Бонусҳо ва даъватҳо
 *   2) Карткаи асосӣ: аватар + ном + телефон + «ID-и шумо» бо нусха,
 *      зер-карти баланс бо тугмаи «Пур кардан» (TopUpModal — мавҷуда),
 *      зер-карти тиллоии Pers Coins бо «Иваз ба баланс» (backend /coins)
 *
 * ҲЕҶ маълумоти сохта нест:
 *   • баланс / тангаҳо / коди даъват / таърих ҳама аз backend;
 *   • IDҳои бозӣ аз фармоишҳои воқеии корбар;
 *   • муштариён аз фармоишҳои иҷрочуда;
 *   • «Пур кардан» → TopUpModal (ҳамон модале, ки дар BottomNav аст).
 */
/** 🗂️ Кадом панели гурӯҳӣ кушода аст (як вақт якто) */
type PanelKey = "orders" | "ids" | "info" | "security" | "bonuses";

export default function Profile() {
  const { t, lang, user, balance, isAdmin, authReady, refreshUser, logout } =
    useApp();
  const nav = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState("");
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  /** 📋 Кадом ID-и бозӣ дар панел нусха шуд (фақат ӯст) */
  const [copiedPid, setCopiedPid] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);

  // 🪙 Pers Coins
  const [coins, setCoins] = useState<CoinsInfo | null>(null);
  const [exBusy, setExBusy] = useState(false);
  const [exMsg, setExMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // 🗂️ Як панели кушода (accordion)
  const [panel, setPanel] = useState<PanelKey | null>("orders");
  const toggle = (key: PanelKey) =>
    setPanel((cur) => (cur === key ? null : key));

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

  // 📋 Нусхаи ID
  const copyId = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(String(user.id));
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1800);
    } catch {
      /* иҷозат нест */
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
      const all = await api.myOrders();
      setOrders(all);
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    }
  }, [user, t]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  // 🪙 Тангаҳо + қоидаҳо + коди даъват (як дафъа ҳангоми вуруд)
  const loadCoins = useCallback(async () => {
    if (!user) return;
    try {
      setCoins(await api.myCoins());
    } catch {
      setCoins(null);
    }
  }, [user]);

  useEffect(() => {
    void loadCoins();
  }, [loadCoins]);

  // 💱 Ивази танга ба баланс (tanҳо адади куллӣ аз backend)
  const doExchange = async () => {
    if (!coins || exBusy) return;
    if (coins.coins < coins.min_exchange) return;
    setExBusy(true);
    setExMsg(null);
    try {
      const res = await api.exchangeCoins();
      setExMsg({
        ok: true,
        text: t("exchangeDone").replace(
          "{amount}",
          Number(res.credited_tjs).toLocaleString("tj-TJ"),
        ),
      });
      await refreshUser(); // баланс дар контекст нав шавад
      await loadCoins(); // тангаҳо + таърих нав шавад
    } catch (e) {
      setExMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : t("error"),
      });
    } finally {
      setExBusy(false);
    }
  };

  // 🔗 Линки даъват (аз поёни саҳифаи ҷорӣ + коди шахсӣ)
  const inviteLink = coins?.referral_code
    ? `${window.location.origin}/?ref=${coins.referral_code}`
    : "";

  const copyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1800);
    } catch {
      /* иҷозат нест */
    }
  };

  // 🎮 IDҳои бозӣ — аз фармоишҳои воқеӣ (ягона, бе такрор)
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
  const coinAmt = coins?.coins ?? 0;
  const canExchange = !!coins && coinAmt >= coins.min_exchange;

  const KIND_KEY: Record<string, string> = {
    cashback: "kindCashback",
    referral: "kindReferral",
    referral_welcome: "kindReferralWelcome",
    admin_grant: "kindAdminGrant",
    exchange: "kindExchange",
  };

  return (
    /* 🌅 Заминаи мулоими кабуди градиентӣ (дар торик — таркиби торик) */
    <div className="profile-soft min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-5">
        {/* ===== САРЛАВҲА ===== */}
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">
          {t("profile")}
        </h1>

        {/* ===== 1️⃣ КАРТОЧКАИ ПРОФИЛ ===== */}
        <section className="card p-5 sm:p-6" aria-labelledby="profile-name">
          <div className="flex items-start gap-4">
            {/* Аватар бо ҳарфи аввали ном */}
            <div
              aria-hidden
              className="grid h-16 w-16 shrink-0 select-none place-items-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 text-2xl font-black dark:from-blue-500/30 dark:to-indigo-500/30 dark:text-blue-100"
            >
              {initial || <Ic icon={UserRound} size="xl" strokeWidth={1.75} />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="profile-name" className="text-xl font-bold truncate">
                  {displayName}
                </h2>
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
                  className="mt-1 -mx-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm text-slate-500 transition hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-slate-400"
                >
                  <Ic icon={Smartphone} className="text-slate-400" />
                  <span className="tabular-nums break-all">{user.phone}</span>
                  <Ic
                    icon={phoneCopied ? Check : Copy}
                    size="xs"
                    className={phoneCopied ? "text-emerald-600" : "text-slate-400"}
                  />
                  {phoneCopied && (
                    <span className="text-xs text-emerald-600">{t("copied")}</span>
                  )}
                </button>
              )}

              {/* 🪪 «ID-и шумо» бо тугмаи нусха */}
              <button
                type="button"
                onClick={copyId}
                aria-label={`${t("profileIdLabel")} ${user.id}`}
                className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 transition hover:border-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200"
              >
                {t("profileIdLabel")} {user.id}
                <Ic
                  icon={idCopied ? Check : Copy}
                  size="xs"
                  className={idCopied ? "text-emerald-600" : "text-blue-400"}
                />
                {idCopied && <span className="text-emerald-600">{t("copied")}</span>}
              </button>
            </div>
          </div>

          {/* 💰 Зер-карти баланс + «Пур кардан» */}
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-500 inline-flex items-center gap-1.5">
                <Ic icon={Wallet} size="xs" />
                {t("balance")}
              </div>
              <div className="text-2xl font-black tabular-nums mt-0.5">
                {balance.toLocaleString("tj-TJ")}
                <span className="ml-1.5 text-sm font-semibold text-slate-500">
                  {t("currency")}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTopUpOpen(true)}
              className="btn-primary text-sm shrink-0"
            >
              <Ic icon={Plus} />
              {t("topup")}
            </button>
          </div>

          {/* 🪙 Зер-карти тиллоии PERS COINS */}
          <div className="mt-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 dark:border-amber-500/30 dark:from-amber-500/10 dark:to-yellow-500/5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 font-black text-amber-900 dark:text-amber-100">
                  <GoldCoin className="h-5 w-5" />
                  Pers Coins:
                  <span className="tabular-nums">{coinAmt}</span>
                </div>
                <div className="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5">
                  {coins &&
                    t("coinsRate").replace("{n}", String(coins.exchange_rate))}
                  {" · "}
                  {t("coinsHint")}
                </div>
              </div>
              <button
                type="button"
                onClick={doExchange}
                disabled={!canExchange || exBusy}
                aria-disabled={!canExchange || exBusy}
                className="btn-primary text-sm shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exBusy ? (
                  <>
                    <Ic icon={Loader2} className="animate-spin" />
                    {t("loading")}
                  </>
                ) : (
                  <>
                    <Ic icon={Coins} />
                    {t("exchangeCoins")}
                  </>
                )}
              </button>
            </div>

            {exMsg && (
              <div
                role="status"
                className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                  exMsg.ok
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300"
                    : "bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300"
                }`}
              >
                {exMsg.text}
              </div>
            )}
          </div>

          {/* ⚡ Амали умумӣ */}
          <div className="mt-4 flex gap-2 flex-wrap">
            <Link to="/" className="btn-ghost text-sm">
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

        {/* ===== 2️⃣ ГУРУҲИ 1: Фармоишҳо · IDҳои бозӣ ===== */}
        <section
          className="card overflow-hidden"
          aria-label={`${t("orders")} · ${t("gameIds")}`}
        >
          <div className="divide-y divide-slate-100 dark:divide-white/10">
            <MenuRow
              icon={Package}
              title={t("orders")}
              hint={t("ordersHint")}
              open={panel === "orders"}
              onClick={() => toggle("orders")}
            />
            <MenuRow
              icon={Gamepad2}
              title={t("gameIds")}
              hint={t("gameIdsHint")}
              open={panel === "ids"}
              onClick={() => toggle("ids")}
            />
          </div>

          {/* 📦 Панели фармоишҳо */}
          {panel === "orders" && (
            <div className="border-t border-slate-100 px-5 py-4 dark:border-white/10">
              {err && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-3"
                >
                  {err}
                </div>
              )}

              {orders.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500">
                  <div className="mb-2 flex justify-center text-slate-300">
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
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-brand-300 dark:border-white/10"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">
                            #{o.id} — {o.game_name}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {o.product_name} ·{" "}
                            {new Date(o.created_at).toLocaleDateString(lang)}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-bold">
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
            </div>
          )}

          {/* 🎮 Панели IDҳои бозӣ (аз фармоишҳои воқеӣ) */}
          {panel === "ids" && (
            <div className="border-t border-slate-100 px-5 py-4 dark:border-white/10">
              {gameIds.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">
                  {t("noGameIds")}
                </p>
              ) : (
                <ul className="space-y-2">
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
                          <div className="text-xs text-slate-500">{g.game}</div>
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
              )}
            </div>
          )}
        </section>

        {/* ===== 3️⃣ ГУРУҲИ 2: Маълумоти шахсӣ · Амният ===== */}
        <section
          className="card overflow-hidden"
          aria-label={`${t("personalInfo")} · ${t("security")}`}
        >
          <div className="divide-y divide-slate-100 dark:divide-white/10">
            <MenuRow
              icon={UserRound}
              title={t("personalInfo")}
              hint={t("personalInfoHint")}
              open={panel === "info"}
              onClick={() => toggle("info")}
            />
            <MenuRow
              icon={ShieldCheck}
              title={t("security")}
              hint={t("securityHint")}
              open={panel === "security"}
              onClick={() => toggle("security")}
            />
          </div>

          {/* ℹ️ Маълумоти шахсӣ */}
          {panel === "info" && (
            <div className="border-t border-slate-100 px-5 py-4 dark:border-white/10">
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-white/10">
                  <dt className="text-slate-500">{t("profile")}</dt>
                  <dd className="font-semibold truncate">{displayName}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-white/10">
                  <dt className="text-slate-500">{t("phone")}</dt>
                  <dd className="font-semibold tabular-nums">
                    {user.phone || "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-white/10">
                  <dt className="text-slate-500">{t("profileIdLabel")}</dt>
                  <dd className="font-semibold tabular-nums">{user.id}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-white/10">
                  <dt className="text-slate-500">{t("registeredAt")}</dt>
                  <dd className="font-semibold">
                    {new Date(user.created_at).toLocaleDateString(lang)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* 🔐 Ивазкунии парол */}
          {panel === "security" && (
            <div className="border-t border-slate-100 px-5 py-4 dark:border-white/10">
              <p className="mb-3 text-xs text-slate-500">
                {t("currentPassword")} → {t("newPassword")} (≥ 8)
              </p>
              <form onSubmit={submitPassword} className="max-w-sm space-y-3">
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

                <button
                  type="submit"
                  disabled={pwdBusy}
                  className="btn-primary text-sm"
                >
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
            </div>
          )}
        </section>

        {/* ===== 4️⃣ ГУРУҲИ 3: Бонусҳо ва даъватҳо ===== */}
        <section className="card overflow-hidden" aria-label={t("bonusesInvites")}>
          <div className="divide-y divide-slate-100 dark:divide-white/10">
            <MenuRow
              icon={Gift}
              title={t("bonusesInvites")}
              hint={t("bonusesInvitesHint")}
              open={panel === "bonuses"}
              onClick={() => toggle("bonuses")}
            />
          </div>

          {panel === "bonuses" && (
            <div className="border-t border-slate-100 px-5 py-4 space-y-4 dark:border-white/10">
              {/* 🔗 Линки даъват */}
              <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4 dark:border-brand-400/30 dark:bg-brand-500/10">
                <div className="text-sm font-bold">{t("inviteLink")}</div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {t("inviteHint")}
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <input
                    readOnly
                    value={inviteLink}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={t("inviteLink")}
                    className="input min-w-0 flex-1 !py-2 text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={copyInvite}
                    disabled={!inviteLink}
                    className="btn-primary text-sm shrink-0 disabled:opacity-50"
                  >
                    <Ic icon={inviteCopied ? Check : Copy} />
                    {inviteCopied ? t("copied") : t("copy")}
                  </button>
                </div>

                <div className="mt-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
                  {t("referralCount").replace(
                    "{n}",
                    String(coins?.referred_count ?? 0),
                  )}
                  {(coins?.referred_count ?? 0) === 0 && (
                    <span className="ml-1 font-normal text-slate-500">
                      — {t("noReferrals")}
                    </span>
                  )}
                </div>
              </div>

              {/* 🪙 Таърихи тангаҳо */}
              <div>
                <div className="mb-2 inline-flex items-center gap-2 text-sm font-bold">
                  <Ic icon={History} className="text-amber-600" />
                  {t("coinHistory")}
                </div>

                {!coins || coins.history.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center text-sm text-slate-500 dark:border-white/10">
                    {t("noCoins")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {coins.history.map((tx) => (
                      <li
                        key={tx.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5 dark:border-white/10"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">
                            {t(KIND_KEY[tx.kind] ?? "kindCashback")}
                          </div>
                          {tx.reason && (
                            <div className="truncate text-xs text-slate-500">
                              {tx.reason}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div
                            className={`text-sm font-black tabular-nums ${
                              tx.amount >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {tx.amount > 0 ? "+" : ""}
                            {tx.amount}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(tx.created_at).toLocaleDateString(lang)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 👥 Муштариёни воқеӣ — аз фармоишҳои иҷрочуда */}
        <Customers />
      </div>

      {/* 💳 Модали пур кардани баланс (ҳамон мавҷуда дар BottomNav) */}
      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </div>
  );
}

/* =====================================================================
 * 📋 Сатри рӯйхати гурӯҳӣ (accordion row) — клавиатура + aria-expanded
 * ====================================================================*/
function MenuRow({
  icon,
  title,
  hint,
  open,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 dark:hover:bg-white/5"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-white/10 dark:text-brand-300">
        <Ic icon={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
          open ? "rotate-90" : ""
        }`}
      />
    </button>
  );
}
