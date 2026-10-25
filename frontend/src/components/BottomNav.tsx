import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { House, LayoutGrid, Package, Plus, Send, Settings, User } from "lucide-react";
import { useApp } from "../context/AppContext";
import TopUpModal from "./TopUpModal";
import OrderSearchModal from "./OrderSearchModal";
import { Ic } from "./Icons";

/**
 * Навигатсияи поёнӣ (Bottom Navigation Bar) — мисли persshop.com:
 *   1) Асосӣ / Главная (ҳаракат ба боло)
 *   2) Каталог (ҳаракат ба рӯйхати бозиҳо)
 *   3) «Пур кардан» (кушодани модали пуркунии баланс)
 *   4) Фармоишҳо (профил ё ҷустуҷӯи рақами фармоиш — сабад дар лоиҳа НЕСТ)
 *   5) Профил (гузариш ба профил ё вуруд)
 *   + Тугмаи дастгирӣ дар Telegram
 * Ҳамаи иконкаҳо — Lucide, андозаи ягона 20px (`size="md"`).
 */
export default function BottomNav() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { user, lang, t, isAdmin, authReady } = useApp();

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);

  const isHome = pathname === "/";
  const isProfile = pathname === "/profile";
  const isLogin = pathname === "/login";

  const labels = {
    home: lang === "ru" ? "Главная" : lang === "uz" ? "Asosiy" : lang === "en" ? "Home" : "Асосӣ",
    catalog: lang === "ru" ? "Каталог" : lang === "uz" ? "Katalog" : lang === "en" ? "Catalog" : "Каталог",
    topup: lang === "ru" ? "Пополнить" : lang === "uz" ? "To'ldirish" : lang === "en" ? "Top up" : "Пур кардан",
    // Сабад дар ин лоиҳа вуҷуд надорад → номи рост: «Фармоишҳо»
    orders: t("orders"),
    profile: lang === "ru" ? "Профиль" : lang === "uz" ? "Profil" : lang === "en" ? "Profile" : "Профил",
  };

  /** 1) Асосӣ — ба саҳифаи асосӣ ва баландтарин нуқта */
  const handleHomeClick = (e: React.MouseEvent) => {
    if (isHome) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /** 2) Каталог — гузариш ба бахши бозиҳо (#games) */
  const handleCatalogClick = (e: React.MouseEvent) => {
    if (isHome) {
      e.preventDefault();
      const el = document.getElementById("games");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      e.preventDefault();
      nav("/");
      setTimeout(() => {
        const el = document.getElementById("games");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  /** 3) Пур кардан — кушодани равзанаи пуркунии баланс */
  const handleTopUpClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setTopUpOpen(true);
  };

  /** 4) Фармоишҳо — агар вуруд карда бошад ба профил, вагарна ҷустуҷӯи рақами фармоиш */
  const handleOrdersClick = (e: React.MouseEvent) => {
    if (user) {
      // Иҷозат медиҳад, ки мустақиман ба саҳифаи профил / фармоишҳо гузарад
    } else {
      e.preventDefault();
      setOrderSearchOpen(true);
    }
  };

  /** Класси ягона барои итеми ғайрифаъол.
   *  `flex-1 min-w-0` → ҳамаи 5 банд дар экранҳои танг (320–390px) ҷой мегиранд;
   *  `max-w-[84px]` → дар экранҳои васеъ қуттиҳо аз ҳад васта намешаванд;
   *  `truncate` → агар матн ҷой надошад, бо нуқтаҳо нишон дода мешавад. */
  const itemCls = (active: boolean) =>
    `flex-1 min-w-0 max-w-[84px] flex flex-col items-center justify-center transition-all active:scale-95
     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
       active
         ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl px-2.5 py-1.5 shadow-md shadow-blue-500/25"
         : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-1 py-1 rounded-2xl"
     }`;

  return (
    <>
      {/* Модалҳо */}
      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
      <OrderSearchModal open={orderSearchOpen} onClose={() => setOrderSearchOpen(false)} />

      {/* Тугмаи шинокунандаи дастгирӣ дар Telegram */}
      <a
        href="https://t.me/ONLAYN_ALMAZ_TJ_bot"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Дастгирӣ дар Telegram"
        className="fixed bottom-20 left-4 z-40 md:bottom-6 md:right-6 md:left-auto
                   w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600
                   text-white shadow-[0_8px_24px_-4px_rgba(37,99,235,0.5)]
                   grid place-items-center hover:scale-105 active:scale-95 transition-transform
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        <Ic icon={Send} size="lg" />
      </a>

      {/* ⚙️ Тугмаи шинокунандаи «Панели идора» — ТАНҲО барои админ, ТАНҲО иконка.
          `authReady` лозим аст: то расидани /auth/me тугма пинҳон мемонад,
          то корбари ғайриадмин тугмаи бемаъниро набинад.
          Мобилӣ: поён-чап, ДАР БОЛОИ тугмаи Telegram (Telegram = bottom-20, 80px;
          ин = 140px → танаффур 12px, ягон пӯшиш нест).
          Компютер (md+): поён-чап — Telegram дар он ҷо нест (= рост). */}
      {isAdmin && authReady && (
        <Link
          to="/admin"
          aria-label={t("adminPanel")}
          title={t("adminPanel")}
          className="fixed left-4 bottom-[8.75rem] z-40 md:left-6 md:bottom-6
                     w-12 h-12 rounded-full bg-gradient-to-tr from-slate-600 to-slate-800
                     text-white ring-1 ring-white/20
                     shadow-[0_8px_24px_-6px_rgba(15,23,42,0.55)]
                     grid place-items-center hover:scale-105 active:scale-95 transition-transform
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <Ic icon={Settings} size="lg" />
        </Link>
      )}

      {/* Панели навигатсияи поёнӣ (Bottom Navigation Dock) — дар телефон/планшет */}
      <nav
        aria-label="Навигатсияи поёнӣ"
        className="md:hidden fixed bottom-3 inset-x-3 z-50 max-w-md mx-auto
                   bg-white/95 backdrop-blur-xl border border-slate-200/90
                   shadow-[0_12px_36px_-6px_rgba(15,23,42,0.22)]
                   rounded-3xl px-2 py-1.5 flex items-center justify-between"
      >
        {/* 1) Асосӣ */}
        <Link to="/" onClick={handleHomeClick} aria-label={labels.home} className={itemCls(isHome)}>
          <Ic icon={House} size="md" />
          <span className="w-full text-center text-[10px] font-bold leading-none mt-0.5 truncate">
            {labels.home}
          </span>
        </Link>

        {/* 2) Каталог */}
        <button
          type="button"
          onClick={handleCatalogClick}
          aria-label={labels.catalog}
          className={itemCls(false)}
        >
          <Ic icon={LayoutGrid} size="md" />
          <span className="w-full text-center text-[10px] font-bold leading-none mt-0.5 truncate">
            {labels.catalog}
          </span>
        </button>

        {/* 3) Тугмаи калони марказӣ «Пур кардан» */}
        <button
          type="button"
          onClick={handleTopUpClick}
          aria-label={labels.topup}
          className="relative -mt-6 flex-1 min-w-0 max-w-[84px] flex flex-col items-center group
                     active:scale-95 transition-transform cursor-pointer
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-2xl"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600
                          text-white shadow-lg shadow-blue-600/35 flex items-center justify-center
                          ring-4 ring-white group-hover:scale-105 transition-transform">
            <Ic icon={Plus} size="lg" strokeWidth={2.75} />
          </div>
          <span className="w-full text-center text-[10px] font-extrabold text-slate-700 mt-1 leading-none truncate">
            {labels.topup}
          </span>
        </button>

        {/* 4) Фармоишҳо (сабад НЕСТ — ин фармоишҳои воқеӣ) */}
        <Link
          to={user ? "/profile" : "/login"}
          onClick={handleOrdersClick}
          aria-label={labels.orders}
          className={itemCls(isProfile && !isHome)}
        >
          <Ic icon={Package} size="md" />
          <span className="w-full text-center text-[10px] font-bold leading-none mt-0.5 truncate">
            {labels.orders}
          </span>
        </Link>

        {/* 5) Профил */}
        <Link
          to={user ? "/profile" : "/login"}
          aria-label={labels.profile}
          className={itemCls((isProfile || isLogin) && !isHome)}
        >
          <Ic icon={User} size="md" />
          <span className="w-full text-center text-[10px] font-bold leading-none mt-0.5 truncate">
            {labels.profile}
          </span>
        </Link>
      </nav>
    </>
  );
}
