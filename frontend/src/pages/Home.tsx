import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Gamepad2, Search, SearchX, ShieldAlert, Star, TriangleAlert, X } from "lucide-react";
import { api } from "../api/client";
import type { Game, Review } from "../types";
import GameCard from "../components/GameCard";
import CoinsCard from "../components/CoinsCard";
import PromoCarousel from "../components/PromoCarousel";
import TrustTicker from "../components/TrustTicker";
import { KEEP_BANNER_ON_HOME } from "../components/InfoSections";
import { useApp } from "../context/AppContext";
import { Ic, TajikFlag } from "../components/Icons";

/**
 * Саҳифаи асосӣ — тарҳи мисли persshop.com:
 *   1) Сарлавҳаи кабуд: ҷустуҷӯ + тикери тақризҳо (бо Navbar мепайвандад)
 *   2) Баннери промо (карусел)
 *   3) Рӯйхати бозиҳо (бо ҷустуҷӯи зинда)
 *   4) Плиткаҳои рақамҳо
 *   5) «Чӣ тавр кор мекунад» + огоҳиномаи бехатарӣ
 */
/**
 * 📦 Кэши барои БОЗГАШТ (талаби соҳиб 16.11.2026: «баъд ин обновис
 * мешавад» → «зебо ва сода»): ҳангоми бозгашт ба саҳифаи асосӣ маълумот
 * АЗ КЭШ ҳамонзамон нишон дода мешавад (без skeleton-и холӣ), дар
 * пасмиз ҳамеша аз нав гирифта мешавад (stale-while-revalidate) →
 * мундариҷа ҳамеша тоза мемонад. Кэш барои ҳар забон алоҳида (номҳои
 * бозиҳо фарқ мекунанд).
 */
type HomeCache = {
  games: Game[];
  revList: Review[];
  reviewSum: { rating_avg: number; reviews_total: number } | null;
};
const homeCache = new Map<string, HomeCache>();

/** 🖼️ Суратҳои гармшуда — истинод нигоҳ дошта мешавад, то GC боркунии
 *  нимавҷудро қатъ накунад */
const warmImgs: HTMLImageElement[] = [];
const warmedUrls = new Set<string>();

/**
 * 🖼️ Пешакӣ бор кардани логотипҳои бозиҳо (талаби соҳиб 16.11.2026:
 * «ва баъд ин обновис мешавад» → «зебо ва сода»).
 *
 * `<img loading="lazy">` ҳангоми баромадан аз саҳифа (баргашт) аз DOM
 * ҷудо шуда, боркуниаш қатъ мешавад → бозгашт = суратҳо чанд сония
 * дертар меоянд (саҳифа аввал холӣ, баъд «обновис» мешавад).
 * `new Image()` аз DOM ҷудо нест: боркунӣ то охираш идома мекунад ва
 * натиҷа дар кэши браузер мемонад → бозгашт = логотипҳо ҳамонзамон.
 */
function warmGameImages(list: Game[]) {
  for (const g of list) {
    const u = g.image_url;
    if (!u || warmedUrls.has(u)) continue;
    warmedUrls.add(u);
    const im = new Image();
    im.src = u;
    warmImgs.push(im);
  }
}

