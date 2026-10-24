import { Link } from "react-router-dom";
import type { Game } from "../types";
import { useApp } from "../context/AppContext";
import GameLogo from "./GameLogo";

/**
 * Корти бозӣ — мисли persshop.com:
 *   айкони калон (squircle, мисли app-icon) + ном дар поён + нархи аз.
 *
 * ⚠️ Бейҷаи «ХИТ» ТАНҲО ВАҚТЕ СОХТА МЕШАВАД, ки админ `is_popular`-ро
 *    фаъол кардааст — рейтинги ҷаълӣ нест.
 */
export default function GameCard({ game }: { game: Game }) {
  const { t } = useApp();
  const min = game.min_price_tjs;

  return (
    <Link
      to={`/game/${game.slug}`}
      className="group relative flex flex-col items-center text-center gap-1.5
                 w-full max-w-[86px] sm:max-w-[112px] md:max-w-[124px] mx-auto
                 transition active:scale-[0.96]"
    >
      {/* 🏷️ «ХИТ» — танҳо аз рӯи маълумоти сервер (0/128 ҳоло) */}
      {game.is_popular && (
        <span
          className="absolute -top-1.5 -right-1.5 z-10 rounded-full bg-rose-500
                     px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase
                     tracking-wide text-white shadow-[0_4px_10px_-3px_rgba(225,29,72,0.6)]"
        >
          {t("popular")}
        </span>
      )}

      {/* Тасвир — squircle калон, мисли app-icon */}
      <GameLogo game={game} size="card" />

      {/* Ном — то 2 сатр */}
      <div className="w-full text-[11px] sm:text-xs font-bold leading-tight line-clamp-2 text-slate-800">
        {game.name}
      </div>

      {/* Нарх — хурд, кабуд */}
      {min != null && (
        <div className="text-[10px] sm:text-[11px] font-bold text-brand-600 tabular-nums">
          {t("from")} {Number(min).toLocaleString("tj-TJ")}
        </div>
      )}
    </Link>
  );
}
