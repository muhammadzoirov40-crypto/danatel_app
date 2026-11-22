import { Headphones, Package, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { Ic } from "../Icons";

/**
 * ⚡ Се тилли баробар дар як сатр: «Пур кардан» · «Дастгирӣ» ·
 * «Фармоишҳо» — иконка дар боло, номи кӯтоҳ дар поён (radius 16).
 * Роҳҳо/модалҳои мавҷуда: TopUpModal · SupportSheet · /orders.
 */
interface QuickActionsProps {
  onTopUp: () => void;
  onSupport: () => void;
}

const tileCls =
  "flex flex-col items-center justify-center gap-1.5 rounded-2xl " +
  "bg-[var(--mf-card)] px-2 py-3.5 transition active:scale-[0.96] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mf-accent)]";

const labelCls = "text-[13px] font-semibold text-[var(--mf-text)]";

export default function QuickActions({ onTopUp, onSupport }: QuickActionsProps) {
  const { t } = useApp();

  return (
    <div className="grid grid-cols-3 gap-3">
      <button type="button" onClick={onTopUp} className={tileCls}>
        <Ic icon={Plus} size="lg" className="text-[var(--mf-accent)]" />
        <span className={labelCls}>{t("topup")}</span>
      </button>

      <button type="button" onClick={onSupport} className={tileCls}>
        <Ic icon={Headphones} size="lg" className="text-[var(--mf-accent)]" />
        <span className={labelCls}>{t("support")}</span>
      </button>

      <Link to="/orders" className={tileCls}>
        <Ic icon={Package} size="lg" className="text-[var(--mf-accent)]" />
        <span className={labelCls}>{t("orders")}</span>
      </Link>
    </div>
  );
}
