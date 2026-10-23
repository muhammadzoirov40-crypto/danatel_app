import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Game } from "../types";
import GameLogo from "./GameLogo";
import { useApp } from "../context/AppContext";

/**
 * 🎠 Баннери промо — карусели мисли persshop.com.
 *   - Як баннер дар як вақт, ҳаракати худкор (5 сония)
 *   - Нуқтаҳо барои иваз кардан + клик
 *   - Тасвири бозӣ дар тарафи рост, матн дар чап
 */
export default function PromoCarousel({ games }: { games: Game[] }) {
  const { t } = useApp();
  const [i, setI] = useState(0);
  const n = games.length;

  // Ҳаракати худкор
  useEffect(() => {
    if (n < 2) return;
    const id = setInterval(() => setI((v) => (v + 1) % n), 5000);
    return () => clearInterval(id);
  }, [n]);

  if (!n) return null;
  const g = games[i];

  return (
    <section aria-label={t("featured")}>
      <div className="relative">
        <Link
          to={`/game/${g.slug}`}
          className="aurora block relative overflow-hidden rounded-3xl text-white
                     shadow-[0_18px_40px_-22px_rgba(37,99,235,0.7)]
                     transition active:scale-[0.99]"
        >
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 p-5 sm:p-8">
            {/* Матн */}
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/18
                               backdrop-blur px-3 py-1 text-[11px] font-bold ring-1 ring-white/25">
                ⚡ {g.name}
              </span>

              <h3 className="mt-3 text-2xl sm:text-4xl font-extrabold leading-[1.1] tracking-tight">
                {g.currency || t("featured")}
              </h3>

              {g.min_price_tjs != null && (
                <p className="mt-1.5 text-sm sm:text-base text-white/85 font-semibold tabular-nums">
                  {t("from")} {Number(g.min_price_tjs).toLocaleString("tj-TJ")}{" "}
                  {t("currency")}
                </p>
              )}

              <span className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5
                               text-sm font-bold text-brand-700 shadow-lg">
                {t("pay")} →
              </span>
            </div>

            {/* Тасвир */}
            <div className="shrink-0 scale-[0.78] sm:scale-100 origin-right">
              <GameLogo game={g} size="hero" />
            </div>
          </div>

          {/* Градиенти поёнии нопайдаро — барои хондани матн */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-black/15 to-transparent" />
        </Link>
      </div>

      {/* 🔘 Нуқтаҳо */}
      {n > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {games.map((gg, idx) => (
            <button
              key={gg.id}
              onClick={() => setI(idx)}
              aria-label={gg.name}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === i ? "w-6 bg-brand-600" : "w-2 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
