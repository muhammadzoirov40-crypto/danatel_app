import { useApp } from "../context/AppContext";

/**
 * ⭐️ Сатри отзывҳо (мисли persshop.com):
 *   Дар чап: Рейтинг ★ 4,9 ва шумораи отзывҳо бо ҷудокунанда |
 *   Дар рост: Сатри равони номи муштариён бо 5 ситора ★★★★★
 */
const REVIEWS = [
  { name: "AZAM" },
  { name: "Panelbezban" },
  { name: "G|X" },
  { name: "Хисрав" },
  { name: "Shahrom" },
  { name: "Умар" },
  { name: "Наби" },
  { name: "Крис" },
  { name: "Муҳаммад" },
  { name: "Далер" },
  { name: "Ҷамшед" },
  { name: "Рустам" },
  { name: "Фирӯз" },
  { name: "Сӯҳроб" },
  { name: "Беҳрӯз" },
  { name: "Самир" },
  { name: "Алишер" },
  { name: "Фарҳод" },
];

export default function TrustTicker() {
  const { lang } = useApp();
  const doubled = [...REVIEWS, ...REVIEWS];

  const reviewWord =
    lang === "tj"
      ? "отзывов"
      : lang === "ru"
        ? "отзывов"
        : lang === "uz"
          ? "taqrizlar"
          : "reviews";

  return (
    <div
      className="mt-3.5 flex items-center rounded-2xl bg-white/12 backdrop-blur-md
                 ring-1 ring-white/20 px-3.5 py-2.5 sm:py-3 text-xs sm:text-sm select-none overflow-hidden"
      aria-hidden
    >
      {/* ⭐️ Рейтинг ва шумораи отзывҳо (дар чап устувор меистад) */}
      <div className="flex items-center gap-1.5 shrink-0 pr-3.5 sm:pr-4 border-r border-white/25 font-bold text-white">
        <span className="text-amber-300 text-sm sm:text-base leading-none">★</span>
        <span className="text-white font-black text-sm sm:text-base leading-none">4,9</span>
        <span className="text-white/85 font-medium text-xs sm:text-sm">
          995 {reviewWord}
        </span>
      </div>

      {/* 📜 Сатри равони отзывҳо (ҳаракати худкор) */}
      <div className="ticker flex-1 ml-3 sm:ml-4 overflow-hidden">
        <div className="ticker-track">
          {doubled.map((r, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white tracking-wide"
            >
              <span>{r.name}</span>
              <span className="text-amber-300 tracking-wider text-xs">★★★★★</span>
              <span className="text-white/20 ml-2.5 sm:ml-3">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
