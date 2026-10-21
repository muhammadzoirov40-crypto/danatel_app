import { useState } from "react";
import type { Game } from "../types";

interface Props {
  game: Game;
  /** Андоза: "card" (саҳифаи асосӣ) | "hero" (тафсилот) */
  size?: "card" | "hero";
}

/**
 * Логотипи бозӣ.
 * - Агар расм бошад → `object-contain` бо фазои мувафиқ
 * - Агар расм нобурд ё хатогӣ дошта бошад → emoji fallback
 */
export default function GameLogo({ game, size = "card" }: Props) {
  const [failed, setFailed] = useState(false);

  const box =
    size === "hero"
      ? "w-24 h-24 sm:w-32 sm:h-32 rounded-3xl"
      : "w-full aspect-square rounded-2xl";

  const pad = Math.min(Math.max(game.image_pad ?? 0, 0), 40);
  const showImage = !!game.image_url && !failed;

  return (
    <div
      className={`${box} relative grid place-items-center overflow-hidden
                  bg-gradient-to-br from-slate-100 to-slate-200
                  group-hover:from-brand-50 group-hover:to-brand-100 transition`}
    >
      {showImage ? (
        <img
          src={game.image_url as string}
          alt={game.name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-contain p-[var(--pad)]"
          style={{ ["--pad" as string]: `${size === "hero" ? Math.round(pad * 1.4) : pad}px` }}
        />
      ) : (
        <span
          className={`${size === "hero" ? "text-6xl sm:text-7xl" : "text-4xl"} select-none`}
          aria-hidden
        >
          {game.emoji}
        </span>
      )}
    </div>
  );
}
