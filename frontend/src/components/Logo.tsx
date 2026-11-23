import { useApp } from "../context/AppContext";

/**
 * 💎 ЛОГОТИПИ danatel.tj — файл `public/logo.svg` (D-и low-poly + тоҷ + ҳалқа).
 *
 * Танҳо `<img src="/logo.svg">` → як манбаи воҳид барои ҳама ҷо
 * (auth, header, footer, sidebar, favicon). `size` — баландӣ дар px.
 */
export default function Logo({
  size = 34,
  withText = false,
  textClass = "",
}: {
  /** Баландии нишон дар px */
  size?: number;
  /** Номи сайт дар тараф (барои header / футер) */
  withText?: boolean;
  /** Классҳои иловагӣ барои матн */
  textClass?: string;
}) {
  const { t } = useApp();
  return (
    <span className="inline-flex items-center gap-2 shrink-0">
      <img
        src="/logo.svg"
        alt="donatshop"
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="shrink-0"
        style={{ height: size, width: size }}
        onError={(e) => {
          e.currentTarget.src = "/icons/favicon-32.png";
          e.currentTarget.onerror = null;
        }}
      />
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