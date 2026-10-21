import { useState } from "react";
import type { Game, Product } from "../types";
import { api, ApiError } from "../api/client";
import { useApp } from "../context/AppContext";

interface Props {
  game: Game;
  onCreated: (orderId: number, paymentUrl?: string | null) => void;
}

/**
 * Формаи фармоиш:
 *   Player ID + интихоби маҳсулот + тугмаи пардохт
 * Responsive: дар мобилӣ якстона, дар десктоп ду сутун.
 */
export default function OrderForm({ game, onCreated }: Props) {
  const { t, lang } = useApp();
  const [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const products = game.products ?? [];

  const submit = async () => {
    setError("");
    if (!playerId.trim() || playerId.trim().length < 2) {
      setError(t("invalidId"));
      return;
    }
    if (!selected) {
      setError(t("requiredField"));
      return;
    }

    setLoading(true);
    try {
      const res = await api.createOrder({
        game_slug: game.slug,
        product_id: selected.id,
        player_id: playerId.trim(),
        player_nickname: nickname.trim() || undefined,
        language: lang,
      });
      onCreated(res.order_id, res.payment_url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4 sm:p-6">
      {/* ID */}
      <div className="mb-4">
        <label className="label">
          {game.player_id_label || t("playerId")} <span className="text-rose-500">*</span>
        </label>
        <input
          className="input font-mono"
          inputMode="numeric"
          placeholder={t("enterPlayerId")}
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
        />
      </div>

      <div className="mb-5">
        <label className="label">{t("playerNickname")}</label>
        <input
          className="input"
          placeholder={t("playerNickname")}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>

      {/* Маҳсулотҳо — сеткаи responsive */}
      <div className="mb-5">
        <label className="label">
          {t("chooseAmount")} <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {products.map((p) => {
            const active = selected?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`relative rounded-xl border-2 p-3 text-left transition
                  ${
                    active
                      ? "border-brand-600 bg-brand-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
              >
                {p.is_popular && (
                  <span className="absolute -top-2 right-2 badge bg-rose-500 text-white">
                    {t("popular")}
                  </span>
                )}
                <div className="font-semibold text-sm leading-tight">{p.name}</div>
                <div className="text-brand-600 font-bold mt-1 text-sm">
                  {Number(p.price_tjs).toLocaleString("tj-TJ")} {t("currency")}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={loading || !selected}
        className="btn-primary w-full py-3.5 text-base"
      >
        {loading ? (
          <>
            <span className="animate-spin">⏳</span> {t("loading")}
          </>
        ) : (
          <>💳 {t("pay")}</>
        )}
      </button>

      <p className="mt-3 text-xs text-slate-500 text-center leading-relaxed">
        🔒 {t("secureNote")}
      </p>
    </div>
  );
}
