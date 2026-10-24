import { useId } from "react";
import { useApp } from "../context/AppContext";

/**
 * 💎 ЛОГОТИПИ danatel.tj
 *
 * Таҳлил: сайт = донати бозиҳо (PUBG UC, Free Fire, MLBB) дар Тоҷикистон →
 *   • гаҷет (gem) = асъори бозӣ / «донат»
 *   • кубикаи кабуд = ҳамон ранги сарлавҳаи сайт (#1546dd → #5aa9ff)
 *   • шакли одӣ + контрасти баленд → дар 16px ҳам фаҳмо
 *
 * variant:
 *   onLight — куби кабуд + гаҷети сафед (футер, саҳифаҳои сафед, favicon)
 *   onDark  — куби сафед + гаҷети кабуд (навбари кабуд, мобилӣ)
 *
 * Қоидаҳо: танҳо SVG (бе тасвири номуносиб), IDҳо бо useId →
 * дар як саҳифа чанд маротиба истифода бурдан бехатар.
 */
export default function Logo({
  size = 34,
  withText = false,
  textClass = "",
  variant = "onLight",
}: {
  /** Андозаи нишона (квадрат) дар px */
  size?: number;
  /** Номи сайт дар тараф (барои header / футер) */
  withText?: boolean;
  /** Классҳои иловагӣ барои матн */
  textClass?: string;
  variant?: "onLight" | "onDark";
}) {
  const uid = useId().replace(/[:]/g, "");
  const gTile = `lgTile${uid}`;
  const gGem = `lgGem${uid}`;
  const onDark = variant === "onDark";
  const { t } = useApp();

  return (
    <span className="flex items-center gap-2 shrink-0">
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        role="img"
        aria-label="danatel.tj"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gTile} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1546dd" />
            <stop offset="0.55" stopColor="#2f7cf6" />
            <stop offset="1" stopColor="#5aa9ff" />
          </linearGradient>
          <linearGradient id={gGem} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#dbeafe" />
          </linearGradient>
        </defs>

        {/* Кубика — ранги сарлавҳаи сайт ё сафед (дар кабуд) */}
        <rect
          width="48"
          height="48"
          rx="13"
          fill={onDark ? "#ffffff" : `url(#${gTile})`}
        />

        {/* Гаҷет (gem) — устувор ва равшан дар андозаи хурд */}
        <path
          d="M17 9h14l7 10-14 20-14-20z"
          fill={onDark ? `url(#${gTile})` : `url(#${gGem})`}
        />
        <path
          d="M17 9L10 19h14z"
          fill={onDark ? "#1546dd" : "#ffffff"}
        />
        <path
          d="M31 9l7 10H24z"
          fill={onDark ? "#1546dd" : "#ffffff"}
          opacity={onDark ? 0.62 : 1}
        />
        <path
          d="M10 19h28L24 39z"
          fill={onDark ? "#5aa9ff" : "#60a5fa"}
          opacity="0.5"
        />
        <path
          d="M24 19v20"
          stroke="#ffffff"
          strokeOpacity={onDark ? 0.55 : 0.45}
          strokeWidth="1.2"
        />
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
