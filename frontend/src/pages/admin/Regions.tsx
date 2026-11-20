import { useEffect, useState } from "react";
import { Globe2, Loader2 } from "lucide-react";
import { api } from "../../api/client";
import { useApp } from "../../context/AppContext";

interface RegionRow {
  name: string;
  enabled: boolean;
}

interface GameOption {
  slug: string;
  name: string;
}

/** 🌍 Минтақаҳо — соҳиб онҳоро хомӯш/фаъол мекунад (20.11.2026).
 *  Ба ҲАМАИ бозиҳое, ки dropdown-и минтақа доранд, татбиқ мешавад.
 *  Рӯйхат аз каталоги воқеии FireLoot меояд; минтақаи сохта нест. */
export default function Regions() {
  const { t } = useApp();
  const [games, setGames] = useState<GameOption[]>([]);
  const [game, setGame] = useState("");
  const [rows, setRows] = useState<RegionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .adminRegionGames()
      .then((d) => {
        if (!alive) return;
        setGames(d);
        if (d.length) setGame((prev) => prev || d[0].slug);
      })
      .catch(() => {
        if (alive) setError("Рӯйхати бозиҳо бор нашудааст");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!game) return;
    let alive = true;
    setLoading(true);
    setError("");
    api
      .adminRegions(game)
      .then((d) => {
        if (alive) setRows(d.regions);
      })
      .catch(() => {
        if (alive) setError("Боркунӣ ноком шуд");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [game]);

  const toggle = async (row: RegionRow) => {
    if (saving || !game) return;
    const next = !row.enabled;
    setSaving(row.name);
    setError("");
    setRows((prev) =>
      prev.map((r) => (r.name === row.name ? { ...r, enabled: next } : r)),
    );
    try {
      await api.setAdminRegion({ game, region: row.name, enabled: next });
    } catch {
      setRows((prev) =>
        prev.map((r) => (r.name === row.name ? { ...r, enabled: !next } : r)),
      );
      setError("Наҷот дода нашуд — такрор кунед");
    } finally {
      setSaving("");
    }
  };

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Globe2 className="w-5 h-5 text-brand-600" aria-hidden />
        <h2 className="text-lg font-extrabold text-slate-800">{t("regions")}</h2>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Ҳамаи бозиҳое, ки минтақа доранд. Хомӯшшудаҳо дар саҳифаи харидор
        намоён намешаванд.
      </p>

      <label className="label mb-2 block" htmlFor="regions-game">
        Бозӣ
      </label>
      <select
        id="regions-game"
        className="input mb-4 w-full sm:w-72"
        value={game}
        onChange={(e) => setGame(e.target.value)}
      >
        {games.map((g) => (
          <option key={g.slug} value={g.slug}>
            {g.name}
          </option>
        ))}
      </select>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Боркунӣ…
        </div>
      )}

      {!loading && rows.length === 0 && (
        <p className="text-sm text-slate-500">Минтақаҳо ёфт нашуданд.</p>
      )}

      {error && <p className="text-sm text-rose-600 mb-2">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.map((r) => (
          <button
            key={r.name}
            type="button"
            onClick={() => void toggle(r)}
            disabled={saving === r.name}
            role="switch"
            aria-checked={r.enabled}
            aria-label={`${r.name}: ${r.enabled ? "фаъол" : "хомӯш"}`}
            className={`flex items-center justify-between gap-3 rounded-2xl border-2 px-3 py-2.5
                        text-left text-sm font-bold transition active:scale-[0.99]
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400
                        disabled:opacity-60 ${
                          r.enabled
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 bg-white text-slate-400"
                        }`}
          >
            <span className="min-w-0 truncate">{r.name}</span>
            {/* 🎚️ Слайдер: чап = ХОМӮШ, рост = ФАЪОЛ (талаби соҳиб) */}
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                r.enabled ? "bg-emerald-600" : "bg-slate-300"
              }`}
              aria-hidden
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  r.enabled ? "left-[22px]" : "left-0.5"
                }`}
              >
                {saving === r.name && (
                  <Loader2 className="absolute inset-0 m-auto w-3 h-3 animate-spin text-emerald-600" />
                )}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
