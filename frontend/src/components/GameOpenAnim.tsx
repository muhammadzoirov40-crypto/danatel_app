import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/**
 * 🎞️ 17.11.2026 (талаби соҳиб: «vaqte baziro intixob mekunad — hamon bozi
 *   kalon shavad to ekran nishon dihad chizhoro») — КУШОДАНИ БОЗӢ:
 *
 *   1️⃣ Линки БО ТАСВИР (корти бозӣ дар grid, баннер): тасвир/логотипи бозӣ
 *      ҷои худро мегирад ва КАЛОН мешавад → пурраи экранро мепӯшад (бо
 *      `translate + scale` то `max(vw/w, vh/h)`), саҳифаи ҳозира дар ҳамин
 *      вақт нопаидор мешавад (fade) → баъд саҳифаи бозӣ (бо логотипи hero)
 *      аз пушти клон пайдо мешавад ва клон фейд мешавад. Саҳифаи бозӣ аз
 *      БОЛО (scroll=0) кушода мешавад; scroll-и қаблӣ барои бозгашт нигоҳ
 *      дошта мешавад (нахуст `push`, баъд `scrollTo`).
 *   2️⃣ Линки БЕ ТАСВИР (SEO-блок, футер, чарх): фолбэк = ҳамон 17.11-иқаблӣ:
 *      саҳифаи ҳозира аз поён ба боло баромада меравад, бозӣ аз поён ворид
 *      мешавад (`translateY(-100%)` → `translateY(100vh → 0)`).
 *
 * 🛡️ Бехатарӣ / дастрасӣ:
 *   · клики такрорӣ ҳангоми анимация манъ аст (`opening`) → ду бор nav нест;
 *   · клики бо Ctrl/Shift/миёна/расти мош → ҳамон рафтори пешин (tabи нав);
 *   · ❤️ тугмаи дӯстдошта дар дохили корт → наздиктарини interactive аз линк
 *     ФАРҚ мекунад → бе анимация, ҳамон пешин (propagation идома дорад);
 *   · `prefers-reduced-motion`, бе WAAPI, расм норасида/пинҳон → оддӣ кушодан;
 *   · `#root` аллакай ҳаракати дигар дорад (масалан бозгашт) → оддӣ кушодан;
 *   · дар миён навигатсияи дигар шуд → анимация беҳаракат хотима мешавад;
 *   · клон: `position:fixed` + `pointer-events:none` + `aria-hidden=true`,
 *     `animation:none` (баннер ken-burns ғалат намекунад), 0 дархости нави
 *     сурат (clone аз ҳамон кэши браузер истифода мебарад);
 *   · `overflow-y` танҳо дар роҳи фолбэк (амудӣ) клип мешавад.
 */

/** Линки бозӣ: танҳо `/game/slug` (`/game`-и оддӣ → redirect, бе анимация). */
function isGameLink(a: HTMLAnchorElement): boolean {
  if (a.hasAttribute("download")) return false;
  const tgt = a.getAttribute("target");
  if (tgt && tgt !== "_self") return false;
  try {
    return new URL(a.href, window.location.href).pathname.startsWith("/game/");
  } catch {
    return false;
  }
}

/**
 * Манбаи калонкунӣ: аввалин `<img>`-и дохили линк (расм бояд аллакай
 * кушода шуда бошад). Агар расм дар дохили «қутти» (squircle-и логотип бо
 * 1 фарзанд) бошад → қуттӣ клон мешавад (gradient + ring + radius нигоҳ
 * дошта мешавад); вагарна худи расм. `null` → фолбэк баҳаракати амудӣ.
 */
function zoomSource(link: HTMLAnchorElement): HTMLElement | null {
  const img = link.querySelector("img");
  if (!img || !(img instanceof HTMLImageElement)) return null;
  if (!img.complete || img.naturalWidth === 0) return null;
  const r = img.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  const p = img.parentElement;
  if (p && p !== link && p.children.length === 1 && p.firstElementChild === img)
    return p;
  return img;
}

/** Интерактивҳои дар дохили линк (❤️ корт, контролҳои баннер...) → бе анимация. */
const INNER =
  'a[href], button, input, select, textarea, label, [role="button"], [role="link"]';

/** Ҳангоми кушодан клики дигар кор намекунад (ноклик такрорӣ → ду бор nav). */
let opening = false;

