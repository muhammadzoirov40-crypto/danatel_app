import { Check, ChevronRight, Copy, UserRound } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { Ic } from "../Icons";

/**
 * 👤 Сатри корбар: аватар 44px (ҳарф) · ном 18px · телефон хокистарӣ ·
 * нишонаи «>» · бейҷи «АДМИН» (пилюлаи 12px) + сатри хокистарии
 * «ID-и шумо: 2» ва «Санаи қайд: 23.10.2026» бо тугмаи нусха (16px).
 */
interface UserInfoProps {
  displayName: string;
  initial: string;
  phone?: string | null;
  userId: number;
  registeredAt: string;
  isAdmin: boolean;
  idCopied: boolean;
  dateCopied: boolean;
  onCopyId: () => void;
  onCopyDate: () => void;
}

export default function UserInfo({
  displayName,
  initial,
  phone,
  userId,
  registeredAt,
  isAdmin,
  idCopied,
  dateCopied,
  onCopyId,
  onCopyDate,
}: UserInfoProps) {
  const { t } = useApp();

  const copyBtn =
    "inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-[13px] " +
    "text-[var(--mf-text-2)] transition hover:text-[var(--mf-text)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mf-accent)]";

  return (
    <section className="rounded-2xl bg-[var(--mf-card)] p-4" aria-labelledby="profile-name">
      <div className="flex items-center gap-3">
        {/* Аватари 44px бо ҳарфи аввали ном */}
        <div
          aria-hidden
          className="grid h-11 w-11 shrink-0 select-none place-items-center rounded-full bg-[var(--mf-divider)] text-base font-bold text-[var(--mf-text)]"
        >
          {initial || <Ic icon={UserRound} size="sm" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 id="profile-name" className="truncate text-[18px] font-bold text-[var(--mf-text)]">
              {displayName}
            </h2>
            {isAdmin && (
              <span className="shrink-0 rounded-full bg-[var(--mf-accent)] px-2 py-0.5 text-[12px] font-semibold text-white">
                {t("admin")}
              </span>
            )}
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-[var(--mf-text-2)]" />
          </div>
          {phone && (
            <p className="mt-0.5 truncate text-sm tabular-nums text-[var(--mf-text-2)]">
              {phone}
            </p>
          )}
        </div>
      </div>

      {/* 🪪 ID + 📅 санаи қайд — ҳар яке бо тугмаи нусха (16px) */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" onClick={onCopyId} className={copyBtn}>
          <span>
            {t("profileIdLabel")} {userId}
          </span>
          <Ic icon={idCopied ? Check : Copy} className={idCopied ? "text-emerald-600 dark:text-emerald-400" : ""} />
        </button>
        <button type="button" onClick={onCopyDate} className={copyBtn}>
          <span>
            {t("registeredAt")}: {registeredAt}
          </span>
          <Ic icon={dateCopied ? Check : Copy} className={dateCopied ? "text-emerald-600 dark:text-emerald-400" : ""} />
        </button>
      </div>
    </section>
  );
}
