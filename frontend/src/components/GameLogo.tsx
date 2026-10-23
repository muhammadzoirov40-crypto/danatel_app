import { useState } from "react";
import type { Game } from "../types";

interface Props {
  game: Game;
  /** Андоза: "card" (саҳифаи асосӣ) | "hero" (тафсилот) */
  size?: "card" | "hero";
}

/**
 * Тасвири бозӣ — мисли persshop.com.
 * - Чоркунҷаи мудаввар (squircle) бо тасвири пурра (`object-cover`)
 * - Сурхи сафед + сояи кабуд
 * - Агар расм нобурд → emoji fallback
 */
export default function GameLogo({ game, size = "card" }: Props) {
  const [failed, setFailed] = useState(false);

  const box =
    size === "hero"
      ? "w-20 h-20 sm:w-28 sm:h-28 rounded-[24%]"
      : "w-full aspect-square rounded-[22%]";

  const showImage = !!game.image_url && !failed;

  return (
    <div
      className={`${box} relative grid place-items-center overflow-hidden
                  bg-gradient-to-br from-brand-100 to-brand-200
                  ring-1 ring-white/60 shadow-[0_6px_16px_-8px_rgba(37,99,235,0.4)]
                  group-hover:scale-[1.03] transition-transform duration-200`}
    >
      {showImage ? (
        <img
          src={game.image_url as string}
          alt={game.name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-4xl" aria-hidden>
          🎮
        </span>
      )}
    </div>
  );
}
