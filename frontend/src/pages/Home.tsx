import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Game } from "../types";
import GameCard from "../components/GameCard";
import PromoCarousel from "../components/PromoCarousel";
import TrustTicker from "../components/TrustTicker";
import { useApp } from "../context/AppContext";

/**
 * Саҳифаи асосӣ — тарҳи мисли persshop.com:
 *   1) Сарлавҳаи кабуд: ҷустуҷӯ + тикери далелҳо (бо Navbar мепайвандад)
 *   2) Баннери промо (карусел)
 *   3) Рӯйхати бозиҳо (бо ҷустуҷӯи зинда)
 *   4) Плиткаҳои рақамҳо
 *   5) «Чӣ тавр кор мекунад» + огоҳиномаи бехатарӣ
 */
export default function Home() {
  const { t, lang } = useApp();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

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

  /** Ҷустуҷӯи зинда — аз рӯи ном ё slug */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games;
    return games.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.slug.toLowerCase().includes(q) ||
        (g.currency ?? "").toLowerCase().includes(q),
    );
  }, [games, query]);

  /** Промо-карусел: аввал машҳур, баъд боқӣ — 6 та */
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

  /** Тикери далелҳо — воқеӣ, на ҷаълӣ */
  const tickerItems = useMemo(
    () => [
      { icon: "🆔", text: t("trustId") },
      { icon: "🇹🇯", text: t("trustSomoni") },
      { icon: "⚡", text: t("trustFast") },
      { icon: "💳", text: "DC Wallet" },
      { icon: "🎮", text: `${games.length} ${t("statGames")}` },
      { icon: "💎", text: `${totalProducts} ${t("statProducts")}` },
    ],
    [t, games.length, totalProducts],
  );

  return (
    <div>
      {/* ===== 1) САРЛАВҲАИ КАБУД — бо Navbar мепайвандад ===== */}
      <section className="header-blue text-white">
        <div className="mx-auto max-w-6xl px-4 pt-4 pb-5 sm:pt-6 sm:pb-7">
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            {t("heroTitle")}
          </h1>
          <p className="mt-1 text-sm text-white/80 max-w-xl">{t("tagline")}</p>

          {/* 🔍 Ҷустуҷӯ — мисли persshop */}
          <div className="relative mt-4">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              🔍
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("search")}
              className="w-full rounded-2xl bg-white pl-11 pr-11 py-3.5 text-sm font-medium
                         text-slate-800 placeholder:text-slate-400
                         shadow-[0_10px_25px_-14px_rgba(15,23,61,0.5)]
                         outline-none focus:ring-2 focus:ring-white/60 transition"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label={t("cancel")}
                className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center
                           w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
              >
                ✕
              </button>
            )}
          </div>

          {/* 🎚️ Тикери далелҳои воқеӣ */}
          <TrustTicker items={tickerItems} />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* ===== 2) БАННЕРИ ПРОМО (карусел) ===== */}
        {!loading && !error && promo.length > 0 && (
          <div className="mt-5 sm:mt-7">
            <PromoCarousel games={promo} />
          </div>
        )}

        {/* ===== 3) РӮЙХАТИ БОЗИҲО ===== */}
        <section id="games" className="mt-8 sm:mt-12 scroll-mt-20">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg sm:text-xl font-bold">
              🎮 {query ? t("resultsFor") : t("chooseGame")}
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {filtered.length} {t("statGames")}
            </span>
          </div>

          {loading && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5 sm:gap-2">
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

          {/* Ҳангами ҷустуҷӯ — натиҷа ёфт нашуд */}
          {!loading && !error && filtered.length === 0 && (
            <div className="card p-8 text-center">
              <div className="text-4xl mb-2">🔍</div>
              <div className="font-semibold">{t("noResults")}</div>
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="btn-ghost mt-4 text-sm"
                >
                  {t("cancel")}
                </button>
              )}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5 sm:gap-2">
              {filtered.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </section>

        {/* ===== 4) ПЛИТКАҲОИ РАҚАМ ===== */}
        {!loading && !error && (
          <section className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Tile icon="🎮" value={String(games.length)} label={t("statGames")} />
            <Tile icon="💎" value={String(totalProducts)} label={t("statProducts")} />
            <Tile icon="🆔" label={t("trustId")} />
            <Tile icon="🇹🇯" label={t("trustSomoni")} />
          </section>
        )}

        {/* ===== 5) ЧӢ ТАВР КОР МЕКУНАД ===== */}
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
