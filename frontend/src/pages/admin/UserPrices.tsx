import { useEffect, useMemo, useState } from "react";
import { CircleCheck, Gem, Loader2, RotateCcw, Save, Tag } from "lucide-react";
import { api } from "../../api/client";
import type { AdminUser, UserPriceItem } from "../../types";
import { useApp } from "../../context/AppContext";
import { Ic } from "../../components/Icons";

/**
 * 💰 Нархҳои шахсии ЯК корбар (талаби соҳиб 17.11.2026).
 *
 * Ҳар сатр ду чизро нишон медиҳад:
 *   • НАРХИ КӯҲНА (умумӣ) — products.price_tjs (хондашуда, ғайрифаъол)
 *   • НАРХИ ШАХСИИ (нав)  — input: чӣ қадор ҳамин корбар мепардозад
 * Тугмаи «Нигоҳ доштан» → PUT (баробари нархи кӯҳна → reset-и худкор);
 * ↺ → барқарор ба нархи кӯҳна (DELETE). Ҳангоми сохтани фармоиш ҳамин
 * нархи шахсӣ дар `order.amount_tjs` мемонад → дарвозаҳои тасдиқи
 * пардохт (dc-push / чек / баланс) БЕ ТАҒЙИРИ МАНТИҚ кор мекунанд.
 *
 * Амалҳо: ҳар дархост як дафъа (busy-и сатрӣ), Enter дар input → нигоҳ,
 * aria-label дар ҳар тугма, ҳолати disabled ҳангоми иҷро.
 */
