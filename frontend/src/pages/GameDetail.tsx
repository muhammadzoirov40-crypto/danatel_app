import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Game } from "../types";
import OrderForm from "../components/OrderForm";
import { useApp } from "../context/AppContext";

/** Саҳифаи тафсилоти бозӣ + формаи фармоиш */
export default function GameDetail() {
  const { slug = "" } = useParams();
  const { t, lang } = useApp();
  const nav = useNavigate();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .game(slug, lang)
      .then((d) => alive && setGame(d))
      .catch((e) => alive && setError(e?.message ?? t("error")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug, lang, t]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="card h-64 animate-pulse bg-slate-100" />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="text-4xl mb-3">😕</div>
        <p className="text-slate-600 mb-6">{error || t("notFound")}</p>
        <Link to="/" className="btn-primary">
          {t("goHome")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <button onClick={() => nav(-1)} className="btn-ghost text-sm mb-5">
        ← {t("back")}
      </button>

      {/* Сарлавҳаи бозӣ */}
      <div className="card p-4 sm:p-6 mb-5 flex items-center gap-4">
        <div className="grid place-items-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-4xl shrink-0">
          {game.emoji}
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold leading-tight">{game.name}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {t("price")}: {t("currency")}
          </p>
        </div>
      </div>

      {/* Форма — мобилӣ: якстона, десктоп: ду сутун */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <OrderForm
            game={game}
            onCreated={(id) => nav(`/order/${id}`)}
          />
        </div>

        {/* Тафсилот / роҳнамо */}
        <aside className="lg:col-span-2 space-y-4">
          <div className="card p-4 sm:p-5">
            <h3 className="font-semibold text-sm mb-3">💡 {t("howItWorks")}</h3>
            <ol className="space-y-3 text-sm">
              {[
                { i: "🆔", txt: t("step2d") },
                { i: "💎", txt: t("chooseAmount") },
                { i: "💳", txt: t("step3d") },
                { i: "🎁", txt: t("step4d") },
              ].map((s, idx) => (
                <li key={idx} className="flex gap-3">
                  <span>{s.i}</span>
                  <span className="text-slate-600">{s.txt}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 flex gap-2">
            <span>⚠️</span>
            <span>{t("secureNote")}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
