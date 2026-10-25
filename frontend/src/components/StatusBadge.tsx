import type { OrderStatus } from "../types";
import { STATUS_META } from "../types";
import { useApp } from "../context/AppContext";
import { Ic } from "./Icons";

/**
 * Бейҷи статуси фармоиш — иконкаи Lucide + матни тарҷума.
 * Ранг/иконка аз ягонаи манбаи `STATUS_META` меояд (на emoji, на дубликат).
 */
export default function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useApp();
  const meta = STATUS_META[status] ?? STATUS_META.pending;

  return (
    <span className={`badge ${meta.cls}`}>
      <Ic icon={meta.icon} size="xs" strokeWidth={2.25} />
      {t(meta.key)}
    </span>
  );
}
