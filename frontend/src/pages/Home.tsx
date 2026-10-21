import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Game } from "../types";
import GameCard from "../components/GameCard";
import { useApp } from "../context/AppContext";

/** Саҳифаи асосӣ — рӯйхати бозиҳо + "Чӣ тавр кор мекунад" */
export default function Home() {
  const { t, lang } = useApp();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .games(lang)
      .then((d) => alive && setGames(d))
      .catch((e) => alive && setError(e?.message ?? t("error")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [lang, t]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      {/* Тақриб */}
      <section className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
          {t("chooseGame")}
        </h1>
        <p className="text-slate-500 mt-2 text-sm sm:text-base">{t("tagline")}</p>
      </section>

      {/* Бозиҳо */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card h-40 animate-pulse bg-slate-100" />
          ))}
        </div>
      )}

      {error && (
        <div className="card p-6 text-center text-rose-600">
          <div className="text-3xl mb-2">⚠️</div>
          {error}
          <div className="mt-4">
            <button className="btn-ghost" onClick={() => location.reload()}>
              {t("retry")}
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}

      {/* Чӣ тавр кор мекунад */}
      <section className="mt-12 sm:mt-16">
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-6">
          {t("howItWorks")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { n: 1, icon: "🎮" },
            { n: 2, icon: "🆔" },
            { n: 3, icon: "💳" },
            { n: 4, icon: "🎁" },
          ].map((s) => (
            <div key={s.n} className="card p-5 text-center">
              <div className="grid place-items-center w-11 h-11 mx-auto rounded-full bg-brand-50 text-xl mb-3">
                {s.icon}
              </div>
              <div className="font-semibold text-sm mb-1">{t(`step${s.n}`)}</div>
              <div className="text-xs text-slate-500 leading-relaxed">
                {t(`step${s.n}d`)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Огоҳиномаи бехатарӣ */}
      <div className="mt-8 rounded-2xl bg-amber-50 border border-amber-200 p-4 sm:p-5 text-sm text-amber-900 flex gap-3">
        <span className="text-xl">⚠️</span>
        <span>{t("secureNote")}</span>
      </div>
    </div>
  );
}
