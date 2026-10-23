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
      className="group relative flex flex-col items-center text-center gap-0.5
                 w-full max-w-[80px] sm:max-w-[92px] md:max-w-[100px] mx-auto
                 transition active:scale-[0.96]"
    >
      {/* Тасвир — паймон ва мудаввар */}
      <GameLogo game={game} size="card" />

      {/* Ном — то 2 сатр */}
      <div className="w-full text-[10px] sm:text-[11px] font-semibold leading-tight line-clamp-2 mt-1 text-slate-800">
        {game.name}
      </div>

      {/* Нарх — хурд ва равшан */}
      {min != null && (
        <div className="text-[10px] sm:text-[11px] font-bold text-brand-600 tabular-nums">
          {t("from")} {Number(min).toLocaleString("tj-TJ")}
        </div>
      )}
    </Link>
  );
}
