import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Coins, Disc3, Info, LayoutGrid, Menu, Package, Send, Star } from "lucide-react";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import { GoldCoin, Ic } from "./Icons";
import Logo from "./Logo";
import SidebarMenu from "./SidebarMenu";

/**
 * Сарлавҳа — танҳо логотип + пайвандҳои пилюлавӣ (lg+) + бейҷи рейтинги
 * воқеӣ + TG + тугмаи ☰ (ҳамаи экранҳо → кушодани SIDEBAR).
 *
 *  ⚠️ ТАҒЙИРИ 28.10.2026 (талаби соҳиб): блоки рост (🌐 забон, 🌙 мавзӯ,
 *     🪙 баланс, 👤 профил) аз сарлавҳа БАРДОШТА ШУД → ҳамааш акнун дар
 *     SIDEBAR-меню аст (чат ба рост). Тугмаи ☰ дар ҳамаи экранҳо (аз ҷумла
 *     десктоп) намоён аст → sidebar дастрас аст.
 *
 *  ҲАМАИ тугмаҳо ба функсияи воқеӣ пайванданд:
 *   · Феҳрист      → /
 *   · Фармоишҳои ман → /orders (ё /login)
 *   · Чарх          → /wheel (гардиши тангаҳо)
 *   · Тақризҳо     → /reviews (саҳифаи алоҳида)
 *   · Дар бораи мo → бахши SEO дар саҳифаи асосӣ (#about)
 *   · TG           → https://t.me/ONLAYN_ALMAZ_TJ_bot
 *   · ☰            → SIDEBAR (забон / мавзӯ / баланс / профил / баромад)
 *
 *  ❗ Дар лоиҳа САБАД (cart) вуҷуд надорад → тугмаи сабад гузошта НАШУД.
 */