export default function GameOpenAnim() {
  const nav = useNavigate();
  const navRef = useRef(nav);
  navRef.current = nav;

  useEffect(() => {
    // Capture дар `window` → ПЕШ аз React/Link: `stopPropagation` → ҳеҷ
    // обработчик дигар кор намекунад → кушодан танҳо аз ҳамин анимация аст.
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const t = e.target as Element | null;
      if (!t || typeof t.closest !== "function") return;
      const link = t.closest<HTMLAnchorElement>('a[href^="/game"]');
      if (!link || !isGameLink(link)) return;
      // ❤️/контроли дохилӣ → ҳамон пешин (React-и он идома дорад)
      const inner = t.closest(INNER);
      if (inner && inner !== link) return;
      if (opening) {
        // Клики такрорӣ ҳангоми кушодан → манъ
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const el = document.getElementById("root");
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!el || typeof el.animate !== "function" || reduced) return; // оддӣ
      // #root аллакай ҳаракати дигар дорад (масалан бозгашт) → оддӣ кушодан
      try {
        if (el.getAnimations && el.getAnimations({ subtree: false }).length)
          return;
      } catch {
        /* бе options → танҳо хатои эҳтиётӣ, оддӣ идома */
      }
      e.preventDefault();
      e.stopPropagation(); // React/Link кор намекунад → танҳо анимация+nav
      opening = true;
      const startPath = window.location.pathname;
      let to = link.getAttribute("href") || "/";
      try {
        const u = new URL(link.href, window.location.href);
        to = u.pathname + u.search + u.hash;
      } catch {
        /* href аз худи линк омад → дуруст */
      }

      const src = zoomSource(link);

      if (src) {
        /* ——— 1️⃣ ТАСВИРИ БОЗӢ КАЛОН МЕШАВАД → ПУРРАИ ЭКРАН ——— */
        const rect = src.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const radius = getComputedStyle(src).borderTopLeftRadius || "0px";
        const clone = src.cloneNode(true) as HTMLElement;
        clone.setAttribute("data-gamezoom", "1");
        clone.setAttribute("aria-hidden", "true");
        clone.style.position = "fixed";
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.margin = "0";
        clone.style.zIndex = "9999";
        clone.style.pointerEvents = "none";
        clone.style.animation = "none"; // ken-burns-и баннер ба клон намегузарад
        clone.style.transformOrigin = "50% 50%";
        document.body.appendChild(clone);

        // Скалаи пӯшиши пурраи экран + ҳаракати маркази клон ба маркази экран
        const s = Math.max(vw / rect.width, vh / rect.height);
        const dx = vw / 2 - (rect.left + rect.width / 2);
        const dy = vh / 2 - (rect.top + rect.height / 2);
        const grow = clone.animate(
          [
            { transform: "translate(0px, 0px) scale(1)", borderRadius: radius },
            {
              transform: `translate(${dx}px, ${dy}px) scale(${s})`,
              borderRadius: "0px",
            },
          ],
          { duration: 260, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
        );
        // Саҳифаи ҳозира нопаидор мешавад (танҳо `#root`; клон дар body аст)
        const fade = el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 180,
          easing: "linear",
          fill: "forwards",
        });

        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          const moved = window.location.pathname !== startPath;
          if (moved) {
            // Дар миён навигатсияи дигар шуд → беҳаракат хотима
            grow.cancel();
            fade.cancel();
            clone.remove();
            opening = false;
            return;
          }
          navRef.current(to); // 1) push → scroll-и саҳифаи қаблӣ сабт мешавад
          window.scrollTo(0, 0); // 2) саҳифаи бозӣ АЗ БОЛО кушода мешавад
          fade.cancel(); // 3) #root → 1 (аллакай саҳифаи бозӣ дар DOM)
          let outStarted = false;
          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            if (clone.isConnected) clone.remove();
            opening = false;
          };
          const startOut = () => {
            if (outStarted) return;
            outStarted = true;
            const outFade = clone.animate(
              [{ opacity: 1 }, { opacity: 0 }],
              { duration: 160, easing: "cubic-bezier(0, 0, 0.2, 1)", fill: "forwards" },
            );
            outFade.onfinish = finish;
            window.setTimeout(finish, 1500); // эҳтиёт
          };
          // 2× rAF → render-и React пеш аз пайдошиш; эҳтиёт барои tabи ғайрифаъол
          requestAnimationFrame(() => requestAnimationFrame(startOut));
          window.setTimeout(startOut, 500); // эҳтиёт агар rAF накард
        };
        grow.onfinish = release;
        window.setTimeout(release, 700); // эҳтиёт агар onfinish нашуд
      } else {
        /* ——— 2️⃣ ФОЛБЭК (линк бе расм): АЗ ПОЁН БА БОЛО ——— */
        const docEl = document.documentElement;
        const prevOverflowY = docEl.style.overflowY;
        docEl.style.overflowY = "hidden"; // translateY(100vh) скролли нав несозад
        const out = el.animate(
          // Саҳифаи ҳозира аз поён ба БОЛО баромада меравад
          [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }],
          { duration: 220, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
        );
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          const moved = window.location.pathname !== startPath;
          out.cancel();
          if (moved) {
            docEl.style.overflowY = prevOverflowY;
            opening = false;
            return;
          }
          navRef.current(to); // 1) push → scroll-и саҳифаи қаблӣ сабт мешавад
          window.scrollTo(0, 0); // 2) саҳифаи бозӣ АЗ БОЛО кушода мешавад
          // 3) саҳифаи бозӣ аз ПОЁН (канни поёнии экран) ба БОЛО меояд
          const inAnim = el.animate(
            [{ transform: "translateY(100vh)" }, { transform: "translateY(0)" }],
            { duration: 240, easing: "cubic-bezier(0, 0, 0.2, 1)" },
          );
          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            docEl.style.overflowY = prevOverflowY;
            opening = false;
          };
          inAnim.onfinish = finish;
          window.setTimeout(finish, 1500); // эҳтиёт агар onfinish нашуд
        };
        out.onfinish = release;
        window.setTimeout(release, 600); // эҳтиёт агар out-ъ onfinish нашуд
      }
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
