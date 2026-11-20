import { useEffect, useState } from "react";
import { Check, Globe2, Loader2, X } from "lucide-react";
import { api } from "../../api/client";
import { useApp } from "../../context/AppContext";

interface RegionRow {
  name: string;
  enabled: boolean;
}

/** 🌍 Минтақаҳои бозӣ — соҳиб онҳоро хомӯш/фаъол мекунад (20.11.2026).
 *  Рӯйхат аз каталоги воқеии FireLoot меояд; ягон минтақаи сохта нест. */
export default function Regions() {
  const { t } = useApp();
  const [rows, setRows] = useState<RegionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .adminRegions("free-fire")
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
  }, []);

  const toggle = async (row: RegionRow) => {
    if (saving) return;
    const next = !row.enabled;
    setSaving(row.name);
    setError("");
    setRows((prev) =>
      prev.map((r) => (r.name === row.name ? { ...r, enabled: next } : r)),
    );
    try {
      await api.setAdminRegion({ game: "free-fire", region: row.name, enabled: next });
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
      <p className="text-xs text-slate-500 mb-4">
        Free Fire · минтақаҳои воқеӣ аз FireLoot. Хомӯшшудаҳо дар саҳифаи
        харидор намоён намешаванд.
      </p>

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
            aria-pressed={r.enabled}
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
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                r.enabled ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"
              }`}
              aria-hidden
            >
              {saving === r.name ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : r.enabled ? (
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
