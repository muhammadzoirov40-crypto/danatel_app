import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { LANGS } from "../i18n";
import { setToken } from "../api/client";

/** Сарлавҳа + интихоби забон */
export default function Navbar() {
  const { lang, setLang, t, isAdmin, setAdmin } = useApp();
  const nav = useNavigate();

  const logout = () => {
    setToken(null);
    setAdmin(false);
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

          <Link
            to="/admin"
            className="btn-ghost text-sm hidden sm:inline-flex"
            title={t("adminPanel")}
          >
            ⚙️ <span className="hidden md:inline">{t("adminPanel")}</span>
          </Link>

          {isAdmin && (
            <button onClick={logout} className="btn-ghost text-sm">
              ⎋ <span className="hidden md:inline">{t("logout")}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
