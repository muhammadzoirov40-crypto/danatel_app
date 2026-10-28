import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { Ic } from "./Icons";

/**
 * ⬅️ Тугмаи «Бозгашт» — ягона барои ҳамаи саҳифаҳо.
 *
 *   · Услуби шишаин (glass): `bg-slate-900/60` + `backdrop-blur-md` +
 *     `border-white/25` — мисли тугмаи бозгашти саҳифаи бозӣ (GameDetail);
 *   · Бармегардад ба саҳифаи қаблӣ дар таърих (`nav(-1)`);
 *   · `aria-label` + матни «Бозгашт» (тарҷума: tj/ru/us/uz);
 *   · Калиди keyboard + `focus-visible` ring барои дастрастӣ (a11y).
 */
export default function BackButton({ className = "" }: { className?: string }) {
  const nav = useNavigate();
  const { t } = useApp();

  return (
    <button
      type="button"
      onClick={() => nav(-1)}
      aria-label={t("back")}
      className={`mb-1 w-fit justify-self-start inline-flex items-center gap-1
                  rounded-full bg-slate-900/60 hover:bg-slate-900/75 border border-white/25
                  text-white text-xs sm:text-sm font-semibold px-3 py-1.5 backdrop-blur-md
                  transition active:scale-95 focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-white/70 ${className}`}
    >
      <Ic icon={ArrowLeft} size="xs" />
      {t("back")}
    </button>
  );
}
