import { useEffect, useRef, useState } from "react";
import type { Game, Product, PlayerLookupResponse } from "../types";
import { api, ApiError } from "../api/client";
import { useApp } from "../context/AppContext";
import BankPicker from "./BankPicker";

interface Props {
  game: Game;
  onCreated: (orderId: number, paymentUrl?: string | null) => void;
}

/**
 * Формаи фармоиш:
 *   Player ID + логини автматик ник + интихоби маҳсулот + тугмаи пардохт
 * Responsive: дар мобилӣ якстона, дар десктоп ду сутун.
 */
export default function OrderForm({ game, onCreated }: Props) {
  const { t, lang, user, balance, refreshUser } = useApp();
  const [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [method, setMethod] = useState<"dc" | "balance">("dc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 🔍 Логини ник
  const [nickLookup, setNickLookup] = useState<PlayerLookupResponse | null>(null);
  const [nickLoading, setNickLoading] = useState(false);
  // 🛡️ Идемпотентность — ҳар як клик token-и ягона дорад
  const [clientToken] = useState(() => crypto.randomUUID());
  // 🏦 Кушодани интихоби банк (марҳилаи 2-юм пардохти DC)
  const [showBank, setShowBank] = useState(false);

  const products = game.products ?? [];
  const price = selected ? Number(selected.price_tjs) : 0;
  const canUseBalance = !!user && balance >= price && price > 0;

  // 🔍 Дебаунсинг логини ник (500мс пас аз гузашт навишт)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const uid = playerId.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (uid.length >= 8 && /^\d+$/.test(uid)) {
      setNickLoading(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await api.lookupPlayer(game.slug, uid);
          setNickLookup(res);
          if (res.found && res.nickname && !nickname) {
            // Агар корисвач ник ворид накарда бошад -> автозаполни
            setNickname(res.nickname);
          }
        } catch {
          setNickLookup({ found: false, uid, game: game.slug, nickname: "", region: "", message: "" });
        } finally {
          setNickLoading(false);
        }
      }, 500);
    } else {
      setNickLookup(null);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [playerId, game.slug]);

  /** Сохтани фармоиш дар сервер (муштарак барои баланс ва DC). */
  const createOrder = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await api.createOrder({
        game_slug: game.slug,
        product_id: selected!.id,
        player_id: playerId.trim(),
        player_nickname: nickname.trim() || undefined,
        language: lang,
        payment_method: method === "balance" ? "balance" : "dc_wallet",
        client_token: clientToken,
      });
      // 💰 Баланс кам шуд → навсозӣ кунед
      if (method === "balance") await refreshUser();
      onCreated(res.order_id, res.payment_url);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("error"));
      return false;
    } finally {
      setLoading(false);
    }
  };

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
    // 💰 Санҷиши пешакии баланс дар фронт (backend ҳатмо дубра месанҷад)
    if (method === "balance") {
      if (!user) {
        setError(t("loginForBalance"));
        return;
      }
      if (balance < price) {
        setError(t("insufficientBalance"));
        return;
      }
      await createOrder();
      return;
    }

    // 💳 DC Wallet → аввал интихоби банк (ҳамон усули rent_frow)
    setShowBank(true);
  };

  return (
    <>
    <div className="card p-4 sm:p-6">
      {/* ID */}
      <div className="mb-4 relative">
        <label className="label">
          {game.player_id_label || t("playerId")} <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <input
            className="input font-mono pr-10"
            inputMode="numeric"
            placeholder={t("enterPlayerId")}
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
          />
          {/* Индикатори логини ник */}
          {nickLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-500 animate-pulse" title={t("loading")}>
              🔍
            </span>
          )}
          {nickLookup?.found && !nickLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600" title={nickLookup.nickname}>
              ✅
            </span>
          )}
          {nickLookup?.found === false && !nickLoading && playerId.trim().length >= 8 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600" title={nickLookup.message || t("nicknameNotFound")}>
              ⚠️
            </span>
          )}
        </div>
        {nickLookup?.found && nickLookup.nickname && (
          <div className="mt-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <span>👤</span>
            <span className="font-mono">{nickLookup.nickname}</span>
            {nickLookup.region && <span className="text-emerald-500">({nickLookup.region})</span>}
          </div>
        )}
      </div>

      <div className="mb-5">
        <label className="label">{t("playerNickname")}</label>
        <input
          className="input"
          placeholder={t("playerNickname")}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        {nickLookup?.found && (
          <p className="mt-1 text-xs text-slate-500">
            {t("nicknameFound")}: <strong>{nickLookup.nickname}</strong>
          </p>
        )}
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

      {/* 💳 Усули пардохт */}
      <div className="mb-5">
        <label className="label">{t("choosePayment")}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* DC Wallet */}
          <button
            onClick={() => setMethod("dc")}
            className={`rounded-xl border-2 p-3 text-left transition
              ${
                method === "dc"
                  ? "border-brand-600 bg-brand-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
          >
            <div className="font-semibold text-sm">💳 {t("dcPayment")}</div>
            <div className="text-xs text-slate-500 mt-0.5">{t("payWithDC")}</div>
          </button>

          {/* Баланс */}
          <button
            onClick={() => setMethod("balance")}
            className={`rounded-xl border-2 p-3 text-left transition
              ${
                method === "balance"
                  ? "border-emerald-600 bg-emerald-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
          >
            <div className="font-semibold text-sm">💰 {t("balancePayment")}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {user ? (
                <>
                  {t("currentBalance")}:{" "}
                  <span className={balance >= price ? "text-emerald-600" : "text-rose-600"}>
                    {balance.toLocaleString("tj-TJ")} {t("currency")}
                  </span>
                </>
              ) : (
                t("loginForBalance")
              )}
            </div>
          </button>
        </div>

        {/* Огоҳиномаи баланс */}
        {method === "balance" && user && price > 0 && !canUseBalance && (
          <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            ⚠️ {t("insufficientBalance")} — {t("currentBalance")}: {balance.toLocaleString("tj-TJ")} /{" "}
            {t("total")}: {price.toLocaleString("tj-TJ")} {t("currency")}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={loading || !selected || (method === "balance" && !canUseBalance)}
        className="btn-primary w-full py-3.5 text-base"
      >
        {loading ? (
          <>
            <span className="animate-spin">⏳</span> {t("loading")}
          </>
        ) : method === "balance" ? (
          <>💰 {t("payFromBalance")}</>
        ) : (
          <>💳 {t("pay")}</>
        )}
      </button>

      <p className="mt-3 text-xs text-slate-500 text-center leading-relaxed">
        🔒 {t("secureNote")}
      </p>
    </div>

    {/* 🏦 Интихоби банк — танҳо барои пардохти DC */}
    {showBank && (
      <BankPicker
        price={price}
        loading={loading}
        onConfirm={async () => {
          const ok = await createOrder();
          // Агар хато шуд → модалка мепӯшад, хато дар корт нишон дода мешавад
          if (!ok) setShowBank(false);
        }}
        onClose={() => setShowBank(false)}
      />
    )}
    </>
  );
}

// 🔧 Helper: рақам ёки не?
function isDigitString(s: string): boolean {
  return /^\d+$/.test(s);
}