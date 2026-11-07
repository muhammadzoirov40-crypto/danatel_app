import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { COUNTRIES, type Country } from "../data/countries";
import { Ic } from "./Icons";

/**
 * 🌍 Интихоби коди кишвар барои шакли телефон (Вуруд / Қайд).
 *
 *   · Тугмаи фишурда: чипи ПАРЧАМ (real flag) + «+992» + стрелка;
 *   · Рӯйхат: 49 кишвар, Тоҷикистон аввал;
 *   · 🔍 Ҷустуҷӯ дар боло: ном ба 4 забон / ISO / рақами код
 *     (мисол: «Рус», «russia», «998») → филтр фаврӣ, холӣ → «Ёфт нашод»;
 *   · 🏳️ Парчамҳои REAL: расми PNG (`/flags/xx.png`, 49 дона) — дар
 *     ҳамаи дастгоҳҳо (машваратии Honor/Huawei ҳам, ки emoji-и парчамро
 *     ҳамчун ҳарф бармегаронад) ҳамчун РАСМ нишон дода мешавад;
 *     агар расм набошад → ҳарфҳои ISO бармегаранд (ҳеҷ чиз намешканад);
 *   · 📐 Ҳангоми кушодан ҷой дар ҷараён (margin) ишғол мешавад →
 *     тугмаи «Вуруд» ҲАМЕША дида мешавад, рӯйхат бар он намепӯшад;
 *   · 📱 КОМПАКТ (талаби соҳиб 07.11.2026: «камтар майдатар кун, ки дар
 *     экран ҷо шавад»): сатрҳо 32px, ҷустуҷӯ пасттар, рӯйхат ≤152px →
 *     панели пурра дар экрани 320×700 ҷо мешавад;
 *   · Фокус ҳангоми кушодан сӯи ҷустуҷӯ; ↑/↓ ба рӯйхат мебарад,
 *     Enter (аз ҷустуҷӯ) → аввали натиҷа; Escape/клик берун → пӯшад;
 *   · aria: input бо label + listbox/option; дар 320px кор мекунад.
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [pad, setPad] = useState(0);

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

  // 📐 Ҳангоми кушодан — ҳаҷми рӯйхатро чен мекунам ва ба root
  //    `margin-bottom` медиҳам → тугмаи «Вуруд» бо марҳила поён мешавад
  //    ва ҲАМЕША дида мешавад (талаби соҳиб: «ин нашавад — ислоҳ кун»)
  useLayoutEffect(() => {
    if (!open) {
      setPad(0);
      return;
    }
    const h = panelRef.current?.offsetHeight ?? 0;
    setPad(h ? h + 8 : 0); // 8px ғафси болои панел (top-[calc(100%+8px)])
  }, [open, q]);

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
    <div
      ref={rootRef}
      className="relative shrink-0"
      style={{
        marginBottom: pad || undefined,
        transitionProperty: "margin-bottom",
        transitionDuration: "0.18s",
        transitionTimingFunction: "ease",
      }}
    >
      {/* 🔘 Тугма: чипи ISO + код */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t("ccLabel")}: +${selected.dial}`}
        className={`h-[46px] px-2.5 inline-flex items-center gap-1.5 rounded-xl border
                   bg-white text-sm font-bold text-slate-700
                   outline-none transition active:scale-[.98]
                   hover:border-slate-400
                   focus:border-brand-500 focus:ring-2 focus:ring-brand-100
                   dark:bg-[#0f1626] dark:border-[#3a4767] dark:text-[#e3eaff]
                   ${open ? "border-brand-400 ring-2 ring-brand-100 dark:ring-brand-500/30" : "border-slate-300"}`}
      >
        <span
          aria-hidden
          className="grid h-[22px] min-w-[28px] place-items-center overflow-hidden rounded-md px-1
                     bg-gradient-to-br from-blue-50 to-indigo-100
                     ring-1 ring-blue-200/70
                     dark:from-white/10 dark:to-white/5 dark:ring-white/15"
        >
          <img
            src={`/flags/${selected.code.toLowerCase()}.png`}
            alt=""
            width={20}
            height={14}
            className="h-[14px] w-[20px] rounded-[2px] object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (fb) fb.style.display = "";
            }}
          />
          <span className="hidden text-[10px] font-black tracking-wider text-blue-700 dark:text-blue-300">
            {selected.code}
          </span>
        </span>
        <span className="tabular-nums">+{selected.dial}</span>
        <Ic
          icon={ChevronDown}
          size="xs"
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* 📜 Рӯйхати кишварҳо + 🔍 ҷустуҷӯ */}
      {open && (
        <div
          ref={panelRef}
          onKeyDown={onPanelKey}
          className="cc-panel absolute left-0 top-[calc(100%+8px)] z-[60] w-[280px]
                     max-w-[calc(100vw-32px)] rounded-2xl border p-1.5
                     border-slate-200/80 bg-white
                     shadow-[0_14px_40px_-10px_rgba(15,23,42,0.22)]
                     ring-1 ring-slate-900/5
                     dark:bg-[#0f1626] dark:border-[#3a4767] dark:ring-white/10
                     dark:shadow-[0_14px_40px_-10px_rgba(0,0,0,0.55)]"
        >
          {/* 🔍 Ҷустуҷӯ — қуттии дохилии pill (ҳамеша дар боло) */}
          <div className="relative mb-1">
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
              className="w-full rounded-xl border border-transparent bg-slate-100/80
                         py-2 pl-9 pr-9 text-[13px] text-slate-700 outline-none transition
                         placeholder:text-slate-400
                         focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100
                         dark:bg-white/5 dark:text-[#e3eaff] dark:placeholder:text-slate-500
                         dark:focus:border-brand-500 dark:focus:bg-white/10
                         dark:focus:ring-brand-500/30"
            />
            {q && (
              <button
                type="button"
                aria-label={t("ccClear")}
                onClick={() => {
                  setQ("");
                  searchRef.current?.focus();
                }}
                className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center
                           rounded-lg text-slate-400 transition
                           hover:bg-white hover:text-slate-600 active:scale-95
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
            className="max-h-[152px] overflow-y-auto overscroll-contain px-0.5 pb-0.5"
          >
            {filtered.length === 0 ? (
              <p className="flex flex-col items-center gap-2 px-3 py-5 text-center text-xs
                            text-slate-500 dark:text-slate-400">
                <Ic icon={Search} size="sm" className="text-slate-300 dark:text-slate-600" />
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
                    className={`w-full flex items-center gap-2 rounded-xl px-2 py-1.5
                                text-left text-[13px] transition
                                focus-visible:outline-none focus-visible:ring-2
                                focus-visible:ring-brand-400
                                ${active
                                  ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200/70 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/30"
                                  : "text-slate-700 hover:bg-slate-100/80 active:bg-slate-100 dark:text-[#e3eaff] dark:hover:bg-white/10"}`}
                  >
                    <span
                      aria-hidden
                      className={`grid h-[20px] min-w-[28px] shrink-0 place-items-center overflow-hidden
                                  rounded-md px-1
                                  ${active
                                    ? "bg-brand-600"
                                    : "bg-gradient-to-br from-blue-50 to-indigo-100 ring-1 ring-blue-200/70 dark:from-white/10 dark:to-white/5 dark:ring-white/15"}`}
                    >
                      <img
                        src={`/flags/${c.code.toLowerCase()}.png`}
                        alt=""
                        width={19}
                        height={13}
                        className="h-[13px] w-[19px] rounded-[2px] object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                          if (fb) fb.style.display = "";
                        }}
                      />
                      <span
                        className={`hidden text-[10px] font-black tracking-wider ${
                          active ? "text-white" : "text-blue-700 dark:text-blue-300"
                        }`}
                      >
                        {c.code}
                      </span>
                    </span>
                    <span
                      className={`flex-1 min-w-0 truncate font-semibold
                        ${active ? "" : "text-slate-700 dark:text-[#e3eaff]"}`}
                    >
                      {c.names[lang]}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">
                      +{c.dial}
                    </span>
                    {active && (
                      <Ic icon={Check} size="xs" className="text-brand-600 shrink-0 dark:text-brand-400" />
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
