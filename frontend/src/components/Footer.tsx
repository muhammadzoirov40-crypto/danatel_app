import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUp,
  Check,
  House,
  LayoutGrid,
  Lock,
  Package,
  Send,
  Share2,
  ShieldCheck,
  User,
  Zap,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import Logo from "./Logo";
import { Ic } from "./Icons";

/**
 * 🦶 Футери расмӣ ва касбии danatel.tj
 * Бо ҳамаи иконкаҳои воқеӣ, пайвандҳои функсионалӣ ва маълумоти амниятӣ.
 */
export default function Footer() {
  const { t, lang, user } = useApp();
  const [copied, setCopied] = useState(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "danatel.tj — Сайти фурӯши донати бозиҳо",
          text: "Донати бозиҳо (Free Fire, PUBG, MLBB) бо сомонӣ дар danatel.tj",
          url: window.location.origin,
        });
        return;
      } catch {
        /* fallback */
      }
    }
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <footer className="mt-14 border-t border-slate-200 bg-white">
      {/* 🛡️ Блоки боэътимодӣ (Trust & Guarantees) */}
      <div className="border-b border-slate-100 bg-slate-50/60 py-8">
        <div className="mx-auto max-w-6xl px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <div className="grid place-items-center w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 shrink-0">
              <Ic icon={ShieldCheck} size="md" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">100% Бехатар</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Танҳо Player ID лозим аст — паролро ба ҳеҷ кас надиҳед.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="grid place-items-center w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 shrink-0">
              <Ic icon={Zap} size="md" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Интиқоли фаврӣ</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Алмосҳо ва кредитҳо дар сонияҳо ба ҳисоби бозӣ ворид мешаванд.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="grid place-items-center w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 shrink-0">
              <Ic icon={Lock} size="md" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Пардохти расмӣ</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                DC Wallet ва кортҳои миллии Тоҷикистон бо пули сомонӣ (TJS).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="grid place-items-center w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 shrink-0">
              <Ic icon={Send} size="md" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Дастгирии 24/7</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Боти расмии Telegram барои ёрии техникӣ ва санҷиши чек.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 🧭 Сутунҳои навигатсия */}
      <div className="mx-auto max-w-6xl px-4 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Сутуни 1: Логотип ва тавсиф */}
        <div className="md:col-span-1 space-y-3">
          <Link to="/" className="inline-block" title="danatel.tj">
            <Logo size={28} withText textClass="text-base font-black" />
          </Link>
          <p className="text-xs text-slate-500 leading-relaxed">
            Аввалин платформаи миллии хариди донат ва пули бозиҳо дар Тоҷикистон.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-95 shadow-2xs"
            >
              <Ic icon={copied ? Check : Share2} size="xs" className={copied ? "text-emerald-600" : "text-brand-600"} />
              <span>{copied ? t("copied") : (lang === "ru" ? "Поделиться сайтом" : "Мубодилаи сайт")}</span>
            </button>
          </div>
        </div>

        {/* Сутуни 2: Навигатсия */}
        <div>
          <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-3">
            Навигатсия
          </h5>
          <ul className="space-y-2 text-xs font-medium text-slate-600">
            <li>
              <Link to="/" className="inline-flex items-center gap-2 hover:text-brand-600 transition">
                <Ic icon={House} size="xs" />
                <span>{t("goHome")}</span>
              </Link>
            </li>
            <li>
              <Link to="/#games" className="inline-flex items-center gap-2 hover:text-brand-600 transition">
                <Ic icon={LayoutGrid} size="xs" />
                <span>{t("navCatalog")}</span>
              </Link>
            </li>
            <li>
              <Link to={user ? "/profile" : "/login"} className="inline-flex items-center gap-2 hover:text-brand-600 transition">
                <Ic icon={Package} size="xs" />
                <span>{t("navOrders")}</span>
              </Link>
            </li>
            <li>
              <Link to={user ? "/profile" : "/login"} className="inline-flex items-center gap-2 hover:text-brand-600 transition">
                <Ic icon={User} size="xs" />
                <span>{user ? t("profile") : t("login")}</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Сутуни 3: Бозиҳо */}
        <div>
          <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-3">
            Бозиҳои машҳур
          </h5>
          <ul className="space-y-2 text-xs font-medium text-slate-600">
            <li>
              <Link to="/game/free-fire" className="hover:text-brand-600 transition">
                Free Fire Diamonds
              </Link>
            </li>
            <li>
              <Link to="/game/pubg-mobile" className="hover:text-brand-600 transition">
                PUBG Mobile UC
              </Link>
            </li>
            <li>
              <Link to="/game/mobile-legends" className="hover:text-brand-600 transition">
                Mobile Legends Diamonds
              </Link>
            </li>
            <li>
              <Link to="/game/blood-strike" className="hover:text-brand-600 transition">
                Blood Strike Gold
              </Link>
            </li>
          </ul>
        </div>

        {/* Сутуни 4: Дастгирӣ */}
        <div>
          <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-3">
            Тамос ва дастгирӣ
          </h5>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Саволе доред? Ба боти Telegram-и мо муроҷиат кунед:
          </p>
          <a
            href="https://t.me/ONLAYN_ALMAZ_TJ_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold hover:shadow-md hover:scale-[1.02] active:scale-95 transition"
          >
            <Ic icon={Send} size="xs" />
            <span>@ONLAYN_ALMAZ_TJ_bot</span>
          </a>
        </div>
      </div>

      {/* 🔻 Сатри поёнӣ */}
      <div className="border-t border-slate-100 bg-slate-50/80 py-4">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} danatel.tj — Ҳамаи ҳуқуқҳо ҳифз шудаанд.
          </div>
          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Ҳаракат ба боло"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-300 transition text-xs font-semibold shadow-2xs"
          >
            <Ic icon={ArrowUp} size="xs" />
            <span>Ба боло</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
