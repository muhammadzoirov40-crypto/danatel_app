import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import type { Game } from "../types";
import { useApp } from "../context/AppContext";
import GameLogo from "./GameLogo";
import { Ic } from "./Icons";

interface GameCardProps {
  game: Game;
  isFavorite?: boolean;
  onToggleFavorite?: (slug: string) => void;
}

/**
 * Корти бозӣ — мисли persshop.com:
 *   айкони калон (squircle, мисли app-icon) + ном дар поён + нархи аз.
 *
 * ⚠️ Бейҷаи «ХИТ» ТАНҲО ВАҚТЕ СОХТА МЕШАВАД, ки админ `is_popular`-ро
 *    фаъол кардааст — рейтинги ҷаълӣ нест.
 * ❤️ Тугмаи дӯстдоштаҳо (Favorites) бо нигоҳдорӣ дар browser.
 */
export default function GameCard({ game, isFavorite = false, onToggleFavorite }: GameCardProps) {
  const { t } = useApp();
  const min = game.min_price_tjs;

  return (
    <Link
      to={`/game/${game.slug}`}
      className="group relative flex flex-col items-center text-center gap-1.5
                 w-full max-w-[100px] sm:max-w-[110px] md:max-w-[118px] mx-auto
                 transition active:scale-[0.96]"
    >
      {/* ❤️ Тугмаи дӯстдоштаҳо */}
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(game.slug);
          }}
          aria-label={isFavorite ? "Аз дӯстдоштаҳо хориҷ кардан" : "Ба дӯстдоштаҳо илова кардан"}
          title={isFavorite ? "Дӯстдошта" : "Илова ба дӯстдоштаҳо"}
          className="absolute -top-1.5 -left-1.5 z-10 w-6 h-6 rounded-full bg-white/95
                     backdrop-blur-xs shadow-xs border border-slate-200/80
                     grid place-items-center hover:scale-110 active:scale-90 transition
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <Ic
            icon={Heart}
            size="xs"
            className={isFavorite ? "text-rose-500 fill-rose-500" : "text-slate-400 hover:text-rose-500"}
          />
        </button>
      )}

      {/* 🏷️ «ХИТ» — танҳо аз рӯи маълумоти сервер */}
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
