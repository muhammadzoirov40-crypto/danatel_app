import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUp,
  Check,
  Share2,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Ic } from "./Icons";
import Logo from "./Logo";
import { copyText } from "../utils/clipboard";

/**
 * 🦶 Футери iOS/macOS — glass-карти калон дар мобил, 4 сутун дар desktop.
 * Танҳо UI; логикаи пайвандҳо ва API ҳамон аст.
 */
export default function Footer() {
  const { t, lang, user } = useApp();
  const [copied, setCopied] = useState(false);
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
                     lg:backdrop-blur-none lg:shadow-none lg:p-0 lg:grid lg:grid-cols-2 lg:gap-8"
        >
          {/* 1️⃣ Brand */}
          <section className="space-y-3 lg:space-y-4" style={reveal(0)}>
            <Link to="/" className="inline-flex items-center gap-4" title="donatshop">
              <Logo size={56} />
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

        </div>

        {/* 🔻 Поёнтарин сатр */}
        <div className="mt-6 text-center text-xs text-[var(--ios-label-2)]" style={reveal(120)}>
          © {new Date().getFullYear()} donatshop
        </div>
      </div>
    </footer>
  );
}
