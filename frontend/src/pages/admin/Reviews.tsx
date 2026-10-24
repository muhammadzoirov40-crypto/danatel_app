import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useApp } from "../../context/AppContext";
import type { AdminReviewList } from "../../types";

/** 🛡️ Санҷиши отзывҳо — админ тасдиқ / рад / нест мекунад */
export default function Reviews() {
  const { t } = useApp();
  const [data, setData] = useState<AdminReviewList | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const load = () =>
    api
      .adminReviews()
      .then(setData)
      .catch((e) => setErr((e as Error).message));

  useEffect(() => {
    load();
  }, []);

  async function act(id: number, fn: () => Promise<unknown>) {
    setBusy(id);
    setErr("");
    try {
      await fn();
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (err) return <div className="card p-5 text-rose-600">{err}</div>;
  if (!data) return <div className="card p-5 animate-pulse text-slate-400">…</div>;

  const pending = data.items.filter((r) => !r.is_approved);
  const approved = data.items.filter((r) => r.is_approved);

  return (
    <div className="space-y-5">
      {/* 📊 Омор */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl font-black text-amber-500">
            {data.rating_avg || "—"}
          </div>
          <div className="text-xs text-slate-500">⭐ {t("rating")}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-black">{data.reviews_total}</div>
          <div className="text-xs text-slate-500">✅ {t("approved")}</div>
        </div>
        <div className="card p-4 text-center">
          <div
            className={`text-2xl font-black ${data.pending ? "text-amber-500" : ""}`}
          >
            {data.pending}
          </div>
          <div className="text-xs text-slate-500">⏳ {t("pendingReview")}</div>
        </div>
      </div>

      {/* ⏳ Дар интизори тасдиқ */}
      <section>
        <h3 className="font-bold mb-2">⏳ {t("pendingReview")}</h3>
        {pending.length === 0 ? (
          <div className="card p-4 text-sm text-slate-500">{t("nothingPending")}</div>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <Row
                key={r.id}
                r={r}
                busy={busy === r.id}
                t={t}
                onApprove={() => act(r.id, () => api.moderateReview(r.id, true))}
                onReject={() => act(r.id, () => api.moderateReview(r.id, false))}
                onDelete={() => act(r.id, () => api.deleteReview(r.id))}
              />
            ))}
          </div>
        )}
      </section>

      {/* ✅ Тасдиқшудаҳо */}
      <section>
        <h3 className="font-bold mb-2">✅ {t("approved")}</h3>
        {approved.length === 0 ? (
          <div className="card p-4 text-sm text-slate-500">{t("nothingApproved")}</div>
        ) : (
          <div className="space-y-3">
            {approved.map((r) => (
              <Row
                key={r.id}
                r={r}
                busy={busy === r.id}
                t={t}
                onApprove={undefined}
                onReject={() => act(r.id, () => api.moderateReview(r.id, false))}
                onDelete={() => act(r.id, () => api.deleteReview(r.id))}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Row({
  r,
  busy,
  t,
  onApprove,
  onReject,
  onDelete,
}: {
  r: AdminReviewList["items"][number];
  busy: boolean;
  t: (k: string) => string;
  onApprove?: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">{r.author_name}</span>
            <span className="text-amber-400 text-xs">
              {"★".repeat(r.rating)}
              <span className="text-slate-300">{"★".repeat(5 - r.rating)}</span>
            </span>
            <span className="text-xs text-slate-400">#{r.id}</span>
            {r.order_id && (
              <span className="text-xs text-slate-400">
                📦 #{r.order_id}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{r.text}</p>
          {r.created_at && (
            <time className="text-xs text-slate-400">
              {new Date(r.created_at).toLocaleString()}
            </time>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          {onApprove && (
            <button onClick={onApprove} disabled={busy} className="btn text-xs">
              ✅ {t("approve")}
            </button>
          )}
          <button onClick={onReject} disabled={busy} className="btn-ghost text-xs">
            ❌ {t("reject")}
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="btn-ghost text-xs text-rose-600"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}
