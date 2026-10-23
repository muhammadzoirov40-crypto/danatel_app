import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { LANGS } from "../i18n";
import { CatalogIcon, GoldCoin, OrdersIcon, TajikFlag } from "./Icons";

/**
 * Сарлавҳа — тарҳи мисли persshop.com:
 *   градиенти кабуд-нил, логотип, пайвандҳо, интихоби забон,
 *   баланс, профил/вуруд.
 */
export default function Navbar() {
  const { lang, setLang, t, user, balance, isAdmin, logout } = useApp();
  const nav = useNavigate();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const cur = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  // Пӯшидани рӯйхати забон ҳангами клик берун
  useEffect(() => {
    if (!langOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!langRef.current?.contains(e.target as Node)) setLangOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLangOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [langOpen]);

  const onLogout = () => {
    logout();
    nav("/");
  };

  const linkCls =
    "rounded-xl px-3 py-2 text-sm font-semibold text-white/85 hover:text-white " +
    "hover:bg-white/12 transition";

  return (
    <header className="sticky top-0 z-40 header-blue text-white">
      <div className="mx-auto max-w-6xl px-4 h-14 sm:h-16 flex items-center gap-2 sm:gap-3">
        {/* 💎 Логотип */}
        <Link
          to="/"
          className="flex items-center gap-2 font-black text-base sm:text-lg shrink-0 tracking-tight"
        >
          <span className="grid place-items-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 ring-1 ring-white/25 text-base sm:text-lg">
            💎
          </span>
          <span>{t("brand")}</span>
        </Link>

        {/* 🔗 Пайвандҳо (десктоп) */}
        <nav className="hidden md:flex items-center gap-1 ml-2">
          <Link to="/" className={linkCls}>
            <CatalogIcon className="w-4 h-4 opacity-90 inline-block mr-1" />
            <span>{t("navCatalog")}</span>
          </Link>
          <Link to={user ? "/profile" : "/login"} className={linkCls}>
            <OrdersIcon className="w-4 h-4 opacity-90 inline-block mr-1" />
            <span>{t("navOrders")}</span>
          </Link>
          {isAdmin && (
            <Link to="/admin" className={linkCls}>
              ⚙️ {t("adminPanel")}
            </Link>
          )}
        </nav>

        <div className="flex-1" />

        {/* 🌐 Забон */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full bg-white/15 ring-1 ring-white/25
                       px-3 py-1.5 text-xs sm:text-sm font-bold hover:bg-white/25 transition"
            title={t("language")}
            aria-haspopup="listbox"
            aria-expanded={langOpen}
          >
            {cur.code === "tj" ? (
              <TajikFlag className="w-4 h-2.5 rounded-xs" />
            ) : (
              <span>{cur.flag}</span>
            )}
            <span className="uppercase">{cur.code}</span>
            <span className="text-[10px] opacity-70">▾</span>
          </button>

          {langOpen && (
            <div
              role="listbox"
              className="absolute right-0 mt-2 w-40 rounded-2xl bg-white text-slate-800
                         border border-slate-200 shadow-xl overflow-hidden p-1 z-50"
            >
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  role="option"
                  aria-selected={lang === l.code}
                  onClick={() => {
                    setLang(l.code);
                    setLangOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm
                              font-medium transition ${
                                lang === l.code
                                  ? "bg-brand-50 text-brand-700"
                                  : "hover:bg-slate-50"
                              }`}
                >
                  {l.code === "tj" ? (
                    <TajikFlag className="w-4 h-2.5 rounded-xs" />
                  ) : (
                    <span>{l.flag}</span>
                  )}
                  <span>{l.label}</span>
                  {lang === l.code && <span className="ml-auto">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 🪙 Баланс (танга) */}
        <Link
          to={user ? "/profile" : "/login"}
          className="flex items-center gap-1.5 rounded-full bg-white/15 ring-1 ring-white/25
                     px-3 py-1.5 text-xs sm:text-sm font-black hover:bg-white/25 transition tabular-nums"
          title={t("balance")}
        >
          <GoldCoin className="w-4 h-4" />
          <span>{user ? Number(balance || 0).toLocaleString("tj-TJ") : "0"}</span>
        </Link>

        {/* 👤 Профил */}
        <Link
          to={user ? "/profile" : "/login"}
          className="grid place-items-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/20 ring-1 ring-white/30
                     text-xs sm:text-sm font-bold hover:bg-white/30 transition shrink-0"
          title={user ? t("profile") : t("login")}
        >
          {isAdmin ? "⚙" : "👤"}
        </Link>

        {/* ☰ Меню (ҳамбиргар) */}
        <Link
          to="/"
          className="grid place-items-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 ring-1 ring-white/25
                     text-sm font-bold hover:bg-white/25 transition shrink-0"
          title="Меню"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
