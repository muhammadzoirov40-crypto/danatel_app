import { Link } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { useApp } from "../context/AppContext";
import Logo from "./Logo";
import { Ic } from "./Icons";

/**
 * 🦶 Футери фишурдашуда — ТАНҲО як сатр: лотип + пилюлаи «Феҳрист».
 *
 * Тибқи дархости корбар: «футер танҳо чунин бошад» (лотип + як пилюла).
 *
 * Барфурӯрданиҳо:
 *   - тавсифи сайт + тугмаи «Мубодилаи сайт»
 *   - 3 сутун: Навигатсия / Бозиҳои машҳур / Тамос ва дастгирӣ
 *   - сатри поёнӣ: © … + тугмаи «Ба боло»
 *   (пештар ин ҷо блоки 4 тилкаи «Trust & Guarantees» ҳам буд — хориқ шуд)
 *
 * Ҳангоми барқароркунӣ: ҳеҷ даъвои суръату интиқол илова карда нашавад.
 */
export default function Footer() {
  const { t } = useApp();

  return (
    <footer className="mt-14 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-3">
        {/* 💎 Логотип */}
        <Link to="/" className="shrink-0" title="donatshop" aria-label="donatshop">
          <Logo size={26} withText textClass="text-base font-black" />
        </Link>

        {/* ⬚ Пилюлаи «Феҳрист» — ягона пайванди футер */}
        <Link
          to="/#games"
          aria-label={t("navCatalog")}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200
                     bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-sm font-semibold
                     text-slate-700 transition shrink-0
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Ic icon={LayoutGrid} size="xs" className="opacity-80" />
          <span>{t("navCatalog")}</span>
        </Link>
      </div>
    </footer>
  );
}
