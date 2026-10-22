import { Link } from "react-router-dom";
import type { Game } from "../types";
import { useApp } from "../context/AppContext";
import GameLogo from "./GameLogo";

/**
 * Корти бозӣ — сеткаи responsive.
 * Мисли persshop: нишонаи «Хит» барои бозии машҳур + нархи аз-рӯ.
 */
export default function GameCard({ game }: { game: Game }) {
  const { t } = useApp();
  const min = game.min_price_tjs;

  return (
    <Link
      to={`/game/${game.slug}`}
      className="card group relative p-3 sm:p-4 flex flex-col items-center text-center
                 gap-2 hover:border-brand-400 hover:shadow-md transition
                 active:scale-[0.98]"
    >
      {/* Нишонаи «Хит» — танҳо барои бозии машҳур */}
      {game.is_popular && (
        <span className="absolute top-2 right-2 badge bg-amber-500 text-white shadow-sm">
          🔥 {t("popular")}
        </span>
      )}

      <GameLogo game={game} size="card" />

      <div>
        <div className="font-semibold text-sm sm:text-base leading-tight">
          {game.name}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{game.currency}</div>
      </div>

      {min != null && (
        <div className="mt-auto rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
          {t("from")} {Number(min).toLocaleString("tj-TJ")} {t("currency")}
        </div>
      )}

      <span className="text-xs font-medium text-brand-600 group-hover:underline">
        {t("pay")} →
      </span>
    </Link>
  );
}
