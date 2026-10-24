import { Link } from "react-router-dom";
import type { Game } from "../types";
import { useApp } from "../context/AppContext";
import GameLogo from "./GameLogo";

/**
 * Корти бозӣ — мобилӣ **хеле зич** (мисли persshop):
 *   танҳо тасвир + ном + нарх, бе фосилаи иловагӣ.
 */
export default function GameCard({ game }: { game: Game }) {
  const { t } = useApp();
  const min = game.min_price_tjs;

  return (
    <Link
      to={`/game/${game.slug}`}
      className="group relative flex flex-col items-center text-center gap-0
                 w-full max-w-[72px] sm:max-w-[82px] md:max-w-[92px] mx-auto
                 transition active:scale-[0.95]"
    >
      {/* Нишонаи «Хит» */}
      {game.is_popular && (
        <span
          className="absolute top-0 right-0 z-10 rounded-sm bg-rose-500 px-1 py-0.5
                     text-[9px] font-bold text-white shadow-sm -translate-y-1/2 translate-x-1/2"
        >
          {t("popular")}
        </span>
      )}

      {/* Тасвир — пурра дар паҳноӣ */}
      <GameLogo game={game} size="card" />

      {/* Ном — то 2 сатр */}
      <div className="w-full text-[10px] sm:text-[11px] font-semibold leading-tight line-clamp-2 text-slate-800">
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