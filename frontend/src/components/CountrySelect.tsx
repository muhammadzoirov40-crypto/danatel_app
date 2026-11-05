import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { COUNTRIES, type Country } from "../data/countries";
import { Ic } from "./Icons";

/**
 * 🌍 Интихоби коди кишвар барои шакли телефон (Вуруд / Қайд).
 *
 *   · Тугмаи фишурда: парчам + «+992» + стрелка (ҳамон услуби `.input`);
 *   · Рӯйхат: 49 кишвар (парчам + ном ба забони лоиҳа + код), Тоҷикистон аввал;
 *   · 🔍 Ҷустуҷӯ дар болои рӯйхат: ном ба 4 забон / ISO / рақами код
 *     (мисол: «Рус», «russia», «998») → филтр фаврӣ, холӣ → «Ёфт нашод»;
 *   · Фокус ҳангоми кушодан сӯи ҷустуҷӯ; ↑/↓ ба рӯйхат мебарад,
 *     Enter (аз ҷустуҷӯ) → аввали натиҷа;
 *   · Корбар ТАНҲО рақами миллӣ менависад — `+` лозим нест;
 *   · Клик берун / Escape → пӯшад; ҷустуҷӯ ҳангоми пӯштан пок мешавад;
 *   · aria: input бо label + listbox/option; дар 320px аз паҳнои экран зиёд нест.
 */
interface Props {
  /** ISO-коди кишвари интихобшуда (масалан "TJ") */
  value: string;
  onChange: (c: Country) => void;
}

export default function CountrySelect({ value, onChange }: Props) {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // 🧹 Ҷустуҷӯ ҳангоми пӯштан пок → ҳангоми кушодан ҳамеша холӣ
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  // 🎯 Ҳангоми кушодан → фокуси ҷустуҷӯ + ба банди интихобшуда
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [open]);

  // 🔍 Филтр: ном ба 4 забон / ISO-код / рақами телефон
  const query = q.trim().toLowerCase();
  const digits = query.replace(/^\+/, "");
  const filtered = query
    ? COUNTRIES.filter((c) =>
        `${c.names.tj} ${c.names.ru} ${c.names.en} ${c.names.uz} ${c.code}`
          .toLowerCase()
          .includes(query) || c.dial.includes(digits),
      )
    : COUNTRIES;

  /** ↑/↓ аз ҷустуҷӯ ба рӯйхат ва байни бандҳо; Enter (аз ҷустуҷӯ) → аввалӣ */
  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const items = [
        ...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []),
      ];
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next =
        i === -1
          ? e.key === "ArrowDown"
            ? 0
            : items.length - 1
          : Math.min(Math.max(i + (e.key === "ArrowDown" ? 1 : -1), 0), items.length - 1);
      items[next]?.focus();
      return;
    }
    if (e.key === "Enter" && document.activeElement === searchRef.current) {
      const first = listRef.current?.querySelector<HTMLElement>('[role="option"]');
      if (first) {
        e.preventDefault();
        first.click();
      }
    }
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

      {/* 📜 Рӯйхати кишварҳо + 🔍 ҷустуҷӯ */}
      {open && (
        <div
          onKeyDown={onPanelKey}
          className="absolute left-0 top-[calc(100%+6px)] z-[60] w-[270px]
                     max-w-[calc(100vw-40px)] overflow-hidden rounded-xl border
                     border-slate-200 bg-white shadow-xl
                     dark:bg-[#0f1626] dark:border-[#3a4767]"
        >
          {/* 🔍 Ҷустуҷӯ — ҳамеша дар боло (ҳангоми скролл намемонад) */}
          <div className="relative border-b border-slate-100 dark:border-white/10">
            <Ic
              icon={Search}
              size="xs"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={searchRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("ccSearch")}
              aria-label={t("ccSearch")}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              className="w-full bg-transparent py-2.5 pl-9 pr-9 text-sm text-slate-700
                         outline-none placeholder:text-slate-400
                         dark:text-[#e3eaff] dark:placeholder:text-slate-500"
            />
            {q && (
              <button
                type="button"
                aria-label={t("ccClear")}
                onClick={() => {
                  setQ("");
                  searchRef.current?.focus();
                }}
                className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center
                           rounded-lg text-slate-400 transition
                           hover:bg-slate-100 hover:text-slate-600 active:scale-95
                           dark:hover:bg-white/10"
              >
                <Ic icon={X} size="xs" />
              </button>
            )}
          </div>

          {/* 📜 Рӯйхат */}
          <div
            ref={listRef}
            role="listbox"
            aria-label={t("ccLabel")}
            className="max-h-[220px] overflow-y-auto overscroll-contain py-1"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                {t("ccEmpty")}
              </p>
            ) : (
              filtered.map((c) => {
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
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
