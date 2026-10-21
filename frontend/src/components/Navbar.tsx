import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { LANGS } from "../i18n";

/** Сарлавҳа + интихоби забон + баланс */
export default function Navbar() {
  const { lang, setLang, t, user, balance, isAdmin, logout } = useApp();
  const nav = useNavigate();

  const onLogout = () => {
    logout();
    nav("/");
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-white/90 border-b border-slate-200">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-3">
        {/* Логотип */}
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-brand-600 text-white text-lg">
            💎
          </span>
          <span className="hidden sm:inline">{t("brand")}</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* 💰 Баланс — танҳо барои корбари вурудкарда */}
          {user && (
            <Link
              to="/profile"
              className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition"
              title={t("balance")}
            >
              💰
              <span className="tabular-nums">
                {balance.toLocaleString("tj-TJ")}
              </span>
            </Link>
          )}

          {/* Забон — мобилӣ: хурд, десктоп: калон */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 p-1">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                title={l.label}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-sm transition ${
                  lang === l.code
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="sm:hidden">{l.flag}</span>
                <span className="hidden sm:inline">
                  {l.flag} {l.code.toUpperCase()}
                </span>
              </button>
            ))}
          </div>

          {/* 👤 Профил — барои корбари оддӣ */}
          {user && !isAdmin && (
            <Link to="/profile" className="btn-ghost text-sm" title={t("profile")}>
              👤 <span className="hidden md:inline">{t("profile")}</span>
            </Link>
          )}

          <Link
            to="/admin"
            className="btn-ghost text-sm hidden sm:inline-flex"
            title={t("adminPanel")}
          >
            ⚙️ <span className="hidden md:inline">{t("adminPanel")}</span>
          </Link>

          {isAdmin && (
            <button onClick={onLogout} className="btn-ghost text-sm">
              ⎋ <span className="hidden md:inline">{t("logout")}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
