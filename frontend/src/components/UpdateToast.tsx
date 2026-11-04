import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";

/**
 * 🔄 Авто-навсозии сайт (талаби соҳиб: «...худаш обновит кардан гирад»).
 *
 * Ҳар 60 сония + ҳангоми бозгашти таб (visibilitychange) + фокус:
 * `/index.html` бе кэш гирифта мешавад → хати JS (`index-*.js`) бо хати
 * боршуда муқоиса мешавад. Агар фарқ кунад → версияи нав мавҷуд аст:
 *   1) тост (`role="status"`) бо тугмаи «Ҳозир нав кунед»;
 *   2) баъди 2.5 сония ХУДАШ reload — агар бехатар бошад:
 *      модалка кушода не, саҳифаи пардохт (`/order/…`) не, менюи фаъол
 *      не, таб пинҳон не;
 *   3) агар нобехатар → ҳар 4 сония такроран санҷида, ҳамонҳо кушода
 *      шуд → reload; то он вақт тост бо тугма мемонад.
 * Reload дар мобилӣ бехатар аст: SPA аз сар кушода, маълумот дар backend.
 */
const POLL_MS = 60_000;
const RETRY_MS = 4_000;
const DELAY_MS = 2_500;

/** Номи файли JS-и асосӣ аз HTML (масалан `index-C9MDDFs-.js`). */
function pickJsAsset(html: string): string | null {
  const m = html.match(/assets\/(index-[^"'?]+\.js)/);
  return m ? m[1] : null;
}

export default function UpdateToast() {
  const { t } = useApp();
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const bootRef = useRef<string | null>(null);
  const detectedRef = useRef(false);
  const reloadingRef = useRef(false);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    const el = document.querySelector<HTMLScriptElement>(
      'script[type="module"][src*="/assets/index-"]',
    );
    bootRef.current = el ? pickJsAsset(el.src) : null;
    if (!bootRef.current) return; // таҳлил имкон надорад — хомӯш мемонем

    /**
     * Модалкаи воқеан кушода? — SidebarMenu ҳамеша `role="dialog"` дорад
     * (баста = `-translate-x-full`, аз viewport берун) → танҳо онҳое ҳисоб
     * мешаванд, ки дар экран намоёнанд (намоёнии барқароршавиро бозмедоранд).
     */
    const anyDialogOpen = (): boolean => {
      const ds = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      for (const el of Array.from(ds)) {
        if (el.getAttribute("aria-hidden") === "true") continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth)
          continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
        return true;
      }
      return false;
    };

    /** Агар reload дар ҳоли ҳозир хатарнок бошад → false. */
    const safe = (): boolean => {
      if (document.visibilityState === "hidden") return false;
      if (anyDialogOpen()) return false;
      if (/^\/order\//.test(pathRef.current)) return false;
      const ae = document.activeElement as HTMLElement | null;
      if (
        ae &&
        (ae.tagName === "INPUT" ||
          ae.tagName === "TEXTAREA" ||
          ae.tagName === "SELECT" ||
          ae.isContentEditable)
      )
        return false;
      // менюи пуршуда — reload матнро гум мекунад
      const fields = document.querySelectorAll<HTMLInputElement>(
        "input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea",
      );
      for (const f of fields) if (f.value) return false;
      return true;
    };

    const tryReload = () => {
      if (reloadingRef.current || !detectedRef.current) return;
      if (!safe()) return;
      reloadingRef.current = true;
      window.location.reload();
    };

    let retryTimer: number | undefined;

    const check = async () => {
      if (detectedRef.current || reloadingRef.current) return;
      try {
        const res = await fetch(`/index.html?_nv=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const remote = pickJsAsset(await res.text());
        if (remote && bootRef.current && remote !== bootRef.current) {
          detectedRef.current = true;
          setReady(true);
          window.setTimeout(tryReload, DELAY_MS);
          retryTimer = window.setInterval(tryReload, RETRY_MS);
        }
      } catch {
        /* офлайн / шабака — беҳуда */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const poll = window.setInterval(() => void check(), POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    void check(); // санҷиши аввал ҳангоми боршавӣ

    return () => {
      window.clearInterval(poll);
      if (retryTimer) window.clearInterval(retryTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);

  if (!ready) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-24 z-[55] mx-auto flex max-w-md items-center gap-2.5 rounded-2xl border border-blue-200 bg-white/95 p-2.5 pl-3 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.4)] backdrop-blur md:bottom-6"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-[0_8px_18px_-8px_rgba(37,99,235,0.75)]">
        <RefreshCw
          size={17}
          strokeWidth={2.5}
          aria-hidden
          className="animate-spin motion-reduce:animate-none"
        />
      </span>
      <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug text-slate-800">
        {t("updateAvailable")}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 px-3 py-2 text-[12px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(37,99,235,0.8)] transition hover:from-blue-600 hover:to-indigo-700 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        {t("updateNow")}
      </button>
    </div>
  );
}
