import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronDown, LayoutGrid, LogOut, Menu, Package, Settings, User } from "lucide-react";
import { useApp } from "../context/AppContext";
import { LANGS } from "../i18n";
import { GoldCoin, Ic, TajikFlag } from "./Icons";
import Logo from "./Logo";

/**
 * Сарлавҳа — тарҳи мисли persshop.com:
 *   градиенти кабуд-нил, логотип, пайвандҳо, интихоби забон,
 *   баланс, профил/вуруд.
 */
export default function Navbar() {
  const { lang, setLang, t, user, balance, isAdmin, logout } = useApp();
  const nav = useNavigate();
  const [langOpen, setLangOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cur = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  // Пӯшидани рӯйхатҳо ҳангами клик берун ё калиди Escape
  useEffect(() => {
    if (!langOpen && !menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLangOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [langOpen, menuOpen]);

  const onLogout = () => {
    logout();
    nav("/");
  };

  const linkCls =
    "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold " +
    "text-white/85 hover:text-white hover:bg-white/12 transition focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-white/70";

  return (
    <header className="sticky top-0 z-40 nav-blue text-white">
      <div className="mx-auto max-w-6xl px-4 h-14 sm:h-16 flex items-center gap-2 sm:gap-3">
        {/* 💎 Логотипи расмӣ (SVG) — variant «onDark» барои навбари кабуд */}
        <Link to="/" className="shrink-0" title="danatel.tj">
          <Logo
            size={34}
            variant="onDark"
            withText
            textClass="text-base sm:text-lg"
          />
        </Link>

        {/* 🔗 Пайвандҳо (десктоп) */}
        <nav className="hidden md:flex items-center gap-1 ml-2">
          <Link to="/" className={linkCls}>
            <Ic icon={LayoutGrid} className="opacity-90" />
            <span>{t("navCatalog")}</span>
          </Link>
          <Link to={user ? "/profile" : "/login"} className={linkCls}>
            <Ic icon={Package} className="opacity-90" />
            <span>{t("navOrders")}</span>
          </Link>
          {isAdmin && (
            <Link to="/admin" className={linkCls}>
              <Ic icon={Settings} className="opacity-90" />
              <span>{t("adminPanel")}</span>
            </Link>
          )}
        </nav>

        <div className="flex-1" />

        {/* 🌐 Забон */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full bg-white/15 ring-1 ring-white/25
                       px-3 py-1.5 text-xs sm:text-sm font-bold hover:bg-white/25 transition
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            title={t("language")}
            aria-label={t("language")}
            aria-haspopup="listbox"
            aria-expanded={langOpen}
          >
            {cur.code === "tj" ? (
              <TajikFlag className="w-4 h-2.5 rounded-xs" />
            ) : (
              <span>{cur.flag}</span>
            )}
            <span className="uppercase">{cur.code}</span>
            <Ic
              icon={ChevronDown}
              size="xs"
              className={`opacity-70 transition-transform ${langOpen ? "rotate-180" : ""}`}
            />
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
                  {lang === l.code && (
                    <Ic icon={Check} size="xs" className="ml-auto text-brand-600" />
                  )}
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

        {/* 👤 Профил / Вуруд */}
        <Link
          to={user ? "/profile" : "/login"}
          aria-label={user ? t("profile") : t("login")}
          className="grid place-items-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/20 ring-1 ring-white/30
                     text-xs sm:text-sm font-bold hover:bg-white/30 transition active:scale-95 shrink-0
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          title={user ? t("profile") : t("login")}
        >
          <Ic icon={isAdmin ? Settings : User} size="md" />
        </Link>

        {/* ☰ Меню — рӯйхати воқеии амалҳо (профил / админ / баромад) */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t("menu")}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={t("menu")}
            className="grid place-items-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 ring-1 ring-white/25
                       text-sm font-bold hover:bg-white/25 transition active:scale-95 shrink-0
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <Ic icon={Menu} size="md" className={`transition-transform ${menuOpen ? "rotate-90" : ""}`} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 rounded-2xl bg-white text-slate-800
                         border border-slate-200 shadow-xl overflow-hidden p-1 z-50"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  nav(user ? "/profile" : "/login");
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium
                           hover:bg-slate-50 transition text-left"
              >
                <Ic icon={User} className="text-slate-400" />
                {user ? t("profile") : t("login")}
              </button>

              {isAdmin && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    nav("/admin");
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium
                             hover:bg-slate-50 transition text-left"
                >
                  <Ic icon={Settings} className="text-slate-400" />
                  {t("adminPanel")}
                </button>
              )}

              <div className="h-px bg-slate-100 my-1" />

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold
                           text-rose-600 hover:bg-rose-50 transition text-left"
              >
                <Ic icon={LogOut} />
                {t("logout")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
