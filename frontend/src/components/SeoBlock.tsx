import { Link } from "react-router-dom";
import { Phone, Send } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { Game } from "../types";
import { Ic } from "./Icons";

/** 📝 Блоки SEO-и поёни саҳифа — мисли persshop.
 *  Танҳо маълумоти воқеӣ: бозиҳо аз API, пардохти воқеӣ, тамоси воқеӣ. */
export default function SeoBlock({ games }: { games: Game[] }) {
  const { t } = useApp();

  return (
    <section id="about" className="mt-10 sm:mt-14 border-t border-slate-200 pt-8 sm:pt-10 scroll-mt-20">
      <div className="max-w-3xl space-y-7 text-[13px] leading-relaxed text-slate-600">
        {/* 1️⃣ Сарлавҳаи асосӣ + муқаддима */}
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight mb-2">
            {t("seoTitle")}
          </h2>
          <p>
            {t("seoIntro")}{" "}
            {games.map((g, i) => (
              <span key={g.id}>
                <Link
                  to={`/game/${g.slug}`}
                  className="font-semibold text-brand-600 hover:text-brand-700 underline decoration-brand-200 underline-offset-2"
                >
                  {g.name}
                </Link>
                {i < games.length - 1 ? ", " : ""}
              </span>
            ))}
            .
          </p>
        </div>

        {/* 2️⃣ Рӯйхати бозиҳо бо нарх */}
        {games.length > 0 && (
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mb-2">
              {t("seoGamesTitle")}
            </h3>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {games.map((g) => (
                <li key={g.id}>
                  <Link
                    to={`/game/${g.slug}`}
                    className="text-brand-600 hover:text-brand-700 font-semibold"
                  >
                    {g.name}
                  </Link>
                  {g.min_price_tjs ? (
                    <span className="text-slate-400">
                      {" "}
                      {t("from")} {Number(g.min_price_tjs).toFixed(2)}{" "}
                      {t("currency")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 3️⃣ Пардохт */}
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mb-1">
            {t("seoPayTitle")}
          </h3>
          <p>{t("seoPayBody")}</p>
        </div>

        {/* 4️⃣ Бехатарӣ */}
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mb-1">
            {t("seoSafeTitle")}
          </h3>
          <p>{t("seoSafeBody")}</p>
        </div>

        {/* 5️⃣ Саволҳо */}
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mb-2">
            {t("seoFaqTitle")}
          </h3>
          <dl className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n}>
                <dt className="font-bold text-slate-800">{t(`seoQ${n}`)}</dt>
                <dd>{t(`seoA${n}`)}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 6️⃣ Дастгирӣ — тамоси воқеӣ */}
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mb-2">
            {t("seoSupport")}
          </h3>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <a
              href="https://t.me/ONLAYN_ALMAZ_TJ_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-sky-50 ring-1 ring-sky-200 px-4 py-2 text-xs sm:text-sm font-bold text-sky-700 hover:bg-sky-100 transition"
            >
              <Ic icon={Send} />
              {t("seoTgLabel")}
            </a>
            <a
              href="tel:+992002119831"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-50 ring-1 ring-emerald-200 px-4 py-2 text-xs sm:text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition"
            >
              <Ic icon={Phone} />
              +992 002119831
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
