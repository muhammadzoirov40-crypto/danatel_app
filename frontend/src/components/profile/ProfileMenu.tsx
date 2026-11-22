import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Ic } from "../Icons";

/**
 * 📋 Ягона корти менюи профил (radius 16): ҳар сатр = иконка дар
 * доираи 36px + унвон 16px + зер-унвон 13px хокистарӣ + «>» +
 * ҷудокунандаи борик. Панели кушода дар зери ҳамон сатр.
 */
export interface ProfileMenuRow {
  id: string;
  icon: LucideIcon;
  title: string;
  hint: string;
  open: boolean;
  onToggle: () => void;
  /** Мазмуни панели кушода (ҳангоми `open`) */
  children?: ReactNode;
}

export default function ProfileMenu({
  rows,
  label,
}: {
  rows: ProfileMenuRow[];
  label: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-[var(--mf-card)]" aria-label={label}>
      {rows.map((row) => (
        <div key={row.id} className="border-t border-[var(--mf-divider)] first:border-t-0">
          <button
            type="button"
            onClick={row.onToggle}
            aria-expanded={row.open}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-black/[0.03] active:bg-black/[0.05] dark:hover:bg-white/[0.03] dark:active:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--mf-accent)]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--mf-divider)] text-[var(--mf-accent)]">
              <Ic icon={row.icon} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-semibold text-[var(--mf-text)]">
                {row.title}
              </span>
              <span className="block truncate text-[13px] text-[var(--mf-text-2)]">
                {row.hint}
              </span>
            </span>
            <ChevronRight
              aria-hidden
              className={`h-4 w-4 shrink-0 text-[var(--mf-text-2)] transition-transform ${
                row.open ? "rotate-90" : ""
              }`}
            />
          </button>

          {row.open && row.children && (
            <div className="border-t border-[var(--mf-divider)] px-4 py-4">
              {row.children}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
