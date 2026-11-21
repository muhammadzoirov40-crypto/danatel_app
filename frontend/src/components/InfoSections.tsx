import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Game } from "../types";
import { useApp } from "../context/AppContext";
import SeoBlock from "./SeoBlock";
import { Ic } from "./Icons";
import { ShieldAlert } from "lucide-react";

/**
 * KEEP_BANNER_ON_HOME = false → the yellow security banner moves to About.
 * Set to true only if the owner asks to keep it on Home.
 */
export const KEEP_BANNER_ON_HOME = false;

/**
 * Shared block moved from Home to "Дар бораи мо": the yellow security banner
 * (when moved), divider and the long informational/SEO section.
 * Fetches the game list itself so Home no longer requests it for this block.
 */
export default function InfoSections({ includeBanner = !KEEP_BANNER_ON_HOME }: { includeBanner?: boolean }) {
  const { t, lang } = useApp();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .games(lang)
      .then((d) => {
        if (!alive) return;
        setGames(d);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message ?? t("error"));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [lang, t]);

  return (
    <div className="mt-10 sm:mt-14 space-y-6">
      {includeBanner && (
        <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-4 sm:p-5 text-sm text-amber-900 flex items-center gap-3">
          <Ic icon={ShieldAlert} size="md" className="text-amber-500" />
          <span className="font-medium">{t("secureNote")}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <div className="h-6 w-48 rounded bg-slate-200 animate-pulse" />
          <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        </div>
      ) : error ? null : games.length > 0 ? (
        <SeoBlock games={games} />
      ) : null}
    </div>
  );
}
