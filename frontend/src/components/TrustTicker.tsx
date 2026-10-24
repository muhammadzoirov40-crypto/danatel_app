/**
 * 🎚️ Тикери ҳаракаткунанда — мисли строчканяи takrixi persshop:
 *   [ ⭐ бейҷа ] │ далелҳои воқеӣ, ки ҳаракат мекунанд
 *
 * ⚠️ Танҳо далелҳои воқеӣ (бозӣ, маҳсулот, TJS, DC Wallet) —
 *    такризи ҷаълӣ ё рейтинги сохта НЕСТ.
 */
interface Item {
  icon: string;
  text: string;
}

export default function TrustTicker({
  items = [],
  badge,
}: {
  items?: Item[];
  /** Бейҷаи доимӣ дар тарафи чап (масалан: «⭐ 4.9 (3 нафар)») */
  badge?: string;
}) {
  if (!items.length && !badge) return null;

  const doubled = [...items, ...items];

  return (
    <div
      aria-hidden
      className="mt-3 flex items-center gap-2.5 rounded-2xl bg-white/[0.16] backdrop-blur-sm
                 h-[42px] pl-3 pr-1 select-none"
    >
      {/* ⭐ Бейҷаи доимӣ */}
      {badge && (
        <span
          className="shrink-0 flex items-center gap-1 rounded-full bg-white/20
                     px-3 py-1 text-[11px] sm:text-xs font-black tracking-wide
                     text-white whitespace-nowrap"
        >
          {badge}
        </span>
      )}

      {/* 🎚️ Ҳаракаткунанда — танҳо агар матнҳо бошанд */}
      {items.length > 0 && (
        <div className="ticker flex-1 min-w-0">
          <div className="ticker-track">
            {doubled.map((it, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-[12px] sm:text-[13px] font-semibold text-white/90"
              >
                <span className="text-white/75">{it.icon}</span>
                {it.text}
                <span className="text-white/30 ml-1.5">•</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
