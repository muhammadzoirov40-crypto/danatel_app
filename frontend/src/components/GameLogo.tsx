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

  // Тасвири бузургтар = камтар мудаввар (мисли persshop)
  const box =
    size === "hero"
      ? "w-24 h-24 sm:w-32 sm:h-32 rounded-[26%]"
      : "w-full aspect-square rounded-[24%]";

  const showImage = !!game.image_url && !failed;

  return (
    <div
      className={`${box} relative grid place-items-center overflow-hidden
                  bg-gradient-to-br from-brand-100 to-brand-200
                  ring-1 ring-white/70 shadow-[0_10px_25px_-12px_rgba(37,99,235,0.6)]
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
