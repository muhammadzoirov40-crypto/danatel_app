import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Check,
  ChevronDown,
  Info,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Package,
  Send,
  Settings,
  Star,
  Sun,
  User,
} from "lucide-react";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import { LANGS } from "../i18n";
import { GoldCoin, Ic, RussianFlag, TajikFlag, USAFlag, UzbekFlag } from "./Icons";
import Logo from "./Logo";

/**
 * Сарлавҳа — услуби «Pers Shop»: логотип, пайвандҳои пилюлавӣ бо иконка,
 * тугмаҳои торик-равшан, забон, баланс, профил ва баромад.
 *
 *  ҲАМАИ тугмаҳо ба функсияи воқеӣ пайванданд:
 *   · Феҳрист      → /
 *   · Фармоишҳои ман → /profile (ё /login)
 *   · Тақризҳо     → /reviews (саҳифаи алоҳида)
 *   · Дар бораи мo → бахши SEO дар саҳифаи асосӣ (#about)
 *   · TG           → https://t.me/ONLAYN_ALMAZ_TJ_bot
 *   · 🌙/☀️        → мавзӯи воқеӣ (localStorage)
 *   · 🪙 баланс    → /profile
 *   · 🚪 баромад   → logout (токен дар сервер бекор мешавад)
 *
 *  ❗ Дар лоиҳа САБАД (cart) вуҷуд надорад → тугмаи сабад гузошта НАШУД,
 *  то тугмаи бекоркор пайдо нашавад (дар сабти корҳо қайд шудааст).
 */
