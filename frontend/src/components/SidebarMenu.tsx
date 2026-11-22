import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Disc3,
  Download,
  Info,
  LogIn,
  LogOut,
  Moon,
  Package,
  Send,
  Settings,
  Star,
  Sun,
  UserPlus,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { LANGS } from "../i18n";
import { httpsUrl } from "../utils/https";
import {
  InstallPromptEvent,
  isIos,
  isStandalone,
} from "./InstallApp";
import {
  Ic,
  RussianFlag,
  TajikFlag,
  USAFlag,
  UzbekFlag,
} from "./Icons";
import Logo from "./Logo";
import { TELEGRAM_URL, WHATSAPP_URL } from "../config/constants";

/**
 * 🍔 SIDEBAR-MENЮ — услуби iOS/macOS.
 *
 *   · Панел аз рост мебарояд (spring 380ms);
 *   · Фон dim + blur; Esc ва swipe-down/right мепӯшад;
 *   · Focus trap дар дохили панел;
 *   · Бандҳо ба навбат (stagger 30ms) пайдо мешаванд.
 */
export default function SidebarMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: (after?: () => void) => void;
}) {
  const { lang, setLang, t, user, isAdmin, logout, theme, toggleTheme } =
    useApp();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [installBusy, setInstallBusy] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [apkBusy, setApkBusy] = useState(false);
  const [visible, setVisible] = useState(false);

  const dragRef = useRef({ startX: 0, startY: 0, dragging: false });

  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const insecure = !window.isSecureContext;
  const ios = isIos();
  const showInstall = !installed && (insecure || ios || !!installEvt);

  const onInstall = async () => {
    if (insecure) {
      window.location.href = httpsUrl();
      return;
    }
    if (ios) {
      setIosHint((v) => !v);
      return;
    }
    if (!installEvt || installBusy) return;
    setInstallBusy(true);
    try {
      await installEvt.prompt();
      const choice = await installEvt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } finally {
      setInstallBusy(false);
    }
  };

  const onApkDownload = async () => {
    if (apkBusy) return;
    setApkBusy(true);
    try {
      const token = localStorage.getItem("danatel_token");
      const res = await fetch("/api/apk", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("apk");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "AutoDonat.apk";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* бехатар */
    } finally {
      setApkBusy(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    if (reducedMotion) {
      setVisible(true);
    } else {
      const timer = window.setTimeout(() => setVisible(true), 16);
      return () => window.clearTimeout(timer);
    }
  }, [open, reducedMotion]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const getFocusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
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
    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const onLogout = () => {
    onClose(() => {
      logout();
      nav("/");
    });
  };

  const goAbout = () => {
    go("/about");
  };

  const goInvite = () => {
    onClose(() => {
      const scroll = () => {
        const el = document.getElementById("invite");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      };
      if (pathname !== "/wheel") {
        nav("/wheel");
        setTimeout(scroll, 300);
        setTimeout(scroll, 1000);
      } else {
        scroll();
      }
    });
  };

  const go = (to: string) => {
    onClose(() => nav(to));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, dragging: true };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.dragging || !panelRef.current) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (dx > 0 || dy > 0) {
      panelRef.current.style.transition = "none";
      panelRef.current.style.transform = `translate(${dx}px, ${Math.max(0, dy)}px)`;
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    if (!drag.dragging || !panelRef.current) return;
    drag.dragging = false;
    const transform = panelRef.current.style.transform;
    const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    const dx = match ? Number(match[1]) : 0;
    const dy = match ? Number(match[2]) : 0;
    panelRef.current.style.transition = "";
    panelRef.current.style.transform = "";
    if (dx > 80 || dy > 80) onClose();
  };

  const onPointerCancel = () => {
    dragRef.current.dragging = false;
    if (panelRef.current) {
      panelRef.current.style.transition = "";
      panelRef.current.style.transform = "";
    }
  };

  const rowBase =
    "relative flex items-center gap-3 h-[52px] px-4 text-[16px] font-medium " +
    "text-slate-700 dark:text-slate-200 transition-[transform,background-color] duration-120 " +
    "active:scale-[0.99] active:bg-black/5 dark:active:bg-white/5 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ios-blue)]";

  const revealStyle = (index: number) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : "translateY(8px)",
    transition: reducedMotion
      ? "none"
      : visible
        ? `opacity 240ms var(--ios-ease) ${index * 30}ms, transform 240ms var(--ios-ease) ${index * 30}ms`
        : "none",
  });

  const MenuRow = ({
    icon,
    iconBg,
    iconColor,
    label,
    onClick,
    href,
    badge,
    danger = false,
    index,
    divider = true,
  }: {
    icon: React.ComponentProps<typeof Ic>["icon"];
    iconBg: string;
    iconColor: string;
    label: string;
    onClick?: () => void;
    href?: string;
    badge?: string;
    danger?: boolean;
    index: number;
    divider?: boolean;
  }) => {
    const content = (
      <>
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]"
          style={{ background: iconBg }}
          aria-hidden
        >
          <Ic icon={icon} size="md" className={iconColor} />
        </span>
        <span className={`flex-1 truncate ${danger ? "text-[#ff3b30]" : "text-[var(--ios-label)]"}`}>
          {label}
        </span>
        {badge && (
          <span className="rounded-full bg-[var(--ios-blue)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--ios-blue)]">
            {badge}
          </span>
        )}
        <Ic icon={ChevronRight} size="xs" className="text-[var(--ios-label-3)]" />
        {divider && (
          <span
            className="absolute bottom-0 right-0 h-px bg-[var(--ios-separator)]"
            style={{ left: 60 }}
            aria-hidden
          />
        )}
      </>
    );

    const className = `${rowBase} ${danger ? "text-[#ff3b30]" : ""}`;

    if (href) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className={className}
          style={revealStyle(index)}
        >
          {content}
        </a>
      );
    }

    return (
      <button type="button" onClick={onClick} aria-label={label} className={className} style={revealStyle(index)}>
        {content}
      </button>
    );
  };

  const Flag = ({ code }: { code: string }) =>
    code === "tj" ? (
      <TajikFlag className="w-5 h-3.5 rounded-xs" />
    ) : code === "ru" ? (
      <RussianFlag className="w-5 h-3.5 rounded-xs" />
    ) : code === "en" ? (
      <USAFlag className="w-5 h-3.5 rounded-xs" />
    ) : (
      <UzbekFlag className="w-5 h-3.5 rounded-xs" />
    );

  return (
    <>
      <div
        onClick={() => onClose()}
        aria-hidden
        className={`fixed inset-0 z-[60] bg-black/30 backdrop-blur-[4px] transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("menu")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className={`fixed inset-y-0 right-0 z-[61] w-[84%] max-w-[340px]
                    bg-white/78 dark:bg-[#1c1c1e]/78
                    backdrop-blur-[28px] backdrop-saturate-[1.8]
                    border-l border-white/60 dark:border-white/8
                    shadow-2xl rounded-l-3xl
                    flex flex-col
                    transition-transform duration-[380ms] ease-[cubic-bezier(0.32,0.72,0,1)]
                    ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: "var(--ios-material-strong)" }}
      >
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <span className="grid place-items-center w-9 h-9 rounded-full bg-blue-50 dark:bg-[var(--ios-blue-tint)] ring-1 ring-blue-100 dark:ring-[var(--ios-blue)]/20 shrink-0 overflow-hidden">
            <Logo size={36} variant="plain" />
          </span>
          <span className="flex-1 min-w-0 font-bold text-[17px] tracking-tight text-[var(--ios-label)] truncate">
            {t("brand")}
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onClose()}
            aria-label={t("close")}
            className="grid place-items-center w-8 h-8 rounded-full bg-[var(--ios-fill)] text-[var(--ios-label-2)]
                       hover:bg-[var(--ios-fill-2)] active:scale-95 transition
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ios-blue)]"
          >
            <Ic icon={X} size="md" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {!user && (
            <div className="mb-4 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => go("/login")}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl
                           bg-[var(--ios-elevated)] px-4 py-3 text-[15px] font-semibold
                           text-[var(--ios-label)] ring-1 ring-[var(--ios-separator)]
                           active:scale-[0.98] transition"
              >
                <Ic icon={LogIn} />
                {t("login")}
              </button>
              <button
                type="button"
                onClick={() => go("/login?register=1")}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl
                           px-4 py-3 text-[15px] font-bold text-white
                           active:scale-[0.98] transition"
                style={{ background: "var(--ios-blue)" }}
              >
                <Ic icon={UserPlus} />
                {t("registerNow")}
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-[20px] bg-[var(--ios-elevated)]/70 dark:bg-[var(--ios-elevated)]/50">
            {[
              { key: "wheel", icon: Disc3, bg: "rgba(175,82,222,0.14)", color: "text-[#af52de]", label: t("wheel"), onClick: () => go("/wheel") },
              { key: "reviews", icon: Star, bg: "rgba(255,149,0,0.14)", color: "text-[#ff9500]", label: t("navReviews"), onClick: () => go("/reviews") },
              { key: "about", icon: Info, bg: "var(--ios-fill)", color: "text-[var(--ios-label-2)]", label: t("navAbout"), onClick: goAbout },
              ...(user
                ? [{ key: "invite", icon: UserPlus, bg: "rgba(52,199,89,0.14)", color: "text-[#34c759]", label: t("inviteLink"), onClick: goInvite }]
                : []),
              { key: "telegram", icon: Send, bg: "rgba(34,158,217,0.14)", color: "text-[#229ED9]", label: "Дастгирӣ дар Telegram", onClick: () => window.open(TELEGRAM_URL, "_blank", "noopener,noreferrer") },
              ...(isAdmin
                ? [{ key: "admin", icon: Settings, bg: "var(--ios-fill)", color: "text-[var(--ios-label-2)]", label: t("adminPanel"), onClick: () => go("/admin"), badge: "АДМИН" }]
                : []),
            ].map((item, index) => (
              <MenuRow
                index={index}
                icon={item.icon}
                iconBg={item.bg}
                iconColor={item.color}
                label={item.label}
                onClick={item.onClick}
                badge={item.badge}
                divider={index < 5}
              />
            ))}

            {showInstall && (
              <MenuRow
                key="install"
                index={6}
                icon={Download}
                iconBg="var(--ios-blue-tint)"
                iconColor="text-[var(--ios-blue)]"
                label={t("menuInstall")}
                onClick={() => void onInstall()}
              />
            )}

            {user && (
              <MenuRow
                key="logout"
                index={7}
                icon={LogOut}
                iconBg="rgba(255,59,48,0.12)"
                iconColor="text-[#ff3b30]"
                label={t("logout")}
                onClick={onLogout}
                danger
                divider={false}
              />
            )}
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--ios-label-2)]">
                Моро пайгирӣ кунед
              </div>
              <p className="mb-3 text-xs text-[var(--ios-label-3)]">
                Хабарҳо, тахфифҳо ва дастгирӣ
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {TELEGRAM_URL && (
                  <a
                    href={TELEGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Telegram"
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl text-white text-[15px] font-semibold transition active:scale-[0.97]"
                    style={{ background: "#229ED9" }}
                  >
                    <TelegramIcon className="h-6 w-6" />
                    <span>Telegram</span>
                  </a>
                )}
                {WHATSAPP_URL && WHATSAPP_URL !== "https://wa.me/992XXXXXXXXX" && (
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl text-white text-[15px] font-semibold transition active:scale-[0.97]"
                    style={{ background: "#25D366" }}
                  >
                    <WhatsAppIcon className="h-6 w-6" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[13px] font-semibold text-[var(--ios-label)]">
                Мавзӯъ
              </div>
              <div className="relative h-9 rounded-full bg-[var(--ios-fill)] p-1">
                <span
                  className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm transition-transform duration-200 dark:bg-slate-700"
                  style={{ transform: theme === "dark" ? "translateX(100%)" : "none" }}
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => theme !== "light" && toggleTheme()}
                  aria-pressed={theme === "light"}
                  aria-label={t("themeLight")}
                  className="relative z-10 flex h-7 flex-1 items-center justify-center rounded-full text-[var(--ios-label-2)] transition"
                >
                  <Ic icon={Sun} size="md" />
                </button>
                <button
                  type="button"
                  onClick={() => theme !== "dark" && toggleTheme()}
                  aria-pressed={theme === "dark"}
                  aria-label={t("themeDark")}
                  className="relative z-10 flex h-7 flex-1 items-center justify-center rounded-full text-[var(--ios-label-2)] transition"
                >
                  <Ic icon={Moon} size="md" />
                </button>
              </div>
            </div>

            <div>
              <div className="mb-2 text-[13px] font-semibold text-[var(--ios-label)]">
                Забон
              </div>
              <div className="grid grid-cols-4 gap-2">
                {LANGS.map((l) => {
                  const active = lang === l.code;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setLang(l.code)}
                      aria-pressed={active}
                      aria-label={l.label}
                      title={l.label}
                      className={`flex h-11 w-11 items-center justify-center rounded-full transition
                                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ios-blue)]
                                  ${
                                    active
                                      ? "bg-white ring-2 ring-[var(--ios-blue)] shadow-sm scale-105 dark:bg-slate-700"
                                      : "hover:bg-[var(--ios-fill)] active:scale-95"
                                  }`}
                    >
                      <Flag code={l.code} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MenuRow({
  icon,
  iconBg,
  iconColor,
  label,
  onClick,
  href,
  badge,
  danger = false,
  index,
  divider = true,
}: {
  icon: React.ComponentProps<typeof Ic>["icon"];
  iconBg: string;
  iconColor: string;
  label: string;
  onClick?: () => void;
  href?: string;
  badge?: string;
  danger?: boolean;
  index: number;
  divider?: boolean;
}) {
  const { visible, reducedMotion, revealStyle } = useMenuMotion();
  const content = (
    <>
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]"
        style={{ background: iconBg }}
        aria-hidden
      >
        <Ic icon={icon} size="md" className={iconColor} />
      </span>
      <span className={`flex-1 truncate ${danger ? "text-[#ff3b30]" : "text-[var(--ios-label)]"}`}>
        {label}
      </span>
      {badge && (
        <span className="rounded-full bg-[var(--ios-blue)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--ios-blue)]">
          {badge}
        </span>
      )}
      <Ic icon={ChevronRight} size="xs" className="text-[var(--ios-label-3)]" />
      {divider && (
        <span
          className="absolute bottom-0 right-0 h-px bg-[var(--ios-separator)]"
          style={{ left: 60 }}
          aria-hidden
        />
      )}
    </>
  );

  const className =
    "relative flex items-center gap-3 h-[52px] px-4 text-[16px] font-medium " +
    "transition-[transform,background-color] duration-120 active:scale-[0.99] " +
    "active:bg-black/5 dark:active:bg-white/5 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ios-blue)]";

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={className}
        style={revealStyle(index)}
      >
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} className={className} style={revealStyle(index)}>
      {content}
    </button>
  );
}

function useMenuMotion() {
  const [visible, setVisible] = useState(false);
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), 16);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  const revealStyle = (index: number) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : "translateY(8px)",
    transition: reducedMotion
      ? "none"
      : visible
        ? `opacity 240ms var(--ios-ease) ${index * 30}ms, transform 240ms var(--ios-ease) ${index * 30}ms`
        : "none",
  });

  return { visible, reducedMotion, revealStyle };
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M21.5 2.5L2.8 9.6c-1.3.5-1.3 1.2-.2 1.6l4.8 1.5 1.8 5.5c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.3-1.4z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.1.2-.3.3-.4.1-.2.1-.3 0-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.4-.5-.6-.5h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9 0 1.1.8 2.1.9 2.3.1.2 1.6 2.4 3.8 3.4 2.2 1 2.2.7 2.6.6.4-.1 1.3-.5 1.5-.9.2-.4.2-.8.1-.9zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.4 5L2 22l5.2-1.3c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
    </svg>
  );
}
