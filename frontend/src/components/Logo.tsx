import { useApp } from "../context/AppContext";

interface LogoProps {
  /** Андозаи квадратии лого (пиксел). Пешфарз: 28 */
  size?: number;
  /** Номи бренд дар паҳлӯ нишон дода шавад (True = барои Header) */
  withText?: boolean;
  /** Ранги матни бренд (масалан, 'text-white' барои Navbar-и торик) */
  textClass?: string;
  /** Дурахши (Glow) муболиғнок дар атрофи лого (True = барои Splash) */
  glow?: boolean;
  /** Агар true бошад, дар мавзӯи равшан нусхаи light истифода мешавад */
  lightVariant?: boolean;
}

export default function Logo({
  size = 28,
  withText = false,
  textClass = "text-[#3E8EF7] dark:text-white",
  glow = false,
  lightVariant = false,
}: LogoProps) {
  const { t } = useApp();
  const src = lightVariant ? "/icons/donatshop-logo-light.png" : "/icons/donatshop-logo.png";

  return (
    <span
      className="inline-flex items-center gap-2 shrink-0"
      style={glow ? { filter: "drop-shadow(0 8px 24px rgba(139,92,246,0.5))" } : undefined}
    >
      <img
        src={src}
        alt="donatshop"
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
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