export default function Navbar() {
  const { lang, setLang, t, user, balance, isAdmin, logout, theme, toggleTheme } = useApp();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [langOpen, setLangOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cur = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  /** ⭐ Рейтинги воқеӣ аз ҷадвали тақризҳои тасдиқшуда → /reviews */
  const [sum, setSum] = useState<{ rating_avg: number; reviews_total: number } | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .reviewSummary()
      .then((d) => {
        if (alive) setSum(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const avg = sum?.rating_avg ?? 0;
  const total = sum?.reviews_total ?? 0;

  // Пӯшидани рӯйхатҳо ҳангоми клик берун ё калиди Escape
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

  /** ➡️ «Дар бораи мo» — ба бахши SEO дар саҳифаи асосӣ */
  const goAbout = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(false);
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

  /** Пайвандҳои пилюлавӣ (мисли «Феҳрист / Харидхо / Тақризхо») */
  const pillCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition
     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
       active ? "bg-white/20 text-white" : "text-white/85 hover:text-white hover:bg-white/15"
     }`;

  /** Тугмаи гардишӣ дар сарлавҳа (забон / мавзӯ / профил / баромад / меню) */
  const iconBtn =
    "place-items-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/15 ring-1 ring-white/25 " +
    "text-white hover:bg-white/25 transition active:scale-95 shrink-0 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

  return (
    <header className="sticky top-0 z-40 nav-blue text-white">
      <div className="mx-auto max-w-6xl px-3 sm:px-4 h-14 sm:h-16 flex items-center gap-1.5 sm:gap-2">
        {/* 💎 Логотипи расмӣ (SVG) */}
        <Link to="/" className="shrink-0" title="donatshop" aria-label="donatshop">
          <Logo size={32} variant="onDark" withText textClass="hidden sm:inline" />
        </Link>

        {/* 🔗 Пайвандҳо — танҳо аз lg (дар экранҳои хурд дар меню) */}
        <nav className="hidden lg:flex items-center gap-1 ml-1" aria-label={t("navCatalog")}>
          <Link to="/" className={pillCls(pathname === "/")} aria-current={pathname === "/" ? "page" : undefined}>
            <Ic icon={LayoutGrid} className="opacity-90" />
            <span>{t("navCatalog")}</span>
          </Link>
          <Link
            to={user ? "/profile" : "/login"}
            className={pillCls(pathname === "/profile" || pathname === "/login")}
            aria-current={pathname === "/profile" ? "page" : undefined}
          >
            <Ic icon={Package} className="opacity-90" />
            <span>{t("navOrders")}</span>
          </Link>
          <Link
            to="/reviews"
            className={pillCls(pathname === "/reviews")}
            aria-current={pathname === "/reviews" ? "page" : undefined}
          >
            <Ic icon={Star} className="opacity-90" />
            <span>{t("navReviews")}</span>
          </Link>
          <button type="button" onClick={goAbout} className={pillCls(false)}>
            <Ic icon={Info} className="opacity-90" />
            <span>{t("navAbout")}</span>
          </button>
          {/* ⚠️ Тугмаи «Панели идора» аз сарлавҳа БАРДОШТА ШУД →
              акнун тангмаи шинокунандаи иконкаӣ дар поён-чап (BottomNav) */}
        </nav>

        <div className="flex-1" />

        {/* ⭐ Бейҷи рейтинги воқеӣ (ҳатто 0) → /reviews */}
        {sum && (
          <Link
            to="/reviews"
            title={t("reviewsTitle")}
            aria-label={`${t("reviewsTitle")}: ${avg.toFixed(1)} / 5, ${total}`}
            className="hidden xl:inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 ring-1
                       ring-amber-300/50 px-3 py-1.5 text-sm font-black text-white
                       hover:bg-amber-400/30 transition active:scale-95 shrink-0
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <Ic icon={Star} size="xs" className="text-amber-300 fill-current" />
            <span className="tabular-nums">{avg.toFixed(1)}</span>
            <span className="font-semibold text-white/75">
              ({total} {t("ratedPeople")})
            </span>
          </Link>
        )}

        {/* ✈️ Telegram — дастгирии воқеӣ */}
        <a
          href="https://t.me/ONLAYN_ALMAZ_TJ_bot"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Telegram"
          title="Telegram"
          className="hidden xl:inline-flex items-center gap-1.5 rounded-full bg-white/15 ring-1
                     ring-white/25 px-3 py-1.5 text-sm font-black hover:bg-white/25 transition
                     active:scale-95 shrink-0 focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-white/70"
        >
          <Ic icon={Send} size="sm" />
          <span>TG</span>
        </a>

        {/* 🌐 Забон */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full bg-white/15 ring-1 ring-white/25
                       px-2.5 py-1.5 text-xs sm:text-sm font-bold hover:bg-white/25 transition
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            title={t("language")}
            aria-label={t("language")}
            aria-haspopup="listbox"
            aria-expanded={langOpen}
          >
            {cur.code === "tj" ? (
              <TajikFlag className="w-4 h-2.5 rounded-xs" />
            ) : cur.code === "ru" ? (
              <RussianFlag className="w-4 h-2.5 rounded-xs" />
            ) : cur.code === "en" ? (
              <USAFlag className="w-4 h-2.5 rounded-xs" />
            ) : (
              <UzbekFlag className="w-4 h-2.5 rounded-xs" />
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
                  ) : l.code === "ru" ? (
                    <RussianFlag className="w-4 h-2.5 rounded-xs" />
                  ) : l.code === "en" ? (
                    <USAFlag className="w-4 h-2.5 rounded-xs" />
                  ) : (
                    <UzbekFlag className="w-4 h-2.5 rounded-xs" />
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

        {/* 🌙 Мавзӯи равшан / торик — функсияи воқеӣ */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("themeLight") : t("themeDark")}
          title={theme === "dark" ? t("themeLight") : t("themeDark")}
          className={`${iconBtn} grid`}
        >
          <Ic
            icon={theme === "dark" ? Sun : Moon}
            size="md"
            className={theme === "dark" ? "text-amber-300" : "text-white/90"}
          />
        </button>

        {/* 🪙 Баланс (тангаи воқеӣ) */}
        <Link
          to={user ? "/profile" : "/login"}
          className="flex items-center gap-1.5 rounded-full bg-white/15 ring-1 ring-white/25
                     px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-black hover:bg-white/25
                     transition tabular-nums shrink-0
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          title={t("balance")}
        >
          <GoldCoin className="w-4 h-4" />
          <span>{user ? Number(balance || 0).toLocaleString("tj-TJ") : "0"}</span>
        </Link>

        {/* 👤 Профил / Вуруд */}
        <Link
          to={user ? "/profile" : "/login"}
          aria-label={user ? t("profile") : t("login")}
          title={user ? t("profile") : t("login")}
          className={`${iconBtn} grid bg-white/20 ring-white/30 text-xs sm:text-sm font-bold`}
        >
          <Ic icon={isAdmin ? Settings : User} size="md" />
        </Link>

        {/* 🚪 Баромад — танҳо дар десктоп (дар телефон дар меню) */}
        {user && (
          <button
            type="button"
            onClick={onLogout}
            aria-label={t("logout")}
            title={t("logout")}
            className={`${iconBtn} hidden md:grid`}
          >
            <Ic icon={LogOut} size="md" />
          </button>
        )}

        {/* ☰ Меню — танҳо телефон (дар десктоп ҳама пайвандҳо намоёнанд) */}
        <div className="relative md:hidden" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t("menu")}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={t("menu")}
            className={`${iconBtn} grid`}
          >
            <Ic
              icon={Menu}
              size="md"
              className={`transition-transform ${menuOpen ? "rotate-90" : ""}`}
            />
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

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  nav("/reviews");
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium
                           hover:bg-slate-50 transition text-left"
              >
                <Ic icon={Star} className="text-amber-400 fill-current" />
                {t("navReviews")}
              </button>

              <button type="button" role="menuitem" onClick={goAbout} className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-slate-50 transition text-left">
                <Ic icon={Info} className="text-slate-400" />
                {t("navAbout")}
              </button>

              {!user && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    nav("/login");
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium
                             hover:bg-slate-50 transition text-left"
                >
                  <Ic icon={LogIn} className="text-slate-400" />
                  {t("login")}
                </button>
              )}

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

              {user && (
                <>
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
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
