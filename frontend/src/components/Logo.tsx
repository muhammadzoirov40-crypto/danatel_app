import { useId } from "react";
import { useApp } from "../context/AppContext";

/**
 * 💎 ЛОГОТИПИ danatel.tj — «D»-и шишагӣ (glassmorphism) + тоҷ + ҳалқа.
 * SVG-и дастнавис, бе raster. Ранги тоҷ аз мавзӯ вобаста аст.
 */
const D_PATH =
  "M14 18 H94 L126 30 L148 50 L170 38 L166 72 L188 86 L166 112 L180 136 " +
  "L152 158 L122 176 L94 182 L14 182 Z " +
  "M50 56 H96 L116 76 L124 100 L116 124 L96 144 L50 144 Z";

export default function Logo({
  size = 34,
  withText = false,
  textClass = "",
  glow = false,
}: {
  /** Баландии нишон дар px */
  size?: number;
  /** Номи сайт дар тараф (барои header / футер) */
  withText?: boolean;
  /** Классҳои иловагӣ барои матн */
  textClass?: string;
  /** Соҳаи нури бунафш (барои auth screen) */
  glow?: boolean;
}) {
  const { t, theme } = useApp();
  const crownColor = theme === "dark" ? "#ffc247" : "#e59a00";
  const uid = useId().replace(/[:]/g, "");
  const gRing = `ringStroke${uid}`;
  const gRingFill = `ringFill${uid}`;
  const gDFill = `dFill${uid}`;
  const gDOutline = `dOutline${uid}`;

  return (
    <span
      className="inline-flex items-center gap-2 shrink-0"
      style={glow ? { filter: "drop-shadow(0 8px 24px rgba(139,92,246,0.5))" } : undefined}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        role="img"
        aria-label="donatshop"
        className="shrink-0"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gRing} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="0.5" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#ff8a2b" />
          </linearGradient>
          <linearGradient id={gRingFill} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b82f6" stopOpacity="0.06" />
            <stop offset="0.5" stopColor="#8b5cf6" stopOpacity="0.12" />
            <stop offset="1" stopColor="#ff8a2b" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id={gDFill} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#9db8ff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#7c3aed" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id={gDOutline} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="0.5" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#ff8a2b" />
          </linearGradient>
        </defs>

        {/* Ҳалқа */}
        <circle
          cx="100"
          cy="100"
          r="88"
          fill={`url(#${gRingFill})`}
          stroke={`url(#${gRing})`}
          strokeWidth="3"
        />

        {/* Ҳарфи D (шишагӣ) */}
        <g transform="translate(24,35) scale(0.75)">
          <path
            d={D_PATH}
            fillRule="evenodd"
            fill={`url(#${gDFill})`}
            stroke={`url(#${gDOutline})`}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Нури сафед дар боло-чап (glassmorphism) */}
          <path
            d="M30 30 Q 44 18 72 22"
            fill="none"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <ellipse
            cx="52"
            cy="26"
            rx="14"
            ry="6"
            fill="rgba(255,255,255,0.28)"
            transform="rotate(-12 52 26)"
          />
        </g>

        {/* Тоҷ (3 қулла) */}
        <g transform="translate(65, 8)">
          <rect
            x="0"
            y="40"
            width="70"
            height="8"
            rx="2"
            fill={crownColor}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1"
          />
          <polygon
            points="0,40 20,40 10,12"
            fill={crownColor}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <polygon
            points="20,40 50,40 35,4"
            fill={crownColor}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <polygon
            points="50,40 70,40 60,16"
            fill={crownColor}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      {withText && (
        <span
          className={`font-black tracking-tight leading-none whitespace-nowrap ${textClass}`}
        >
          {t("brand")}
        </span>
      )}
    </span>
  );
}