export default function Navbar() {
  const { t, user, balance } = useApp();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  /** 🪙 Pers Coins (тангаҳо) — барои таблочаи сарлавҳа (3 қисм: icon/balans/coin) */
  const [coins, setCoins] = useState<number | null>(null);
  useEffect(() => {
    if (!user) {
      setCoins(null);
      return;
    }
    let alive = true;
    api
      .myCoins()
      .then((d) => {
        if (alive) setCoins(d.coins);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, balance]);

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

  /** ➡️ «Дар бораи мo» — ба бахши SEO дар саҳифаи асосӣ */
  const goAbout = (e: React.MouseEvent) => {
    e.preventDefault();
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

  /** Тугмаи гардишӣ дар сарлавҳа (меню → SIDEBAR).
      ⚠️ 29.10.2026: мисли тасвир — ҳамон баландӣ бо таблочаи тиллоӣ,
      бе ring сахт (тоза ва якхела). */
  const iconBtn =
    "place-items-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/20 hover:bg-white/30 " +
    "text-white transition active:scale-95 shrink-0 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

  return (
    /* 📱 Сарлавҳа: дар МОБИЛӢ танҳо дар саҳифаи асосӣ (/); дар ДЕСКТОП
       ҳама ҷо (пайвандҳо + 🪙 баланс + ☰ меню дастрас).
       ⚠️ 28.10.2026 (талаби соҳиб): аз нав ба ҳолати аввал баргаштем, зеро
       сарлавҳа дар саҳифаҳои ғайри-асосии мобилӣ (аз ҷумла /profile)
       лозим нест — «dar profil headero nishon nadihad… tanho dar asosi
       nishon dihad». Дар мобилӣ навигатсия → BottomNav; дар десктоп
       сарлавҳа ҳама ҷо мемонад (кашодани меню/баланс). */
    <>
    <header
      className={`${pathname === "/" ? "" : "hidden md:block"} sticky top-0 z-40 nav-blue text-white`}
    >
      <div className="mx-auto max-w-6xl px-3 sm:px-4 h-14 sm:h-16 flex items-center gap-1.5 sm:gap-2">
        {/* 💎 Логотипи расмӣ (SVG) + калимаи «donatshop».
            ⚠️ 28.10.2026 (талаби соҳиб): калимаи бренда ҲАМЕША намоён
            (қаблӣ дар мобилӣ `hidden sm:inline` буд → танҳо нишонаи D). */}
        <Link to="/" className="shrink-0" title="donatshop" aria-label="donatshop">
          <Logo size={32} variant="onDark" withText textClass="text-[15px] sm:text-base" />
        </Link>

        {/* 🔗 Пайвандҳо — танҳо аз lg (дар экранҳои хурд дар меню) */}
        <nav className="hidden lg:flex items-center gap-1 ml-1" aria-label={t("navCatalog")}>
          <Link to="/" className={pillCls(pathname === "/")} aria-current={pathname === "/" ? "page" : undefined}>
            <Ic icon={LayoutGrid} className="opacity-90" />
            <span>{t("navCatalog")}</span>
          </Link>
          <Link
            to={user ? "/orders" : "/login"}
            className={pillCls(pathname === "/orders" || pathname === "/login")}
            aria-current={pathname === "/orders" ? "page" : undefined}
          >
            <Ic icon={Package} className="opacity-90" />
            <span>{t("navOrders")}</span>
          </Link>
          {/* 🎡 Чарх — саҳифаи воқеии гардиши тангаҳо */}
          <Link
            to="/wheel"
            className={pillCls(pathname === "/wheel")}
            aria-current={pathname === "/wheel" ? "page" : undefined}
          >
            <Ic icon={Disc3} className="opacity-90" />
            <span>{t("wheel")}</span>
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
        </nav>

        <div className="flex-1" />

        {/* ⭐ Бейҷи рейтинги воқеӣ (ҳатто 0) → /reviews */}
        {sum && (
          <Link
            to="/reviews"
            title={t("reviewsTitle")}
            aria-label={`${t("reviewsTitle")}: ${avg.toFixed(1)} / 5, ${total}`}
            className="hidden 2xl:inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 ring-1
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
          className="hidden 2xl:inline-flex items-center gap-1.5 rounded-full bg-white/15 ring-1
                     ring-white/25 px-3 py-1.5 text-sm font-black hover:bg-white/25 transition
                     active:scale-95 shrink-0 focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-white/70"
        >
          <Ic icon={Send} size="sm" />
          <span>TG</span>
        </a>

        {/* 🪙 Баланс — таблочаи 3 қисмӣ (мисли тасвир):
            ① iconka (тиллоӣ) → ② balans (TJS) → ③ coin (Pers Coins).
            Клик → /profile. Ҳама дар як сатр, фишурда. */}
        <Link
          to={user ? "/profile" : "/login"}
          aria-label={`${t("balance")}: ${user ? Number(balance || 0).toLocaleString("tj-TJ") : "0"}${
            coins !== null ? `, Pers Coins ${coins}` : ""
          }`}
          title={t("balance")}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30
                     px-2 sm:px-2.5 text-xs font-black text-white tabular-nums shrink-0
                     transition active:scale-95 focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-white/70"
        >
          {/* ① ICON — тангаи тиллоӣ (флипи 3D) */}
          <GoldCoin className="w-4 h-4 shrink-0 coin-spin" />
          {/* ② BALANS (TJS) */}
          <span>{user ? Number(balance || 0).toLocaleString("tj-TJ") : "0"}</span>
          {/* ③ COIN (Pers Coins) — агар мавҷуд бошад (флипи 3D) */}
          {coins !== null && (
            <>
              <span aria-hidden className="opacity-50">·</span>
              <span className="inline-flex items-center gap-1 text-amber-200">
                <Ic icon={Coins} size="xs" className="coin-spin" />
                <span>{coins}</span>
              </span>
            </>
          )}
        </Link>

        {/* ☰ Меню — ҲАМАИ экранҳо (мобилӣ + десктоп); кушодани SIDEBAR
            (чап→рост): забон, мавзӯ, баланс, профил, баромад — ҳама дар он ҷост */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={t("menu")}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          title={t("menu")}
          className={`${iconBtn} grid`}
        >
          <Ic icon={Menu} size="md" />
        </button>
      </div>
    </header>

      {/* 📚 SIDEBAR-MENЮ (чап → рост) — ҷудо аз <header> → overlay аз
          болои ҳамаи муҳтавои саҳифа мебарояд (з-[60] > z-40) */}
      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
