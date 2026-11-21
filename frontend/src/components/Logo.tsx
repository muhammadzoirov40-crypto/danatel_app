import { useRef, type MouseEvent } from "react";
import { useApp } from "../context/AppContext";

/**
 * 💎 ЛОГОТИПИ donatshop — шаффоф PNG (`/donatshop-D-logo.png`, соҳиб 21.11.2026).
 *
 * Олдинги кўп-фacetли SVG ўрнига соҳибнинг тайёр логотипи ишлатилади.
 * Фақат визуал қават: API / state / route / матн ўзгармайди.
 * variant="onDark" (кўк навбар) учун расм NGO «ях» кўринишда фильтрланади.
 */
export default function Logo({
  size = 34,
  withText = false,
  textClass = "",
  variant = "onLight",
  animate = false,
}: {
  /** Баландии нишон дар px */
  size?: number;
  /** Номи сайт дар тараф (барои header / футер) */
  withText?: boolean;
  /** Классҳои иловагӣ барои матн */
  textClass?: string;
  variant?: "onLight" | "onDark";
  /** 💎 Аниматсияи «шинои кристалл» */
  animate?: boolean;
}) {
  const { t } = useApp();
  const ref = useRef<HTMLSpanElement>(null);

  /** Курсорга қараб 3D мойиллик (CSS variables) — фақат визуал */
  const tilt = (e: MouseEvent<HTMLSpanElement>) => {
    if (!ref.current) return;
    const b = ref.current.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width - 0.5;
    const y = (e.clientY - b.top) / b.height - 0.5;
    ref.current.style.setProperty("--rx", `${(-y * 12).toFixed(1)}deg`);
    ref.current.style.setProperty("--ry", `${(x * 12).toFixed(1)}deg`);
  };
  const untilt = () => {
    if (!ref.current) return;
    ref.current.style.setProperty("--rx", "0deg");
    ref.current.style.setProperty("--ry", "0deg");
  };

  return (
    <span className="flex items-center gap-2 shrink-0">
      <span
        ref={ref}
        className={`logo ${animate ? "logo-float" : ""} ${
          variant === "onDark" ? "logo-ice" : ""
        }`}
        style={{ width: size, height: size }}
        onMouseMove={tilt}
        onMouseLeave={untilt}
      >
        <img src="/donatshop-D-logo.png" alt="donatshop" width={size} height={size} />
      </span>

      {withText && (
        <span
          className={`font-bold tracking-tight leading-none whitespace-nowrap ${textClass}`}
        >
          {t("brand")}
        </span>
      )}
    </span>
  );
}
