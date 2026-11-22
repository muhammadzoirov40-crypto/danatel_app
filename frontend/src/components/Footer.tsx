import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUp,
  Check,
  ChevronRight,
  House,
  LayoutGrid,
  Package,
  Send,
  Share2,
  User,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";
import type { Game } from "../types";
import { Ic } from "./Icons";
import { copyText } from "../utils/clipboard";

/**
 * 🦶 Футери iOS/macOS — glass-карти калон дар мобил, 4 сутун дар desktop.
 * Танҳо UI; логикаи пайвандҳо ва API ҳамон аст.
 */
export default function Footer() {
  const { t, lang, user } = useApp();
  const [copied, setCopied] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "danatel.tj — Сайти фурӯши донати бозиҳо",
          text: "Донати бозиҳо (Free Fire, PUBG, MLBB) бо сомонӣ дар danatel.tj",
          url: window.location.origin,
        });
        return;
      } catch {
        /* fallback */
      }
    }
    try {
      if (await copyText(window.location.origin)) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  // Маълумоти бозиҳо барои нишон додани «аз X сомонӣ»
  useEffect(() => {
    let alive = true;
    api
      .games(lang)
      .then((d) => {
        if (alive) setGames(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lang]);

  // Аниматсияи fade + translateY(8px) ҳангоми ба экран омадан
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(true);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const gameBySlug = (slug: string) => games.find((g) => g.slug === slug);
  const popular = [
    { slug: "free-fire", label: "Free Fire Diamonds" },
    { slug: "pubg-mobile", label: "PUBG Mobile UC" },
    { slug: "mobile-legends", label: "Mobile Legends Diamonds" },
    { slug: "blood-strike", label: "Blood Strike Gold" },
  ];

  const navItems = [
    { to: "/", icon: House, label: t("goHome") },
    { to: "/#games", icon: LayoutGrid, label: t("navCatalog") },
    { to: user ? "/orders" : "/login", icon: Package, label: user ? t("navOrders") : t("login") },
    { to: user ? "/profile" : "/login", icon: User, label: user ? t("profile") : t("login") },
  ];

  const reveal = (delay: number) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(8px)",
    transition: reducedMotion
      ? "none"
      : visible
        ? `opacity 240ms var(--ios-ease) ${delay}ms, transform 240ms var(--ios-ease) ${delay}ms`
        : "none",
  });

  return (
    <footer
      ref={rootRef}
      className="mt-14 pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-8"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        {/* 📱 Мобил: як корти glass; 💻 Desktop: 4 сутун бе корт */}
        <div
          className="footer-shell rounded-[28px] p-5 sm:p-6
                     bg-[rgba(255,255,255,0.72)] dark:bg-[rgba(28,28,30,0.72)]
                     backdrop-saturate-[1.8] backdrop-blur-[24px]
                     border border-[rgba(255,255,255,0.6)] dark:border-[rgba(255,255,255,0.08)]
                     shadow-[var(--ios-shadow-2)]
                     lg:rounded-none lg:border-t lg:border-[var(--ios-separator)] lg:bg-transparent
                     lg:backdrop-blur-none lg:shadow-none lg:p-0 lg:grid lg:grid-cols-4 lg:gap-8"
        >
          {/* 1️⃣ Brand */}
          <section className="space-y-3 lg:space-y-4" style={reveal(0)}>
            <Link to="/" className="inline-flex items-center gap-4" title="donatshop">
              <img
                src="/icons/donatshop-D-logo.png"
                alt=""
                aria-hidden
                width={40}
                height={40}
                className="shrink-0"
                style={{ height: 40, width: "auto" }}
              />
              <span className="text-[17px] font-bold leading-none text-[var(--ios-label)]">
                donatshop
              </span>
            </Link>
            <p className="text-[15px] leading-relaxed text-[var(--ios-label-2)] max-w-[34ch]">
              Аввалин платформаи миллии хариди донат ва пули бозиҳо дар Тоҷикистон.
            </p>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full text-sm font-semibold transition active:scale-95"
              style={{
                background: "var(--ios-blue-tint)",
                color: "var(--ios-blue)",
              }}
            >
              <Ic icon={copied ? Check : Share2} size="xs" />
              <span>{copied ? t("copied") : lang === "ru" ? "Поделиться сайтом" : "Мубодилаи сайт"}</span>
            </button>
          </section>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:contents">
            {/* 2️⃣ Навигатсия */}
            <section className="lg:mt-0" style={reveal(60)}>
            <h5 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--ios-label-2)] mb-2">
              Навигатсия
            </h5>
            <div className="overflow-hidden rounded-[14px] bg-[var(--ios-elevated)]/60 dark:bg-[var(--ios-elevated)]/40 lg:bg-transparent">
              <ul className="divide-y divide-[var(--ios-separator)]">
                {navItems.map((item, i) => (
                  <li key={item.to + item.label} className={i === 0 ? "" : "border-t border-[var(--ios-separator)]"}>
                    <Link
                      to={item.to}
                      aria-label={item.label}
                      className="flex items-center gap-3 h-12 px-4 active:bg-black/5 dark:active:bg-white/5 active:scale-[0.99] transition duration-120"
                    >
                      <span className="grid place-items-center w-[30px] h-[30px] rounded-lg shrink-0" style={{ background: "var(--ios-blue-tint)" }}>
                        <Ic icon={item.icon} size="sm" className="text-[var(--ios-blue)]" />
                      </span>
                      <span className="flex-1 text-[16px] font-medium text-[var(--ios-label)]">{item.label}</span>
                      <Ic icon={ChevronRight} size="xs" className="text-[var(--ios-label-3)]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* 3️⃣ Бозиҳо */}
          <section className="mt-6 lg:mt-0" style={reveal(120)}>
            <h5 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--ios-label-2)] mb-2">
              Бозиҳои машҳур
            </h5>
            <div className="overflow-hidden rounded-[14px] bg-[var(--ios-elevated)]/60 dark:bg-[var(--ios-elevated)]/40 lg:bg-transparent">
              <ul className="divide-y divide-[var(--ios-separator)]">
                {popular.map((p, i) => {
                  const g = gameBySlug(p.slug);
                  return (
                    <li key={p.slug} className={i === 0 ? "" : "border-t border-[var(--ios-separator)]"}>
                      <Link
                        to={`/game/${p.slug}`}
                        aria-label={p.label}
                        className="flex items-center gap-3 h-12 px-4 active:bg-black/5 dark:active:bg-white/5 active:scale-[0.99] transition duration-120"
                      >
                        {g?.image_url ? (
                          <img
                            src={g.image_url}
                            alt=""
                            aria-hidden
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-[22%] object-cover shrink-0"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className="grid place-items-center w-8 h-8 rounded-[22%] bg-[var(--ios-fill)] text-sm shrink-0">
                            {g?.emoji ?? "🎮"}
                          </span>
                        )}
                        <span className="flex-1 min-w-0">
                          <span className="block text-[16px] font-medium text-[var(--ios-label)] truncate">
                            {g?.name ?? p.label}
                          </span>
                          {g?.min_price_tjs ? (
                            <span className="block text-xs text-[var(--ios-label-2)]">
                              аз {Number(g.min_price_tjs).toFixed(2)} {t("currency")}
                            </span>
                          ) : null}
                        </span>
                        <Ic icon={ChevronRight} size="xs" className="text-[var(--ios-label-3)]" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
          </div>

          {/* 4️⃣ Тамос */}
          <section className="mt-6 lg:mt-0" style={reveal(180)}>
            <h5 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--ios-label-2)] mb-2">
              Тамос ва дастгирӣ
            </h5>
            <div className="rounded-[14px] p-4" style={{ background: "var(--ios-elevated)", border: "0.5px solid var(--ios-separator)" }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="grid place-items-center w-[40px] h-[40px] rounded-xl shrink-0" style={{ background: "var(--ios-blue-tint)" }}>
                  <Ic icon={Send} size="sm" className="text-[var(--ios-blue)]" />
                </span>
                <div className="min-w-0">
                  <div className="text-[16px] font-semibold text-[var(--ios-label)]">Саволе доред?</div>
                  <div className="text-xs text-[var(--ios-label-2)] leading-relaxed">
                    Ба боти Telegram-и мо муроҷиат кунед.
                  </div>
                </div>
              </div>
              <a
                href="https://t.me/ONLAYN_ALMAZ_TJ_bot"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="@ONLAYN_ALMAZ_TJ_bot"
                className="flex items-center justify-center gap-2 w-full h-[50px] rounded-[14px] text-white text-sm font-bold transition active:scale-[0.98]"
                style={{ background: "var(--ios-blue)" }}
              >
                <Ic icon={Send} size="sm" />
                <span>@ONLAYN_ALMAZ_TJ_bot</span>
              </a>
            </div>
          </section>
        </div>

        {/* 🔻 Поёнтарин сатр */}
        <div className="mt-6 text-center text-xs text-[var(--ios-label-2)]" style={reveal(240)}>
          © {new Date().getFullYear()} donatshop
        </div>
      </div>
    </footer>
  );
}
