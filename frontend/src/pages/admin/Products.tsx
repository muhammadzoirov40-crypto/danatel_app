import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { Game, Product } from "../../types";
import { useApp } from "../../context/AppContext";

/** Идораи бозиҳо + нархҳо (созиш танҳо бо тоҷикӣ, бо UI-и 4 забон) */
export default function Products() {
  const { t } = useApp();
  const [games, setGames] = useState<Game[]>([]);
  const [active, setActive] = useState<string>("");
  const [detail, setDetail] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.adminGames();
      setGames(d);
      if (!active && d.length) setActive(d[0].slug);
      setErr("");
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    } finally {
      setLoading(false);
    }
  }, [active, t]);

  const loadDetail = useCallback(async () => {
    if (!active) return;
    try {
      setDetail(await api.adminGame(active));
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    }
  }, [active]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);
  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  if (loading)
    return <div className="card h-40 animate-pulse bg-slate-100" />;

  return (
    <div className="space-y-4">
      {err && <div className="card p-4 text-rose-600 text-sm">{err}</div>}
      {msg && (
        <div className="card p-4 text-emerald-700 bg-emerald-50 border-emerald-200 text-sm">
          ✅ {msg}
        </div>
      )}

      {/* Интихоби бозӣ */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {games.map((g) => (
          <button
            key={g.id}
            onClick={() => setActive(g.slug)}
            className={`btn text-xs whitespace-nowrap ${
              active === g.slug
                ? "bg-brand-600 text-white"
                : "bg-white border border-slate-200 text-slate-700"
            }`}
          >
            {g.emoji} {g.name}
          </button>
        ))}
      </div>

      {/* Нархҳо */}
      {detail && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-sm">
            💎 {t("products")} — {detail.emoji} {detail.name}
          </div>

          {(detail.products ?? []).length === 0 ? (
            <div className="p-8 text-center text-slate-500">{t("noProducts")}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(detail.products ?? []).map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  currency={t("currency")}
                  onChange={async (patch) => {
                    try {
                      await api.updateProduct(p.id, patch);
                      await loadDetail();
                      flash("Нарх навсозӣ шуд / Цена обновлена");
                    } catch (e) {
                      setErr((e as Error)?.message ?? t("error"));
                    }
                  }}
                  onDelete={async () => {
                    if (!confirm(`${t("delete")}: ${p.name}?`)) return;
                    try {
                      await api.deleteProduct(p.id);
                      await loadDetail();
                      flash("Ҳазф шуд / Удалено");
                    } catch (e) {
                      setErr((e as Error)?.message ?? t("error"));
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Илова кардани нархи нав */}
      {detail && <AddProduct game={detail} onAdded={loadDetail} flash={flash} />}
    </div>
  );
}

function ProductRow({
  product: p,
  currency,
  onChange,
  onDelete,
}: {
  product: Product;
  currency: string;
  onChange: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [price, setPrice] = useState(String(p.price_tjs));
  const dirty = Number(price) !== Number(p.price_tjs);

  return (
    <div className="px-4 py-3 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[140px]">
        <div className="font-medium text-sm">{p.name}</div>
        <div className="text-xs text-slate-500">ID: {p.amount}</div>
      </div>

      <div className="flex items-center gap-2">
        <input
          className="input !w-28 !py-2 text-sm font-semibold"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <span className="text-xs text-slate-500 whitespace-nowrap">{currency}</span>
      </div>

      <div className="flex gap-1.5 ml-auto">
        <button
          disabled={!dirty}
          onClick={() => onChange({ price_tjs: Number(price) })}
          className="btn-primary text-xs px-3 py-1.5"
        >
          💾
        </button>
        <button onClick={onDelete} className="btn-danger text-xs px-3 py-1.5">
          🗑️
        </button>
      </div>
    </div>
  );
}

function AddProduct({
  game,
  onAdded,
  flash,
}: {
  game: Game;
  onAdded: () => void;
  flash: (m: string) => void;
}) {
  const { t } = useApp();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) {
      setErr(t("requiredField"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await api.createProduct({
        game_id: game.id,
        name_tj: name.trim(),
        price_tjs: Number(price),
        amount: Number(amount || 0),
        is_active: true,
      });
      setName("");
      setPrice("");
      setAmount("");
      onAdded();
      flash("Маҳсулот илова шуд / Товар добавлен");
    } catch (e2) {
      setErr((e2 as Error)?.message ?? t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-4">
      <div className="font-semibold text-sm mb-3">➕ {t("add")}</div>

      {err && (
        <div className="mb-3 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">{t("product")} (TJ)</label>
          <input
            className="input !py-2 text-sm"
            placeholder="100 алмос"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label">{t("price")} ({t("currency")})</label>
          <input
            className="input !py-2 text-sm"
            inputMode="decimal"
            placeholder="100"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div>
          <label className="label">ID / Amount</label>
          <input
            className="input !py-2 text-sm"
            inputMode="numeric"
            placeholder="100"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>

      <button type="submit" disabled={busy} className="btn-primary mt-3 text-sm">
        {busy ? t("loading") : `➕ ${t("add")}`}
      </button>
    </form>
  );
}
