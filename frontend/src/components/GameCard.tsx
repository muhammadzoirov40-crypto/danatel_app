import { Link } from "react-router-dom";
import type { Game } from "../types";
import { useApp } from "../context/AppContext";

/** Корти бозӣ — сеткаи responsive (2 сутун дар мобилӣ, 4 дар десктоп) */
export default function GameCard({ game }: { game: Game }) {
  const { t } = useApp();

  return (
    <Link
      to={`/game/${game.slug}`}
      className="card group p-4 sm:p-5 flex flex-col items-center text-center
                 gap-3 hover:border-brand-400 hover:shadow-md transition
                 active:scale-[0.98]"
    >
      <div
        className="grid place-items-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl
                   bg-gradient-to-br from-slate-100 to-slate-200 text-3xl
                   group-hover:from-brand-50 group-hover:to-brand-100 transition"
      >
        {game.emoji}
      </div>

      <div>
        <div className="font-semibold text-sm sm:text-base leading-tight">
          {game.name}
        </div>
        <div className="text-xs text-slate-500 mt-1">{game.currency}</div>
      </div>

      <span className="mt-auto text-xs font-medium text-brand-600 group-hover:underline">
        {t("pay")} →
      </span>
    </Link>
  );
}
