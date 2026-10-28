import { useEffect, useState, type KeyboardEvent } from "react";
import { Star, Users, type LucideIcon } from "lucide-react";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import Customers from "../components/Customers";
import Reviews from "../components/Reviews";
import BackButton from "../components/BackButton";
import { Ic } from "../components/Icons";

type TabId = "customers" | "reviews";

/**
 * 📇 Саҳифаи алоҳидаи «Муштариёни мо» + «Тақризҳои муштариён».
 *
 *  Ин ду бахш пештар дар саҳифаи асосӣ буданд; акнун ба ин ҷо
 *  кӯчида шуданд ва номҳояшон дар header-и саҳифа ҳамчун таб
 *  навишта шудааст. Бейҷи рейтинги боло рақами воқеӣ аз
 *  `GET /api/reviews/summary` аст — ҳеҷ рақами сохта нест.
 */
export default function ReviewsPage() {
  const { t } = useApp();
  const [tab, setTab] = useState<TabId>("customers");
  const [sum, setSum] = useState<{ rating_avg: number; reviews_total: number } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .reviewSummary()
      .then((d) => {
        if (alive) setSum(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const avg = sum?.rating_avg ?? 0;
  const total = sum?.reviews_total ?? 0;

  const tabs: { id: TabId; icon: LucideIcon; label: string }[] = [
    { id: "customers", icon: Users, label: t("customersTitle") },
    { id: "reviews", icon: Star, label: t("reviewsTitle") },
  ];

  /** Ҷабр: → / ← байни ду таб ҳаракат мекунад (keyboard operability) */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    setTab((cur) => (cur === "customers" ? "reviews" : "customers"));
  };

  return (
    <div>
      {/* ===== Header-и саҳифа: ном + бейҷи рейтинги воқеӣ + номи ду бахш ===== */}
      <section className="text-white">
        <div className="mx-auto max-w-6xl px-4 pt-4 pb-5 sm:pt-6">
          {/* ⬅️ Тугмаи бозгашт (услуби якхела дар ҳамаи саҳифаҳо) */}
          <BackButton />
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black leading-tight">
                {t("reviewsPageTitle")}
              </h1>
              <p className="mt-1 text-sm text-white/75">{t("reviewsPageSub")}</p>
            </div>

            {/* ⭐ Рейтинги воқеӣ — ҳатто 0 бошад ҳам нишон дода мешавад */}
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 ring-1 ring-white/25
                             px-3 py-1.5 text-sm font-black tabular-nums">
              <Ic icon={Star} size="xs" className="text-amber-300 fill-current" />
              {avg.toFixed(1)}
              <span className="font-semibold text-white/75">
                ({total} {t("ratedPeople")})
              </span>
            </span>
          </div>

          {/* Номҳои ду бахш — дар header-и саҳифа */}
          <div
            role="tablist"
            aria-label={t("reviewsPageTitle")}
            onKeyDown={onKeyDown}
            className="mt-4 flex flex-wrap gap-2"
          >
            {tabs.map((x) => {
              const active = tab === x.id;
              return (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  id={`tab-${x.id}`}
                  aria-controls={`panel-${x.id}`}
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTab(x.id)}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold
                              transition active:scale-95
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80
                              ${
                                active
                                  ? "bg-white text-slate-900 shadow-lg shadow-blue-900/25"
                                  : "bg-white/12 text-white/85 ring-1 ring-white/25 hover:bg-white/20 hover:text-white"
                              }`}
                >
                  <Ic
                    icon={x.icon}
                    size="sm"
                    className={
                      active
                        ? x.id === "reviews"
                          ? "text-amber-500 fill-current"
                          : "text-brand-600"
                        : "opacity-90"
                    }
                  />
                  {x.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Мундариҷаи таби интихобшуда ===== */}
      <div className="mx-auto max-w-6xl px-4 pb-16">
        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          tabIndex={0}
          className="outline-none"
        >
          {tab === "customers" ? (
            <Customers showEmpty hideTitle />
          ) : (
            <Reviews hideTitle />
          )}
        </div>
      </div>
    </div>
  );
}
