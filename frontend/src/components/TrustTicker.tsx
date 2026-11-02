import type { ReactNode } from "react";

/**
 * Тикери ҳаракаткунанда — мисли строчканяи takrixi persshop:
 *   [ бейҷаи рейтинг ] │ НОМИ харидорони отзивдор (★★★★★ Ном), ки ҳаракат мекунанд
 *
 * Танҳо тақризҳои воқеии тасдиқшудаи админ — номи шахсӣ аз `author_name`.
 * 0 тақриз → тарафи рост холӣ мемонад (ҷаълӣ НЕСТ).
 *
 * Дастрасӣ: `aria-hidden` танҳо рахи ҳаракаткунанда дорад,
 * бейҷаи рейтинг барои screen reader дастрас мемонад.
 */
interface Item {
  icon: ReactNode;
  text: string;
  /** Ранги иконка (масалан: ситораҳои тиллоӣ) */
  iconClass?: string;
}

export default function TrustTicker({
  items = [],
  badge,
}: {
  items?: Item[];
  /** Бейҷаи доимӣ дар тарафи чап (масалан: иконкаи Star + «4.9 (3 нафар)») */
  badge?: ReactNode;
}) {
  if (!items.length && !badge) return null;

  const doubled = [...items, ...items];

  return (
    <div
      className="mt-3 flex items-center gap-2.5 rounded-2xl bg-white/[0.16] backdrop-blur-sm
                 h-[42px] pl-3 pr-1 select-none"
    >
      {/* Бейҷаи доимӣ */}
      {badge && (
        <span className="shrink-0 flex items-center gap-1.5 rounded-full bg-white/20
                         px-3 py-1 text-[11px] sm:text-xs font-black tracking-wide
                         text-white whitespace-nowrap">
          {badge}
        </span>
      )}

      {/* Диагонал мисли persshop — танҳо байни бейҷа ва номи харидорон */}
      {badge && items.length > 0 && (
        <span className="h-[18px] w-px shrink-0 bg-white/35" aria-hidden />
      )}

      {/* Ҳаракаткунанда — танҳо агар матнҳо бошанд */}
      {items.length > 0 && (
        <div className="ticker flex-1 min-w-0" aria-hidden>
          <div className="ticker-track">
            {doubled.map((it, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-[12px] sm:text-[13px] font-semibold text-white/90"
              >
                <span className={it.iconClass || "text-white/75"}>{it.icon}</span>
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
