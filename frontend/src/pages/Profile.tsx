import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  CircleCheck,
  CircleX,
  Copy,
  Gift,
  History,
  Loader2,
  LogOut,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { api, ApiError } from "../api/client";
import type { CoinsInfo } from "../types";
import { Ic } from "../components/Icons";
import TopUpModal from "../components/TopUpModal";
import InstallApp from "../components/InstallApp";
import SupportSheet from "../components/SupportSheet";
import ProfileHeader from "../components/profile/ProfileHeader";
import UserInfo from "../components/profile/UserInfo";
import BalanceCard from "../components/profile/BalanceCard";
import QuickActions from "../components/profile/QuickActions";
import ProfileMenu, { type ProfileMenuRow } from "../components/profile/ProfileMenu";
import { copyText } from "../utils/clipboard";

/**
 * 👤 ПРОФИЛИ КОРБАР — услуби MegaFon (dark theme, танҳо layout + ранг):
 *
 *   1) Сари часпак 56px: ← + «Профил» 20px;
 *   2) Сатри корбар: аватар 44px · ном 18px · телефон · «>» · бейҷи АДМИН;
 *   3) «ID-и шумо» + «Санаи қайд» бо тугмаи нусха (16px);
 *   4) Корти баланс: «БАЛАНС» · 28px · «сомонӣ» · тугмаи сабзи «+»;
 *   5) Се тил: Пур кардан · Дастгирӣ · Фармоишҳо;
 *   6) Ягона корти меню (Маълумоти шахсӣ · Амният · Бонусҳо ва даъватҳо);
 *   7) «Баромад» — сатри пурраи бо матни сурхи #FF453A.
 *
 * Рангҳо: CSS-переменнаҳои `--mf-*` (index.css). ҲЕҶ маълумоти сохта нест —
 * баланс / тангаҳо / коди даъват / таърих ҳама аз backend; API дастнахӯрда.
 */
/** 🗂️ Кадом панели гурӯҳӣ кушода аст (як вақт якто) */
type PanelKey = "info" | "security" | "bonuses";

/**
 * 💰 Формати бехатари маблағ — NaN / string / null ҳеҷ гоҳ саҳифаро намепартояд.
 * Ҳамеша 2 рақами даҳӣ + вергули тоҷикӣ (605,96).
 */
