import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ArrowLeft, Frown, Gem } from "lucide-react";
import { api } from "../api/client";
import type { Game, Product } from "../types";
import OrderForm from "../components/OrderForm";
import GameLogo from "../components/GameLogo";
import { useApp } from "../context/AppContext";
import { Ic } from "../components/Icons";

/** Рангҳои баннер барои ҳар бозӣ (мисли PromoCarousel) */
const THEMES: Record<string, { bg: string; art?: string }> = {
  "free-fire": {
    // 🔥 Сурх → норинҷӣ → зарди табангар (тарҳи нав; матни сафед бо скрим хонда мешавад)
    bg: "linear-gradient(115deg,#b91c1c 0%,#ea580c 38%,#f59e0b 72%,#fbbf24 100%)",
    art: "/images/free-fire.webp",
  },
  "pubg-mobile": {
    bg: "linear-gradient(115deg,#2a1a05 0%,#78350f 42%,#b45309 74%,#d97706 100%)",
    art: "/images/pubg-mobile.webp",
  },
  "mobile-legends": {
    bg: "linear-gradient(115deg,#2e1065 0%,#6d28d9 42%,#a21caf 74%,#db2777 100%)",
    art: "/images/mobile-legends.webp",
  },
  "blood-strike": {
    bg: "linear-gradient(115deg,#083344 0%,#0e7490 48%,#06b6d4 100%)",
    art: "/images/blood-strike.webp",
  },
  "arena-breakout": {
    bg: "linear-gradient(115deg,#0f172a 0%,#334155 52%,#475569 100%)",
    art: "/images/arena-breakout.webp",
  },
  "arena-breakout-infinite": {
    bg: "linear-gradient(115deg,#1c1917 0%,#3f3f46 52%,#57534e 100%)",
  },
  "honor-of-kings": {
    bg: "linear-gradient(115deg,#1e1b4b 0%,#4338ca 48%,#7c3aed 100%)",
  },
  "marvel-rivals": {
    bg: "linear-gradient(115deg,#450a0a 0%,#991b1b 48%,#dc2626 100%)",
  },
};
const FALLBACK_BG = "linear-gradient(115deg,#1d4ed8 0%,#2563eb 42%,#4f46e5 100%)";

/** Саҳифаи тафсилоти бозӣ — тарҳи мисли persshop.com */
export default function GameDetail() {
  const { slug = "" } = useParams();
  const { t, lang } = useApp();
  const nav = useNavigate();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // 💰 Интихоби маҳсулот барои sticky-сумма дар сарчашма
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSelected(null);
    api
      .game(slug, lang)
      .then((d) => alive && setGame(d))
      .catch((e) => alive && setError(e?.message ?? t("error")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug, lang, t]);

  const theme = useMemo(() => THEMES[slug] ?? {}, [slug]);
  const bg = theme.bg ?? FALLBACK_BG;
  const products = game?.products ?? [];
  const minPrice = products.length
    ? Math.min(...products.map((p) => Number(p.price_tjs)))
    : null;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <div className="rounded-3xl h-56 sm:h-72 animate-pulse" style={{ background: FALLBACK_BG }} />
        <div className="grid grid-cols-1 gap-5 mt-5">
          <div className="rounded-3xl h-96 animate-pulse bg-white" />
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="card p-6">
          <div className="flex justify-center mb-3 text-slate-300">
            <Ic icon={Frown} size="2xl" strokeWidth={1.75} />
          </div>
          <p className="text-slate-600 mb-6">{error || t("notFound")}</p>
          <Link to="/" className="btn-primary">
            {t("goHome")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 py-5 sm:py-8">
      {/* ============ САРПӯШИ БОЗӢ (COVER) ============
          Тугмаи «Бозгашт» акнун ДАР ДОХИЛИ баннер (торуши) — мисли тарҳи нав */}
      <div
        className="relative rounded-3xl overflow-hidden shadow-[0_22px_50px_-25px_rgba(37,99,235,0.7)] mb-5"
        style={{ background: bg }}
      >
        {/* Тасвири бозӣ дар тарафи рост бо маска */}
        {theme.art && (
          <img
            src={theme.art}
            alt=""
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-full w-[55%] sm:w-[45%] object-cover opacity-40 sm:opacity-55"
            style={{
              maskImage:
                "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 35%, #000 85%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 35%, #000 85%)",
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}

        {/* Ҳалқаҳои диагоналӣ */}
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, rgba(255,255,255,0.22) 0 2px, transparent 2px 26px)",
          }}
        />

        {/* 🌑 Скрими тира аз чап — матни сафед бояд WCAG AA хонда шавад */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent pointer-events-none"
        />

        {/* ⬅️ Тугмаи бозгашт — дар боло-рост, шишаӣ */}
        <button
          type="button"
          onClick={() => nav(-1)}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 inline-flex items-center gap-1.5
                     rounded-full bg-white/20 hover:bg-white/35 border border-white/35
                     text-white text-xs sm:text-sm font-semibold px-3.5 py-2 backdrop-blur-md
                     transition active:scale-95 focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-white"
        >
          <Ic icon={ArrowLeft} size="xs" />
          {t("back")}
        </button>

        {/* Мазмуни сарпӯш */}
        <div className="relative flex items-center gap-4 sm:gap-6 p-5 sm:p-8 text-white">
          <div className="shrink-0">
            <GameLogo game={game} size="hero" />
          </div>
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full mb-2">
              <Ic icon={Gem} size="xs" />
              {t("topup")}
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight drop-shadow-sm">
              {game.name}
            </h1>
            <p className="text-white/85 text-sm sm:text-base mt-1.5">
              {t("gameSubtitle")}
            </p>

            {/* Чипҳои асосӣ */}
            <div className="flex flex-wrap gap-2 mt-3">
              {minPrice != null && (
                <span className="text-xs sm:text-sm bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full font-semibold">
                  {t("from")} {minPrice.toLocaleString("tj-TJ")} {t("currency")}
                </span>
              )}
              {products.length > 0 && (
                <span className="text-xs sm:text-sm bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  {products.length} {t("statProducts")}
                </span>
              )}
              {/* ⚠️ Чипи «Дар сонияҳо» (даъвои суръат) бароварда шуд —
                  танҳо маълумоти воқеӣ: нархи аз + шумораи бастаҳо */}
            </div>
          </div>
        </div>
      </div>

      {/* ============ МАЗМУН — 2 СУТУН ============ */}
      <div className="grid grid-cols-1 gap-5">
        {/* Формаи фармоиш — паҳлӯйӣ */}
        <div>
          <OrderForm
            game={game}
            selected={selected}
            onSelected={setSelected}
            onCreated={(id) => nav(`/order/${id}`)}
          />
        </div>
      </div>
    </div>
  );
}
