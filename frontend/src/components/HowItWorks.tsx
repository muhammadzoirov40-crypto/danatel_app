import { useApp } from "../context/AppContext";
import { Gamepad3D, IdBadge3D, CreditCard3D, GiftBox3D } from "./Icons";

/**
 * «Чӣ тавр кор мекунад?» — рӯйхати уфуқӣ (иконка чап, сарлавҳа +
 * тавсиф рост, рақами қадам 1–4). Кӯчонидашуда аз Home ба About.
 */
export default function HowItWorks() {
  const { t } = useApp();

  const steps = [
    { n: 1, icon: <Gamepad3D className="w-8 h-8" />, bg: "bg-blue-50 ring-1 ring-blue-100 dark:bg-blue-900/30 dark:ring-blue-800" },
    { n: 2, icon: <IdBadge3D className="w-8 h-8" />, bg: "bg-purple-50 ring-1 ring-purple-100 dark:bg-purple-900/30 dark:ring-purple-800" },
    { n: 3, icon: <CreditCard3D className="w-8 h-8" />, bg: "bg-amber-50 ring-1 ring-amber-100 dark:bg-amber-900/30 dark:ring-amber-800" },
    { n: 4, icon: <GiftBox3D className="w-8 h-8" />, bg: "bg-rose-50 ring-1 ring-rose-100 dark:bg-rose-900/30 dark:ring-rose-800" },
  ];

  return (
    <section className="mt-10 sm:mt-14">
      <h2 className="text-xl sm:text-2xl font-bold text-center mb-6 text-slate-900 dark:text-white">
        {t("howItWorks")}
      </h2>
      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.n} className="card p-4 flex items-start gap-3 sm:gap-4">
            <div className={`grid place-items-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shrink-0 ${s.bg}`}>
              {s.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-extrabold dark:bg-white dark:text-slate-900">
                  {s.n}
                </span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  {t(`step${s.n}`)}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {t(`step${s.n}d`)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
