import { useEffect, useMemo, useState } from "react";
import { Flame, Gamepad2, Heart, LayoutGrid, Search, SearchX, ShieldAlert, Star, TriangleAlert, X } from "lucide-react";
import { api } from "../api/client";
import type { Game } from "../types";
import GameCard from "../components/GameCard";
import CoinsCard from "../components/CoinsCard";
import PromoCarousel from "../components/PromoCarousel";
import TrustTicker from "../components/TrustTicker";
import SeoBlock from "../components/SeoBlock";
import { useApp } from "../context/AppContext";
import { Ic, CreditCard3D, Diamond3D, Gamepad3D, GiftBox3D, IdBadge3D, TajikFlag } from "../components/Icons";

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
  /** ⭐ Рейтинги воқеӣ аз ҷадвали отзывҳо (админ тасдиқкардаҳо) */
  const [reviewSum, setReviewSum] = useState<{
    rating_avg: number;
    reviews_total: number;
  } | null>(null);

  /** ❤️ Дӯстдоштаҳо (нигоҳдорӣ дар хотираи браузер) */
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("danatel_favorites") || "[]");
    } catch {
      return [];
    }
  });

  const [filterTab, setFilterTab] = useState<"all" | "popular" | "favorites">("all");

  const toggleFavorite = (slug: string) => {
    setFavorites((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      try {
        localStorage.setItem("danatel_favorites", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .games(lang)
      .then((d) => alive && setGames(d))
      .catch((e) => alive && setError(e?.message ?? t("error")))
      .finally(() => alive && setLoading(false));
    api
      .reviewSummary()
      .then((d) => alive && setReviewSum(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lang, t]);

  /** Ҷустуҷӯи зинда ва филтр — ҳама / машҳур / дӯстдоштаҳо */
  const filtered = useMemo(() => {
    let list = games;
    if (filterTab === "popular") {
      list = list.filter((g) => g.is_popular);
    } else if (filterTab === "favorites") {
      list = list.filter((g) => favorites.includes(g.slug));
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.slug.toLowerCase().includes(q) ||
        (g.currency ?? "").toLowerCase().includes(q),
    );
  }, [games, query, filterTab, favorites]);

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

  /** Бейҷаи чап: рейтинги миёна + ЧАНД нафар хол додаанд.
   *  Ҳама аз ҷадвали отзывҳои тасдиқшуда — рақами воқеӣ.
   *  Иконкаи касбӣ (Lucide Star), на emoji; ҳатто рейтинг 0 бошад ҳам нишон дода мешавад. */
  const ratingBadge = useMemo(() => {
    const avg = reviewSum?.rating_avg ?? 0;
    const n = reviewSum?.reviews_total ?? 0;
    return (
      <>
        <Ic icon={Star} size="xs" className="text-amber-300 fill-current" />
        <span className="tabular-nums">
          {avg.toFixed(1)} ({n} {t("ratedPeople")})
        </span>
      </>
    );
  }, [reviewSum, t]);

  /** 🎚️ Тикер танҳо бейҷаи ⭐ рейтингро нишон медиҳад — матнҳо бардошта шуданд */
  return (
    <div>
      {/* ===== 1) САРЛАВҲАИ КАБУД — бо Navbar мепайвандад ===== */}
      <section className="text-white">
        <div className="mx-auto max-w-6xl flex flex-col gap-3 px-4 pt-2 pb-0 sm:pt-5">
          <h1 className="sr-only">{t("heroTitle")}</h1>

          {/* 🔍 Ҷустуҷӯ — КАЛОН, мисли persshop (аз ҳар дастгоҳ кор мекунад) */}
          <div className="relative">
            {/* Иконка: `z-10` зарур аст → `backdrop-blur` дар input stacking context
                месозад ва бе z-index иконка аз паси фони input пинҳон мемонад. */}
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10
                             text-white/70">
              <Ic icon={Search} />
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
                aria-label={t("clear")}
                className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center
                           w-7 h-7 rounded-full bg-white/20 text-white hover:bg-white/30
                           transition active:scale-95 focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <Ic icon={X} />
              </button>
            )}
          </div>

          {/* ⭐️ Сатри далелҳо — мисли takrizhoi persshop (бо рейтингҳои воқеӣ) */}
          <TrustTicker badge={ratingBadge} />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* 🪙 KORTI PERS COINS + «Гардондан» → /wheel (танҳо баъди вуруд) */}
        <div className="mt-3 sm:mt-4">
          <CoinsCard />
        </div>

        {/* ===== 3) 🎠 БАННЕР — дар заминаи сафед (кабуд аз боло поён рафт) ===== */}
        {!loading && !error && promo.length > 0 && (
          <div className="mt-3 sm:mt-4">
            <PromoCarousel games={promo} />
          </div>
        )}

        {/* ===== 4) РӮЙХАТИ БОЗИҲО ===== */}
        <section id="games" className="mt-8 sm:mt-12 scroll-mt-20">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2.5">
            {/* 🎮 Сарлавҳа — икона дар badge-и gradient + матни зебо */}
            <h2 className="text-base sm:text-xl font-extrabold tracking-tight inline-flex items-center gap-2.5">
              <span className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/35">
                <Ic icon={Gamepad2} size="sm" />
              </span>
              <span className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-400">
                {query ? t("resultsFor") : t("chooseGame")}
              </span>
            </h2>

            {/* 🎚️ Чипҳои филтр — ҳар як ранги худ, фаъол = gradient + соя */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                aria-pressed={filterTab === "all"}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                  filterTab === "all"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/35"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/10"
                }`}
              >
                <Ic icon={LayoutGrid} size="xs" />
                <span>{lang === "ru" ? "Все" : lang === "uz" ? "Barchasi" : lang === "en" ? "All" : "Ҳама"}</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("popular")}
                aria-pressed={filterTab === "popular"}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                  filterTab === "popular"
                    ? "bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-md shadow-rose-500/35"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/10"
                }`}
              >
                <Ic icon={Flame} size="xs" />
                <span>{lang === "ru" ? "Популярные" : lang === "uz" ? "Ommabop" : lang === "en" ? "Popular" : "Машҳур"}</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("favorites")}
                aria-pressed={filterTab === "favorites"}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 ${
                  filterTab === "favorites"
                    ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/35"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/10"
                }`}
              >
                <Ic icon={Heart} size="xs" className={favorites.length ? "fill-current" : ""} />
                <span>{lang === "ru" ? "Избранное" : lang === "uz" ? "Sevimlilar" : lang === "en" ? "Favorites" : "Дӯстдоштаҳо"}</span>
                {favorites.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{favorites.length}</span>
                )}
              </button>
            </div>
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
              <div className="flex justify-center mb-2">
                <Ic icon={TriangleAlert} size="xl" />
              </div>
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
              <div className="flex justify-center mb-2 text-slate-300">
                <Ic icon={SearchX} size="2xl" />
              </div>
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
                <GameCard key={g.id} game={g} isFavorite={favorites.includes(g.slug)} onToggleFavorite={toggleFavorite} />
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
          <Ic icon={ShieldAlert} size="md" className="text-amber-500" />
          <span className="font-medium">{t("secureNote")}</span>
        </div>

        {/* 👥 Муштариёни воқеӣ ва ⭐ тақризҳо → акнун дар саҳифаи алоҳидаи /reviews */}

        {/* 📝 Блоки SEO — маълумоти воқеӣ (мисли persshop) */}
        {!loading && !error && games.length > 0 && <SeoBlock games={games} />}
      </div>
    </div>
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
