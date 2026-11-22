import { Plus } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { Ic } from "../Icons";

/**
 * 💳 Корти баланс: номи «БАЛАНС» хокистарӣ, маблағи 28px сафед бо
 * «сомонӣ» хокистарӣ ва тугмаи сабзи гарди «+» (мисли MegaFon)
 * барои кушодани «Пур кардан».
 */
interface BalanceCardProps {
  balanceText: string | null;
  loading: boolean;
  onTopUp: () => void;
  onRetry: () => void;
}

export default function BalanceCard({
  balanceText,
  loading,
  onTopUp,
  onRetry,
}: BalanceCardProps) {
  const { t } = useApp();

  return (
    <section className="rounded-2xl bg-[var(--mf-card)] p-4" aria-labelledby="balance-label">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div
            id="balance-label"
            className="text-[12px] font-semibold uppercase tracking-wider text-[var(--mf-text-2)]"
          >
            {t("balance")}
          </div>

          <div className="mt-1.5 flex items-baseline gap-1.5" role="status" aria-live="polite">
            {loading ? (
              <>
                <span
                  aria-hidden
                  className="inline-block h-7 w-24 animate-pulse rounded-md bg-[var(--mf-divider)]"
                />
                <span className="sr-only">{t("loading")}</span>
              </>
            ) : balanceText !== null ? (
              <>
                <span className="text-[28px] font-bold leading-none tabular-nums text-[var(--mf-text)]">
                  {balanceText}
                </span>
                <span className="text-sm text-[var(--mf-text-2)]">{t("currency")}</span>
              </>
            ) : (
              <span className="text-[28px] leading-none text-[var(--mf-text-2)]" aria-hidden>
                —
              </span>
            )}
          </div>

          {!loading && balanceText === null && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 text-[13px] font-semibold text-[var(--mf-accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mf-accent)]"
            >
              {t("retry")}
            </button>
          )}
        </div>

        {/* 🟢 Тугмаи сабзи гарди «+» → «Пур кардан» */}
        <button
          type="button"
          onClick={onTopUp}
          aria-label={t("topup")}
          title={t("topup")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--mf-green)] text-white transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mf-green)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mf-card)]"
        >
          <Ic icon={Plus} size="md" strokeWidth={2.5} />
        </button>
      </div>
    </section>
  );
}
