import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { House, LayoutGrid, Package, Plus, Settings, User } from "lucide-react";
import { useApp } from "../context/AppContext";
import TopUpModal from "./TopUpModal";
import OrderSearchModal from "./OrderSearchModal";
import { Ic } from "./Icons";

/**
 * Навигатсияи поёнӣ (Bottom Navigation Bar) — glassmorphism + градиенти
 * кабуд-фӣолетӣ.
 *
 *  📏 ИСЛОҲИ МАТН (талаби соҳиб, 28.10.2026):
 *   · Масъалаи қаблӣ: `max-w-[84px]` + `justify-between` → матн бурида
 *     мешуд («Пур ка…», «Фармо…»).
 *   · Ҳал: тақсимоти БАРОБАРИ `flex-1` (барои марказ `flex-[1.15]` —
 *     фазои барои «Пур кардан»), бе `max-w` cap, `gap` мувофиқ,
 *     `tracking-tight` → ҳамаи номҳо пурра ҷой мегиранд (310–430px).
 *   · `truncate` ҳамчун ОХИРИН нигоҳдоранда мондааст (агар хеле танг шавад),
 *     аммо дар 310px ҳам матн пурра намоён аст.
 *
 *  🎨 УСЛУБ: фони нимшиффоф + backdrop-blur (glass), қатти matched border,
 *    итеми фаъол = пилюлаи градиенти кабуд→фӣолетӣ бо сояи нарм,
 *    итеми ғайрифаъол = хокистарии мулоими TCAG (WCAG-хонда).
 *
 *  ҲАМАИ тугмаҳо ба функсияи воқеӣ пайванданд:
 *   1) Асосӣ → / (боло)
 *   2) Каталог → #games
 *   3) Пур кардан → модали пуркунии баланс
 *   4) Фармоишҳо → /orders (ё ҷустуҷӯи рақами фармоиш)
 *   5) Профил → /profile (ё /login)
 *   + Тугмаи дастгирӣ дар Telegram
 */
export default function BottomNav() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { user, lang, t, isAdmin, authReady } = useApp();

  /** 🦶 Вақте футер дар экран аст (саҳифаи асосӣ), тугмаҳои шинокунанда
   *  пинҳон мешаванд — то логотипи футерро пӯшида накунанд. */
  const [footerOnScreen, setFooterOnScreen] = useState(false);

  useEffect(() => {
    const el = document.querySelector("footer");
    if (!el || typeof IntersectionObserver === "undefined") {
      setFooterOnScreen(false);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => setFooterOnScreen(entries.some((e) => e.isIntersecting)),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pathname]);

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);

  const isHome = pathname === "/";
  const isProfile = pathname === "/profile";
  const isOrders = pathname === "/orders";
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

  /** Класси ягона барои итемҳои чап/рост.
   *  `flex-1 min-w-0` → тақсимоти БАРОБАР (бе `max-w` cap) → матн бурида НАМЕШАВАД;
   *  `gap` дар контейнер → танаффури зебо;
   *  `tracking-tight` → фазои бештар барои ҳарфҳо;
   *  `truncate` танҳо охирин нигоҳдоранда. */
  const itemCls = (active: boolean) =>
    `relative flex-1 min-w-0 flex flex-col items-center justify-center gap-1 rounded-2xl
     px-0 py-1.5 transition-all active:scale-95
     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
       active
         ? "text-white bg-gradient-to-b from-blue-600 via-indigo-600 to-purple-600 shadow-[0_6px_16px_-4px_rgba(79,70,229,0.55)]"
         : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
     }`;

  /** Матни зeri иконка — ягона барои ҳама (ҳамеша пурра, охир truncate) */
  const labelCls =
    "w-full text-center text-[8.5px] font-semibold tracking-[-0.02em] leading-none truncate";

  return (
    <>
      {/* Модалҳо */}
      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
      <OrderSearchModal open={orderSearchOpen} onClose={() => setOrderSearchOpen(false)} />

      {/* ⚙️ Тугмаи шинокунандаи «Панели идора» — ТАНҲО барои админ, ТАНҲО иконка. */}
      {isAdmin && authReady && !footerOnScreen && (
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

      {/* 🧭 Панели навигатсияи поёнӣ — GLASSMORPHISM + градиенти кабуд-фӣолетӣ.
          `items-stretch gap-1.5` → 5 банди БАРОБАР бо танаффури зебо;
          `flex-[1.15]` барои марказ → «Пур кардан» пурра ҷой мегирад. */}
      <nav
        aria-label="Навигатсияи поёнӣ"
        className="md:hidden fixed bottom-3 inset-x-3 z-50 max-w-md mx-auto
                   bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl
                   border border-white/60 dark:border-slate-700/60
                   shadow-[0_12px_40px_-8px_rgba(31,38,135,0.28)]
                   rounded-[26px] px-1 py-2 flex items-stretch gap-1"
      >
        {/* 1) Асосӣ */}
        <Link to="/" onClick={handleHomeClick} aria-label={labels.home} className={itemCls(isHome)}>
          <Ic icon={House} size="md" strokeWidth={isHome ? 2.4 : 2} />
          <span className={labelCls}>{labels.home}</span>
        </Link>

        {/* 2) Каталог */}
        <button
          type="button"
          onClick={handleCatalogClick}
          aria-label={labels.catalog}
          className={itemCls(false)}
        >
          <Ic icon={LayoutGrid} size="md" />
          <span className={labelCls}>{labels.catalog}</span>
        </button>

        {/* 3) Тугмаи калони марказӣ «Пур кардан» — CTA бо градиент + FAB бардошта */}
        <button
          type="button"
          onClick={handleTopUpClick}
          aria-label={labels.topup}
          className="relative flex-[1.15] min-w-0 -mt-6 flex flex-col items-center justify-center group
                     active:scale-95 transition-transform cursor-pointer rounded-2xl
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <div
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600
                       text-white shadow-[0_10px_22px_-6px_rgba(79,70,229,0.6)] flex items-center justify-center
                       ring-4 ring-white dark:ring-slate-900 group-hover:scale-105 transition-transform"
          >
            <Ic icon={Plus} size="lg" strokeWidth={2.75} />
          </div>
          <span className="w-full text-center text-[8.5px] font-bold tracking-[-0.02em] text-slate-700 dark:text-slate-200 mt-1 leading-none truncate">
            {labels.topup}
          </span>
        </button>

        {/* 4) Фармоишҳо (сабад НЕСТ — ин фармоишҳои воқеӣ) */}
        <Link
          to={user ? "/orders" : "/login"}
          onClick={handleOrdersClick}
          aria-label={labels.orders}
          className={itemCls(isOrders && !isHome)}
        >
          <Ic icon={Package} size="md" strokeWidth={isOrders && !isHome ? 2.4 : 2} />
          <span className={labelCls}>{labels.orders}</span>
        </Link>

        {/* 5) Профил */}
        <Link
          to={user ? "/profile" : "/login"}
          aria-label={labels.profile}
          className={itemCls((isProfile || isLogin) && !isHome)}
        >
          <Ic icon={User} size="md" strokeWidth={(isProfile || isLogin) && !isHome ? 2.4 : 2} />
          <span className={labelCls}>{labels.profile}</span>
        </Link>
      </nav>
    </>
  );
}
