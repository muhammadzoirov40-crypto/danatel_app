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
 *   · 🎞️ 17.11.2026 (тағйири фикри соҳиб: «iconkai peshtararo mon oxir ba
 *     tarafi rost meraft ku»): ҳаракати АМУДИИ қаблӣ (поён → боло) БАРГАРДОНДА
 *     ШУД → ҳамон 16.11: саҳифаи ҳозира ба тарафи РОСТ мебарояд
 *     (`translateX(0 → 100%)`), баъд саҳифаи қаблӣ аз чап ворид мешавад
 *     (`translateX(-12% → 0)`; 0.18s + 0.14s). «Зер кардан → бозӣ аз поён ба
 *     боло» = КУШОДАНИ бозӣ → дар `GameOpenAnim` (амудӣ, он ҷо иҷро мешавад).
 *   · 🛡️ 17.11 (шикояти соҳиб: «bozbaydo meshava, 0.5 sikund meistad, nest
 *     meshava»): «даромадан» то ивази URL (traversal-и Chrome ~60-90ms) ва
 *     commit-и React сабр мекунад → саҳифаи кӯҳна боз ба чап бар намегардад;
 *     дар ин фосила #root дар ҷои рост мемонад (экран холӣ).
 *   · 🛡️ 17.11.2026 (талаби соҳиб: «бозгашт ҳамон пагеро нишон медиҳад» →
 *     17.11: «барои чӣ зер мекунем → боз ҳамон саҳифа, баъд нест мешавад»):
 *     мантиқи бозгашт аз рӯи Navigation API (`currentEntry.index` +
 *     URL-и entry-ҳои қаблӣ): (1) дар iframe (Responsive Viewer)
 *     `history.length` аз таърихи МУШТАРАК аст → зиёда аз 1 ҳато барои
 *     саҳифаи аввалин → `nav(-1)` ҳамон саҳифаро/таърихи бегона нишон
 *     медиҳад → iframe бо index=0 ҳамеша ба саҳифаи асосӣ; (2) entry-и
 *     такрорӣ (ҳамон path) → то саҳифаи ДИГАР мепарронад, агар ҳама қаблиҳо
 *     ҳамон path бошанд → ба саҳифаи асосӣ (`replace` → ба ҳамон саҳифа
 *     бар намегардад); (3) сатҳи болоӣ бо index=0 вале `history.length>1`
 *     (масалан `about:blank` API-ро сифр мекунад, қаблӣ — Telegram/мақолаи
 *     дигар) → ҳамон `nav(-1)`-и пешин. Фолбэк бе Navigation API → ҳамон
 *     мантиқи пешин (`idx` → `history.length`).
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
    const curPath = window.location.pathname;

    // 🧭 17.11.2026 (талаби соҳиб: «барои чӣ зер мекунем → боз ҳамон саҳифа,
    //    баъд нест мешавад»): Navigation API (Chrome 102+).
    //    · `currentEntry.index` = ҷойи воқеии ҳамин window; дар iframe
    //      (Responsive Viewer) `history.length` АЗ ТАЪРИХИ МУШТАРАК (joint)
    //      аст → зиёда аз 1 ҳато барои саҳифаи аввалин → мантиқи кӯҳна
    //      `length≤1` ғалат мешуд ва `nav(-1)` ҳамон саҳифаро ё таърихи
    //      бегона нишон медиҳад;
    //    · агар қаблӣ ҲАМОН path бошад (entry-и такрорӣ) → то саҳифаи ДИГАР
    //      мепарронад; агар ҳамаи қаблиҳо ҳамон path бошанд → ба саҳифаи
    //      асосӣ (replace → ба ҳамон саҳифа бар намегардад).
    type NavApi = {
      currentEntry?: { index?: number } | null;
      entries?: () => { url: string }[];
    };
    // Режимҳо:
    //  · 'skip' — API қаблиҳоро мебинад → то саҳифаи ДИГАР мепарронад
    //    (entry-и такрорӣ = ҳамон path нодида гирифта мешавад);
    //  · 'none' — API мегӯяд қаблӣ нест (index=0): дар iframe таърихи
    //    МУШТАРАК бегона аст (joint back → вайронӣ/ҳамон саҳифа) → саҳифаи
    //    асосӣ; дар сатҳи болоӣ (масалан `about:blank` сифр мекунад, вале
    //    қаблӣ — Telegram/мақолаи дигар ҳаст) → ҳамон `nav(-1)`-и пешин;
    //  · 'fb'   — бе Navigation API → ҳамон мантиқи пешин (idx → length).
    let mode: "skip" | "none" | "fb" = "fb";
    let steps = 1; // қадами бозгашт (0 → саҳифаи асосӣ)
    try {
      const api = (window as unknown as { navigation?: NavApi }).navigation;
      const curIdx = api?.currentEntry?.index;
      const entries = api?.entries?.();
      if (typeof curIdx === "number" && Array.isArray(entries)) {
        if (curIdx > 0) {
          mode = "skip";
          steps = 0;
          for (let i = curIdx - 1; i >= 0; i--) {
            let p = "";
            try {
              p = new URL(entries[i].url, window.location.href).pathname;
            } catch {
              p = "?";
            }
            if (p !== curPath) {
              steps = curIdx - i;
              break;
            }
          }
        } else {
          mode = "none";
        }
      }
    } catch {
      mode = "fb";
    }
    let needHome: boolean;
    if (mode === "skip") {
      // Ҳамаи қаблиҳо ҳамон path буданд (ё ҳеҷ кори дигар нест) → асосӣ.
      needHome = steps === 0 && curPath !== "/";
    } else if (mode === "none") {
      const isIframe = window.self !== window.top;
      needHome = curPath !== "/" && (isIframe || window.history.length <= 1);
    } else {
      // Фолбэк (браузер бе Navigation API): ҳамон мантиқи пешин.
      const canBack = typeof idx === "number" ? idx > 0 : window.history.length > 1;
      needHome = !canBack && window.history.length <= 1 && curPath !== "/";
      steps = needHome ? 0 : 1;
    }
    // `replace` → ба ҳамон саҳифаи асосӣ дубора барнамегардад.
    const doNav = () => {
      if (needHome) nav("/", { replace: true });
      else if (steps > 0) nav(-steps);
      else nav(-1); // дар '/' бе қаблӣ → ҳамон nav(-1)-и беҳаракат
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
      // 17.11 (тағйири фикри соҳиб): саҳифаи ҳозира ба тарафи РОСТ мебарояд
      [{ transform: "translateX(0)" }, { transform: "translateX(100%)" }],
      { duration: 180, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
    );
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      doNav(); // таърих иваз мешавад (nav(-steps) = traversal-и АСИНХРОН!)
      // 🛡️ 17.11 (шикояти соҳиб: «ba tarafi rost meravad, bozbaydo meshava,
      //    0.5 sikund meistad, nest meshava»): `history.go(-n)` дар Chrome
      //    тақрибан 60-90ms ДАРЪАТ мешавад → дар ин фосила МУНДАРИҶА ҲАНОЗ
      //    САҲИФАИ КӯҲНА аст. Агар ҳамон лаҳза «даромадан» оғоз шавад →
      //    саҳифаи кӯҳна АЗ ЧАП БАРМЕГАРДАД («bozbaydo»), баъд дар охир ба
      //    саҳифаи нав мабадал мешавад → ҳамин шикояти соҳиб. Ислоҳ: сабр то
      //    ивази URL + 2 rAF (React аз popstate ҷорӣ шудааст) → баъд «даромадан».
      //    Дар ин муддат #root дар ҷои рост (пӯшида) мемонад → экрани холӣ →
      //    саҳифаи нав аз чап ТОЗА ворид мешавад. Мӯҳлатҳо: 0.18s + 0.14s.
      let started = false;
      const startIn = () => {
        if (started) return;
        started = true;
        out.cancel(); // ҳаракати баромадан хотима → ҷои худ
        // Саҳифаи қаблӣ аз ЧАП ворид мешавад (баръакси баромадан — ҳамон 16.11):
        el.animate(
          [{ transform: "translateX(-12%)" }, { transform: "translateX(0)" }],
          { duration: 140, easing: "cubic-bezier(0, 0, 0.2, 1)" },
        );
        docEl.style.overflowX = prevOverflow;
        el.style.overflowX = prevRootOverflow;
        animating = false;
      };
      const t0 = performance.now();
      const poll = () => {
        if (started) return;
        if (window.location.pathname !== curPath) {
          // URL иваз шуд → +2 rAF = React аз popstate ҷорӣ шуд (commit пеш аз расм)
          requestAnimationFrame(() => requestAnimationFrame(startIn));
        } else if (performance.now() - t0 > 300) {
          startIn(); // эҳтиёт: traversal-ро надидем → ҳамон роҳи кӯҳна
        } else {
          requestAnimationFrame(poll);
        }
      };
      requestAnimationFrame(poll);
    };
    out.onfinish = release;
    // Эҳтиёт: агар `onfinish` нашуд → пас аз 500ms ҳатман озод мешавад
    window.setTimeout(release, 500);
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
