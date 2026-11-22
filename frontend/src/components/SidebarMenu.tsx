import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Disc3,
  Download,
  Info,
  LayoutGrid,
  LogIn,
  LogOut,
  MessageCircle,
  Moon,
  Package,
  Send,
  Settings,
  Star,
  Sun,
  UserPlus,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { LANGS } from "../i18n";
import { httpsUrl } from "../utils/https";
import {
  InstallPromptEvent,
  isIos,
  isStandalone,
} from "./InstallApp";
import {
  Ic,
  RussianFlag,
  TajikFlag,
  USAFlag,
  UzbekFlag,
} from "./Icons";
import Logo from "./Logo";
import { INSTAGRAM_URL, TELEGRAM_URL, WHATSAPP_URL } from "../config/constants";

/**
 * 🍔 SIDEBAR-MENЮ (чап → рост) — услуби «RentHub».
 *
 *   · Аз тарафи ЧАП ба рост мебарояд (translate-x), бо «rounded-r-3xl»;
 *   · Заминаи пушти blur + overlay → клик берун مепӯшад;
 *   · Kaliди Escape → мепӯшад; `aria-modal` + focus ба тугмаи ✕;
 *   · Бадани саҳифа ҳангоми кушодан ҳаракат намекунад (scroll lock).
 *
 *  ҲАМАИ бандҳо ба функсияи воқеӣ пайванданд:
 *   · Феҳрист      → /
 *   · Фармоишҳои ман → /orders (ё /login)
 *   · Чарх          → /wheel
 *   · Тақризҳо     → /reviews
 *   · Дар бораи мo → #about (бахши SEO дар саҳифаи асосӣ)
 *   · Насб барнома → PWA prompt / iOS-дастур / HTTPS (танҳо вақте роҳ ҳаст)
 *   · Панели идора  → /admin (танҳо барои админ)
 *   · Насби AutoDonat → зеркашии APK (танҳо барои админ)
 *   · Баромад       → logout
 *   · 🌙/☀️ + забон  → мавзӯи воқеӣ (localStorage) + 4 забон
 *
 *  ❗ Танҳо функсияҳои мавҷуд → ягон банди бемаънӣ нест.
 */
