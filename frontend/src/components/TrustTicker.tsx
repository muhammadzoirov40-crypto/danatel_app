/**
 * 🎚️ Тикери ҳаракаткунанда — мисли строчканяи отзывҳои persshop,
 * аммо бо **далелҳои воқеӣ** (мо отзывҳои ҷаълӣ намесозем).
 *
 * `items` = [{ icon, text }]
 */
interface Item {
  icon: string;
  text: string;
}

export default function TrustTicker({ items }: { items: Item[] }) {
  if (!items.length) return null;

  // Роҳхатро дупла мекунем, то ҳаракат бефосила бошад (-50%)
  const doubled = [...items, ...items];

  return (
    <div className="ticker mt-3 select-none" aria-hidden>
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
