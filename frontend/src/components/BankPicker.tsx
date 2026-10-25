import { useState } from "react";
import { Check, CreditCard, Loader2, Lock, Star, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Ic } from "./Icons";

/**
 * Интихоби банк барои пардохти берунӣ (DC Wallet).
 *
 * Ҳамон усуле, ки дар лоиҳаи rent_frow истифода мешавад:
 *   «Пардохт» → интихоби банк → «Идома» → меравад ба DC Wallet.
 *
 * DC Bank банки фаол (рекомендуется) аст, боқӣ ҳамчун «зуд меояд»
 * қулфуда нишон дода мешаванд — то корбар бидонад кадом банкҳо
 * дар оянда илова мешаванд.
 */

interface Bank {
  id: string;
  label: string;
  accent: string;
  recommended?: boolean;
  available: boolean;
}

const BANKS: Bank[] = [
  { id: "dc", label: "DC Bank", accent: "#f59e0b", recommended: true, available: true },
  { id: "alif", label: "Alif Bank", accent: "#10b981", available: false },
  { id: "milli", label: "Korti milli", accent: "#ef4444", available: false },
  { id: "eskhata", label: "Bank Eskhata", accent: "#f97316", available: false },
  { id: "cash", label: "Cash Deposit to Bank", accent: "#22c55e", available: false },
];

function CheckIcon() {
  return <Ic icon={Check} size="xs" strokeWidth={4} />;
}

function LockIcon() {
  return <Ic icon={Lock} size="sm" />;
}

interface Props {
  price: number;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Кушодани интихоби банк (overlay/модалка).
 * Пас аз «Идома» → onConfirm() фармоишро месозад.
 */
export default function BankPicker({ price, loading, onConfirm, onClose }: Props) {
  const { t } = useApp();
  const first = BANKS.find((b) => b.available) ?? BANKS[0];
  const [bankId, setBankId] = useState<string>(first.id);

  const selected = BANKS.find((b) => b.id === bankId) ?? first;
  const canConfirm = selected.available && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Пасманзар */}
      <button
        aria-label={t("close")}
        onClick={loading ? undefined : onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
      />

      {/* Модалка — дар мобилӣ аз поён, дар десктоп дар марказ */}
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Сарлавҳа */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800 inline-flex items-center gap-2">
              <Ic icon={CreditCard} className="text-brand-600" />
              {t("chooseBank")}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("total")}:{" "}
              <span className="font-bold text-brand-600">
                {price.toLocaleString("tj-TJ")} {t("currency")}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label={t("close")}
            className="grid place-items-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition disabled:opacity-50"
          >
            <Ic icon={X} />
          </button>
        </div>

        {/* Рӯйхати банкҳо */}
        <div className="px-5 py-4 space-y-2.5 overflow-y-auto">
          {BANKS.map((bank) => {
            const available = bank.available;
            const active = bank.id === bankId;
            return (
              <button
                key={bank.id}
                type="button"
                disabled={!available}
                onClick={() => available && setBankId(bank.id)}
                className={`w-full flex items-center gap-3 rounded-xl border-2 p-3 text-left transition
                  ${
                    active
                      ? "border-brand-600 bg-brand-50 shadow-sm"
                      : "border-slate-200 bg-white"
                  }
                  ${available ? "hover:border-slate-300" : "opacity-70 cursor-not-allowed"}`}
              >
                {/* Сутуни ранги банк */}
                <span
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ backgroundColor: bank.accent, opacity: available ? 1 : 0.3 }}
                  aria-hidden="true"
                />

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-800 truncate">
                    {bank.label}
                  </span>
                  {bank.recommended && available && (
                    <span className="block text-[11px] font-semibold text-amber-600 inline-flex items-center gap-1">
                      <Ic icon={Star} size="xs" className="fill-current" />
                      {t("bankRecommended")}
                    </span>
                  )}
                  {!available && (
                    <span className="block text-[11px] font-medium text-slate-400">
                      {t("bankSoon")}
                    </span>
                  )}
                </span>

                {available ? (
                  <span
                    aria-hidden="true"
                    className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                      active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"
                    }`}
                  >
                    {active && <CheckIcon />}
                  </span>
                ) : (
                  <span className="shrink-0 text-slate-300">
                    <LockIcon />
                  </span>
                )}
              </button>
            );
          })}

          <p className="px-1 text-xs leading-relaxed text-slate-500">{t("bankHint")}</p>
        </div>

        {/* Тугмаҳо — ҳамеша дар поён */}
        <div className="shrink-0 px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="shrink-0 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
          >
            {t("back")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? (
              <>
                <Ic icon={Loader2} className="animate-spin" /> {t("loading")}
              </>
            ) : (
              <>
                <Ic icon={CreditCard} />
                {t("continueBtn")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
