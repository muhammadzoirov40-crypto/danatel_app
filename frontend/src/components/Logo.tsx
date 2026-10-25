import { useId } from "react";
import { useApp } from "../context/AppContext";

/**
 * 💎 ЛОГОТИПИ danatel.tj — ҳарфи «D» мисли ГАВҲАРАКИ КАБУДИ БУРИДА
 *
 * Тибқи дастури лоиҳа:
 *   • ҳарфи «D» бо буришҳои геометрӣ (facet) ва дурахши барқӣ;
 *   • тарафи рости «D» ба ТИРҲОИ БОЛОИ КРИСТАЛӢ мегузарад;
 *   • дар зери нишон номи «danatel.tj» бо ҳарфҳои ғафс (HTML-матн,
 *     на SVG-матн → дар ҳама забонҳо дуруст ва бо font-и сайт).
 *
 * Ҳама чиз SVG-и дастнавис аст → дар 16px ҳам фаҳмо, бе тасвири номуносиб.
 * IDҳо бо `useId` → дар як саҳифа чанд маротиба истифода бурдан бехатар.
 *
 * variant:
 *   onLight — «D»-и кабуди чуқур + тирҳои кабуд (сафед, футер, favicon)
 *   onDark  — «D»-и сафеди кристалӣ (навбари кабуди сайт)
 */
export default function Logo({
  size = 34,
  withText = false,
  textClass = "",
  variant = "onLight",
}: {
  /** Баландии нишон дар px */
  size?: number;
  /** Номи сайт дар тараф (барои header / футер) */
  withText?: boolean;
  /** Классҳои иловагӣ барои матн */
  textClass?: string;
  variant?: "onLight" | "onDark";
}) {
  const uid = useId().replace(/[:]/g, "");
  const gBase = `dBase${uid}`;
  const gArrow = `dArrow${uid}`;
  const clip = `dClip${uid}`;
  const onDark = variant === "onDark";
  const { t } = useApp();

  /* ===== Рангҳо ===== */
  const base1 = onDark ? "#ffffff" : "#0b3fd8"; // поёнии гавҳарак
  const base2 = onDark ? "#cfe6ff" : "#4f9bff"; // болоии гавҳарак
  const edge = onDark ? "#1546dd" : "#ffffff"; // контури дурахшон
  const edgeOp = onDark ? 0.4 : 0.5;
  const arrow1 = onDark ? "#ffffff" : "#7db4ff";
  const arrow2 = onDark ? "#bcd9ff" : "#1546dd";
  const facet = onDark ? "#1546dd" : "#0a2a8f"; // сояи поёнӣ
  const facetOp = onDark ? 0.32 : 0.32;
  const gloss = onDark ? 0.55 : 0.34; // дурахши болоӣ

  /* ===== Шаклҳо ===== */
  const D_OUTER = "M4 6 H30 L44 21 V43 L30 58 H4 Z";
  const D_HOLE = "M16 18 H29 L34 25 V39 L29 46 H16 Z";
  const D_FULL = `${D_OUTER} ${D_HOLE}`;
  // Тирҳои боло (дурахши росткунҷа → нӯгти тез)
  const A1 = "M39 58 H51 L45 34 Z";
  const A2 = "M53 58 H69 L61 6 Z";

  /** Андозаи SVG: 72×64 → паҳноӣ аз рӯи баландӣ ҳисоб мешавад */
  const w = Math.round((size * 72) / 64);

  return (
    <span className="flex items-center gap-2 shrink-0">
      <svg
        width={w}
        height={size}
        viewBox="0 0 72 64"
        role="img"
        aria-label="danatel.tj"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gBase} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={base2} />
            <stop offset="0.55" stopColor={onDark ? "#eaf3ff" : "#2f7cf6"} />
            <stop offset="1" stopColor={base1} />
          </linearGradient>
          <linearGradient id={gArrow} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={arrow1} />
            <stop offset="1" stopColor={arrow2} />
          </linearGradient>
          <clipPath id={clip}>
            <path d={D_FULL} fillRule="evenodd" />
          </clipPath>
        </defs>

        {/* ===== Ҳарфи «D» — як гавҳарак, бо буришҳои кристаллӣ ===== */}
        <path d={D_FULL} fillRule="evenodd" fill={`url(#${gBase})`} />
        <g clipPath={`url(#${clip})`}>
          {/* буриши болоӣ — дурахшон */}
          <path d="M4 6 H44 V22 L4 40 Z" fill="#ffffff" opacity={gloss} />
          {/* буриши миёна */}
          <path d="M4 40 L44 22 V40 L4 52 Z" fill="#ffffff" opacity={onDark ? 0.2 : 0.1} />
          {/* буриши поёнӣ — соя */}
          <path d="M4 52 L44 40 V58 H4 Z" fill={facet} opacity={facetOp} />
        </g>
        {/* контури дурахшон */}
        <path
          d={D_OUTER}
          fill="none"
          stroke={edge}
          strokeOpacity={edgeOp}
          strokeWidth="1.2"
        />
        <path
          d={D_HOLE}
          fill="none"
          stroke={edge}
          strokeOpacity={edgeOp}
          strokeWidth="1.2"
        />

        {/* ===== Тирҳои болои кристалӣ (аз тарафи рости «D») ===== */}
        <path d={A1} fill={`url(#${gArrow})`} />
        <path d="M39 58 H45 L45 34 Z" fill="#ffffff" opacity={onDark ? 0.45 : 0.35} />
        <path d={A2} fill={`url(#${gArrow})`} />
        <path d="M53 58 H61 L61 6 Z" fill="#ffffff" opacity={onDark ? 0.5 : 0.4} />
        <path d="M61 6 L69 58 L61 58 Z" fill={onDark ? "#7db4ff" : "#0b3fd8"} opacity="0.55" />
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
