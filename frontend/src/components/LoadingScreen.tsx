import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";

declare global {
  interface Window {
    /** Пешрафти index.html (0–90%) ҳангоми боргирии бандл */
    __bootPct?: number;
  }
}

const TICK = 40; // фосилаи қадам (ms)
const STEP = 8; // фоиз дар қадам
const TARGET = 90; // ҳадди симуляция — то ҷое ки воқеӣ мешавад
const HOLD = 300; // вақти истодан дар 100% пеш аз fade
const FADE = 300; // муддати fade-out
const ASSET_TIMEOUT = 10000; // ҳифз: агар `load` натавонад — баъд 10s

/**
 * Экрани боргирӣ: navy + D logo + progress bar + фоиз.
 * 0→90% симуляцияи зуд; 90→100% танҳо вақти auth check + assets воқеӣ
 * тайёр; баъди 100% → 300ms → fade-out → саҳифа нишон дода мешавад.
 */
export default function LoadingScreen({ onDone }: { onDone: () => void }) {
  const { t, authReady } = useApp();
  const [pct, setPct] = useState(() =>
    Math.min(TARGET, window.__bootPct ?? 0),
  );
  const [fading, setFading] = useState(false);
  const [assetsReady, setAssetsReady] = useState(
    () => document.readyState === "complete",
  );
  // ref → timer-ҳо аз нав барпо намешаванд ҳангоми навшавии render
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // 📦 Assets (бандл + тасвирҳо) — `load` ё `complete`
  useEffect(() => {
    if (assetsReady) return;
    const done = () => setAssetsReady(true);
    window.addEventListener("load", done, { once: true });
    const safety = window.setTimeout(done, ASSET_TIMEOUT);
    return () => {
      window.removeEventListener("load", done);
      window.clearTimeout(safety);
    };
  }, [assetsReady]);

  // 📈 Симуляция: зуд то 90% (як state — `pct`)
  useEffect(() => {
    const id = window.setInterval(() => {
      setPct((p) => (p < TARGET ? Math.min(TARGET, p + STEP) : p));
    }, TICK);
    return () => window.clearInterval(id);
  }, []);

  // ⏱️ Ҳифз: агар auth/assets дер кашанд, пас аз 15s маҷбуран 100%
  const [forceReady, setForceReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setForceReady(true), 15000);
    return () => window.clearTimeout(t);
  }, []);

  // ✅ Воқеӣ тайёр (auth + assets) ва симуляция ба 90% расид → 100%
  const ready = (authReady && assetsReady) || forceReady;
  useEffect(() => {
    if (!ready || pct < TARGET) return;
    setPct(100);
    const hold = window.setTimeout(() => setFading(true), HOLD);
    const hide = window.setTimeout(() => doneRef.current(), HOLD + FADE);
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(hide);
    };
  }, [ready, pct]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t("loading")}
      className={`fixed inset-0 z-[99998] flex flex-col items-center justify-center gap-3.5 bg-[#010A27] transition-opacity motion-reduce:transition-none ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE}ms` }}
    >
      <img
        src="/icons/donatshop-logo.png"
        alt="donatshop"
        className="h-24 w-24 object-contain"
      />
      <div
        className="h-1 w-44 overflow-hidden rounded-full"
        style={{ background: "rgba(120,180,255,0.18)" }}
        aria-hidden
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg,#1c6dff,#54c8ff)",
            transition: "width 0.2s ease",
          }}
        />
      </div>
      <div
        className="text-[12.5px] font-semibold tabular-nums"
        style={{ color: "#8fa3d9" }}
        aria-hidden
      >
        {pct}%
      </div>
      <p className="max-w-[250px] text-center text-[12.5px] font-semibold text-[#4a5578] dark:text-[#aab6d8]">
        {t("loading")}
      </p>
    </div>
  );
}
