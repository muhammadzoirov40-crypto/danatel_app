import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Headphones, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Ic } from "./Icons";
import BrandIcon, { type BrandName } from "./BrandIcon";
import { INSTAGRAM_URL, TELEGRAM_URL, WHATSAPP_URL } from "../config/constants";

interface SupportSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Каналҳои дастгирӣ — логоҳои расмӣ тавассути як компоненти `BrandIcon` */
const CHANNELS: { label: string; href: string; brand: BrandName }[] = [
  { label: "Telegram", href: TELEGRAM_URL, brand: "telegram" },
  { label: "WhatsApp", href: WHATSAPP_URL, brand: "whatsapp" },
  { label: "Instagram", href: INSTAGRAM_URL, brand: "instagram" },
];

/**
 * Bottom sheet-и дастгирӣ — ҳам барои BottomNav ва ҳам SidebarMenu.
 * Логикаи кушодан/пӯшидан дар компоненти волид аст.
 */
export default function SupportSheet({ open, onClose }: SupportSheetProps) {
  const { t } = useApp();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startY: 0, dragging: false, current: 0 });
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (reducedMotion) {
        setVisible(true);
      } else {
        const timer = window.setTimeout(() => setVisible(true), 30);
        return () => window.clearTimeout(timer);
      }
      return;
    }
    if (mounted) {
      setVisible(false);
      const timer = window.setTimeout(() => setMounted(false), 320);
      return () => window.clearTimeout(timer);
    }
  }, [open, mounted, reducedMotion]);

  useEffect(() => {
    if (!open || !mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeButton = sheetRef.current?.querySelector<HTMLButtonElement>("[data-close]") ?? null;
    closeButton?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mounted, onClose]);


  // 🔤 Логоҳои расмӣ (44px, SVG inline) — танҳо канали линкдор
  const channels = CHANNELS.filter((item) => item.href);

  const gridCols =
    channels.length <= 1 ? "grid-cols-1" : channels.length === 2 ? "grid-cols-2" : "grid-cols-3";

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { startY: e.clientY, dragging: true, current: 0 };
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.dragging || !sheetRef.current) return;
    const dy = e.clientY - drag.startY;
    if (dy > 0) {
      drag.current = dy;
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    }
  };

  const resetDrag = () => {
    const drag = dragRef.current;
    if (!drag.dragging || !sheetRef.current) return;
    drag.dragging = false;
    sheetRef.current.style.transition = "";
    if (drag.current > 96) {
      onClose();
    } else {
      sheetRef.current.style.transform = "";
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[70] ${open || visible ? "pointer-events-auto" : "pointer-events-none"}`}>
      <div
        onClick={onClose}
        aria-hidden
        className={`absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-sheet-title"
        className={`absolute inset-x-0 bottom-0 flex h-auto max-h-[70vh] flex-col rounded-t-[28px] border-t border-white/60 bg-[rgba(255,255,255,0.78)] px-5 pt-4 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.18)] backdrop-blur-[28px] backdrop-saturate-[1.8] dark:border-white/8 dark:bg-[rgba(28,28,30,0.78)] ${
          reducedMotion ? "" : "transition-transform duration-[380ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        } ${visible ? "translate-y-0" : "translate-y-full"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={resetDrag}
        onPointerCancel={resetDrag}
      >
        <div
          className="mx-auto mb-4 h-1.5 w-9 rounded-full bg-slate-300 dark:bg-slate-600 touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={resetDrag}
          onPointerCancel={resetDrag}
          aria-hidden
        />

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[rgba(0,122,255,0.12)]"
              aria-hidden
            >
              <Ic icon={Headphones} size="md" className="text-[#007aff]" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 id="support-sheet-title" className="text-[20px] font-bold leading-tight text-[var(--ios-label)]">
                {t("support")}
              </h2>
              <p className="mt-1 text-[14px] leading-tight text-[var(--ios-label-2)]">
                {t("supportSubtitle")}
              </p>
            </div>
          </div>
          <button
            data-close
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--ios-fill)] text-[var(--ios-label-2)] transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ios-blue)]"
          >
            <Ic icon={X} size="md" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className={`grid ${gridCols} gap-[10px]`}>
            {channels.map((item, index) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.label}
                className="flex h-[84px] flex-col items-center justify-center gap-2 rounded-[18px] border border-[var(--ios-material-border)] bg-[var(--ios-fill)] text-center transition duration-120 active:scale-[0.96] hover:-translate-y-0.5 hover:shadow-md dark:bg-[var(--ios-fill)]"
                style={
                  reducedMotion
                    ? undefined
                    : {
                        opacity: visible ? 1 : 0,
                        transform: visible ? "translateY(0)" : "translateY(6px)",
                        transition: `opacity 240ms var(--ios-ease) ${index * 50}ms, transform 240ms var(--ios-ease) ${index * 50}ms, background-color 120ms, box-shadow 120ms`,
                      }
                }
              >
                {/* Логои расмӣ бе доираи иловагии ранга («лого дар дохили лого») */}
                <BrandIcon name={item.brand} size={44} />
                <span className="text-[13px] font-semibold leading-none text-[var(--ios-label)]">
                  {item.label}
                </span>
              </a>
            ))}
          </div>

        </div>
      </div>
    </div>,
    document.body,
  );
}

