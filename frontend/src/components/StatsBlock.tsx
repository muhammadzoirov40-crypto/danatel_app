import { useMemo } from "react";
import type { Game } from "../types";
import { useApp } from "../context/AppContext";
import { Ic } from "./Icons";
import { Gamepad3D, Diamond3D, IdBadge3D, TajikFlag } from "./Icons";

/**
 * Блоки омор (2x2) кӯчонидашуда аз саҳифаи асосӣ.
 * Рақамҳо (бозиҳо, маҳсулотҳо) аз маълумоти воқеӣ (API) гирифта мешаванд.
 */
export default function StatsBlock({ games, loading }: { games: Game[]; loading: boolean }) {
  const { t } = useApp();

  const totalProducts = useMemo(
    () => games.reduce((s, g) => s + (g.products_count ?? 0), 0),
    [games],
  );

  if (loading) {
    return (
      <section className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5 h-24 animate-pulse bg-slate-100 dark:bg-slate-800" />
        ))}
      </section>
    );
  }

  return (
    <section className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="card p-5 text-center flex flex-col items-center">
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-blue-50 ring-1 ring-blue-100 dark:bg-blue-900/30 dark:ring-blue-800 mb-3 shadow-xs">
          <Gamepad3D className="w-8 h-8" />
        </div>
        <div className="font-bold text-sm mb-1">{t("statGames")}</div>
        <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
          {games.length}
        </div>
      </div>

      <div className="card p-5 text-center flex flex-col items-center">
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-sky-50 ring-1 ring-sky-100 dark:bg-sky-900/30 dark:ring-sky-800 mb-3 shadow-xs">
          <Diamond3D className="w-8 h-8" />
        </div>
        <div className="font-bold text-sm mb-1">{t("statProducts")}</div>
        <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
          {totalProducts}
        </div>
      </div>

      <div className="card p-5 text-center flex flex-col items-center">
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-purple-50 ring-1 ring-purple-100 dark:bg-purple-900/30 dark:ring-purple-800 mb-3 shadow-xs">
          <IdBadge3D className="w-8 h-8" />
        </div>
        <div className="font-bold text-sm mb-1">{t("trustId")}</div>
      </div>

      <div className="card p-5 text-center flex flex-col items-center">
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200/60 dark:bg-emerald-900/30 dark:ring-emerald-800 mb-3 shadow-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 ring-1 ring-emerald-200/60 shadow-xs dark:bg-emerald-900/40">
            <TajikFlag className="w-5 h-3.5 rounded-xs" />
            <span className="text-xs font-black text-emerald-800 tracking-wide dark:text-emerald-200">TJS</span>
          </div>
        </div>
        <div className="font-bold text-sm mb-1">{t("trustSomoni")}</div>
      </div>
    </section>
  );
}
