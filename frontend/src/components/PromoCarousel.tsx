import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Game } from "../types";
import { useApp } from "../context/AppContext";

/**
 * 🎠 Баннери промо — мисли persshop.com:
 *   - Тасвири бозӣ дар тарафи рост мебарояд (bleed)
 *   - Chip + рақами калон + зерматн + тугма дар чап
 *   - Ҳар бозӣ ранги худро дорад (мисли MLBB бунафш, FF норанҷӣ...)
 *   - Нуқтаҳо + ҳаракати худкор (5 сония)
 */

/** Рангҳои баннер аз рӯи slug (мисли persshop) */
const THEMES: Record<string, string> = {
  "free-fire":
    "linear-gradient(115deg,#7c2d12 0%,#c2410c 42%,#ea580c 72%,#f59e0b 100%)",
  "pubg-mobile":
    "linear-gradient(115deg,#2a1a05 0%,#78350f 42%,#b45309 74%,#d97706 100%)",
  "mobile-legends":
    "linear-gradient(115deg,#2e1065 0%,#6d28d9 42%,#a21caf 74%,#db2777 100%)",
  "blood-strike":
    "linear-gradient(115deg,#083344 0%,#0e7490 48%,#06b6d4 100%)",
  "arena-breakout":
    "linear-gradient(115deg,#0f172a 0%,#334155 52%,#475569 100%)",
  "arena-breakout-infinite":
    "linear-gradient(115deg,#1c1917 0%,#3f3f46 52%,#57534e 100%)",
  "honor-of-kings":
    "linear-gradient(115deg,#1e1b4b 0%,#4338ca 48%,#7c3aed 100%)",
  "marvel-rivals":
    "linear-gradient(115deg,#450a0a 0%,#991b1b 48%,#dc2626 100%)",
};
const FALLBACK =
  "linear-gradient(115deg,#1d4ed8 0%,#2563eb 42%,#4f46e5 100%)";

export default function PromoCarousel({ games }: { games: Game[] }) {
  const { t } = useApp();
  const [i, setI] = useState(0);
  const n = games.length;

  useEffect(() => {
    if (n < 2) return;
    const id = setInterval(() => setI((v) => (v + 1) % n), 5000);
    return () => clearInterval(id);
  }, [n]);

  if (!n) return null;
  const g = games[i];
  const bg = THEMES[g.slug] ?? FALLBACK;

  return (
    <section aria-label={t("featured")}>
      <div className="overflow-hidden rounded-3xl shadow-[0_18px_40px_-22px_rgba(37,99,235,0.6)]">
        <Link
          to={`/game/${g.slug}`}
          className="relative block overflow-hidden text-white transition active:scale-[0.995]"
          style={{ background: bg }}
        >
          {/* Диагоналии нозук (мисли persshop) */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg,#fff 0 2px,transparent 2px 14px)",
            }}
          />

          {/* Тасвири бозӣ — дар рост мебарояд */}
          {g.image_url && (
            <img
              src={g.image_url}
              alt=""
              aria-hidden
              className="pointer-events-none absolute right-0 top-0 h-full w-[40%] sm:w-[32%] md:w-[28%]
                         object-cover object-right"
              style={{
                maskImage:
                  "linear-gradient(to right,transparent 0%,#000 45%,#000 100%)",
                WebkitMaskImage:
                  "linear-gradient(to right,transparent 0%,#000 45%,#000 100%)",
              }}
            />
          )}

          {/* Гардиши торикӣ аз чап — барои хондани матн */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/45 via-black/20 to-transparent" />

          {/* Мундариҷа */}
          <div className="relative z-10 flex min-h-[168px] sm:min-h-[236px] flex-col justify-center
                          p-5 sm:p-8 max-w-[72%] sm:max-w-[58%]">
            {/* Chip */}
            <span
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/40
                         backdrop-blur px-3 py-1 text-[11px] font-extrabold uppercase
                         tracking-wide ring-1 ring-white/20"
            >
              ✦ {g.name}
            </span>

            {/* Рақами калон — нархи аз */}
            {g.min_price_tjs != null ? (
              <h3 className="mt-2 text-2xl sm:text-4xl font-extrabold leading-none tracking-tight">
                <span className="text-sm sm:text-base font-bold opacity-85 align-middle mr-1.5">
                  {t("from")}
                </span>
                <span className="text-3xl sm:text-5xl font-black">
                  {Number(g.min_price_tjs).toLocaleString("tj-TJ")}
                </span>
                <span className="ml-1.5 text-base sm:text-xl font-bold opacity-90">
                  {t("currency")}
                </span>
              </h3>
            ) : (
              <h3 className="mt-2 text-2xl sm:text-4xl font-extrabold leading-none tracking-tight">
                {g.currency}
              </h3>
            )}

            {/* Зерматн */}
            <p className="mt-1 text-xs sm:text-sm font-medium text-white/80">
              {g.currency || t("tagline")}
            </p>

            {/* Тугма */}
            <span
              className="mt-3.5 inline-flex w-fit items-center gap-2 rounded-full bg-white
                         px-4 py-2 sm:px-5 sm:py-2 text-xs sm:text-sm font-bold text-slate-900
                         shadow-md hover:bg-slate-50 transition"
            >
              {t("pay")} →
            </span>
          </div>
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
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === i ? "w-6 bg-brand-600" : "w-1.5 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
