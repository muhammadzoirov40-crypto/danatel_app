import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Disc3,
  Info,
  LayoutGrid,
  LogIn,
  LogOut,
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
import {
  Ic,
  RussianFlag,
  TajikFlag,
  USAFlag,
  UzbekFlag,
} from "./Icons";
import Logo from "./Logo";

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
 *   · Панели идора  → /admin (танҳо барои админ)
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
  onClose: () => void;
}) {
  const { lang, setLang, t, user, isAdmin, logout, theme, toggleTheme } =
    useApp();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

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
    logout();
    onClose();
    nav("/");
  };

  /** ➡️ «Дар бораи мo» — ба бахши SEO дар саҳифаи асосӣ */
  const goAbout = () => {
    onClose();
    const scroll = () => {
      const el = document.getElementById("about");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    };
    if (pathname !== "/") {
      nav("/");
      setTimeout(scroll, 150);
    } else {
      scroll();
    }
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
    onClose();
    nav(to);
  };

  const rowCls =
    "w-full flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[15px] font-semibold " +
    "text-slate-700 hover:bg-slate-100 active:scale-[.98] transition text-left " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

  return (
    <>
      {/* 🌫️ Overlay — клик берун мепӯшад */}
      <div
        onClick={onClose}
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
          <span className="grid place-items-center w-11 h-11 rounded-full bg-blue-50 dark:bg-slate-800 ring-1 ring-blue-100 dark:ring-slate-700 shrink-0">
            <Logo size={26} variant="onLight" />
          </span>
          <span className="flex-1 min-w-0 font-black text-[17px] tracking-tight text-slate-900 dark:text-white truncate">
            {t("brand")}
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
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

            {/* ✈️ Дастгирӣ дар Telegram — пайванди воқеӣ ба бот (кушода
                дар таби нав). Қаблан тугмаи шинокунанда дар саҳифа буд;
                аккун дар меню, то саҳифа тоза шавад (талаби соҳиб, 28.10.2026). */}
            <a
              href="https://t.me/ONLAYN_ALMAZ_TJ_bot"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Дастгирӣ дар Telegram"
              title="Дастгирӣ дар Telegram"
              className={rowCls}
            >
              <Ic icon={Send} className="text-sky-500 shrink-0" />
              Дастгирӣ дар Telegram
            </a>

            {isAdmin && (
              <button type="button" onClick={() => go("/admin")} className={rowCls}>
                <Ic icon={Settings} className="text-slate-500 shrink-0" />
                {t("adminPanel")}
              </button>
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
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3.5 flex items-center gap-2">
          {/* 🌙 Мавзӯи равшан / торик — ТАНҲО ИКОНКА (бе матн), то бо
              флагҳои забон якхела ва зебо шавад (талаби соҳиб, 28.10.2026).
              `aria-label` + `title` барои screen-reader/tooltip боқӣ. */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? t("themeLight") : t("themeDark")}
            title={theme === "dark" ? t("themeLight") : t("themeDark")}
            className="grid place-items-center w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800
                       text-slate-600 dark:text-slate-300
                       ring-1 ring-slate-200 dark:ring-slate-700 shrink-0
                       hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <Ic
              icon={theme === "dark" ? Sun : Moon}
              size="sm"
              className={theme === "dark" ? "text-amber-400" : "text-slate-500"}
            />
          </button>

          <div className="flex-1" />

          {/* 🌐 Забон — 4 доира (флаг) */}
          <div
            role="group"
            aria-label={t("language")}
            className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-full p-1"
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
