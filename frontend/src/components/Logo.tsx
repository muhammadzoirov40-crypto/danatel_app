import { useId } from "react";
import { useApp } from "../context/AppContext";

/**
 * 💎 ЛОГОТИПИ danatel.tj — ҳарфи «D»-и ГАВҲАРАКӢ (low-poly crystal)
 *
 * Тибқи тасвири ниҳоии соҳиб:
 *   • ҳарфи «D» аз бисёр сатҳҳои (facet) буридаи кабуд иборат аст —
 *     аз кабуди чуқур (пойон-чап) то сафедкабуд (боло-рост);
 *   • тарафи рости «D» бо тирчаҳои тези кристаллӣ (shards) бурида мешавад;
 *   • ҳамаи сатҳҳо дар як `clipPath` мебуранд → ҳар гоҳ рангҳо дуруст
 *     набошанд, ҳамвор мемонад (бе «сӯрохиҳо»).
 *
 * Ҳама чиз SVG-и дастнавис аст → бе ягон хатои матнӣ, дар 16px ҳам фаҳмо.
 * IDҳо бо `useId` → дар як саҳифа чанд маротиба истифода бурдан бехатар.
 *
 * variant:
 *   onLight — «D»-и кабуди сатҳнок (сафед, футер, favicon)
 *   onDark  — «D»-и ЯХӢ (сафедкабуд) барои навбари кабуди сайт
 */

/* ===== Сатҳҳо (facet) — [нуқтаҳо, рақами ранг] ===== */
const FACETS: ReadonlyArray<readonly [string, number]> = [
  // ➖ тахтаи чап (стем)
  ["14,18 50,56 32,96", 3],
  ["14,18 32,96 14,182", 1],
  ["32,96 50,144 14,182", 0],
  ["50,56 50,144 32,96", 4],
  // ➖ боло
  ["14,18 94,18 50,56", 5],
  ["94,18 96,56 50,56", 4],
  ["94,18 126,30 96,56", 6],
  ["126,30 116,76 96,56", 5],
  ["126,30 148,50 116,76", 6],
  // 🗡️ тирчаҳои кристаллӣ (рост)
  ["148,50 170,38 116,76", 7],
  ["170,38 166,72 116,76", 6],
  ["166,72 188,86 124,100", 8],
  ["166,72 124,100 116,76", 5],
  ["188,86 166,112 124,100", 7],
  ["166,112 180,136 124,100", 6],
  ["166,112 116,124 124,100", 5],
  ["166,112 180,136 116,124", 5],
  ["180,136 152,158 116,124", 6],
  // ➖ поён
  ["152,158 96,144 116,124", 4],
  ["152,158 122,176 96,144", 3],
  ["122,176 94,182 96,144", 3],
  ["50,144 96,144 94,182", 2],
  ["94,182 14,182 50,144", 1],
];

/** Кабуди классикӣ — барои саҳифаҳои сафед */
const PAL_LIGHT = [
  "#0a2a8f",
  "#1140b8",
  "#1546dd",
  "#1f6fe0",
  "#2f8cf0",
  "#4f9bff",
  "#7cc0fb",
  "#a9d8fd",
  "#cfe8ff",
];
/** Яхи сафедкабуд — барои навбари кабуди сайт.
 *  Ҳамаи рангҳо аз фони кабуд (#2250df) РАВШАНТАРанд → контур гум намешавад. */
const PAL_ICE = [
  "#5aa3ff",
  "#78b7ff",
  "#93c9ff",
  "#a9d8fd",
  "#c1e5fe",
  "#d6edff",
  "#e8f4ff",
  "#f6fbff",
  "#ffffff",
];

/** Контури «D»: беруна + тир (binari, ҳалкунанда — қисми дохилӣ холӣ) */
const D_PATH =
  "M14 18 H94 L126 30 L148 50 L170 38 L166 72 L188 86 L166 112 L180 136 " +
  "L152 158 L122 176 L94 182 L14 182 Z " +
  "M50 56 H96 L116 76 L124 100 L116 124 L96 144 L50 144 Z";

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
  const clip = `dClip${uid}`;
  const onDark = variant === "onDark";
  const pal = onDark ? PAL_ICE : PAL_LIGHT;
  const { t } = useApp();

  return (
    <span className="flex items-center gap-2 shrink-0">
      <svg
        width={size}
        height={size}
        viewBox="6 10 188 188"
        role="img"
        aria-label="danatel.tj"
        className="shrink-0"
      >
        <defs>
          <clipPath id={clip}>
            <path d={D_PATH} fillRule="evenodd" clipRule="evenodd" />
          </clipPath>
        </defs>

        {/* Зеринаш — то дар байни сатҳҳо «сӯрохӣ» пайдо нашавад */}
        <path d={D_PATH} fillRule="evenodd" fill={pal[2]} />

        {/* Сатҳҳои кристаллӣ */}
        <g clipPath={`url(#${clip})`}>
          {FACETS.map(([pts, tone], i) => (
            <polygon key={i} points={pts} fill={pal[tone]} />
          ))}
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
