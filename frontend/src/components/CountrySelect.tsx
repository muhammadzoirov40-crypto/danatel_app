import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useApp } from "../context/AppContext";
import { COUNTRIES, type Country } from "../data/countries";
import { Ic } from "./Icons";

/**
 * 🌍 Интихоби коди кишвар барои шакли телефон (Вуруд / Қайд).
 *
 *   · Тугмаи фишурда: парчам + «+992» + стрелка (ҳамон услуби `.input`);
 *   · Рӯйхат: 49 кишвар (парчам + ном ба забони лоиҳа + код), Тоҷикистон аввал;
 *   · Корбар ТАНҲО рақами миллӣ менависад — `+` лозим нест;
 *   · Клик берун / Escape → пӯшад; Tab/стрелкаҳо → ҳаракат; aria: listbox/option;
 *   · Дар 320px рӯйхат аз рости тугма мебарояд ва аз паҳнои экран зиёд намешавад.
 */
interface Props {
  /** ISO-коди кишвари интихобшуда (масалан "TJ") */
  value: string;
  onChange: (c: Country) => void;
}

export default function CountrySelect({ value, onChange }: Props) {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = COUNTRIES.find((c) => c.code === value) ?? COUNTRIES[0];

  // 🚪 Клик берун ё Escape → пӯштани рӯйхат
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 🎯 Ҳангоми кушодан → фокус + ба банди интихобшуда
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest" });
    el?.focus();
  }, [open]);

  /** ↑/↓ дар рӯйхат — ҳаракати фокус байни бандҳо */
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [
      ...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []),
    ];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "ArrowDown"
        ? Math.min(i + 1, items.length - 1)
        : Math.max(i - 1, 0);
    items[next]?.focus();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      {/* 🔘 Тугма: парчам + код */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t("ccLabel")}: +${selected.dial}`}
        className="h-[46px] px-2.5 inline-flex items-center gap-1.5 rounded-xl border
                   border-slate-300 bg-white text-sm font-bold text-slate-700
                   outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100
                   transition hover:border-slate-400 active:scale-[.98]
                   dark:bg-[#0f1626] dark:border-[#3a4767] dark:text-[#e3eaff]"
      >
        <span aria-hidden className="text-base leading-none">
          {selected.flag}
        </span>
        <span>+{selected.dial}</span>
        <Ic
          icon={ChevronDown}
          size="xs"
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* 📜 Рӯйхати кишварҳо */}
      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={t("ccLabel")}
          onKeyDown={onListKey}
          className="absolute left-0 top-[calc(100%+6px)] z-[60] w-[270px]
                     max-w-[calc(100vw-40px)] max-h-[260px] overflow-y-auto
                     overscroll-contain rounded-xl border border-slate-200
                     bg-white shadow-xl py-1 dark:bg-[#0f1626] dark:border-[#3a4767]"
        >
          {COUNTRIES.map((c) => {
            const active = c.code === value;
            return (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left
                            text-sm transition focus-visible:outline-none
                            focus-visible:bg-blue-50 dark:focus-visible:bg-white/10
                            ${active ? "bg-brand-50 dark:bg-white/10" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {c.flag}
                </span>
                <span
                  className={`flex-1 min-w-0 truncate font-semibold
                    ${active ? "text-brand-700 dark:text-brand-400" : "text-slate-700 dark:text-[#e3eaff]"}`}
                >
                  {c.names[lang]}
                </span>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                  +{c.dial}
                </span>
                {active && (
                  <Ic icon={Check} size="xs" className="text-brand-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