export default function SidebarMenu({
  open,
  onClose,
}: {
  open: boolean;
  /** Пӯшидан; `after` — кори баъдӣ (навигатсия) → аввал маркери таърих
   *  бардошта мешавад, баъд иҷро мешавад (ислоҳи 17.11.2026). */
  onClose: (after?: () => void) => void;
}) {
  const { lang, setLang, t, user, isAdmin, logout, theme, toggleTheme } =
    useApp();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 📦 Насб кардани барнома (PWA) — ҳамон муколамаи InstallApp, дар меню.
  //    Рӯйдоди браузер дар ин ҷо ҳам гирифта мешавад (preventDefault) →
  //    тугмаи меню ва блоки Профил як event-и ягонаро истифода мебаранд.
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [installBusy, setInstallBusy] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  // 📱 Боргирии APK — тавассути /api/apk (токени админ дар header);
  //    файли статикӣ дар nginx баста аст (сирри webhook дар дохили APK).

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const insecure = !window.isSecureContext;
  const ios = isIos();
  /** Банди насб танҳо вақте нишон дода мешавад, ки роҳи насб ВОҚЕӢ мавҷуд:
      Android prompt / iPhone / http→HTTPS. Firefox-и десктоп → пинҳон. */
  const showInstall = !installed && (insecure || ios || !!installEvt);

  /** Клик: http → HTTPS; iOS → дастур дар ҷои худ; Android → prompt() */
  const onInstall = async () => {
    if (insecure) {
      window.location.href = httpsUrl();
      return;
    }
    if (ios) {
      setIosHint((v) => !v);
      return;
    }
    if (!installEvt || installBusy) return;
    setInstallBusy(true);
    try {
      await installEvt.prompt();
      const choice = await installEvt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallEvt(null);
    } catch {
      /* браузер рад кард → ҳолати пешина мемонад */
    } finally {
      setInstallBusy(false);
    }
  };

  /** 📱 «Насби AutoDonat» — ба ҷои пайванди статикӣ: дархост ба /api/apk
      бо токени админ → blob → зеркашӣ. Хато → огоҳиномаи возеҳ (таъмини
      он ки сирри webhook танҳо аз ҳисоби админ баромада натавонад).

      08.11.2026 «насби барнома кор намекунад» (соҳиб): сабаб дар лог —
      дар Downloads-и ӯ файли КӯҳНА бо ҳамон ном (AutoDonat-v1.0-debug,
      версияҳои 07.11) мемонад → ӯ файли кӯҳна/нопурра-ро мекушод →
      «насб намешавад». Ислоҳ: (1) номи файл бо версия = AutoDonat-v1.8.apk;
      (2) пас аз зеркашӣ дар Android роҳнамои возеҳ (Notifications → танҳо
      v1.5 → иҷозати Chrome → агар нопурра = аз нав); (3) 401/403 → паёми
      мушаххас ба ҷои «Хато»-и умумӣ. */

  // 🔒 Escape + lock-и скролл + focus ба ✕ ҳангоми кушодан
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // 🚪 Баромад
  const onLogout = () => {
    onClose(() => {
      logout();
      nav("/");
    });
  };

  /** ➡️ «Дар бораи мo» — саҳифаи алоҳидаи /about */
  const goAbout = () => {
    go("/about");
  };

  /** 🎁 «Линки даъват» — ба бахши даъват дар саҳифаи Чарҳ (#invite).
      Одамон аз меню мебинанд ва баъд клик → рост ба линк меравад.
      ⚠️ Маълумот (games/coins) баъд аз нав бор мешавад → scroll ду маротиба
      (баъди 250мс + 900мс), то ҷойи ниҳоии корт дуруст ба назар гирифта шавад. */
  const goInvite = () => {
    onClose(() => {
      const scroll = () => {
        const el = document.getElementById("invite");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      };
      if (pathname !== "/wheel") {
        nav("/wheel");
        setTimeout(scroll, 300);
        setTimeout(scroll, 1000);
      } else {
        scroll();
      }
    });
  };

  /** 🚩 Ростшавии флаг барои забон */
  const Flag = ({ code }: { code: string }) =>
    code === "tj" ? (
      <TajikFlag className="w-5 h-3.5 rounded-xs" />
    ) : code === "ru" ? (
      <RussianFlag className="w-5 h-3.5 rounded-xs" />
    ) : code === "en" ? (
      <USAFlag className="w-5 h-3.5 rounded-xs" />
    ) : (
      <UzbekFlag className="w-5 h-3.5 rounded-xs" />
    );

  /** Ҳамон равиши клик барои ҳамаи бандҳои меню */
  const go = (to: string) => {
    onClose(() => nav(to));
  };

  const rowCls =
    "w-full flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[15px] font-semibold " +
    "text-slate-700 hover:bg-slate-100 active:scale-[.98] transition text-left " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

  return (
    <>
      {/* 🌫️ Overlay — клик берун мепӯшад */}
      <div
        onClick={() => onClose()}
        aria-hidden
        className={`fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* 📚 Панели чап — аз чап ба рост */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("menu")}
        className={`fixed inset-y-0 left-0 z-[61] w-[84%] max-w-[340px]
                    bg-white dark:bg-slate-900 shadow-2xl rounded-r-3xl
                    flex flex-col transition-transform duration-300 ease-out
                    ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* 🔝 Сарлавҳа: логотип + ном + ✕ */}
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <span className="grid place-items-center w-11 h-11 rounded-full bg-blue-50 dark:bg-brand-900/30 ring-1 ring-blue-100 dark:ring-brand-700/40 shrink-0 overflow-hidden">
            <Logo size={33} variant="color" />
          </span>
          <span className="flex-1 min-w-0 font-black text-[17px] tracking-tight text-slate-900 dark:text-white truncate">
            {t("brand")}
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onClose()}
            aria-label={t("close")}
            className="grid place-items-center w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800
                       text-slate-500 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700
                       hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <Ic icon={X} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {/* 🔑 Агар вуруд НАКАРДА бошад → қайд/вуруд.
              ⚠️ КОРТИ ПРОФИЛ (ном + баланс) АЗ SIDEBAR БАРДОРДА ШУД
              (талаби соҳиб, 28.10.2026): баланс аккун дар сарлавҳа (🪙) аст,
              профил тавассути BottomNav «Профил» дастрас. */}
          {!user && (
            <div className="flex flex-col gap-2.5 mb-4">
              {/* 🔑 Ворид шудан */}
              <button
                type="button"
                onClick={() => go("/login")}
                className="w-full flex items-center justify-center gap-2 rounded-2xl
                           bg-slate-100 dark:bg-slate-800 px-4 py-3 text-[15px] font-bold
                           text-slate-800 dark:text-slate-100 ring-1 ring-slate-200 dark:ring-slate-700
                           hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[.98] transition
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <Ic icon={LogIn} />
                {t("login")}
              </button>
              {/* 📝 Ба қайд гирифтан (CTA) */}
              <button
                type="button"
                onClick={() => go("/login?register=1")}
                className="w-full flex items-center justify-center gap-2 rounded-2xl
                           bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3
                           text-[15px] font-extrabold text-white
                           shadow-[0_10px_24px_-8px_rgba(37,99,235,0.7)]
                           hover:from-blue-700 hover:to-indigo-700 active:scale-[.98] transition
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <Ic icon={UserPlus} />
                {t("registerNow")}
              </button>
            </div>
          )}

          {/* 🧭 Бандҳои меню — ҳама ба саҳифаи воқеӣ.
              ⚠️ Унвони «МЕНЮ» АЗ САТР БАРДОРДА ШУД (талаби соҳиб, 28.10.2026);
              `aria-label` дар <nav> барои screen-reader боқӣ мондааст. */}
          <nav className="flex flex-col" aria-label={t("menu")}>
            {/* ⚠️ «Феҳрист» ва «Фармоишҳои ман» — танҳо дар экранҳои
                калон (PC, >420px). Дар мобилии 320–420px ПИНҲОН
                (талаби соҳиб, 28.10.2026), зеро ҳар ду аллакай дар
                BottomNav ҳастанд. `max-[420px]:hidden` = Tailwind arbitrary. */}
            <button
              type="button"
              onClick={() => go("/")}
              className={`${rowCls} max-[420px]:hidden`}
            >
              <Ic icon={LayoutGrid} className="text-blue-500 shrink-0" />
              {t("navCatalog")}
            </button>

            <button
              type="button"
              onClick={() => go(user ? "/orders" : "/login")}
              className={`${rowCls} max-[420px]:hidden`}
            >
              <Ic icon={Package} className="text-indigo-500 shrink-0" />
              {t("navOrders")}
            </button>

            <button type="button" onClick={() => go("/wheel")} className={rowCls}>
              <Ic icon={Disc3} className="text-purple-500 shrink-0" />
              {t("wheel")}
            </button>

            <button
              type="button"
              onClick={() => go("/reviews")}
              className={rowCls}
            >
              <Ic icon={Star} className="text-amber-400 fill-current shrink-0" />
              {t("navReviews")}
            </button>

            <button type="button" onClick={goAbout} className={rowCls}>
              <Ic icon={Info} className="text-slate-400 shrink-0" />
              {t("navAbout")}
            </button>

            {/* 🎁 Линки даъвати шумо — одамон аз меню мебинанд → ба #invite */}
            {user && (
              <button type="button" onClick={goInvite} className={rowCls}>
                <Ic icon={UserPlus} className="text-emerald-500 shrink-0" />
                {t("inviteLink")}
              </button>
            )}

            {/* 📣 Дастгирӣ — accordion: tap → 3 шабака пайдо мешаванд */}
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setSupportOpen((v) => !v)}
                aria-expanded={supportOpen}
                aria-controls="sidebar-support-panel"
                className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left transition active:scale-[0.99]"
              >
                <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                  Дастгирӣ
                </span>
                <Ic
                  icon={ChevronDown}
                  size="sm"
                  className={`text-slate-400 transition-transform duration-200 ${supportOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div
                id="sidebar-support-panel"
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                  supportOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="mb-3 mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Саволе доред? Ба мо нависед.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Telegram", href: TELEGRAM_URL, bg: "#229ED9", icon: <Send className="h-5 w-5" /> },
                      { label: "WhatsApp", href: WHATSAPP_URL, bg: "#25D366", icon: <MessageCircle className="h-5 w-5" /> },
                      { label: "Instagram", href: INSTAGRAM_URL, bg: "#E4405F", icon: <InstagramIcon className="h-5 w-5" /> },
                    ].map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={item.label}
                        className="flex h-11 items-center justify-center gap-1.5 rounded-xl text-white text-xs font-semibold transition active:scale-95"
                        style={{ background: item.bg }}
                      >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </a>
                    ))}
                  </div>
                  <a
                    href="tel:+992002119831"
                    aria-label="+992 002 119 831"
                    className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 transition active:scale-95 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Ic icon={Send} size="sm" className="text-[var(--ios-blue)]" />
                    +992 002 119 831
                  </a>
                </div>
              </div>
            </div>

            {isAdmin && (
              <button type="button" onClick={() => go("/admin")} className={rowCls}>
                <Ic icon={Settings} className="text-slate-500 shrink-0" />
                {t("adminPanel")}
              </button>
            )}

            {/* 📦 Насб кардани барнома (PWA) — танҳо вақте роҳи насб ВОҚЕӢ
                мавҷуд: Android prompt / iPhone-дастур / http→HTTPS.
                Насб шуд → банд худкорона меравад (чизе барои амал нест). */}
            {showInstall && (
              <>
                <button
                  type="button"
                  onClick={() => void onInstall()}
                  disabled={installBusy}
                  aria-expanded={ios ? iosHint : undefined}
                  className={`${rowCls} disabled:cursor-wait disabled:opacity-60`}
                >
                  <Ic icon={Download} className="text-brand-500 shrink-0" />
                  {t("menuInstall")}
                </button>
                {ios && iosHint && (
                  <p className="mb-1 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    🍎 {t("appIosHint")}
                  </p>
                )}
              </>
            )}

            {user && (
              <button type="button" onClick={onLogout} className={`${rowCls} text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10`}>
                <Ic icon={LogOut} className="text-rose-500 shrink-0" />
                {t("logout")}
              </button>
            )}
          </nav>
        </div>

        {/* ⚙️ Панели поёнӣ: мавзӯ + забон (мисли RentHub) */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 flex flex-col gap-2.5">
          {/* ☀️/🌙 ИККИ АЛОҲИДА ТУГМА — ҳарду мавзӯро бевосита фаъол мекунад */}
          <div className="flex items-center gap-2" role="group" aria-label={t("theme")}>
            {([
              { key: "light" as const, icon: Sun, label: t("themeLight") },
              { key: "dark" as const, icon: Moon, label: t("themeDark") },
            ]).map((m) => {
              const active = theme === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    if (theme !== m.key) toggleTheme();
                  }}
                  aria-pressed={active}
                  aria-label={m.label}
                  title={m.label}
                  className={`inline-flex items-center justify-center gap-1.5 min-h-10 flex-1 rounded-xl px-3
                              text-[13px] font-semibold transition active:scale-[0.97]
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                                active
                                  ? "bg-blue-500 text-white shadow-sm"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                              }`}
                >
                  <Ic icon={m.icon} size="xs" />
                  {m.label}
                </button>
              );
            })}
          </div>


          {/* 🌐 Забон — 4 доира (флаг) */}
          <div
            role="group"
            aria-label={t("language")}
            className="flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-full p-1"
          >
            {LANGS.map((l) => {
              const active = lang === l.code;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLang(l.code)}
                  aria-pressed={active}
                  aria-label={l.label}
                  title={l.label}
                  className={`grid place-items-center w-8 h-8 rounded-full transition
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                                active
                                  ? "bg-white dark:bg-slate-700 ring-2 ring-blue-500 shadow-sm scale-105"
                                  : "hover:bg-white/60 dark:hover:bg-slate-700/60 active:scale-95"
                              }`}
                >
                  <Flag code={l.code} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 2 .2 2.7.5.7.3 1.3.7 1.9 1.3.6.6 1 1.2 1.3 1.9.3.7.4 1.5.5 2.7.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 2-.5 2.7-.3.7-.7 1.3-1.3 1.9-.6.6-1.2 1-1.9 1.3-.7.3-1.5.4-2.7.5-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-2-.2-2.7-.5-.7-.3-1.3-.7-1.9-1.3-.6-.6-1-1.2-1.3-1.9-.3-.7-.4-1.5-.5-2.7C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-2 .5-2.7.3-.7.7-1.3 1.3-1.9.6-.6 1.2-1 1.9-1.3.7-.3 1.5-.4 2.7-.5C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.2 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.3.8-.4.4-.6.8-.8 1.3-.2.4-.3 1-.4 2.1-.1 1.2-.1 1.5-.1 4.7s0 3.5.1 4.7c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.3.4.4.8.6 1.3.8.4.2 1 .3 2.1.4 1.2.1 1.5.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.3-.8.4-.4.6-.8.8-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.5.1-4.7s0-3.5-.1-4.7c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.4-.9-.8-1.3-.4-.4-.8-.6-1.3-.8-.4-.2-1-.3-2.1-.4-1.2-.1-1.5-.1-4.7-.1zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8zm0 1.8a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2zm6.3-.2a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0z" />
    </svg>
  );
}
