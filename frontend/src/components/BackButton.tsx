import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { Ic } from "./Icons";

/**
 * ⬅️ Тугмаи «Бозгашт» — ягона барои ҳамаи саҳифаҳо.
 *
 *   · Услуби шишаин (glass): `bg-slate-900/60` + `backdrop-blur-md` +
 *     `border-white/25` — мисли тугмаи бозгашти саҳифаи бозӣ (GameDetail);
 *   · Бармегардад ба саҳифаи қаблӣ дар таърих (`nav(-1)`);
 *   · 🎞️ 16.11.2026 (талаби соҳиб): ҳангоми бозгашт САҲИФА БА ТАРАФИ РОСТ
 *     мебарояд (баромадан дида мешавад) → баъд саҳифаи қаблӣ аз чап ворид
 *     мешавад (анимация 0.22s + 0.17s). Танҳо `#root` (тамоми экран: Navbar +
 *     main + BottomNav) ҳаракат мекунад; порталҳо (модалка/тост) ҷойи худро
 *     нигоҳ медоранд. `overflow-x` дар `#root` ҳангоми ҳаракат клип мешавад →
 *     SidebarMenu-и пинҳон (дар чапи экран) ҳамроҳ накашида шавад (ислоҳи
 *     16.11.2026: дар скриншоти соҳиб «менюи кушода» пайдо шуда буд). Беҳурматӣ ба `prefers-reduced-motion` → бе анимация;
 *     дар саҳифаи аввалии таърих (idx=0) → ҳамон рафтори пешин (бе ҳаракат);
 *     клики такрорӣ ҳангоми анимация манъ аст.
 *   · `aria-label` + матни «Бозгашт» (тарҷума: tj/ru/us/uz);
 *   · Калиди keyboard + `focus-visible` ring барои дастрастӣ (a11y).
 */

/** Ҳангоми анимация клики дигар кор намекунад (ноклик такрорӣ → ду бор nav). */
let animating = false;

export default function BackButton({
  className = "",
  iconOnly = false,
}: {
  className?: string;
  /** Танҳо иконкаи ← (бе матн) — `aria-label` нигоҳ дошта мешавад (талаби соҳиб). */
  iconOnly?: boolean;
}) {
  const nav = useNavigate();
  const { t } = useApp();

  const goBack = () => {
    if (animating) return;
    const el = document.getElementById("root");
    // Таърих: React Router `idx`-ро дар history.state нигоҳ медорад —
    // агар саҳифа аввалин бошад (idx=0) → бозгашт нест → бе анимация (ҳамон пешин).
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    const canBack = typeof idx === "number" ? idx > 0 : true;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || typeof el.animate !== "function" || !canBack || reduced) {
      nav(-1);
      return;
    }
    animating = true;
    const docEl = document.documentElement;
    const prevOverflow = docEl.style.overflowX;
    const prevRootOverflow = el.style.overflowX;
    docEl.style.overflowX = "hidden"; // таҳвили 100% скролли уфуқӣ намесозад
    // SidebarMenu-и пинҳон дар чапи экран (x<0) ҳангоми ҳаракати 100%
    // ба мобайн кашида мешуд → ҳамчун «менюи кушода» пайдо мешуд → клип:
    el.style.overflowX = "hidden";
    const out = el.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(100%)" }],
      { duration: 220, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
    );
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      nav(-1); // саҳифаи қаблӣ (мундариҷа иваз мешавад)
      out.cancel(); // ҳаракати баромадан хотима → ҷои худ
      // Саҳифаи қаблӣ аз чап (parallax-и iOS) ворид мешавад:
      el.animate(
        [{ transform: "translateX(-12%)" }, { transform: "translateX(0)" }],
        { duration: 170, easing: "cubic-bezier(0, 0, 0.2, 1)" },
      );
      docEl.style.overflowX = prevOverflow;
      el.style.overflowX = prevRootOverflow;
      animating = false;
    };
    out.onfinish = release;
    // Эҳтиёт: агар `onfinish` нашуд → пас аз 600ms ҳатман озод мешавад
    window.setTimeout(release, 600);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={t("back")}
      className={`mb-1 w-fit justify-self-start inline-flex items-center gap-1
                  rounded-full bg-slate-900/60 hover:bg-slate-900/75 border border-white/25
                  text-white text-xs sm:text-sm font-semibold px-3 py-1.5 backdrop-blur-md
                  transition active:scale-95 focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-white/70 ${className}`}
    >
      <Ic icon={ArrowLeft} size="xs" />
      {!iconOnly && t("back")}
    </button>
  );
}
