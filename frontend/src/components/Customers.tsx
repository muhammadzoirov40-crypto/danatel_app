import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import { Ic } from "./Icons";

interface Row {
  name: string;
  delivered: number;
}

/**
 * 👥 Рӯйхати муштариёни ВОҚЕӢ.
 *  Танҳо онҳое, ки дар база фармоиши иҷрочуда (delivered) доранд.
 *  Номҳо ниқобшуда: номи пурра ё •••5678. Ҳеҷ рейтинги сохта нест.
 */
export default function Customers() {
  const { t } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api
      .customers(30)
      .then((d) => {
        setRows(d.items);
        setTotal(d.customers_total);
      })
      .catch(() => {});
  }, []);

  if (total === 0) return null;

  return (
    <section className="mt-10 sm:mt-12">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-xl sm:text-2xl font-bold inline-flex items-center gap-2">
          <Ic icon={Users} size="md" className="text-brand-600" />
          {t("customersTitle")}
        </h2>
        <span className="text-sm font-bold text-slate-500">
          {total} {t("customersTotal")}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {rows.map((r, i) => (
          <span
            key={`${r.name}-${i}`}
            className="inline-flex items-center gap-2 rounded-full bg-white
                       ring-1 ring-slate-200 px-3 py-1.5 text-sm shadow-xs"
          >
            <span
              className="grid place-items-center w-6 h-6 rounded-full
                         bg-brand-100 text-brand-700 text-xs font-black"
            >
              {r.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="font-semibold text-slate-700">{r.name}</span>
            <span className="text-xs text-slate-400">
              · {r.delivered} {t("customersOrders")}
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}
