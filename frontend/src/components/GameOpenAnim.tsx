import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/**
 * 🎞️ 17.11.2026 (талаби соҳиб: «ҳангоми зер кардан ҳамин бозиро аз поён
 *   ба боло нишон медиҳад») — КУШОДАНИ БОЗӢ = ҳаракати АМУДӢ:
 *   · саҳифаи ҳозира `translateY(0 → -100%)` (аз поён ба боло баромада меравад);
 *   · баъд саҳифаи бозӣ аз поён `translateY(100vh → 0)` БА БОЛО меояд —
 *     аввалин чизе, ки дида мешавад, сарлавҳа/логои бозӣ аз канни поён аст;
 *   · танҳо линкҳои `/game/…` (корти бозӣ, баннер, SEO, футер, чарх) →
 *     ҳамаи «кушодани бозӣ» дар тамоми барнома якхела ҳаракат мекунанд;
 *   · ҳангоми кушодан саҳифаи бозӣ АЗ БОЛО (scroll=0) кушода мешавад;
 *     scroll-и саҳифаи қаблӣ барои бозгашт нигоҳ дошта мешавад
 *     (нахуст `push`, баъд `scrollTo` → entry-и қаблӣ ҷои худро дорад).
 *
 * 🛡️ Бехатарӣ / дастрасӣ:
 *   · клики такрорӣ ҳангоми анимация манъ аст (`opening`); ду бор nav нест;
 *   · клики бо Ctrl/Shift/миёна/расти мош → ҳамон рафтори пешин (tabи нав);
 *   · ❤️ тугмаи дӯстдошта дар дохили корт → наздиктарини interactive аз линк
 *     ФАРҚ мекунад → бе анимация, ҳамон пешин (propagation идома дорад);
 *   · `prefers-reduced-motion` ё бе WAAPI → кушодани оддӣ (беҳаракат);
 *   · `#root` аллакай ҳаракати дигар дорад (масалан бозгашт) → оддӣ кушодан;
 *   · дар миён навигатсияи дигар шуд → анимация беҳаракат хотима мешавад;
 *   · `overflow-y` ҳангоми ҳаракат клип мешавад → скролли нав пайдо намешавад;
 *   · клики сеюм ҳангоми анимация → `stopPropagation` → ҳеҷ навигатсия;
 *   · таҳвили ҳаракат танҳо дар `#root` → порталҳо (модалка/тост) ҷойи худро
 *     нигоҳ медоранд; беурматӣ ба `prefers-reduced-motion` риоя мешавад.
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
        // Дар миён навигатсияи дигар шуд (масалан менюи Navbar) → беҳаракат
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
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
