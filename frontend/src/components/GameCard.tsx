import { Link } from "react-router-dom";
import type { Game } from "../types";
import { useApp } from "../context/AppContext";
import GameLogo from "./GameLogo";

/**
 * Корти бозӣ — мисли persshop.com:
 *   **танҳо тасвир калон**, бе заминаи сафед, бе қолаб.
 *   Ном + нарх хурд дар зери тасвир.
 */
export default function GameCard({ game }: { game: Game }) {
  const { t } = useApp();
  const min = game.min_price_tjs;

  return (
    <Link
      to={`/game/${game.slug}`}
      className="group relative flex flex-col items-center text-center gap-1
                 transition active:scale-[0.97]"
    >
      {/* Нишонаи «Хит» — танҳо барои бозии машҳур */}
      {game.is_popular && (
        <span
          className="absolute top-0.5 right-0.5 z-10 rounded-md bg-rose-500 px-1.5 py-0.5
                     text-[10px] font-bold text-white shadow-sm"
        >
          {t("popular")}
        </span>
      )}

      {/* Тасвир — пурра дар паҳноӣ, бидуни фосила */}
      <GameLogo game={game} size="card" />

      {/* Ном — то 2 сатр */}
      <div className="w-full text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2">
        {game.name}
      </div>

      {/* Нарх — хурд */}
      {min != null && (
        <div className="text-[10px] sm:text-[11px] font-bold text-brand-600 tabular-nums">
          {t("from")} {Number(min).toLocaleString("tj-TJ")}
        </div>
      )}
    </Link>
  );
}
