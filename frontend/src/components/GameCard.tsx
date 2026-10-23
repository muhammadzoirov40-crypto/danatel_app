import { Link } from "react-router-dom";
import type { Game } from "../types";
import { useApp } from "../context/AppContext";
import GameLogo from "./GameLogo";

/**
 * Корти бозӣ — тили **хурд ва зич** мисли persshop.com:
 *   иконкаи мудаввар + ном + нархи хурд.
 *   (Бе қаламфури калон — танҳо ҳангами hover сафед мешавад)
 */
export default function GameCard({ game }: { game: Game }) {
  const { t } = useApp();
  const min = game.min_price_tjs;

  return (
    <Link
      to={`/game/${game.slug}`}
      className="group relative flex flex-col items-center text-center gap-1.5
                 rounded-2xl p-1.5 sm:p-2 hover:bg-white
                 hover:shadow-[0_10px_25px_-16px_rgba(37,99,235,0.55)]
                 transition active:scale-[0.97]"
    >
      {/* Нишонаи «Хит» — танҳо барои бозии машҳур */}
      {game.is_popular && (
        <span
          className="absolute top-1 right-1 z-10 rounded-md bg-rose-500 px-1.5 py-0.5
                     text-[10px] font-bold text-white shadow-sm"
        >
          {t("popular")}
        </span>
      )}

      {/* Иконка — ҳамаи паҳноӣ, чоркунҷаи мудаввар */}
      <GameLogo game={game} size="card" />

      {/* Ном — то 2 сатр */}
      <div className="w-full text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2">
        {game.name}
      </div>

      {/* Нарх — хурд, зери ном */}
      {min != null && (
        <div className="text-[10px] sm:text-[11px] font-bold text-brand-600 tabular-nums">
          {t("from")} {Number(min).toLocaleString("tj-TJ")}
        </div>
      )}
    </Link>
  );
}
