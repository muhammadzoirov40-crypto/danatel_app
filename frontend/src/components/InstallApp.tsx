import { useEffect, useState } from "react";
import { Check, Download, Smartphone } from "lucide-react";
import { useApp } from "../context/AppContext";
import { httpsUrl } from "../utils/https";

/**
 * 📦 Блоки насби барнома (PWA) дар Профил.
 *
 * Воқеӣ ва бе ягон сохтакорӣ:
 *   • Android/Chrome → `beforeinstallprompt` → тугмаи «Нусха ба телефон»
 *     → prompt() (ҳамон муколамаи худи браузер);
 *   • iPhone/Safari → `beforeinstallprompt` НЕСТ → дастур:
 *     Мубодила (Share) → «Илова кардан ба экран»;
 *   • аллакай насб шудааст (display-mode: standalone / navigator.standalone)
 *     → нишонаи «насб шудааст»;
 *   • дар http:// (без HTTPS) → линки HTTPS (PWA танҳо дар secure context).
 * Service Worker фақат дар HTTPS кор мекунад → ҳамаи роҳҳо ба он мебаранд.
 */

/** Рӯйдоди муколамаи насби браузер (BeforeInstallPromptEvent) */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function isIos(): boolean {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ худро Mac ҳамчун нишон медиҳад, вале touch дорад
  return /Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
}

export function isStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari
  return (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export default function InstallApp() {
  const { t } = useApp();
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // инфишори худкори Chrome-ро мебандем — тугмаи мо кор мекунад
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred || busy) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
    } catch {
      /* браузер рад кард → ҳолати пешина мемонад */
    } finally {
      setBusy(false);
    }
  };

  const insecure = !window.isSecureContext;
  const ios = isIos();

  // Ҳеҷ роҳи насб нест (масалан Firefox-и десктоп) → блок нишон дода намешавад
  if (!installed && !insecure && !ios && !deferred) return null;

  return (
    <section className="glass rounded-2xl p-4" aria-label={t("appSectionTitle")}>
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-400 text-white shadow-lg shadow-brand-500/25"
        >
          {installed ? <Check size={20} /> : <Smartphone size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold tracking-tight">
            {t("appSectionTitle")}
          </div>
          <div className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {installed ? t("appInstalled") : t("appInstallDesc")}
          </div>

          {/* 🔗 http:// → HTTPS (PWA танҳо дар secure context) */}
          {insecure && (
            <a
              href={httpsUrl()}
              className="btn-primary mt-3 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm"
            >
              <Download size={16} aria-hidden />
              {t("faceOpenHttps")}
            </a>
          )}

          {/* 🍎 iPhone/Safari → дастури «Add to Home Screen» */}
          {!insecure && ios && !installed && (
            <p className="mt-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 dark:bg-white/5 dark:text-slate-300">
              🍎 {t("appIosHint")}
            </p>
          )}

          {/* 🤖 Android/Chrome → тугмаи воқеии насб */}
          {!insecure && !ios && !installed && deferred && (
            <button
              type="button"
              onClick={() => void install()}
              disabled={busy}
              className="btn-primary mt-3 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} aria-hidden />
              {t("appInstallBtn")}
            </button>
          )}

          {/* ✅ Аллакай насб шудааст */}
          {installed && (
            <div
              role="status"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            >
              <Check size={14} aria-hidden />
              {t("appInstalled")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
