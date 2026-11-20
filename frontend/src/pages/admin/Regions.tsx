import { useEffect, useState } from "react";
import { Globe2, Loader2, Package } from "lucide-react";
import { api } from "../../api/client";
import { useApp } from "../../context/AppContext";

interface Row {
  name: string;
  enabled: boolean;
}

interface GameOption {
  slug: string;
  name: string;
}

function ToggleRow({
  name,
  label,
  enabled,
  saving,
  onToggle,
}: {
  name: string;
  label: string;
  enabled: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      role="switch"
      aria-checked={enabled}
      aria-label={`${label}: ${enabled ? "фаъол" : "хомӯш"}`}
      className={`flex items-center justify-between gap-3 rounded-2xl border-2 px-3 py-2.5
                  text-left text-sm font-bold transition active:scale-[0.99]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400
                  disabled:opacity-60 ${
                    enabled
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-400"
                  }`}
    >
      <span className="min-w-0 truncate">{label || name}</span>
      {/* 🎚️ Слайдер: чап = ХОМӮШ, рост = ФАЪОЛ */}
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          enabled ? "bg-emerald-600" : "bg-slate-300"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            enabled ? "left-[22px]" : "left-0.5"
          }`}
        >
          {saving && (
            <Loader2 className="absolute inset-0 m-auto w-3 h-3 animate-spin text-emerald-600" />
          )}
        </span>
      </span>
    </button>
  );
}

/** 🌍 + 📦 Минтақаҳо ва гурӯҳҳои маҳсулот — соҳиб 20—21.11.2026.
 *  Ба ҲАМАИ бозиҳое, ки dropdown доранд, татбиқ мешавад. */
export default function Regions() {
  const { t } = useApp();
  const [games, setGames] = useState<GameOption[]>([]);
  const [game, setGame] = useState("");
  const [regions, setRegions] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
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
    Promise.all([api.adminRegions(game), api.adminGroups(game)])
      .then(([r, g]) => {
        if (!alive) return;
        setRegions(r.regions);
        setGroups(g.groups);
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

  const toggle = async (kind: "region" | "group", row: Row) => {
    if (saving || !game) return;
    const next = !row.enabled;
    const setter = kind === "region" ? setRegions : setGroups;
    const patch = (v: Row[]) =>
      v.map((r) => (r.name === row.name ? { ...r, enabled: next } : r));
    setSaving(row.name);
    setError("");
    setter(patch);
    try {
      if (kind === "region") {
        await api.setAdminRegion({ game, region: row.name, enabled: next });
      } else {
        await api.setAdminGroup({ game, group: row.name, enabled: next });
      }
    } catch {
      setter((v: Row[]) =>
        v.map((r) => (r.name === row.name ? { ...r, enabled: !next } : r)),
      );
      setError("Наҷот дода нашуд — такрор кунед");
    } finally {
      setSaving("");
    }
  };

  const groupLabel: Record<string, string> = {
    likes: t("secLikes"),
    diamonds: t("secDiamonds"),
    currency: t("secCurrency"),
    vouchers: t("secVouchers"),
    passes: t("secPasses"),
    packs: t("secPacks"),
  };

  return (
    <div className="space-y-4">
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
        {!loading && regions.length === 0 && (
          <p className="text-sm text-slate-500">Минтақаҳо ёфт нашуданд.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {regions.map((r) => (
            <ToggleRow
              key={r.name}
              name={r.name}
              label={r.name}
              enabled={r.enabled}
              saving={saving === r.name}
              onToggle={() => void toggle("region", r)}
            />
          ))}
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-5 h-5 text-brand-600" aria-hidden />
          <h2 className="text-lg font-extrabold text-slate-800">Бахшҳои маҳсулот</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Алмосҳо, пропускҳо, ваучерҳо ва ғайра. Хомӯшшуда бахш ва маҳсулоти он
          дар саҳифаи харидор нест мешавад.
        </p>
        {error && <p className="text-sm text-rose-600 mb-2">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {groups.map((g) => (
            <ToggleRow
              key={g.name}
              name={g.name}
              label={groupLabel[g.name] || g.name}
              enabled={g.enabled}
              saving={saving === g.name}
              onToggle={() => void toggle("group", g)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
