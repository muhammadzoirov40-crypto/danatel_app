import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CircleCheck, DollarSign, Gamepad2, Gem, Loader2, Percent, Plus, Save, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import type { Game, Product } from "../../types";
import { useApp } from "../../context/AppContext";
import { Ic } from "../../components/Icons";

/** Логотипи хурди бозӣ дар тугмаи интихоб (ҷои emoji-и базаи маълумот) */
function GameChipLogo({ g }: { g: Game }) {
  const [failed, setFailed] = useState(false);
  if (g.image_url && !failed) {
    return (
      <img
        src={g.image_url}
        alt=""
        aria-hidden
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-4 h-4 rounded object-cover shrink-0"
      />
    );
  }
  return <Ic icon={Gamepad2} size="xs" />;
}

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
      // 📚 Версияи КОМИЛ: + sku + cost_tjs (нархи харид барои фоида)
      setDetail(await api.adminGameFull(active));
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

  /** 🔥 Нархи FireLoot ($) барои ҳамаи sku — як дафъа аз каталоги воқеӣ */
  const [flUsd, setFlUsd] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    api
      .flCatalog()
      .then((c) => {
        if (!alive) return;
        const m: Record<string, number> = {};
        for (const it of c.items) if (it.usd > 0) m[it.sku] = it.usd;
        setFlUsd(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  /** 💱 Як рақам (%) → ҳамаи нархҳо иваз мешаванд:
   *  mode="current" аз нархи ҷорӣ · mode="cost" аз НАРХИ ХАРИД (пойдор) */
  const [pct, setPct] = useState("");
  const [pctMode, setPctMode] = useState<"current" | "cost">("current");
  const [pctBusy, setPctBusy] = useState(false);
  const applyPercent = async () => {
    const v = parseFloat(pct.replace(",", "."));
    if (!Number.isFinite(v) || v < -95 || v > 1000 || pctBusy) return;
    setPctBusy(true);
    try {
      const r = await api.adjustPrices(v, pctMode);
      flash(t("priceBulkDone").replace("{n}", String(r.updated)));
      await loadDetail();
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    } finally {
      setPctBusy(false);
    }
  };

  /** 💲 Нархи харид = FireLoot $ × курс — як рақам → ҳамаи sku-дорҳо */
  const [rate, setRate] = useState("");
  const [rateBusy, setRateBusy] = useState(false);
  const fillFromFl = async () => {
    const r = parseFloat(rate.replace(",", "."));
    if (!Number.isFinite(r) || r <= 0 || r > 10000 || rateBusy) return;
    setRateBusy(true);
    try {
      const res = await api.fillCosts(r);
      flash(t("fillCostsDone").replace("{n}", String(res.updated)));
      await loadDetail();
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    } finally {
      setRateBusy(false);
    }
  };

  if (loading)
    return <div className="card h-40 animate-pulse bg-slate-100" />;

  return (
    <div className="space-y-4">
      {err && <div className="card p-4 text-rose-600 text-sm">{err}</div>}
      {msg && (
        <div className="card p-4 text-emerald-700 bg-emerald-50 border-emerald-200 text-sm inline-flex items-center gap-2">
          <Ic icon={CircleCheck} />
          {msg}
        </div>
      )}

      {/* 💱 Як рақам (%) → асос: ҷорӣ ё ХАРИД + 💲 пуркуниҳо аз FireLoot $ */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-700 inline-flex items-center gap-2">
            <Ic icon={Percent} className="text-brand-600" />
            {t("priceBulkLabel")}
          </span>
          {/* Ҳолат: аз нархи ҷорӣ | аз нархи харид (0% фоиз — пойдор) */}
          <div
            className="flex rounded-lg border border-slate-200 overflow-hidden"
            role="group"
            aria-label={t("priceBulkLabel")}
          >
            <button
              type="button"
              onClick={() => setPctMode("current")}
              aria-pressed={pctMode === "current"}
              className={`px-2.5 py-1.5 text-[11px] font-semibold ${
                pctMode === "current"
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t("priceModeCurrent")}
            </button>
            <button
              type="button"
              onClick={() => setPctMode("cost")}
              aria-pressed={pctMode === "cost"}
              className={`px-2.5 py-1.5 text-[11px] font-semibold border-l border-slate-200 ${
                pctMode === "cost"
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t("priceModeCost")}
            </button>
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={-95}
            max={1000}
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            placeholder="%"
            aria-label={t("priceBulkLabel")}
            className="input !w-24 !py-2 text-sm font-semibold"
          />
          <button
            type="button"
            onClick={() => void applyPercent()}
            disabled={pct === "" || pctBusy}
            className="btn text-xs bg-brand-600 text-white disabled:opacity-50"
          >
            {pctBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <Ic icon={Percent} size="xs" />
            )}
            {t("priceBulkApply")}
          </button>
          <span className="text-xs text-slate-500 basis-full sm:basis-auto">
            {pctMode === "cost" ? t("priceBulkCostHint") : t("priceBulkHint")}
          </span>
        </div>

        {/* 💲 Нархи харид = FireLoot $ × курс (барои фоида + «аз харид») */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="fl-rate" className="label !mb-1 block">
              {t("fillRate")}
            </label>
            <input
              id="fl-rate"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0.01}
              max={10000}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.00"
              className="input !w-28 !py-2 text-sm font-semibold"
            />
          </div>
          <button
            type="button"
            onClick={() => void fillFromFl()}
            disabled={rate === "" || rateBusy}
            className="btn text-xs bg-emerald-600 text-white disabled:opacity-50"
          >
            {rateBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <Ic icon={DollarSign} size="xs" />
            )}
            {t("fillCosts")}
          </button>
          <span className="text-xs text-slate-500 basis-full">
            {t("costLabel")} = FireLoot $ × {t("fillRate").toLowerCase()}
          </span>
        </div>
      </div>

      {/* Интихоби бозӣ */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {games.map((g) => (
          <button
            key={g.id}
            onClick={() => setActive(g.slug)}
            aria-pressed={active === g.slug}
            className={`btn text-xs whitespace-nowrap ${
              active === g.slug
                ? "bg-brand-600 text-white"
                : "bg-white border border-slate-200 text-slate-700"
            }`}
          >
            <GameChipLogo g={g} />
            {g.name}
          </button>
        ))}
      </div>

      {/* Нархҳо */}
      {detail && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-sm inline-flex items-center gap-2">
            <Ic icon={Gem} className="text-brand-600" />
            {t("products")} — {detail.name}
          </div>

          {(detail.products ?? []).length === 0 ? (
            <div className="p-8 text-center text-slate-500">{t("noProducts")}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(detail.products ?? []).map((p) => (
                <ProductRow
                  /* key бо нархҳо → баъд аз bulk-ивазкунии берунӣ input-ҳо
                     нав мешаванд (қаблан кӯҳна мемонид) */
                  key={`${p.id}-${p.price_tjs}-${p.cost_tjs ?? 0}`}
                  product={p}
                  currency={t("currency")}
                  flUsd={p.sku ? flUsd[p.sku] : undefined}
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
  flUsd,
  onChange,
  onDelete,
}: {
  product: Product;
  currency: string;
  /** 💲 Нархи воқеии FireLoot ($) барои ин sku (аз каталоги воқеӣ) */
  flUsd?: number;
  onChange: (patch: Record<string, unknown>) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [price, setPrice] = useState(String(p.price_tjs));
  /** 💲 Нархи харид — 0/холӣ = ворид нашудааст (фаида ҳисоб намешавад) */
  const [cost, setCost] = useState(p.cost_tjs ? String(p.cost_tjs) : "");
  const [busy, setBusy] = useState<"save" | "del" | null>(null);
  const { t } = useApp();
  const dirty =
    Number(price) !== Number(p.price_tjs) ||
    Number(cost || 0) !== Number(p.cost_tjs || 0);

  /** Амал бо ҳолати busy → аз фиристодани дархости такрорӣ пешгирӣ мекунад */
  const run = async (kind: "save" | "del", fn: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-4 py-3 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[140px]">
        <div className="font-medium text-sm">{p.name}</div>
        <div className="text-xs text-slate-500">
          ID: {p.amount}
          {p.sku && (
            <span className="ml-1.5 inline-block rounded-md border border-orange-200 bg-orange-50 px-1.5 py-0.5 font-semibold text-orange-600">
              FireLoot: {flUsd !== undefined ? `$${flUsd}` : p.sku}
            </span>
          )}
        </div>
      </div>

      {/* Фурӯш + Харид (нархи харид → фоида ва %-и «аз харид») */}
      <div className="flex items-end gap-2">
        <div>
          <span className="mb-1 block text-[10px] leading-none text-slate-500">
            {t("sellLabel")}
          </span>
          <div className="flex items-center gap-1">
            <input
              className="input !w-24 !py-2 text-sm font-semibold"
              inputMode="decimal"
              aria-label={`${t("sellLabel")} — ${p.name}`}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {currency}
            </span>
          </div>
        </div>
        <div>
          <span className="mb-1 block text-[10px] leading-none text-slate-500">
            {t("costLabel")}
          </span>
          <div className="flex items-center gap-1">
            <input
              className="input !w-24 !py-2 text-sm"
              inputMode="decimal"
              aria-label={`${t("costLabel")} — ${p.name}`}
              value={cost}
              placeholder="0"
              onChange={(e) => setCost(e.target.value)}
            />
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {currency}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 ml-auto">
        <button
          disabled={!dirty || busy !== null}
          onClick={() =>
            void run("save", () =>
              onChange({
                price_tjs: Number(price),
                cost_tjs: Number(cost || 0),
              }),
            )
          }
          aria-label={t("save")}
          title={t("save")}
          className="btn-primary text-xs px-3 py-1.5"
        >
          <Ic icon={Save} size="xs" />
        </button>
        <button
          disabled={busy !== null}
          onClick={() => void run("del", onDelete)}
          aria-label={t("delete")}
          title={t("delete")}
          className="btn-danger text-xs px-3 py-1.5"
        >
          <Ic icon={Trash2} size="xs" />
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
      <div className="font-semibold text-sm mb-3 inline-flex items-center gap-2">
        <Ic icon={Plus} className="text-brand-600" />
        {t("add")}
      </div>

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
        {busy ? (
          <>
            <Ic icon={Loader2} className="animate-spin" /> {t("loading")}
          </>
        ) : (
          <>
            <Ic icon={Plus} />
            {t("add")}
          </>
        )}
      </button>
    </form>
  );
}
