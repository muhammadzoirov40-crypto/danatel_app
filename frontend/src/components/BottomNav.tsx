import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Headphones, House, Package, Plus, User } from "lucide-react";
import { useApp } from "../context/AppContext";
import TopUpModal from "./TopUpModal";
import OrderSearchModal from "./OrderSearchModal";
import { Ic } from "./Icons";
import SupportSheet from "./SupportSheet";

/**
 * Навигатсияи поёнӣ (Bottom Navigation Bar) — glassmorphism + градиенти
 * кабуд-фӣолетӣ.
 *
 *  📏 НОМҲО НЕСТ (талаби соҳиб, 31.10.2026):
 *   · Тугмаҳо танҳо бо иконка — матнҳои зери иконка («Асосӣ», «Каталог»,
 *     «Пур кардан», «Фармоишҳо», «Профил») нест карда шуданд.
 *   · `aria-label` барои ҳар итем МОНДАСТ (WCAG) — screen reader номҳоро
 *     мехонад, қалби тугма 44px+ меборад.
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
  const { user, lang, t } = useApp();

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);

  const isHome = pathname === "/";
  const isProfile = pathname === "/profile";
  const isOrders = pathname === "/orders";
  const isLogin = pathname === "/login";
  /**
   * Пинҳон кардани навигатор:
   *   · /order/:id — то аз болои мазмун набарояд;
   *   · /login (вуруд/қайд) — талаби соҳиб (31.10.2026): navbar-и поёнӣ
   *     дар login/register даркор нест.
   *   · /admin — панели идора табҳои худашро дорад; navbar-и поёнии муштариён
   *     дар он ҷо лозим нест ва ҷои контентро мегирад (талаби соҳиб 01.11.2026).
   */
  const hideNav = pathname.startsWith("/order/") || isLogin || pathname === "/admin";

  useEffect(() => {
    setSupportOpen(false);
  }, [pathname]);

  const labels = {
    home: lang === "ru" ? "Главная" : lang === "uz" ? "Asosiy" : lang === "en" ? "Home" : "Асосӣ",
    support: t("support"),
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
   *  `flex-1 min-w-0` → тақсимоти БАРОБАР;
   *  танҳо иконка (бе матн) → `py-3` барои қалби ламс ≥44px. */
  const itemCls = (active: boolean) =>
    `relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5
     rounded-xl px-0 py-1.5 transition-colors
     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
       active
         ? "text-blue-500 dark:text-blue-400"
         : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
     }`;
  const labelCls = (active: boolean) =>
    `text-[10px] leading-none font-medium ${active ? "" : "opacity-90"}`;

  return (
    <>
      {/* Модалҳо */}
      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
      <OrderSearchModal open={orderSearchOpen} onClose={() => setOrderSearchOpen(false)} />

      {/* 🧭 Панели навигатсияи поёнӣ — GLASSMORPHISM + градиенти кабуд-фӣолетӣ.
          Танҳо иконкаҳо (бе ном) — 5 банди баробар; номҳо танҳо
          дар `aria-label` (дастрасӣ). */}
      <nav
        aria-label="Навигатсияи поёнӣ"
        data-bottomnav=""
        className={`md:hidden fixed bottom-0 inset-x-0 z-50 mx-auto
                   ios-bar ios-tabbar max-w-md
                   px-2 pt-2 ${hideNav ? "hidden" : "flex"} items-stretch gap-1`}
      >
        {/* 1) Асосӣ */}
        <Link to="/" onClick={handleHomeClick} aria-label={labels.home} title={labels.home} className={itemCls(isHome)}>
          <Ic icon={House} size="md" strokeWidth={1.75} />
          <span className={labelCls(isHome)}>{labels.home}</span>
        </Link>

        {/* 2) Дастгирӣ — bottom sheet */}
        <button
          type="button"
          onClick={() => setSupportOpen(true)}
          aria-label={labels.support}
          title={labels.support}
          className={itemCls(supportOpen)}
        >
          <Ic icon={Headphones} size="md" strokeWidth={1.75} />
          <span className={labelCls(supportOpen)}>{labels.support}</span>
        </button>

        {/* 3) Тугмаи калони марказӣ «Пур кардан» — CTA бо градиент + FAB бардошта */}
        <button
          type="button"
          onClick={handleTopUpClick}
          aria-label={labels.topup}
          title={labels.topup}
          className="relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 group
                     active:scale-95 transition-transform cursor-pointer rounded-xl
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <div
            className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center
                       shadow-[0_2px_8px_rgba(0,122,255,0.3)] transition-transform"
          >
            <Ic icon={Plus} size="md" strokeWidth={2} />
          </div>
          <span className="text-[10px] leading-none font-medium text-slate-400">
            {labels.topup}
          </span>
        </button>

        {/* 4) Фармоишҳо (сабад НЕСТ — ин фармоишҳои воқеӣ) */}
        <Link
          to={user ? "/orders" : "/login"}
          onClick={handleOrdersClick}
          aria-label={labels.orders}
          title={labels.orders}
          className={itemCls(isOrders && !isHome)}
        >
          <Ic icon={Package} size="md" strokeWidth={1.75} />
          <span className={labelCls(isOrders && !isHome)}>{labels.orders}</span>
        </Link>

        {/* 5) Профил */}
        <Link
          to={user ? "/profile" : "/login"}
          aria-label={labels.profile}
          title={labels.profile}
          className={itemCls((isProfile || isLogin) && !isHome)}
        >
          <Ic icon={User} size="md" strokeWidth={1.75} />
          <span className={labelCls((isProfile || isLogin) && !isHome)}>{labels.profile}</span>
        </Link>
      <SupportSheet open={supportOpen} onClose={() => setSupportOpen(false)} />
      </nav>
    </>
  );
}
