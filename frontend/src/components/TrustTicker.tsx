import { useApp } from "../context/AppContext";

/**
 * 🎚️ Тикери ҳаракаткунанда — мисли строчканяи отзывҳои persshop,
 * бо **далелҳои воқеӣ** (рейтинг, шумораи бозиҳо/маҳсулотҳо).
 */
interface Item {
  icon: string;
  text: string;
}

export default function TrustTicker({ items }: { items: Item[] }) {
  if (!items.length) return null;

  const doubled = [...items, ...items];

  return (
    <div className="ticker select-none" aria-hidden>
      <div className="ticker-track">
        {doubled.map((it, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white/90"
          >
            <span className="text-white/70">{it.icon}</span>
            {it.text}
            <span className="text-white/30 ml-1.5">•</span>
          </span>
        ))}
      </div>
    </div>
  );
}