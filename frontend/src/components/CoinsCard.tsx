import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";
import type { CoinsInfo } from "../types";
import { Ic } from "./Icons";

/**
 * 🪙 КОРТИ PERS COINS — «Pers Coins: N» + «То гардиш — N танга»
 * + шкалаи прогресс + тугмаи кабуди «Гардондан» → саҳифаи чарх.
 *
 * Қоидаҳо:
 *  • Ҳама рақамҳо аз backend (`/api/coins/me`) — фронт ҳеҷ рақам намесозад
 *  • Танҳо баъди вуруд нишон дода мешавад (ҳисоби воқеӣ лозим аст)
 *  • `data` агар дода шавад → ҳамон маълумот истифода мешавад
 *    (дар профил аллакай ҳаст → ДУБРА дархост намешавад);
 *    агар дода нашавад → худаш як дафъа мегирад (дар саҳифаи асосӣ)
 */
export default function CoinsCard({ data }: { data?: CoinsInfo | null }) {
  const { t, user } = useApp();
  const [own, setOwn] = useState<CoinsInfo | null>(null);
  const [failed, setFailed] = useState(false);

  const selfFetch = data === undefined;

  useEffect(() => {
    if (!selfFetch || !user) return;
    let alive = true;
    api
      .myCoins()
      .then((d) => alive && setOwn(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [selfFetch, user]);

  // Бе ҳисоб — маълумоти шахсӣ вуҷуд надорад → корт ҳам нишон дода намешавад
  if (!user) return null;

  const info: CoinsInfo | null = selfFetch ? own : data;

  // Ҳанӯз боргирӣ → скелетон (ҳамон андоза, то саҳифа ҷумба накунад)
  if (!info) {
    if (selfFetch && failed) return null;
    return (
      <div
        aria-hidden
        className="h-[78px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100 shadow-sm dark:border-white/10 dark:bg-white/5"
      />
    );
  }

  const cost = Math.max(1, info.spin_cost);
  const amount = Math.max(0, info.coins);
  const left = Math.max(0, cost - amount);
  const pct = Math.min(100, Math.round((amount / cost) * 100));

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2.5 rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-3.5 shadow-sm dark:border-white/10 dark:bg-white/5">
      {/* 🪙 Тиллоӣ бо «P» дар дохили доираи кабуд */}
      <div
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-600 shadow-md shadow-blue-600/30 sm:h-12 sm:w-12"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 text-[13px] font-black text-amber-950 ring-1 ring-amber-200/70 sm:h-8 sm:w-8 sm:text-sm">
          P
        </span>
      </div>

      <div className="min-w-[132px] flex-1">
        <div className="text-[13px] font-extrabold leading-tight text-slate-900 sm:text-base dark:text-white">
          Pers Coins:{" "}
          <span className="tabular-nums">{amount.toLocaleString("tj-TJ")}</span>
        </div>
        <div className="text-[11px] font-medium leading-tight text-slate-500 sm:text-xs dark:text-slate-400">
          {left > 0 ? t("toSpin").replace("{n}", String(left)) : t("spinReady")}
        </div>

        {/* 📏 Шкалаи прогресс: тангаҳо → хароҷоти гардиш */}
        <div
          role="progressbar"
          aria-label="Pers Coins"
          aria-valuemin={0}
          aria-valuemax={cost}
          aria-valuenow={Math.min(amount, cost)}
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-300/90 dark:bg-white/10"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* 🔵 Тугмаи «Гардондан» → /wheel */}
      <Link
        to="/wheel"
        className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 sm:w-auto sm:px-3.5 py-2.5 text-[11px] sm:text-xs font-bold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
      >
        <Ic icon={Sparkles} size="sm" />
        {t("gardonan")}
      </Link>
    </div>
  );
}
