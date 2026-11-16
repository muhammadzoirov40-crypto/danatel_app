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
 *   · 🛡️ 17.11.2026 (талаби соҳиб: «бозгашт ҳамон пагеро нишон медиҳад,
 *     page дигариро [намедиҳад]»): агар дар таърих УМУМАН қаблӣ набошад
 *     (`history.length≤1` — саҳифаи аввалин entry: мустақим кушодан/PWA/апп),
 *     он вақт `nav(-1)` ҳеҷ чиро намекунад → ҳамон саҳифа мемонад. Ҳоло:
 *     бо ҳамон анимация ба саҳифаи АСОСӢ меравад (`replace` → ба ҳамон
 *     саҳифа дубора барнамегардад). Агар қаблӣ бошад (масалан аз Telegram)
 *     → ҳамон `nav(-1)`-и пешин.
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
    // Таърих: React Router `idx`-ро дар history.state нигоҳ медорад.
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    // Қаблӣ дар SPA: idx>0 → ҳа; idx=0/намаълум → аз рӯи history.length.
    const canBack = typeof idx === "number" ? idx > 0 : window.history.length > 1;
    // 🛡️ 17.11.2026 (талаби соҳиб): агар УМУМАН қаблӣ набошад (`length≤1`),
    // `nav(-1)` ҳеҷ чиро намекунад → ҲАМОН САҲИФА мемонад. Ҳоло: ба
    // саҳифаи АСОСӢ меравад (бо ҳамон анимация; `replace` → ба ҳамон
    // саҳифа дубора барнамегардад). Агар қаблӣ вуҷуд дошта бошад
    // (масалан аз Telegram) → ҳамон `nav(-1)`-и пешин.
    const needHome =
      !canBack &&
      window.history.length <= 1 &&
      window.location.pathname !== "/";
    const doNav = () => {
      if (needHome) nav("/", { replace: true });
      else nav(-1);
    };
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Бе анимация: reduced-motion / element нест / idx=0 бо қаблӣ (ҳамон пешин)
    const skipAnim =
      !el ||
      typeof el.animate !== "function" ||
      reduced ||
      (typeof idx === "number" && idx === 0 && !needHome);
    if (skipAnim) {
      doNav();
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
      doNav(); // саҳифаи қаблӣ ё саҳифаи асосӣ (мундариҷа иваз мешавад)
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
