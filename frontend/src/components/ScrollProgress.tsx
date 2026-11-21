import { useEffect, useState } from "react";

/** 🍎 iOS-услуби скролл индикатори — экран пастидаги юпқа чизиқ.
 *  Танҳо визуал: ҳеҷ API / state / route / маълумотга таъсир қилмайди. */
export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, window.scrollY / max));
      setProgress(p);
      setVisible(doc.scrollHeight > window.innerHeight + 24);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      className="ios-scroll-progress"
      role="presentation"
      aria-hidden
      data-progress={visible ? progress.toFixed(3) : "hidden"}
    >
      <span style={{ transform: `scaleX(${visible ? progress : 0})` }} />
    </div>
  );
}
