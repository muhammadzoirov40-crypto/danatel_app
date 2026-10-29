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
    <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-lg shadow-blue-700/30 ring-1 ring-white/20 dark:from-blue-700 dark:to-indigo-800 dark:shadow-none">
      {/* ✒️ Кикер — хурд, фишурда, сафед (мисли корти баланс) */}
      <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-100/90">
        <Ic icon={Sparkles} size="xs" />
        Pers Coins
      </div>

      {/* ✒️ Маблағ — калон, рақамҳои баробар (tabular) */}
      <div className="mt-1 text-[2rem] sm:text-4xl font-black leading-none tracking-[-0.02em] tabular-nums [text-shadow:0_2px_14px_rgba(15,23,42,0.28)]">
        {amount.toLocaleString("tj-TJ")}
        <span className="ml-1.5 text-base sm:text-lg font-semibold text-blue-200 [text-shadow:none]">
          {t("coinUnit")}
        </span>
      </div>

      {/* 📏 Прогресс: тангаҳо → хароҷоти гардиш */}
      <div className="mt-2.5 text-[11px] font-semibold text-blue-100/90">
        {left > 0 ? t("toSpin").replace("{n}", String(left)) : t("spinReady")}
      </div>
      <div
        role="progressbar"
        aria-label="Pers Coins"
        aria-valuemin={0}
        aria-valuemax={cost}
        aria-valuenow={Math.min(amount, cost)}
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/25"
      >
        <div
          className="h-full rounded-full bg-white transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* ⬜ Тугмаи «Гардондан» — сафед (мисли «Пур кардан») */}
      <Link
        to="/wheel"
        className="mt-3.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-[13px] sm:text-sm font-bold text-blue-700 shadow-md shadow-blue-900/20 transition hover:bg-blue-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        <Ic icon={Sparkles} size="sm" className="shrink-0 text-blue-600" />
        {t("gardonan")}
      </Link>
    </div>
  );
}
