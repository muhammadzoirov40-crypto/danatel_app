import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Game } from "../types";
import OrderForm from "../components/OrderForm";
import GameLogo from "../components/GameLogo";
import { useApp } from "../context/AppContext";

/** Рангҳои баннер барои ҳар бозӣ (мисли PromoCarousel) */
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

/** Саҳифаи тафсилоти бозӣ + формаи фармоиш — бе заминаи сафед */
export default function GameDetail() {
  const { slug = "" } = useParams();
  const { t, lang } = useApp();
  const nav = useNavigate();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .game(slug, lang)
      .then((d) => alive && setGame(d))
      .catch((e) => alive && setError(e?.message ?? t("error")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug, lang, t]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl h-64 animate-pulse" style={{ background: FALLBACK }} />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="text-4xl mb-3">😕</div>
        <p className="text-slate-600 mb-6">{error || t("notFound")}</p>
        <Link to="/" className="btn-primary">
          {t("goHome")}
        </Link>
      </div>
    );
  }

  const bg = THEMES[game.slug] ?? FALLBACK;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <button onClick={() => nav(-1)} className="btn-ghost text-sm mb-5">
        ← {t("back")}
      </button>

      {/* Сарлавҳаи бозӣ — градиент, бе заминаи сафед */}
      <div
        className="relative rounded-3xl overflow-hidden shadow-[0_18px_40px_-22px_rgba(37,99,235,0.6)]"
        style={{ background: bg }}
      >
        <div className="flex items-center gap-4 p-4 sm:p-6 text-white">
          <div className="shrink-0">
            <GameLogo game={game} size="hero" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">{game.name}</h1>
            <p className="text-white/85 text-sm mt-1">
              {t("price")}: {t("currency")}
            </p>
          </div>
        </div>
      </div>

      {/* Форма — мобилӣ: якстона, десктоп: ду сутун */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mt-5">
        <div className="lg:col-span-3">
          <OrderForm
            game={game}
            onCreated={(id) => nav(`/order/${id}`)}
          />
        </div>

        {/* Тафсилот / роҳнамо — шарр/glassmorphism, бе заминаи сафед */}
        <aside className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/20 p-4 sm:p-5 text-white">
            <h3 className="font-semibold text-sm mb-3">💡 {t("howItWorks")}</h3>
            <ol className="space-y-3 text-sm">
              {[
                { i: "🆔", txt: t("step2d") },
                { i: "💎", txt: t("chooseAmount") },
                { i: "💳", txt: t("step3d") },
                { i: "🎁", txt: t("step4d") },
              ].map((s, idx) => (
                <li key={idx} className="flex gap-3">
                  <span>{s.i}</span>
                  <span className="text-white/90">{s.txt}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/20 p-4 text-xs text-white/95 flex gap-2">
            <span>⚠️</span>
            <span>{t("secureNote")}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}