import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { LANGS } from "../i18n";

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
    <header className="sticky top-0 z-40 header-blue text-white shadow-[0_8px_24px_-16px_rgba(15,23,61,0.6)]">
      <div className="mx-auto max-w-6xl px-4 h-14 sm:h-16 flex items-center gap-2 sm:gap-3">
        {/* 💎 Логотип */}
        <Link
          to="/"
          className="flex items-center gap-2 font-extrabold text-base sm:text-lg shrink-0 tracking-tight"
        >
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/25 text-lg">
            💎
          </span>
          <span className="hidden sm:inline">{t("brand")}</span>
        </Link>

        {/* 🔗 Пайвандҳо (десктоп) */}
        <nav className="hidden md:flex items-center gap-1 ml-1">
          <Link to="/" className={linkCls}>
            ▦ {t("navCatalog")}
          </Link>
          {user && (
            <Link to="/profile" className={linkCls}>
              📦 {t("navOrders")}
            </Link>
          )}
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
            className="flex items-center gap-1.5 rounded-xl bg-white/12 ring-1 ring-white/25
                       px-2.5 py-2 text-sm font-semibold hover:bg-white/20 transition"
            title={t("language")}
            aria-haspopup="listbox"
            aria-expanded={langOpen}
          >
            🌐 <span className="uppercase">{cur.code}</span>
            <span className="text-[10px] opacity-70">▾</span>
          </button>

          {langOpen && (
            <div
              role="listbox"
              className="absolute right-0 mt-2 w-40 rounded-2xl bg-white text-slate-800
                         border border-slate-200 shadow-xl overflow-hidden p-1"
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
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                  {lang === l.code && <span className="ml-auto">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 💰 Баланс — танҳо барои корбари вурудкарда */}
        {user && (
          <Link
            to="/profile"
            className="flex items-center gap-1.5 rounded-xl bg-white/12 ring-1 ring-white/25
                       px-2.5 py-2 text-sm font-bold hover:bg-white/20 transition"
            title={t("balance")}
          >
            💰
            <span className="tabular-nums">
              {Number(balance || 0).toLocaleString("tj-TJ")}
            </span>
          </Link>
        )}

        {/* 👤 Профил / Вуруд */}
        {user ? (
          <div className="flex items-center gap-1.5">
            <Link
              to="/profile"
              className="grid place-items-center w-9 h-9 rounded-full bg-white/20 ring-1 ring-white/30
                         text-sm font-bold hover:bg-white/30 transition"
              title={t("profile")}
            >
              {isAdmin ? "⚙" : "👤"}
            </Link>
            <button
              onClick={onLogout}
              className="hidden sm:grid place-items-center w-9 h-9 rounded-full
                         bg-white/10 ring-1 ring-white/20 hover:bg-white/20 transition"
              title={t("logout")}
            >
              ⎋
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="rounded-xl bg-white px-3.5 py-2 text-sm font-bold text-brand-700
                       hover:bg-white/90 transition shadow-sm"
          >
            {t("login")}
          </Link>
        )}
      </div>
    </header>
  );
}
