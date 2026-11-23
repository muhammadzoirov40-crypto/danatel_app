import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { COUNTRIES, type Country } from "../data/countries";
import { Ic } from "./Icons";

interface Props {
  value: string;
  onChange: (c: Country) => void;
}

export default function CountrySelect({ value, onChange }: Props) {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragDeltaY = useRef(0);
  const [dragY, setDragY] = useState(0);

  const selected = COUNTRIES.find((c) => c.code === value) ?? COUNTRIES[0];

  const requestClose = () => {
    const prefersReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setOpen(false);
      setDragY(0);
      setQ("");
      return;
    }
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setDragY(0);
      setQ("");
    }, 280);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [open]);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const query = q.trim().toLowerCase();
  const digits = query.replace(/^\+/, "");
  const filtered = query
    ? COUNTRIES.filter(
        (c) =>
          `${c.names.tj} ${c.names.ru} ${c.names.en} ${c.names.uz} ${c.code}`
            .toLowerCase()
            .includes(query) || c.dial.includes(digits),
      )
    : COUNTRIES;

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

  // Swipe down handlers (for grabber/header area)
  const onTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragDeltaY.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current == null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) {
      dragDeltaY.current = dy;
      setDragY(dy);
    }
  };
  const onTouchEnd = () => {
    const prefersReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const threshold = 80; // 25% of ~320px is ~80
    if (dragDeltaY.current > threshold || dragDeltaY.current > 120) {
      requestClose();
    } else {
      setDragY(0);
    }
    dragStartY.current = null;
    dragDeltaY.current = 0;
  };

  const sheetStyle: React.CSSProperties = {};
  if (dragY > 0 && !closing) {
    sheetStyle.transform = `translateY(${dragY}px)`;
    sheetStyle.transition = "none";
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      {/* 🔘 Тугма: чипи ISO + код */}
      <button
        type="button"
        onClick={() => { setOpen(true); setClosing(false); }}
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
        <Ic icon={ChevronDown} size="xs" className="text-slate-400 transition-transform" />
      </button>

      {/* 📱 Bottom Sheet */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 z-[9998] bg-black/50 backdrop-blur-[4px] transition-opacity duration-200 ${closing ? "opacity-0" : "opacity-100"}`}
            onClick={requestClose}
            aria-hidden
          />
          {/* Sheet */}
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("ccSelectTitle")}
            onKeyDown={onPanelKey}
            style={sheetStyle}
            className={`fixed z-[9999] left-0 right-0 bottom-0 max-h-[80dvh] flex flex-col
                        rounded-t-[28px] border-t
                        md:left-1/2 md:right-auto md:-translate-x-1/2 md:top-1/2 md:-translate-y-1/2 md:bottom-auto md:max-h-[80dvh] md:w-[420px] md:rounded-[28px] md:border
                        transition-transform duration-[380ms] ease-[cubic-bezier(.2,.8,.2,1)]
                        ${closing ? "translate-y-full md:translate-y-[-40%] md:opacity-0" : "translate-y-0 md:translate-y-[-50%]"}
                        ${typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "!transition-none" : ""}`}
          >
            <div
              className="flex flex-col flex-1 min-h-0 rounded-t-[28px] md:rounded-[28px] overflow-hidden"
              style={{
                background: "rgba(24,24,56,.92)",
                backdropFilter: "blur(24px) saturate(160%)",
                WebkitBackdropFilter: "blur(24px) saturate(160%)",
                borderTop: "1px solid rgba(130,110,255,.35)",
                boxShadow: "0 -10px 40px rgba(0,0,0,.5)",
              }}
            >
              {/* Grabber */}
              <div
                className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                <div className="w-9 h-[5px] rounded-full bg-white/25" />
              </div>
              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-2">
                <h2 className="text-[18px] font-bold text-white">{t("ccSelectTitle")}</h2>
                <button
                  type="button"
                  onClick={requestClose}
                  className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
                  aria-label={t("close") || "Close"}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Search */}
              <div className="px-4 pb-2">
                <div className="relative">
                  <Ic icon={Search} size="xs" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
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
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-9 text-[14px] text-white outline-none transition placeholder:text-white/40 focus:border-[#5B7CFF] focus:ring-2 focus:ring-[#5B7CFF]/30"
                  />
                  {q && (
                    <button
                      type="button"
                      aria-label={t("ccClear")}
                      onClick={() => { setQ(""); searchRef.current?.focus(); }}
                      className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
                    >
                      <Ic icon={X} size="xs" />
                    </button>
                  )}
                </div>
              </div>
              {/* List */}
              <div ref={listRef} role="listbox" aria-label={t("ccLabel")} className="flex-1 overflow-y-auto overscroll-contain px-2 pb-4 max-h-[50dvh]">
                {filtered.length === 0 ? (
                  <p className="flex flex-col items-center gap-2 px-3 py-8 text-center text-sm text-white/60">
                    <Ic icon={Search} size="sm" className="text-white/30" />
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
                        onClick={() => { onChange(c); requestClose(); }}
                        className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B7CFF] ${active ? "bg-[#2F66F0]/30 text-white ring-1 ring-[#5B7CFF]/50" : "text-white/90 hover:bg-white/8 active:bg-white/12"}`}
                      >
                        <span aria-hidden className={`grid h-[22px] min-w-[32px] shrink-0 place-items-center overflow-hidden rounded-md px-1 ${active ? "bg-[#2F66F0]" : "bg-white/10 ring-1 ring-white/15"}`}>
                          <img
                            src={`/flags/${c.code.toLowerCase()}.png`}
                            alt=""
                            width={20}
                            height={14}
                            className="h-[14px] w-[20px] rounded-[2px] object-contain"
                            onError={(e) => { e.currentTarget.style.display = "none"; const fb = e.currentTarget.nextElementSibling as HTMLElement | null; if (fb) fb.style.display = ""; }}
                          />
                          <span className={`hidden text-[10px] font-black tracking-wider ${active ? "text-white" : "text-white/80"}`}>{c.code}</span>
                        </span>
                        <span className="flex-1 min-w-0 truncate font-medium">{c.names[lang]}</span>
                        <span className="text-sm font-semibold tabular-nums text-white/60">+{c.dial}</span>
                        {active && <Ic icon={Check} size="xs" className="text-[#5B7CFF] shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
