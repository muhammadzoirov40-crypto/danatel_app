import { useEffect, useState } from "react";
import BackButton from "./BackButton";

/**
 * 📌 Сари саҳифаи часпак (стикки) барои мобилӣ — талаби соҳиб 11.11.2026:
 *   «vaqte ki inro ba поён scroll meunad in dar header chaspipida monad —
 *   inxel nom va iconkai nazad — dar hamash haminxel boshad» = вақте скролл
 *   мекунӣ, [← иконка] [номи саҳифа] дар боло часпидан мемонад (мисли
 *   скриншоти соҳиб аз саҳифаи «Профил»).
 *
 *   · Танҳо мобилӣ (`md:hidden`) — дар десктоп Navbar (sticky top-0) ҳамеша
 *     болост ва сари саҳифаҳо зери он ҷой мегирад;
 *   · Пас аз скролли >120px бо translate+opacity пайдо мешавад;
 *   · Ҳангоми пинҳон: `invisible` → аз tab-фармоиш ва screen-reader дур (a11y);
 *   · Ҳамон BackButton-и умумӣ (aria-label + keyboard + focus-visible ✓);
 *   · Матн — `p` (ҳамчун дубликати декоративии h1-и асосӣ; h1 дар саҳифа мемонад).
 */
export default function StickyHeader({ title }: { title: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Адаптивӣ: дар саҳифаҳои кӯтоҳ (макс. скролл <120px) оғоз барвақттар —
    // вагарна тугмаи ← ҳангоми скролл нопадид мешавад.
    const onScroll = () => {
      const max = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const th = Math.min(120, Math.round(max * 0.6));
      setShow(window.scrollY > th);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 top-0 z-40 md:hidden transition-all duration-200 ease-out ${
        show
          ? "translate-y-0 opacity-100 visible"
          : "-translate-y-full opacity-0 invisible"
      }`}
    >
      <div className="border-b border-slate-200/80 bg-white/90 shadow-[0_6px_18px_-12px_rgba(15,23,42,0.45)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-3 sm:px-4">
          <BackButton iconOnly />
          <p className="min-w-0 truncate text-lg font-extrabold text-slate-900">
            {title}
          </p>
        </div>
      </div>
    </div>
  );
}
