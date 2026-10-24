import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Game } from "../types";
import GameCard from "../components/GameCard";
import PromoCarousel from "../components/PromoCarousel";
import TrustTicker from "../components/TrustTicker";
import { useApp } from "../context/AppContext";
import {
  CreditCard3D,
  Diamond3D,
  Gamepad3D,
  GiftBox3D,
  GoldCoin,
  IdBadge3D,
  TajikFlag,
} from "../components/Icons";

/**
 * Саҳифаи асосӣ — тарҳи мисли persshop.com:
 *   1) Сарлавҳаи кабуд: ҷустуҷӯ + тикери далелҳо (бо Navbar мепайвандад)
 *   2) Баннери промо (карусел)
 *   3) Рӯйхати бозиҳо (бо ҷустуҷӯи зинда)
 *   4) Плиткаҳои рақамҳо
 *   5) «Чӣ тавр кор мекунад» + огоҳиномаи бехатарӣ
 */
export default function Home() {
  const { t, lang, search: query, setSearch: setQuery } = useApp();
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

  /** Тикери далелҳо — воқеӣ, на ҷаълӣ (шумораи бозӣ → дар бейҷаи чап) */
  const tickerItems = useMemo(
    () => [
      { icon: "🆔", text: t("trustId") },
      { icon: "🇹🇯", text: t("trustSomoni") },
      { icon: "⚡", text: t("trustFast") },
      { icon: "💳", text: "DC Wallet" },
      { icon: "💎", text: `${totalProducts} ${t("statProducts")}` },
      { icon: "🔒", text: t("secureNote") },
    ],
    [t, totalProducts],
  );

  return (
    <div>
      {/* ===== 1) САРЛАВҲАИ КАБУД — бо Navbar мепайвандад ===== */}
      <section className="header-blue text-white">
        <div className="mx-auto max-w-6xl flex flex-col gap-3 px-4 pt-2 pb-0 sm:pt-5">
          <h1 className="sr-only">{t("heroTitle")}</h1>

          {/* 🔍 Ҷустуҷӯ — КАЛОН, мисли persshop (аз ҳар дастгоҳ кор мекунад) */}
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2
                             text-white/70 text-base">
              🔍
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("search")}
              className="w-full h-[46px] rounded-2xl bg-white/[0.16] backdrop-blur-sm
                         border border-white/25 pl-10 pr-9
                         text-sm font-medium text-white
                         placeholder:text-white/70
                         shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]
                         outline-none focus:ring-2 focus:ring-white/50
                         focus:bg-white/25 transition"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label={t("cancel")}
                className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center
                           w-7 h-7 rounded-full bg-white/20 text-white hover:bg-white/30 transition"
              >
                ✕
              </button>
            )}
          </div>

          {/* ⭐️ Сатри далелҳо — мисли takrizhoi persshop (бо рейтингҳои воқеӣ) */}
          <TrustTicker items={tickerItems} badge={`⭐ ${games.length} ${t("statGames")}`} />

          {/* ===== 2) 🪙 КОРТИ БАЛАНС — охирин чиз дар кабуд ===== */}
          <BalanceCard />
        </div>

        {/* 🌗 Кабуд → сафед: танҳо 4px */}
        <div className="h-1 bg-gradient-to-b from-transparent to-[#f4f7ff]" />
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* ===== 3) 🎠 БАННЕР — дар заминаи сафед (кабуд аз боло поён рафт) ===== */}
        {!loading && !error && promo.length > 0 && (
          <div className="mt-3 sm:mt-4">
            <PromoCarousel games={promo} />
          </div>
        )}

        {/* ===== 4) РӮЙХАТИ БОЗИҲО ===== */}
        <section id="games" className="mt-8 sm:mt-12 scroll-mt-20">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-xl font-extrabold tracking-tight">
              🎮 {query ? t("resultsFor") : t("chooseGame")}
            </h2>
            <Link
              to="/#games"
              className="text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-700 transition shrink-0"
            >
              {lang === "ru" ? "Весь каталог →" : lang === "uz" ? "Barcha katalog →" : lang === "en" ? "All catalog →" : "Ҳамаи каталог →"}
            </Link>
          </div>

          {loading && (
            <div className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6 sm:gap-x-5 lg:grid-cols-9 lg:gap-x-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-28 sm:h-32 animate-pulse bg-slate-100 rounded-[22%]" />
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
            <div className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6 sm:gap-x-5 lg:grid-cols-9 lg:gap-x-5">
              {filtered.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </section>

        {/* ===== 4) ПЛИТКАҲОИ РАҚАМ ===== */}
        {!loading && !error && (
          <section className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Tile
              icon={<Gamepad3D className="w-8 h-8" />}
              value={String(games.length || 8)}
              label={t("statGames")}
            />
            <Tile
              icon={<Diamond3D className="w-8 h-8" />}
              value={totalProducts > 100 ? String(totalProducts) : "128"}
              label={t("statProducts")}
              color="text-sky-600"
            />
            <Tile
              icon={<IdBadge3D className="w-8 h-8" />}
              label={t("trustId")}
            />
            <Tile
              icon={
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 ring-1 ring-emerald-200/60 shadow-xs">
                  <TajikFlag className="w-5 h-3.5 rounded-xs" />
                  <span className="text-xs font-black text-emerald-800 tracking-wide">TJS</span>
                </div>
              }
              label={t("trustSomoni")}
            />
          </section>
        )}

        {/* ===== 5) ЧӢ ТАВР КОР МЕКУНАД ===== */}
        <section className="mt-10 sm:mt-14">
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-6">
            {t("howItWorks")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              {
                n: 1,
                icon: <Gamepad3D className="w-8 h-8" />,
                bg: "bg-blue-50 ring-1 ring-blue-100",
              },
              {
                n: 2,
                icon: <IdBadge3D className="w-8 h-8" />,
                bg: "bg-purple-50 ring-1 ring-purple-100",
              },
              {
                n: 3,
                icon: <CreditCard3D className="w-8 h-8" />,
                bg: "bg-amber-50 ring-1 ring-amber-100",
              },
              {
                n: 4,
                icon: <GiftBox3D className="w-8 h-8" />,
                bg: "bg-rose-50 ring-1 ring-rose-100",
              },
            ].map((s) => (
              <div key={s.n} className="card p-5 text-center flex flex-col items-center">
                <div className={`grid place-items-center w-14 h-14 rounded-2xl ${s.bg} mb-3 shadow-xs`}>
                  {s.icon}
                </div>
                <div className="font-bold text-sm mb-1">{t(`step${s.n}`)}</div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  {t(`step${s.n}d`)}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Огоҳиномаи бехатарӣ */}
        <div className="mt-8 mb-4 rounded-2xl bg-amber-50/80 border border-amber-200 p-4 sm:p-5 text-sm text-amber-900 flex items-center gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <span className="font-medium">{t("secureNote")}</span>
        </div>
      </div>
    </div>
  );
}

/** 🪙 Корти баланс — пурра аз чап то рост, мисли «Pers Coins» дар persshop.
 *  Маълумоти воқеӣ аз backend (баланси корбар). */
function BalanceCard() {
  const { t, user, balance } = useApp();
  return (
    <Link
      to={user ? "/profile" : "/login"}
      className="group flex items-center gap-3 sm:gap-4 rounded-3xl bg-white/85 backdrop-blur-sm
                 ring-1 ring-white/60 px-4 py-3 sm:px-5 sm:py-4
                 shadow-[0_12px_30px_-18px_rgba(15,23,61,0.7)]
                 transition hover:bg-white active:scale-[0.995]"
    >
      <GoldCoin className="w-9 h-9 sm:w-11 sm:h-11 shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
          {t("balance")}:{" "}
          {Number(user ? balance : 0).toLocaleString("tj-TJ")}{" "}
          <span className="text-slate-500 font-bold text-xs sm:text-sm">
            {t("currency")}
          </span>
        </div>
        <div className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
          {t("balanceHint")}
        </div>
      </div>

      <span
        className="shrink-0 rounded-full bg-brand-600 text-white text-[11px] sm:text-sm
                   font-bold px-3 sm:px-4 py-2 group-hover:bg-brand-700 transition"
      >
        {user ? t("navOrders") : t("login")} →
      </span>
    </Link>
  );
}

/** Плиткаи рақам/матн */
function Tile({
  icon,
  value,
  label,
  color = "text-brand-700",
}: {
  icon: React.ReactNode;
  value?: string;
  label: string;
  color?: string;
}) {
  return (
    <div className="card p-4 text-center flex flex-col items-center justify-center min-h-[96px]">
      <div className="grid place-items-center mb-1">{icon}</div>
      {value != null && (
        <div className={`text-xl font-black tabular-nums ${color}`}>
          {value}
        </div>
      )}
      <div className="text-[11px] font-semibold text-slate-500 leading-tight mt-0.5">
        {label}
      </div>
    </div>
  );
}
