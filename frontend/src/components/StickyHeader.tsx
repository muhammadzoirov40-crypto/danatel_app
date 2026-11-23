import BackButton from "./BackButton";

/**
 * 📌 Сари саҳифаи ҲАМЕШАГӢ (мобилӣ) — талаби соҳиб 23.11.2026:
 *   «in header [1] hama vaqt boshad [2]» = сафед-сари [← ном] бояд ДАР ҲАМА
 *   ВАҚТ бошад — ҳам ҳангоми скролл, ҳам дар болои саҳифа (на танҳо
 *   баъди скролл, чунон ки пешин буд).
 *
 *   · Танҳо мобилӣ (`md:hidden`) — дар десктоп Navbar + сатри саҳифаҳо
 *     (← + ном) ба ҷои ин сар кор мекунанд;
 *   · Ҳамеша нишон: scroll-триггер ва `aria-hidden` хориҷ шуд;
 *   · `heading` (пешфарз `true`) → сарлавҳаи `h1`-и саҳифа: дар мобилӣ
 *     сатри мазмунии ←+ном пинҳон аст → ягона h1-и намоён дар ҳамин ҷо
 *     мемонад (SEO/SR, mobile-first);
 *   · `heading={false}` → `p` барои саҳифаҳое, ки h1-и худро дар мазмун
 *     доранд (масалан /order/:id — дар корт «Фармоиш сохта шуд»);
 *   · Ҳамон BackButton-и умумӣ (aria-label + keyboard + focus-visible ✓);
 *   · Матн `truncate` — номи дароз дар 320px намебурад;
 *   · `bg`/`border` аз `.sticky-header` (ios.css): light = сафед,
 *     dark = торик — ҳарду режим ✓.
 */
export default function StickyHeader({
  title,
  heading = true,
}: {
  title: string;
  heading?: boolean;
}) {
  const Tag: "h1" | "p" = heading ? "h1" : "p";
  return (
    <div className="fixed inset-x-0 top-0 z-30 md:hidden">
      <div className="sticky-header border-b border-slate-200/80 bg-white/90 shadow-[0_6px_18px_-12px_rgba(15,23,42,0.45)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-3 sm:px-4">
          <BackButton iconOnly />
          <Tag className="min-w-0 truncate text-lg font-extrabold text-slate-900 dark:text-slate-100">
            {title}
          </Tag>
        </div>
      </div>
    </div>
  );
}
