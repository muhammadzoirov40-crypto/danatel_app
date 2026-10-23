import { Link, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";

/**
 * 📱 Навигатсияи поёнӣ (Bottom Navigation Bar) — мисли persshop.com:
 *   1) 🏠 Асосӣ / Главная (бо заминаи кабуд ҳангоми фаъол будан)
 *   2) 㗊 Каталог
 *   3) ➕ Тугмаи калони мудаввари марказӣ «Пур кардан»
 *   4) 🛒 Фармоишҳо / Корзина
 *   5) 👤 Профил
 *   + 💬 Тугмаи равони чати Telegram / кӯмак
 */
export default function BottomNav() {
  const { pathname } = useLocation();
  const { user, lang } = useApp();

  const isHome = pathname === "/";
  const isProfile = pathname === "/profile";
  const isLogin = pathname === "/login";

  const t = {
    home: lang === "ru" ? "Главная" : lang === "uz" ? "Asosiy" : lang === "en" ? "Home" : "Асосӣ",
    catalog: lang === "ru" ? "Каталог" : lang === "uz" ? "Katalog" : lang === "en" ? "Catalog" : "Каталог",
    topup: lang === "ru" ? "Пополнить" : lang === "uz" ? "To'ldirish" : lang === "en" ? "Top up" : "Пур кардан",
    cart: lang === "ru" ? "Корзина" : lang === "uz" ? "Savat" : lang === "en" ? "Orders" : "Фармоишҳо",
    profile: lang === "ru" ? "Профиль" : lang === "uz" ? "Profil" : lang === "en" ? "Profile" : "Профил",
  };

  const scrollToCatalog = () => {
    if (pathname !== "/") return;
    const el = document.getElementById("games");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      {/* 💬 Тугмаи шинокунандаи чат / дастгирӣ (Floating Chat Button) */}
      <a
        href="https://t.me/ONLAYN_ALMAZ_TJ_bot"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Дастгирӣ дар Telegram"
        className="fixed bottom-20 left-4 z-40 md:bottom-6 md:right-6 md:left-auto
                   w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600
                   text-white shadow-[0_8px_24px_-4px_rgba(37,99,235,0.5)]
                   grid place-items-center hover:scale-105 active:scale-95 transition-transform"
      >
        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.03 2 11c0 2.87 1.51 5.42 3.86 7.02l-.86 3.12 3.42-1.83C9.43 19.72 10.69 20 12 20c5.52 0 10-4.03 10-9s-4.48-9-10-9zm0 16c-1.12 0-2.2-.23-3.18-.65l-.39-.17-1.92 1.03.49-1.78-.26-.37C5.51 14.84 4.5 13.01 4.5 11c0-3.86 3.36-7 7.5-7s7.5 3.14 7.5 7-3.36 7-7.5 7z" />
        </svg>
      </a>

      {/* 📱 Панели навигатсияи поёнӣ (Bottom Navigation Dock) — танҳо дар телефон/планшет */}
      <nav
        aria-label="Навигатсияи поёнӣ"
        className="md:hidden fixed bottom-3 inset-x-3 z-50 max-w-md mx-auto
                   bg-white/95 backdrop-blur-xl border border-slate-200/90
                   shadow-[0_12px_36px_-6px_rgba(15,23,42,0.22)]
                   rounded-3xl px-2 py-1.5 flex items-center justify-between"
      >
        {/* 1) 🏠 Асосӣ */}
        <Link
          to="/"
          className={`flex flex-col items-center justify-center transition-all ${
            isHome
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl px-3.5 py-1.5 shadow-md shadow-blue-500/25"
              : "text-slate-500 hover:text-slate-900 px-2 py-1"
          }`}
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
          </svg>
          <span className="text-[10px] font-bold leading-none mt-0.5">
            {t.home}
          </span>
        </Link>

        {/* 2) 㗊 Каталог */}
        <Link
          to="/#games"
          onClick={scrollToCatalog}
          className="flex flex-col items-center justify-center text-slate-500 hover:text-slate-900 px-2 py-1 transition"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M4 4h7v7H4zm9 0h7v7h-7zm0 9h7v7h-7zm-9 0h7v7H4z" />
          </svg>
          <span className="text-[10px] font-bold leading-none mt-0.5">
            {t.catalog}
          </span>
        </Link>

        {/* 3) ➕ Тугмаи калони марказӣ «Пур кардан» */}
        <Link
          to={user ? "/profile" : "/login"}
          className="relative -mt-6 flex flex-col items-center group active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600
                          text-white shadow-lg shadow-blue-600/35 flex items-center justify-center
                          ring-4 ring-white group-hover:scale-105 transition-transform">
            <svg
              className="w-6 h-6 stroke-current stroke-[2.8]"
              viewBox="0 0 24 24"
              fill="none"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <span className="text-[10px] font-extrabold text-slate-700 mt-1 leading-none">
            {t.topup}
          </span>
        </Link>

        {/* 4) 🛒 Фармоишҳо / Корзина */}
        <Link
          to={user ? "/profile" : "/login"}
          className={`flex flex-col items-center justify-center transition-all ${
            isProfile && !isHome
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl px-3.5 py-1.5 shadow-md shadow-blue-500/25"
              : "text-slate-500 hover:text-slate-900 px-2 py-1"
          }`}
        >
          <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6h15l-1.5 9h-13zM6 6l-1-3H2M9 20a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
          <span className="text-[10px] font-bold leading-none mt-0.5">
            {t.cart}
          </span>
        </Link>

        {/* 5) 👤 Профил */}
        <Link
          to={user ? "/profile" : "/login"}
          className={`flex flex-col items-center justify-center transition-all ${
            isLogin
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl px-3.5 py-1.5 shadow-md shadow-blue-500/25"
              : "text-slate-500 hover:text-slate-900 px-2 py-1"
          }`}
        >
          <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
          <span className="text-[10px] font-bold leading-none mt-0.5">
            {t.profile}
          </span>
        </Link>
      </nav>
    </>
  );
}