function formatMoney(value: unknown): string | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.replace(/\s/g, "").replace(",", "."))
        : Number.NaN;
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString("tj-TJ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 🪙 Навъи эътибори тангаҳо → калиди тарҷума */
const KIND_KEY: Record<string, string> = {
  cashback: "kindCashback",
  referral: "kindReferral",
  referral_welcome: "kindReferralWelcome",
  admin_grant: "kindAdminGrant",
  exchange: "kindExchange",
  exchange_in: "kindExchangeIn",
  spin: "kindSpin",
  spin_reward: "kindSpinReward",
};

export default function Profile() {
  const {
    t,
    lang,
    user,
    balance,
    balanceLoading,
    isAdmin,
    authReady,
    refreshUser,
    logout,
  } = useApp();
  const nav = useNavigate();

  const [idCopied, setIdCopied] = useState(false);
  const [dateCopied, setDateCopied] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const balanceText = formatMoney(balance);

  // 📋 Нусхаи ID (маҳаллӣ — ягон дархост ба сервер намеравад)
  const copyId = async () => {
    if (!user) return;
    if (await copyText(String(user.id))) {
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1800);
    }
  };

  // 📋 Нусхаи санаи қайд (ҳамон матне, ки дар саҳифа нишон дода мешавад)
  const copyDate = async () => {
    if (!user) return;
    if (await copyText(new Date(user.created_at).toLocaleDateString(lang))) {
      setDateCopied(true);
      setTimeout(() => setDateCopied(false), 1800);
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
  const [coins, setCoins] = useState<CoinsInfo | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

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
    if (await copyText(inviteLink)) {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1800);
    }
  };

  // 🗂️ Як панели кушода (accordion)
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const toggle = (key: PanelKey) =>
    setPanel((cur) => (cur === key ? null : key));

  // Ҳангоми боргирии аввалия → скелетон (на саҳифаи холӣ, на партофт)
  if (!user) {
    if (authReady) return null; // → эффект боло ба `/login` меафтонад
    return (
      <div className="mf-profile min-h-[100dvh] w-full bg-[var(--mf-bg)]">
        <div className="mx-auto max-w-3xl px-4 py-6 grid gap-3">
          <div className="h-28 animate-pulse rounded-2xl bg-[var(--mf-card)]" aria-hidden />
          <div className="h-44 animate-pulse rounded-2xl bg-[var(--mf-card)]" aria-hidden />
        </div>
      </div>
    );
  }

  const displayName = user.full_name || user.username || `#${user.id}`;
  const initial = displayName.trim().charAt(0).toUpperCase();
  const registeredAt = new Date(user.created_at).toLocaleDateString(lang);

  const openTopUp = () => setTopUpOpen(true);

  /** 📋 Ягона корти меню — се сатр бо панели кушода дар зери ҳамон сатр */
  const menuRows: ProfileMenuRow[] = [
    {
      id: "info",
      icon: UserRound,
      title: t("personalInfo"),
      hint: t("personalInfoHint"),
      open: panel === "info",
      onToggle: () => toggle("info"),
      children: (
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mf-divider)] px-4 py-3">
            <dt className="text-[var(--mf-text-2)]">{t("profile")}</dt>
            <dd className="truncate font-semibold text-[var(--mf-text)]">{displayName}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mf-divider)] px-4 py-3">
            <dt className="text-[var(--mf-text-2)]">{t("phone")}</dt>
            <dd className="truncate font-semibold tabular-nums text-[var(--mf-text)]">
              {user.phone || "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mf-divider)] px-4 py-3">
            <dt className="text-[var(--mf-text-2)]">{t("profileIdLabel")}</dt>
            <dd className="font-semibold tabular-nums text-[var(--mf-text)]">{user.id}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mf-divider)] px-4 py-3">
            <dt className="text-[var(--mf-text-2)]">{t("registeredAt")}</dt>
            <dd className="font-semibold text-[var(--mf-text)]">{registeredAt}</dd>
          </div>
        </dl>
      ),
    },
    {
      id: "security",
      icon: ShieldCheck,
      title: t("security"),
      hint: t("securityHint"),
      open: panel === "security",
      onToggle: () => toggle("security"),
      children: (
        <>
          <p className="mb-3 text-[13px] text-[var(--mf-text-2)]">
            {t("currentPassword")} → {t("newPassword")} (≥ 8)
          </p>
          <form onSubmit={submitPassword} className="max-w-sm space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[var(--mf-text-2)]">
                {t("currentPassword")}
              </span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={pwdCur}
                onChange={(e) => setPwdCur(e.target.value)}
                className="input rounded-xl border border-[var(--mf-divider)] bg-[var(--mf-divider)] px-4 py-3 text-sm text-[var(--mf-text)] placeholder:text-[var(--mf-text-2)] focus:border-[var(--mf-accent)] focus:ring-2 focus:ring-[var(--mf-accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[var(--mf-text-2)]">
                {t("newPassword")}
              </span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={pwdNew}
                onChange={(e) => setPwdNew(e.target.value)}
                className="input rounded-xl border border-[var(--mf-divider)] bg-[var(--mf-divider)] px-4 py-3 text-sm text-[var(--mf-text)] placeholder:text-[var(--mf-text-2)] focus:border-[var(--mf-accent)] focus:ring-2 focus:ring-[var(--mf-accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[var(--mf-text-2)]">
                {t("confirmPassword")}
              </span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={pwdCheck}
                onChange={(e) => setPwdCheck(e.target.value)}
                className="input rounded-xl border border-[var(--mf-divider)] bg-[var(--mf-divider)] px-4 py-3 text-sm text-[var(--mf-text)] placeholder:text-[var(--mf-text-2)] focus:border-[var(--mf-accent)] focus:ring-2 focus:ring-[var(--mf-accent)]"
              />
            </label>

            {pwdMsg && (
              <div
                role="status"
                className={`rounded-xl border px-4 py-2 text-sm ${
                  pwdOk
                    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "border-rose-500/30 bg-rose-500/15 text-rose-600 dark:text-rose-400"
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
        </>
      ),
    },
    {
      id: "bonuses",
      icon: Gift,
      title: t("bonusesInvites"),
      hint: t("bonusesInvitesHint"),
      open: panel === "bonuses",
      onToggle: () => toggle("bonuses"),
      children: (
        <div className="space-y-4">
          {/* 🔗 Линки даъват */}
          <div className="rounded-2xl border border-[var(--mf-divider)] bg-[var(--mf-divider)] p-4">
            <div className="text-[15px] font-bold text-[var(--mf-text)]">{t("inviteLink")}</div>
            <div className="mt-1 text-xs text-[var(--mf-text-2)]">{t("inviteHint")}</div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
                aria-label={t("inviteLink")}
                className="input min-w-0 flex-1 rounded-xl border border-[var(--mf-divider)] bg-[var(--mf-card)] px-3 py-2 text-xs font-semibold text-[var(--mf-text)] focus:border-[var(--mf-accent)] focus:ring-2 focus:ring-[var(--mf-accent)]"
              />
              <button
                type="button"
                onClick={copyInvite}
                disabled={!inviteLink}
                className="btn-primary shrink-0 text-sm disabled:opacity-50"
              >
                <Ic icon={inviteCopied ? Check : Copy} />
                {inviteCopied ? t("copied") : t("copy")}
              </button>
            </div>

            <div className="mt-2 text-xs font-semibold text-[var(--mf-text-2)]">
              {t("referralCount").replace("{n}", String(coins?.referred_count ?? 0))}
              {(coins?.referred_count ?? 0) === 0 && (
                <span className="ml-1 font-normal">— {t("noReferrals")}</span>
              )}
            </div>
          </div>

          {/* 🪙 Таърихи тангаҳо */}
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-[15px] font-bold text-[var(--mf-text)]">
              <Ic icon={History} className="text-amber-600 dark:text-amber-400" />
              {t("coinHistory")}
            </div>

            {!coins || coins.history.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--mf-divider)] px-4 py-4 text-center text-sm text-[var(--mf-text-2)]">
                {t("noCoins")}
              </p>
            ) : (
              <ul className="space-y-2">
                {coins.history.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mf-divider)] px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-[var(--mf-text)] sm:text-sm">
                        {t(KIND_KEY[tx.kind] ?? "kindCashback")}
                      </div>
                      {tx.reason && (
                        <div className="truncate text-xs text-[var(--mf-text-2)]">{tx.reason}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={`text-sm font-black tabular-nums ${
                          tx.amount === 0
                            ? "text-[var(--mf-text-2)]"
                            : tx.amount > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {tx.amount === 0 ? "—" : `${tx.amount > 0 ? "+" : ""}${tx.amount}`}
                      </div>
                      <div className="text-[11px] text-[var(--mf-text-2)]">
                        {new Date(tx.created_at).toLocaleDateString(lang)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="mf-profile min-h-[100dvh] w-full bg-[var(--mf-bg)] pb-[calc(88px+env(safe-area-inset-bottom))]">
      {/* 1️⃣ Сари часпак: ← + «Профил» (56px + safe-area) */}
      <ProfileHeader title={t("profile")} />

      <div className="mx-auto grid max-w-3xl gap-3 px-4 pt-3">
        {/* 2️⃣+3️⃣ Сатри корбар + ID/санаи қайд бо нусха */}
        <UserInfo
          displayName={displayName}
          initial={initial}
          phone={user.phone}
          userId={user.id}
          registeredAt={registeredAt}
          isAdmin={isAdmin}
          idCopied={idCopied}
          dateCopied={dateCopied}
          onCopyId={copyId}
          onCopyDate={copyDate}
        />

        {/* 4️⃣ Корти баланс + тугмаи сабзи «+» */}
        <BalanceCard
          balanceText={balanceText}
          loading={balanceLoading}
          onTopUp={openTopUp}
          onRetry={() => {
            void refreshUser();
          }}
        />

        {/* 5️⃣ Се тил: Пур кардан · Дастгирӣ · Фармоишҳо */}
        <QuickActions onTopUp={openTopUp} onSupport={() => setSupportOpen(true)} />

        {/* 6️⃣ Ягона корти меню бо се сатр */}
        <ProfileMenu
          rows={menuRows}
          label={`${t("personalInfo")} · ${t("security")} · ${t("bonusesInvites")}`}
        />

        {/* 📦 Барнома (PWA) — ҳамон блоки мавҷуда, дар саҳифаи торик */}
        <InstallApp />

        {/* 7️⃣ «Баромад» — сатри пурраи торик бо матни сурх */}
        <button
          type="button"
          onClick={() => {
            logout();
            nav("/");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--mf-card)] px-4 py-4 text-[15px] font-semibold text-[var(--mf-danger)] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mf-danger)]"
        >
          <Ic icon={LogOut} size="md" />
          {t("logout")}
        </button>
      </div>

      {/* Модалҳои мавҷуда */}
      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
      <SupportSheet open={supportOpen} onClose={() => setSupportOpen(false)} />
    </div>
  );
}
