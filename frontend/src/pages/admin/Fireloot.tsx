import { useEffect, useMemo, useState } from "react";
import { Flame, Loader2, RefreshCw, Search, TriangleAlert, Wallet } from "lucide-react";
import { api, ApiError } from "../../api/client";
import { useApp } from "../../context/AppContext";
import { Ic } from "../../components/Icons";
import type { FirelootBalance, FirelootItem } from "../../types";

/**
 * 🔥 FireLoot — ҳамон чизе, ки дар шарикии FireLoot мебинед:
 *   • Баланси ҳисоб ($) — воқеӣ аз API
 *   • Каталоги воқеӣ: ҳамаи бозиҳо/минтақаҳо бо нархи $
 *   • Нархи шумо (сомонӣ) + таъинот «Сомонӣ / $» — аз рӯи sku пайваст
 *   • Ҳамоҳангсозӣ: минтақаи нав дар каталог → бо тугма сохта мешавад
 */
export default function Fireloot() {
  const { t } = useApp();
  const [bal, setBal] = useState<FirelootBalance | null>(null);
  const [items, setItems] = useState<FirelootItem[]>([]);
  const [manual, setManual] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState<string | null>(null);
  // 🗂 Филтрҳо
  const [game, setGame] = useState("");
  const [region, setRegion] = useState("");
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [b, c] = await Promise.all([api.flBalance(), api.flCatalog()]);
      setBal(b);
      setItems(c.items);
      setManual(c.manual);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 🎮 Бозиҳои каталог (аз худи маълумот) */
  const games = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.game, (m.get(it.game) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  /** 🌍 Минтақаҳои бозии интихобшуда */
  const regions = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      if (game && it.game !== game) continue;
      m.set(it.region, (m.get(it.region) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items, game]);

  /** 📚 Сатрҳои нишондодашуда */
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(
      (it) =>
        (!game || it.game === game) &&
        (!region || it.region === region) &&
        (!s || it.name.toLowerCase().includes(s) || it.sku.toLowerCase().includes(s)),
    );
  }, [items, game, region, q]);

  /** 🔄 Ҳамоҳангсозии фаврӣ (минтақаҳои нав аз каталог) */
  const sync = async () => {
    setSyncing(true);
    setSynced(null);
    try {
      const r = await api.flSync();
      setSynced(
        `+${r.created} ${t("flNew")} · ${r.adopted} ${t("region")} · ${r.attached} SKU`,
      );
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("error"));
    } finally {
      setSyncing(false);
    }
  };

  const matched = items.filter((i) => i.tjs != null).length;

  return (
    <div className="space-y-5">
      {/* 💰 Баланси FireLoot — воқеӣ аз API */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-bold inline-flex items-center gap-2">
            <Ic icon={Wallet} />
            {t("flBalance")}
          </h2>
          <button onClick={sync} disabled={syncing || loading} className="btn text-sm">
            {syncing ? (
              <Ic icon={Loader2} className="animate-spin" />
            ) : (
              <Ic icon={RefreshCw} />
            )}
            {t("flSync")}
          </button>
        </div>

        {loading && !bal ? (
          <div className="mt-3 text-sm text-slate-500 inline-flex items-center gap-2">
            <Ic icon={Loader2} className="animate-spin" /> {t("loading")}
          </div>
        ) : bal ? (
          <div className="mt-3 flex items-end gap-4 flex-wrap">
            <span className="text-3xl font-extrabold text-emerald-600">
              ${Number(bal.balance ?? 0).toLocaleString("en-US")}
            </span>
            <span className="text-sm text-slate-500 pb-1">{bal.currency}</span>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                bal.telegram_active
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              Telegram:{" "}
              {bal.telegram_active ? t("flTgActive") : t("flTgInactive")}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              ⭐ {Number(bal.stars_balance ?? 0).toLocaleString("en-US")}
            </span>
          </div>
        ) : null}

        {synced && (
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
            {t("flSynced")} {synced}
          </div>
        )}
        {err && (
          <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700 inline-flex items-center gap-2">
            <Ic icon={TriangleAlert} /> {err}
          </div>
        )}
      </div>

      {/* 📚 Каталоги воқеӣ + нархи шумо */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="font-bold inline-flex items-center gap-2">
            <Ic icon={Flame} />
            {t("flCatalog")}
          </h2>
          <div className="flex gap-2 flex-wrap text-xs">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              {items.length} {t("statProducts")}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
              {matched} {t("flYours")}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
              {manual} {t("flManual")}
            </span>
          </div>
        </div>

        {/* Филтрҳо */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          <select
            className="input text-sm"
            value={game}
            onChange={(e) => {
              setGame(e.target.value);
              setRegion("");
            }}
            aria-label={t("game")}
          >
            <option value="">{t("game")}</option>
            {games.map(([slug, n]) => (
              <option key={slug} value={slug}>
                {slug} ({n})
              </option>
            ))}
          </select>
          <select
            className="input text-sm"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            aria-label={t("region")}
          >
            <option value="">{t("region")}</option>
            {regions.map(([reg, n]) => (
              <option key={reg} value={reg}>
                {reg} ({n})
              </option>
            ))}
          </select>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Ic icon={Search} />
            </span>
            <input
              className="input text-sm pl-9"
              placeholder={t("search")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-500 inline-flex items-center gap-2 justify-center w-full">
            <Ic icon={Loader2} className="animate-spin" /> {t("loading")}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-slate-500">{t("notFound")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="text-left px-3 py-2 font-semibold">{t("product")}</th>
                  <th className="text-left px-3 py-2 font-semibold">{t("region")}</th>
                  <th className="text-right px-3 py-2 font-semibold">$</th>
                  <th className="text-right px-3 py-2 font-semibold">
                    {t("currency")} · {t("flYours")}
                  </th>
                  <th className="text-right px-3 py-2 font-semibold">{t("flRate")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((it) => (
                  <tr
                    key={it.sku}
                    className={`border-b border-slate-100 ${
                      it.tjs == null ? "text-slate-400" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{it.name}</div>
                      <div className="text-xs text-slate-400">
                        {it.game} · {it.category} · {it.sku}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">{it.region}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      ${it.usd.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {it.tjs != null ? (
                        `${Number(it.tjs).toLocaleString("tj-TJ")} ${t("currency")}`
                      ) : (
                        <span className="text-xs font-normal">{t("flNoMatch")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {it.rate != null ? it.rate.toFixed(2) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
