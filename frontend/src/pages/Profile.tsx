import {
  useCallback,
  useEffect,
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
  Copy,
  Gift,
  History,
  Loader2,
  LogOut,
  Plus,
  Save,
  ShieldCheck,
  Smartphone,
  UserRound,
  Wallet,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { api, ApiError } from "../api/client";
import type { CoinsInfo } from "../types";
import { Ic } from "../components/Icons";
import TopUpModal from "../components/TopUpModal";
import BackButton from "../components/BackButton";

/**
 * 👤 ПРОФИЛИ КОРБАР
 *
 * Тарҳ (ба талаботи тасвир):
 *   1) Картҳои гурӯҳӣ бо рӯйхатҳои иттилоотӣ (accordion):
 *      Фармоишҳо · IDҳои бозии ман | Маълумоти шахсӣ · Амният |
 *      Бонусҳо ва даъватҳо
 *   2) Карткаи асосӣ: аватар + ном + телефон + «ID-и шумо» бо нусха +
 *      «Кушодашуда: <сана>» (user.created_at),
 *      зер-карти баланси КӯЛобӢ бо ду тугма: «Пур кардан» (TopUpModal) +
 *      «Фармоишҳои ман» (/orders); Тугмаи тағйир додани ном НЕСТ (backend нест),
 *      корти `CoinsCard` (Pers Coins + «То гардиш» + тугмаи «Гардондан» → /wheel)
 *
 * ҲЕҶ маълумоти сохта нест:
 *   • баланс / тангаҳо / коди даъват / таърих ҳама аз backend;
 *   • IDҳои бозӣ аз фармоишҳои воқеии корбар;
 *   • «Муштариёни мо» аз профил БАРҲАМ ДОДА ШУД (талаби корбар) —
 *     ҳамон компонент дар саҳифаҳои дигар (ReviewsPage · OrderPage · GameDetail) монд;
 *   • «Пур кардан» → TopUpModal (ҳамон модале, ки дар BottomNav аст).
 */
/** 🗂️ Кадом панели гурӯҳӣ кушода аст (як вақт якто) */
type PanelKey = "info" | "security" | "bonuses";

export default function Profile() {
  const { t, lang, user, balance, isAdmin, authReady, logout } = useApp();
  const nav = useNavigate();

  const [phoneCopied, setPhoneCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  /** 📋 Кадом ID-и бозӣ дар панел нусха шуд (фақат ӯст) */
  const [topUpOpen, setTopUpOpen] = useState(false);

  // 🪙 Pers Coins — худи корт дар компоненти `CoinsCard` (ҳамон дар Home)
  const [coins, setCoins] = useState<CoinsInfo | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // 🗂️ Як панели кушода (accordion)
  const [panel, setPanel] = useState<PanelKey | null>(null);
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

  // Ҳангоми боргирии аввалия → скелетон (на саҳифаи холӣ, на партофт)
  if (!user) {
    if (authReady) return null; // → эффект боло ба `/login` меафтонад
    return (
      <div className="profile-soft min-h-[calc(100vh-4rem)] w-full max-w-full overflow-x-clip">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8 grid gap-4 sm:gap-5">
          <div className="glass rounded-2xl h-44 animate-pulse" aria-hidden />
          <div className="glass rounded-2xl h-64 animate-pulse" aria-hidden />
        </div>
      </div>
    );
  }

  const displayName = user.full_name || user.username || `#${user.id}`;
  const initial = displayName.trim().charAt(0).toUpperCase();

  const KIND_KEY: Record<string, string> = {
    cashback: "kindCashback",
    referral: "kindReferral",
    referral_welcome: "kindReferralWelcome",
    admin_grant: "kindAdminGrant",
    exchange: "kindExchange",
    exchange_in: "kindExchangeIn",
  };

  return (
    /* 🌅 Заминаи мулоими кабуди градиентӣ (дар торик — таркиби торик) */
    <div className="profile-soft min-h-[calc(100vh-4rem)] w-full max-w-full overflow-x-clip">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8 grid gap-4 sm:gap-5">
        {/* ⬅️ Тугмаи бозгашт (услуби якхела дар ҳамаи саҳифаҳо) */}
        <BackButton />
        {/* ===== 1️⃣ КАРТОЧКАИ ПРОФИЛ ===== */}
        <section className="glass min-w-0 rounded-2xl p-4 sm:p-6" aria-labelledby="profile-name">
          <div className="flex items-start gap-4">
            {/* Аватар бо ҳарфи аввали ном */}
            <div
              aria-hidden
              className="grid h-16 w-16 shrink-0 select-none place-items-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 text-2xl font-black ring-4 ring-white/80 shadow-lg shadow-blue-500/20 dark:from-blue-500/30 dark:to-indigo-500/30 dark:text-blue-100"
            >
              {initial || <Ic icon={UserRound} size="xl" strokeWidth={1.75} />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {/* ✒️ Ном — градиенти сӯяшуда, фишурда (SaaS-ӣ) */}
                <h2
                  id="profile-name"
                  className="truncate text-[1.3rem] sm:text-2xl font-extrabold tracking-tight leading-tight
                             bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500
                             bg-clip-text text-transparent"
                >
                  {displayName}
                </h2>
                {isAdmin && (
                  <span className="inline-flex shrink-0 items-center rounded-full
                                   bg-gradient-to-r from-brand-500 to-indigo-500
                                   text-white text-[10px] font-extrabold uppercase tracking-[0.12em]
                                   px-2.5 py-1
                                   shadow-[0_6px_14px_-6px_rgba(37,99,235,0.9)] ring-1 ring-white/25">
                    {t("admin")}
                  </span>
                )}
              </div>

              {user.phone && (
                <button
                  type="button"
                  onClick={copyPhone}
                  aria-label={`${t("copy")}: ${user.phone}`}
                  className="mt-1 -mx-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-[13px] sm:text-sm font-medium text-slate-500 transition hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-slate-400"
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
                className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] sm:text-xs font-extrabold tracking-wide text-blue-700 transition hover:border-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200"
              >
                {t("profileIdLabel")} {user.id}
                <Ic
                  icon={idCopied ? Check : Copy}
                  size="xs"
                  className={idCopied ? "text-emerald-600" : "text-blue-400"}
                />
                {idCopied && <span className="text-emerald-600">{t("copied")}</span>}
              </button>

              {/* 📅 «Кушодашуда: <сана>» — аз backend (user.created_at) */}
              <div className="mt-1.5 text-[11px] sm:text-xs font-medium tracking-wide text-slate-400 dark:text-slate-400">
                {t("registeredAt")}: {new Date(user.created_at).toLocaleDateString(lang)}
              </div>
            </div>
          </div>

          {/* 💰 ЗЕР-КАРТИ БАЛАНС — кӯлобӣ + тугмаҳои «Пур кардан» · «Фармоишҳои ман»
             (Тугмаи тағйир додани ном НЕСТ — талаботи корбар) */}
          <div
            className="mt-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4
                       text-white shadow-lg shadow-blue-700/30 ring-1 ring-white/20
                       dark:from-blue-700 dark:to-indigo-800 dark:shadow-none"
          >
            {/* ✒️ Кикер — хурд, фишурда, сафед */}
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-100/90">
              <Ic icon={Wallet} size="xs" />
              {t("balance")}
            </div>
            {/* ✒️ Маблағ — калон, рақамҳои баробар (tabular), фишурда */}
            <div className="mt-1 text-[2rem] sm:text-4xl font-black leading-none tracking-[-0.02em] tabular-nums [text-shadow:0_2px_14px_rgba(15,23,42,0.28)]">
              {balance.toLocaleString("tj-TJ")}
              <span className="ml-1.5 text-base sm:text-lg font-semibold text-blue-200 [text-shadow:none]">
                {t("currency")}
              </span>
            </div>

            {/* 📱 Мобилӣ: тугма ТАГ БА ТАГ пурарӯза;
               тугмаи «Фармоишҳои ман» БАРДОШТА ШУД (талаби корбар) —
               фармоишҳо тавассути BottomNav («Фармоишҳо») дастрасанд */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setTopUpOpen(true)}
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5
                           rounded-xl bg-white px-2 py-2.5 text-[13px] sm:px-3 sm:text-sm font-bold tracking-wide text-blue-700
                           shadow-md shadow-blue-900/20
                           transition hover:bg-blue-50 active:scale-[0.98]
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <Ic icon={Plus} className="shrink-0 text-blue-600" />
                <span className="text-center leading-tight">{t("topup")}</span>
              </button>
            </div>
          </div>

          {/* 🪙 КОРТИ PERS COINS — аз профил БАРДОШТА ШУД (талаби корбар);
              тангаҳо/чарх тавассути BottomNav дастрасанд */}

          {/* ⚡ Амали умумӣ — тугмаҳои «Бозиро интихоб кунед» ва «Панели идора»
              аз профил БАРДОШТА ШУД (талаби корбар): бозӣ → BottomNav «Каталог»,
              админ → нишонаи алоҳида. Танҳо «Баромад» монд. */}
          <div className="mt-4 flex gap-2 flex-wrap">
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

        {/* ===== 3️⃣ ГУРУҲИ 2: Маълумоти шахсӣ · Амният ===== */}
        <section
          className="glass rounded-2xl overflow-hidden"
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
        <section className="glass rounded-2xl overflow-hidden" aria-label={t("bonusesInvites")}>
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
                <div className="text-[15px] font-bold tracking-tight">{t("inviteLink")}</div>
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
                <div className="mb-2 inline-flex items-center gap-2 text-[15px] font-bold tracking-tight">
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
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs sm:text-sm font-semibold">
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
      className="flex w-full items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4 text-left transition hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 dark:hover:bg-white/5"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600
                       ring-1 ring-brand-100/80 shadow-sm dark:bg-white/10 dark:text-brand-300 dark:ring-white/10">
        <Ic icon={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold tracking-tight text-slate-800 dark:text-slate-100">
          {title}
        </span>
        <span className="block truncate text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
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