export default function UserPrices({
  user,
  flash,
}: {
  user: AdminUser;
  flash: (m: string) => void;
}) {
  const { t, lang } = useApp();
  const [items, setItems] = useState<UserPriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [active, setActive] = useState("");
  /** product_id → матни воридшуда (холӣ = бе нархи шахсӣ) */
  const [vals, setVals] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .userPrices(user.id, lang)
      .then((list) => {
        if (!alive) return;
        setItems(list);
        setActive((a) => a || list[0]?.game_slug || "");
        const v: Record<number, string> = {};
        for (const it of list) {
          if (it.custom_price_tjs != null) {
            v[it.product_id] = String(it.custom_price_tjs);
          }
        }
        setVals(v);
        setErr("");
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setErr((e as Error)?.message ?? t("error"));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user.id, lang, t]);

  /** Бозии фаъол (чипҳо) — тартиби аввалин маҳсулот */
  const games = useMemo(() => {
    const seen = new Map<
      string,
      { slug: string; name: string; image?: string | null }
    >();
    for (const it of items) {
      if (!seen.has(it.game_slug)) {
        seen.set(it.game_slug, {
          slug: it.game_slug,
          name: it.game_name,
          image: it.game_image_url,
        });
      }
    }
    return [...seen.values()];
  }, [items]);

  const shown = items.filter((i) => i.game_slug === active);

  const patch = (upd: UserPriceItem) =>
    setItems((list) =>
      list.map((x) => (x.product_id === upd.product_id ? upd : x)),
    );

  const dropVal = (productId: number) =>
    setVals((m) => {
      const n = { ...m };
      delete n[productId];
      return n;
    });

  /** 💾 Нигоҳдори: PUT (баробари кӯҳна → backend reset-и худкор мекунад) */
  const save = async (it: UserPriceItem) => {
    const v = parseFloat((vals[it.product_id] ?? "").replace(",", "."));
    if (busy != null || !Number.isFinite(v) || v <= 0) return;
    setBusy(it.product_id);
    try {
      const upd = await api.setUserPrice(user.id, it.product_id, v);
      patch(upd);
      if (upd.custom_price_tjs == null) dropVal(it.product_id);
      flash(t("userPriceSaved"));
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    } finally {
      setBusy(null);
    }
  };

  /** ↺ Барқарорӣ: баргардонидан ба нархи кӯҳна (умумӣ) */
  const reset = async (it: UserPriceItem) => {
    if (busy != null) return;
    setBusy(it.product_id);
    try {
      const upd = await api.resetUserPrice(user.id, it.product_id);
      patch(upd);
      dropVal(it.product_id);
      flash(t("priceResetDone"));
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-sm inline-flex items-center gap-2">
        <Ic icon={Tag} className="text-brand-600" />
        {t("userPricesTitle")} — {user.full_name || user.phone || `#${user.id}`}
      </div>

      {err && (
        <div role="alert" className="px-4 py-2 text-rose-600 text-sm">
          {err}
        </div>
      )}

      {loading ? (
        <div className="p-4">
          <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : (
        <>
          {/* Чипҳои бозӣ */}
          <div
            className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-2"
            role="group"
            aria-label={t("userPricesTitle")}
          >
            {games.map((g) => (
              <button
                key={g.slug}
                type="button"
                onClick={() => setActive(g.slug)}
                aria-pressed={active === g.slug}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${
                  active === g.slug
                    ? "bg-brand-600 text-white"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                }`}
              >
                {g.image ? (
                  <img
                    src={g.image}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="w-4 h-4 rounded object-cover"
                  />
                ) : (
                  <Ic icon={Gem} size="xs" />
                )}
                {g.name}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              {t("noProducts")}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {shown.map((it) => {
                const hasCustom = it.custom_price_tjs != null;
                return (
                  <div
                    key={it.product_id}
                    className="px-4 py-3 flex flex-wrap items-end gap-3"
                  >
                    <div className="flex-1 min-w-[110px]">
                      <div className="font-medium text-sm">{it.name}</div>
                      <div className="text-xs text-slate-500">
                        ID: {it.amount}
                      </div>
                    </div>

                    {/* НАРХИ КӯҲНА (умумӣ) — ҳангоми шахсӣ: кӯҳна паст мешавад */}
                    <div>
                      <span className="mb-1 block text-[10px] leading-none text-slate-500">
                        {t("oldPrice")}
                      </span>
                      <div
                        className={`text-sm font-semibold ${
                          hasCustom
                            ? "text-slate-400 line-through"
                            : "text-slate-700"
                        }`}
                      >
                        {Number(it.base_price_tjs).toFixed(2)} {t("currency")}
                      </div>
                    </div>

                    {/* НАРХИ ШАХСИИ (нав) */}
                    <div>
                      <label
                        htmlFor={`up-${it.product_id}`}
                        className="mb-1 block text-[10px] leading-none text-slate-500"
                      >
                        {t("newPrice")}
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          id={`up-${it.product_id}`}
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min={0.1}
                          value={vals[it.product_id] ?? ""}
                          placeholder={Number(it.base_price_tjs).toFixed(2)}
                          onChange={(e) =>
                            setVals((m) => ({
                              ...m,
                              [it.product_id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void save(it);
                          }}
                          aria-label={`${t("newPrice")} — ${it.name}`}
                          className="input !w-24 !py-2 text-sm font-semibold"
                        />
                        <button
                          type="button"
                          onClick={() => void save(it)}
                          disabled={
                            busy != null || !(vals[it.product_id] ?? "").trim()
                          }
                          aria-label={`${t("save")} — ${it.name}`}
                          title={t("save")}
                          className="btn text-xs bg-brand-600 text-white disabled:opacity-50"
                        >
                          {busy === it.product_id ? (
                            <Loader2
                              className="w-4 h-4 animate-spin"
                              aria-hidden
                            />
                          ) : (
                            <Ic icon={Save} size="xs" />
                          )}
                        </button>
                        {hasCustom && (
                          <button
                            type="button"
                            onClick={() => void reset(it)}
                            disabled={busy != null}
                            aria-label={`${t("priceResetDone")} — ${it.name}`}
                            title={t("priceResetDone")}
                            className="btn text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                          >
                            <Ic icon={RotateCcw} size="xs" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 inline-flex items-center gap-1.5">
            <Ic icon={CircleCheck} size="xs" className="text-emerald-600" />
            {t("userPricesHint")}
          </div>
        </>
      )}
    </div>
  );
}
