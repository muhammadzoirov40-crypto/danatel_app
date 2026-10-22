import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Game } from "../types";
import GameCard from "../components/GameCard";
import GameLogo from "../components/GameLogo";
import { useApp } from "../context/AppContext";

/**
 * Саҳифаи асосӣ — тарҳи мобилии мисли persshop.com:
 *   1) Hero бо aurora-градиент + чипҳои бехатарӣ
 *   2) Промо-картоҳои афтодаи амудӣ (бо нархи ҳақиқӣ)
 *   3) Рӯйхати бозиҳо (сетка) бо нишонаи «Хит»
 *   4) Плиткаҳои рақамҳо
 *   5) «Чӣ тавр кор мекунад» + огоҳиномаи бехатарӣ (нигоҳ дошта шуд)
 */
export default function Home() {
  const { t, lang } = useApp();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .games(lang)
      .then((d) => alive && setGames(d))
      .catch((e) => alive && setError(e?.message ?? t("error")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [lang, t]);

  /** Промо: аввал бозиҳои машҳур (аз рӯи маълумоти admin), баъд боқӣ — 6 та */
  const promo = useMemo(() => {
    const pop = games.filter((g) => g.is_popular);
    const rest = games.filter((g) => !g.is_popular);
    return [...pop, ...rest].slice(0, 6);
  }, [games]);

  /** Ҳамаи маҳсулотҳо (рақами ҳақиқӣ) */
  const totalProducts = useMemo(
    () => games.reduce((s, g) => s + (g.products_count ?? 0), 0),
    [games],
  );

  const trust = [
    { i: "🆔", k: "trustId" },
    { i: "🇹🇯", k: "trustSomoni" },
    { i: "⚡", k: "trustFast" },
  ];

  return (
    <div>
      {/* ============ 1) HERO — aurora ============ */}
      <section className="aurora text-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-14">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-semibold ring-1 ring-white/25">
            🇹🇯 danatel.tj
          </span>

          <h1 className="mt-4 text-2xl sm:text-4xl font-extrabold tracking-tight leading-[1.15]">
            {t("heroTitle")}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-white/85 max-w-xl">
            {t("tagline")}
          </p>

          {/* Чипҳо — дар мобилӣ афтодаи амудӣ */}
          <div className="mt-5 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {trust.map((c) => (
              <span
                key={c.k}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-xs font-semibold ring-1 ring-white/25"
              >
                {c.i} {t(c.k)}
              </span>
            ))}
          </div>

          <a
            href="#games"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5
                       text-sm font-bold text-brand-700 shadow-lg shadow-blue-900/20
                       transition active:scale-[0.98]"
          >
            🎮 {t("chooseGame")} ↓
          </a>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* ============ 2) ПРОМО-КАРТОҲО (афтодаи амудӣ) ============ */}
        {!loading && !error && promo.length > 0 && (
          <section className="mt-6 sm:mt-8">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg sm:text-xl font-bold">✨ {t("featured")}</h2>
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x -mx-4 px-4 pb-1 sm:mx-0 sm:px-0">
              {promo.map((g) => (
                <Link
                  key={g.id}
                  to={`/game/${g.slug}`}
                  className="aurora snap-start shrink-0 w-[72%] sm:w-[260px]
                             rounded-3xl p-4 text-white relative overflow-hidden
                             transition active:scale-[0.98] shadow-lg shadow-blue-900/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-base leading-tight truncate">
                        {g.name}
                      </div>
                      <div className="text-xs text-white/80 mt-0.5 truncate">
                        {g.currency}
                      </div>
                    </div>
                    <GameLogo game={g} size="card" />
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-2">
                    {g.min_price_tjs != null ? (
                      <div>
                        <div className="text-[11px] text-white/75">{t("from")}</div>
                        <div className="text-xl font-extrabold tabular-nums">
                          {Number(g.min_price_tjs).toLocaleString("tj-TJ")}{" "}
                          <span className="text-sm font-semibold">{t("currency")}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xl font-extrabold">→</div>
                    )}
                    <span className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold">
                      {t("pay")} →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ============ 3) РӮЙХАТИ БОЗИҲО ============ */}
        <section id="games" className="mt-8 sm:mt-12 scroll-mt-20">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg sm:text-xl font-bold">🎮 {t("chooseGame")}</h2>
            <span className="text-xs text-slate-500">
              {games.length} {t("statGames")}
            </span>
          </div>

          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card h-40 animate-pulse bg-slate-100" />
              ))}
            </div>
          )}

          {error && (
            <div className="card p-6 text-center text-rose-600">
              <div className="text-3xl mb-2">⚠️</div>
              {error}
              <div className="mt-4">
                <button className="btn-ghost" onClick={() => location.reload()}>
                  {t("retry")}
                </button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {games.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </section>

        {/* ============ 4) ПЛИТКАҲОИ РАҚАМ ============ */}
        {!loading && !error && (
          <section className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Tile icon="🎮" value={String(games.length)} label={t("statGames")} />
            <Tile icon="💎" value={String(totalProducts)} label={t("statProducts")} />
            <Tile icon="🆔" label={t("trustId")} />
            <Tile icon="🇹🇯" label={t("trustSomoni")} />
          </section>
        )}

        {/* ============ 5) ЧӢ ТАВР КОР МЕКУНАД ============ */}
        <section className="mt-10 sm:mt-14">
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-6">
            {t("howItWorks")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { n: 1, icon: "🎮" },
              { n: 2, icon: "🆔" },
              { n: 3, icon: "💳" },
              { n: 4, icon: "🎁" },
            ].map((s) => (
              <div key={s.n} className="card p-5 text-center">
                <div className="grid place-items-center w-11 h-11 mx-auto rounded-full bg-brand-50 text-xl mb-3">
                  {s.icon}
                </div>
                <div className="font-semibold text-sm mb-1">{t(`step${s.n}`)}</div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  {t(`step${s.n}d`)}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Огоҳиномаи бехатарӣ */}
        <div className="mt-8 mb-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 sm:p-5 text-sm text-amber-900 flex gap-3">
          <span className="text-xl">⚠️</span>
          <span>{t("secureNote")}</span>
        </div>
      </div>
    </div>
  );
}

/** Плиткаи рақам/матн */
function Tile({
  icon,
  value,
  label,
}: {
  icon: string;
  value?: string;
  label: string;
}) {
  return (
    <div className="card p-4 text-center">
      <div className="text-xl">{icon}</div>
      {value != null && (
        <div className="mt-1 text-lg font-extrabold tabular-nums text-brand-700">
          {value}
        </div>
      )}
      <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">
        {label}
      </div>
    </div>
  );
}
