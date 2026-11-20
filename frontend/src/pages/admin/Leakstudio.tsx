import { useCallback, useEffect, useState } from "react";
import { Heart, Loader2, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { api, ApiError } from "../../api/client";
import { useApp } from "../../context/AppContext";
import { Ic } from "../../components/Icons";
import type { Game, LeakstudioPackage } from "../../types";

/**
 * 🎯 Leak Studio BD — бастаҳои воқеӣ аз API (нархи BDT) + иловаи маҳсулот.
 *
 * Нархҳо МИСЛИ FIRELOOT (талаби соҳиб 20.11.2026 «narhoro misli FireLoot kun»):
 *   • Харид  = BDT × курс (BDT → сом)  → `cost_tjs` дар маҳсулот низ мемонад
 *   • Фурӯш = нархи TJS (соҳиб мегузорад)
 *   • Фоида  = фурӯш − харид (зинда ҳисоб мешавад)
 * Курс: аввал аз localStorage, вагарна ВОҚЕӢ аз API-и курси байналмилалӣ
 * (open.er-api.com, CORS кушода) — рақами сохта ҳеҷ гоҳ гузошта намешавад.
 * Ҳамаи рақамҳои BDT воқеӣ аз Leak Studio API (20.11.2026).
 */
const KINDS: { key: string; titleKey: string }[] = [
  { key: "likes", titleKey: "kindLikes" },
  { key: "auto_likes", titleKey: "kindAutoLikes" },
  { key: "levelup", titleKey: "kindLevelup" },
];

/** 💲 Курси нигоҳдорӣ: BDT барои 1 сомонӣ (самти «бо сомонӣ», талаби соҳиб) */
const RATE_KEY = "ls_bdt_per_som";

/** Ҳисоби харид = BDT × курс (то 2 рақам — пули воқеӣ) */
function costOf(bdt: number, rate: number): number {
  if (!(bdt > 0) || !(rate > 0)) return 0;
  return Math.round(bdt * rate * 100) / 100;
}

export default function Leakstudio() {
  const { t } = useApp();
  const [packages, setPackages] = useState<Record<string, LeakstudioPackage[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [games, setGames] = useState<Game[]>([]);
  const [gameSlug, setGameSlug] = useState("free-fire");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  // 💲 Курси ду тарафа (талаби соҳиб 20.11.2026 «курсро бо сомонӣ кун»):
  //    A = «1 сомонӣ = чанд BDT» (вуруд) · B = «1 BDT = чанд сомонӣ» (харид)
  const [bdtPerSom, setBdtPerSom] = useState("");
  const [somPerBdt, setSomPerBdt] = useState("");
  const [market, setMarket] = useState<{ a: number; b: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [ls, gs] = await Promise.all([api.lsPackages(), api.adminGames()]);
      setPackages(ls.packages ?? {});
      setErrors(ls.errors ?? {});
      setGames(gs);
      if (gs.length && !gs.some((g) => g.slug === gameSlug)) {
        setGameSlug(gs[0].slug);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("error"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 💲 Курс: нигоҳдоштаи браузер (самти нав) → вагарна ВОҚЕӢ аз API-и курс.
      Хатои формати кӯҳна («1 BDT = … сом», 20.11.2026) пок мешавад. */
  useEffect(() => {
    const r6 = (x: number) => Number(x.toFixed(6));
    const saved = Number(window.localStorage.getItem(RATE_KEY) || 0);
    if (saved > 0) {
      setBdtPerSom(String(r6(saved)));
      setSomPerBdt(String(r6(1 / saved)));
    } else {
      window.localStorage.removeItem("ls_bdt_rate"); // кӯҳнаи самти баръакс
    }
    let alive = true;
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => {
        const rt = (d as { rates?: { TJS?: number; BDT?: number } } | null)
          ?.rates;
        const a =
          rt && typeof rt.TJS === "number" && typeof rt.BDT === "number" && rt.TJS > 0 && rt.BDT > 0
            ? rt.BDT / rt.TJS
            : NaN;
        if (!alive || !(a > 0)) return;
        setMarket({ a: r6(a), b: r6(1 / a) }); // сарчашаи воқеӣ + сана дар поён
        if (!(saved > 0)) {
          setBdtPerSom(String(r6(a)));
          setSomPerBdt(String(r6(1 / a)));
        }
      })
      .catch(() => undefined); // сет хомӯш — админ дастӣ мегузорад
    return () => {
      alive = false;
    };
  }, []);

  /** Ҳисоби харид аз майдони B («1 BDT = чанд сомонӣ» — ҳамон курс) */
  const rateN = Number((somPerBdt || "").replace(",", ".")) || 0;

  /** A: «1 сомонӣ = чанд BDT» → B = 1/A (зинда) */
  const onSomSide = (v: string) => {
    setBdtPerSom(v);
    const n = Number(v.replace(",", "."));
    if (n > 0) {
      setSomPerBdt(String(Number((1 / n).toFixed(6))));
      window.localStorage.setItem(RATE_KEY, String(n));
    } else {
      setSomPerBdt("");
    }
  };

  /** B: «1 BDT = чанд сомонӣ» → A = 1/B (зинда) */
  const onBdtSide = (v: string) => {
    setSomPerBdt(v);
    const n = Number(v.replace(",", "."));
    if (n > 0) {
      const a = Number((1 / n).toFixed(6));
      setBdtPerSom(String(a));
      window.localStorage.setItem(RATE_KEY, String(a));
    } else {
      setBdtPerSom("");
    }
  };

  /** ➕ Иловаи баста → маҳсулоти воқеӣ: харид = BDT × курс, фурӯш = TJS */
  const add = async (kind: string, pkg: LeakstudioPackage) => {
    const pk = String(pkg.id ?? pkg.name ?? pkg.code ?? "");
    const key = `${kind}:${pk}`;
    const price = Number((prices[key] ?? "").replace(",", "."));
    const game = games.find((g) => g.slug === gameSlug);
    if (!game) return;
    if (!price || price <= 0) {
      setMsg(t("requiredField"));
      window.setTimeout(() => setMsg(""), 3000);
      return;
    }
    setCreating(key);
    setMsg("");
    try {
      const likes = Number(pkg.likes || 0);
      const days = Number(pkg.days || 0);
      const bdt = Number(String(pkg.price ?? "").replace(",", "."));
      const cost = costOf(Number.isFinite(bdt) ? bdt : 0, rateN);
      const label =
        kind === "likes" && likes
          ? `${likes} ${t("unitLikes")}`
          : kind === "auto_likes" && days
            ? `${days} ${t("unitDays")} ${t("kindAutoLikes")}`
            : String(pkg.display_name || pkg.name || pkg.code || "");
      await api.createProduct({
        game_id: game.id,
        name_tj: label,
        price_tjs: price,
        cost_tjs: cost,
        amount: kind === "likes" ? likes : kind === "auto_likes" ? days : 0,
        is_active: true,
        provider: "leakstudio",
        ls_kind: kind,
        // likes: миқдор аз `amount` (ID лозим нест); боқӣ → id/коди баста
        sku: kind === "likes" ? "" : pk,
      });
      setMsg("Маҳсулот илова шуд / Товар добавлен");
      window.setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : t("error"));
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* 🎯 Сарлавҳа + санҷиш */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-bold inline-flex items-center gap-2">
            <Ic icon={Heart} className="text-rose-500" />
            Leak Studio BD
          </h2>
          <button onClick={() => void load()} disabled={loading} className="btn text-sm">
            {loading ? (
              <Ic icon={Loader2} className="animate-spin" />
            ) : (
              <Ic icon={RefreshCw} />
            )}
            {t("refresh")}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">{t("lsNote")}</p>

        {msg && (
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
            {msg}
          </div>
        )}
        {err && (
          <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700 inline-flex items-center gap-2">
            <Ic icon={TriangleAlert} /> {err}
          </div>
        )}
        {Object.keys(errors).length > 0 && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            {Object.entries(errors).map(([k, v]) => (
              <div key={k}>
                {k}: {v}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 💲 Курси харид — БО СОМОНӢ: 1 сомонӣ = чанд BDT (+ оинаи BDT → сом) */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="ls-a" className="label !mb-1 block">
              1 {t("currency")} =
            </label>
            <input
              id="ls-a"
              type="number"
              inputMode="decimal"
              step="0.000001"
              min={0.000001}
              value={bdtPerSom}
              onChange={(e) => onSomSide(e.target.value)}
              placeholder="0.000000"
              aria-label={`1 ${t("currency")} = BDT`}
              className="input !w-32 !py-2 text-sm font-semibold"
            />
            <span className="mt-1 block text-[10px] leading-none text-slate-500">
              BDT
            </span>
          </div>
          <div>
            <label htmlFor="ls-b" className="label !mb-1 block">
              1 BDT =
            </label>
            <input
              id="ls-b"
              type="number"
              inputMode="decimal"
              step="0.000001"
              min={0.000001}
              value={somPerBdt}
              onChange={(e) => onBdtSide(e.target.value)}
              placeholder="0.000000"
              aria-label={`1 BDT = ${t("currency")}`}
              className="input !w-32 !py-2 text-sm font-semibold"
            />
            <span className="mt-1 block text-[10px] leading-none text-slate-500">
              {t("currency")}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {t("costLabel")} = BDT × {t("lsRate")}
          {market && (
            <span className="text-slate-400">
              {" · "}
              {t("lsMarket")}: 1 {t("currency")} = {market.a} BDT · 1 BDT ={" "}
              {market.b} {t("currency")}
            </span>
          )}
        </p>

        <div className="mt-3 pt-3 border-t border-slate-100">
          <label className="label">{t("game")}</label>
          <select
            className="input text-sm"
            value={gameSlug}
            onChange={(e) => setGameSlug(e.target.value)}
            aria-label={t("game")}
          >
            {games.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name || g.slug}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 📦 Бастаҳои воқеӣ: харид (BDT×курс) → фурӯш (TJS) → фоида */}
      {loading ? (
        <div className="py-10 text-center text-slate-500 inline-flex items-center gap-2 justify-center w-full card">
          <Ic icon={Loader2} className="animate-spin" /> {t("loading")}
        </div>
      ) : (
        KINDS.filter((k) => (packages[k.key] ?? []).length > 0).map(({ key, titleKey }) => (
          <div key={key} className="card p-5">
            <h3 className="font-bold mb-3 inline-flex items-center gap-2">
              <Ic icon={Heart} size="sm" className="text-rose-500" />
              {t(titleKey)}
              <span className="text-xs font-normal text-slate-400">
                ({(packages[key] ?? []).length})
              </span>
            </h3>
            <div className="space-y-2">
              {(packages[key] ?? []).map((pkg, i) => {
                const pk = String(pkg.id ?? pkg.name ?? pkg.code ?? i);
                const k = `${key}:${pk}`;
                const bdt = Number(String(pkg.price ?? "").replace(",", "."));
                const hasBdt = Number.isFinite(bdt) && bdt > 0;
                const cost = costOf(hasBdt ? bdt : 0, rateN);
                const price = Number((prices[k] ?? "").replace(",", ".")) || 0;
                const profit = price > 0 && cost >= 0 ? Math.round((price - cost) * 100) / 100 : null;
                return (
                  <div
                    key={k}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1 basis-48">
                      <div className="text-sm font-medium text-slate-800 truncate">
                        {String(pkg.display_name || pkg.name || pkg.code || pk)}
                      </div>
                      <div className="text-xs text-slate-500 tabular-nums">
                        {key === "likes" && pkg.likes != null && (
                          <span>{pkg.likes} {t("unitLikes")} · </span>
                        )}
                        {key === "auto_likes" && (
                          <span>
                            {pkg.days != null && `${pkg.days} ${t("unitDays")} · `}
                            {pkg.likes_per_day != null && `${pkg.likes_per_day}/${t("unitDays")} · `}
                          </span>
                        )}
                        {pkg.server != null && <span>{pkg.server} · </span>}
                        <span className="font-semibold text-emerald-700">
                          {hasBdt ? `${bdt} BDT` : "—"}
                        </span>
                        {hasBdt && rateN > 0 && (
                          <span className="text-slate-600">
                            {" · "}
                            {t("costLabel")}: <b>{cost} {t("currency")}</b>
                          </span>
                        )}
                      </div>
                      {/* Фоида = фурӯш − харид (зинда, вақте нарх гузошта шуд) */}
                      {profit !== null && (
                        <div
                          className={`text-xs tabular-nums font-semibold ${
                            profit >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {t("lsProfit")}: {profit} {t("currency")}
                        </div>
                      )}
                    </div>
                    <input
                      className="input !w-24 !py-1.5 text-sm"
                      inputMode="decimal"
                      placeholder={t("price")}
                      aria-label={`${t("price")} — ${String(pkg.name || pk)}`}
                      value={prices[k] ?? ""}
                      onChange={(e) =>
                        setPrices((prev) => ({ ...prev, [k]: e.target.value }))
                      }
                    />
                    <button
                      disabled={creating !== null}
                      onClick={() => void add(key, pkg)}
                      aria-label={t("add")}
                      title={t("add")}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {creating === k ? (
                        <Ic icon={Loader2} size="xs" className="animate-spin" />
                      ) : (
                        <Ic icon={Plus} size="xs" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