export default function Home() {
  const { t, lang, search: query, setSearch: setQuery } = useApp();
  const [games, setGames] = useState<Game[]>(() => homeCache.get(lang)?.games ?? []);
  const [loading, setLoading] = useState(() => !homeCache.has(lang));
  const [error, setError] = useState("");
  /** ⭐ Тақризҳои тасдиқшуда — НОМИ харидорони отзивдор барои тикер */
  const [revList, setRevList] = useState<Review[]>(() => homeCache.get(lang)?.revList ?? []);
  /** ⭐ Рейтинги воқеӣ аз ҷадвали отзывҳо (админ тасдиқкардаҳо) */
  const [reviewSum, setReviewSum] = useState<{
    rating_avg: number;
    reviews_total: number;
  } | null>(() => homeCache.get(lang)?.reviewSum ?? null);

  useEffect(() => {
    let alive = true;
    const save = (patch: Partial<HomeCache>) => {
      const cur = homeCache.get(lang) ?? { games: [], revList: [], reviewSum: null };
      homeCache.set(lang, { ...cur, ...patch });
    };
    const c = homeCache.get(lang);
    if (c) {
      // Аз кэш → ҳамонзамон (бе skeleton) → бозгашт «обновис» намешавад
      setGames(c.games);
      setRevList(c.revList);
      setReviewSum(c.reviewSum);
      setLoading(false);
      setError("");
    } else {
      setLoading(true);
      setError("");
    }
    // SWR: ҳамеша дар пасмиз аз нав мегирем → маълумот ҳамеша тоза
    api
      .games(lang)
      .then((d) => {
        if (!alive) return;
        setGames(d);
        save({ games: d });
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        // хато танҳо он вақт нишон дода мешавад, ки кэш ҳам набошад
        if (!homeCache.get(lang)) setError(e?.message ?? t("error"));
        setLoading(false);
      });
    api
      .reviews(12)
      .then((d) => {
        if (!alive) return;
        setRevList(d);
        save({ revList: d });
      })
      .catch(() => {});
    api
      .reviewSummary()
      .then((d) => {
        if (!alive) return;
        setReviewSum(d);
        save({ reviewSum: d });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lang, t]);

  /** 🖼️ Логотипҳоро ҳамонзамон гарм мекунем (аз ҷумла аз кэш) → бозгашт
   *  бо суратҳои тайёр, бе пайдо шудани таъхирдор = «обновис» нест. */
  useEffect(() => {
    warmGameImages(games);
  }, [games]);

  /** Ҷустуҷӯи зинда — ҳамаи бозиҳо бо филтри матнӣ */
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

  /** Бейҷаи чап — мисли тикери persshop: «⭐ 4,9 1360 тақриз»
   *  Ҳама аз ҷадвали отзывҳои тасдиқшуда — рақами воқеӣ.
   *  Иконкаи касбӣ (Lucide Star), на emoji; ҳатто рейтинг 0 бошад ҳам нишон дода мешавад. */
  const ratingBadge = useMemo(() => {
    const avg = reviewSum?.rating_avg ?? 0;
    const n = reviewSum?.reviews_total ?? 0;
    return (
      <>
        <Ic icon={Star} size="xs" className="text-amber-300 fill-current" />
        <span className="tabular-nums">
          {avg.toFixed(1).replace(".", ",")} {n} {t("reviewsCount")}
        </span>
      </>
    );
  }, [reviewSum, t]);

  /** 🎚️ Тикери тақризҳо: НОМИ ҳар харидоре, ки отзив гузоштааст
   *  (мисли «★★★★★ AZAM» дар persshop). Танҳо тақризҳои тасдиқшудаи
   *  админ аз `GET /reviews` — ҷаълӣ нест; 0 тақриз → тарафи рост холӣ. */
  const tickerItems = useMemo(
    () =>
      revList.map((r) => ({
        icon: "\u2605".repeat(r.rating) + "\u2606".repeat(Math.max(0, 5 - r.rating)),
        text: r.author_name,
        iconClass: "text-amber-300",
      })),
    [revList],
  );

  /** 🎚️ Тикери тақризҳо — НОМИ харидорони отзивдор (мисли persshop) */
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

          {/* ⭐️ Тикери тақризҳо — бейҷа │ НОМИ харидорони отзивдор (мисли persshop) */}
          <TrustTicker items={tickerItems} badge={ratingBadge} />
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
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
            {/* 🎮 Сарлавҳа — икона дар badge-и gradient + матни зебо */}
            <h2 className="text-base sm:text-xl font-extrabold tracking-tight inline-flex items-center gap-2.5">
              <span className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/35">
                <Ic icon={Gamepad2} size="sm" />
              </span>
              <span className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-400">
                {query ? t("resultsFor") : t("chooseGame")}
              </span>
            </h2>

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
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </section>

        {/* ===== 4) ПЛИТКАҲОИ РАҚАМ ===== */}
        {/* 🎯 ЛАЙКҲО — БАХШИ АЛОҲИДА: ҳаҷм мисли кортҳои бозӣ, РАСМИ ВОҚЕӢ */}
        <section className="mt-4 sm:hidden" aria-label={t("secLikes")}>
          <div className="grid grid-cols-4 gap-x-3 gap-y-5">
            <Link
              to="/game/free-fire?group=likes"
              aria-label={t("secLikes")}
              className="group relative flex flex-col items-center gap-1.5
                         w-full max-w-[100px] sm:max-w-[110px] mx-auto
                         transition active:scale-[0.96] focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-brand-400 rounded-xl"
            >
              <span className="w-full aspect-square rounded-[22%] relative shrink-0
                             overflow-hidden ring-1 ring-white/70
                             shadow-[0_10px_22px_-10px_rgba(37,99,235,0.45)]
                             group-hover:scale-[1.04] group-hover:shadow-[0_14px_28px_-10px_rgba(37,99,235,0.55)]
                             transition duration-200">
                <img
                  src="/images/likes/heart-fire.webp?v=20261120"
                  alt=""
                  aria-hidden
                  className="w-full h-full object-cover"
                />
              </span>
                {/* 🆕 NEW — 10 рӯз (20—30.11.2026); берун аз расм, то бурида нашавад */}
                {Date.now() < Date.parse("2026-11-30T23:59:59+05:00") && (
                  <span className="absolute -top-2 -right-3 z-10 inline-flex items-center justify-center
                                   rounded-full border-2 border-white bg-white px-2 py-0.5
                                   text-[10px] font-extrabold leading-none text-rose-600 shadow-md">
                    NEW
                  </span>
                )}
              <span className="w-full text-[11px] sm:text-xs font-bold leading-tight line-clamp-2
                               text-center text-slate-800 dark:text-white">
                {t("secLikes")}
              </span>
            </Link>
          </div>
        </section>

        {/* Огоҳиномаи бехатарӣ — танҳо агар KEEP_BANNER_ON_HOME = true бошад */}
        {KEEP_BANNER_ON_HOME && (
          <div className="mt-8 mb-4 rounded-2xl bg-amber-50/80 border border-amber-200 p-4 sm:p-5 text-sm text-amber-900 flex items-center gap-3">
            <Ic icon={ShieldAlert} size="md" className="text-amber-500" />
            <span className="font-medium">{t("secureNote")}</span>
          </div>
        )}

        {/* 👥 Муштариёни воқеӣ ва ⭐ тақризҳо → акнун дар саҳифаи алоҳидаи /reviews */}
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
