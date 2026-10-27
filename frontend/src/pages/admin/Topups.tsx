import { useCallback, useEffect, useState } from "react";
import { CircleCheck, ExternalLink, Loader2, RefreshCw, X } from "lucide-react";
import { api } from "../../api/client";
import { useApp } from "../../context/AppContext";
import { Ic } from "../../components/Icons";
import type { AdminTopup } from "../../types";

type Filter = "" | "pending" | "approved" | "rejected";

const STATUS_LABEL: Record<AdminTopup["status"], string> = {
  pending: "topupWaitReview",
  approved: "topupApproved",
  rejected: "topupRejected",
};

const STATUS_CLS: Record<AdminTopup["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};

/**
 * 💳 Дархостҳои пур кардани баланс — санҷиш + қабул/рад.
 * Ҳамон амалиётҳо аз Telegram-бот ҳам кор мекунанд (як хидмат).
 */
export default function Topups() {
  const { t, lang } = useApp();
  const [rows, setRows] = useState<AdminTopup[]>([]);
  const [filter, setFilter] = useState<Filter>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.adminTopups(filter || undefined));
      setErr("");
    } catch {
      setErr(t("error"));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: number, approve: boolean) => {
    if (busy !== null) return; // бе дубликация
    setBusy(id);
    setErr("");
    try {
      if (approve) await api.adminTopupApprove(id);
      else await api.adminTopupReject(id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(null);
    }
  };

  const viewReceipt = async (path: string) => {
    try {
      const url = await api.fetchReceipt(path);
      window.open(url, "_blank");
    } catch {
      setErr(t("error"));
    }
  };

  const allLabel = lang === "ru" ? "Все" : "Ҳама";
  const filters: { id: Filter; label: string }[] = [
    { id: "", label: allLabel },
    { id: "pending", label: t("topupWaitReview") },
    { id: "approved", label: t("topupApproved") },
    { id: "rejected", label: t("topupRejected") },
  ];

  return (
    <div>
      {/* Сарлавҳа + филтрҳо + навсозӣ */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {filters.map((f) => (
          <button
            key={f.id || "all"}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`btn text-xs whitespace-nowrap ${
              filter === f.id
                ? "bg-brand-600 text-white"
                : "bg-white border border-slate-200 text-slate-700"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => void load()}
          className="btn text-xs bg-white border border-slate-200 text-slate-700 ml-auto"
          aria-label={t("refresh") || "↻"}
        >
          <Ic icon={RefreshCw} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {err && (
        <div
          role="alert"
          className="mb-3 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs font-bold text-rose-700"
        >
          {err}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="grid place-items-center py-14 text-slate-400">
          <Ic icon={Loader2} size="lg" className="animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          {t("topupNoRequests")}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="card p-3.5 flex flex-wrap items-center gap-3 justify-between"
            >
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 tabular-nums">
                  #{r.id} · {Number(r.amount_tjs).toLocaleString("tj-TJ")} сомонӣ
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {r.user_name || r.user_phone || (r.user_id ? `#${r.user_id}` : "—")}
                  {" · "}
                  {new Date(r.created_at).toLocaleString(
                    lang === "ru" ? "ru-RU" : "tj-TJ",
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CLS[r.status]}`}
                >
                  {t(STATUS_LABEL[r.status])}
                </span>

                {r.receipt_file && (
                  <button
                    onClick={() => void viewReceipt(r.receipt_file!)}
                    className="btn text-xs bg-slate-100 text-slate-700"
                    aria-label={t("topupReceipt")}
                  >
                    <Ic icon={ExternalLink} />
                    {t("receiptPhoto")}
                  </button>
                )}

                {r.status === "pending" && (
                  <>
                    <button
                      onClick={() => void decide(r.id, true)}
                      disabled={busy !== null}
                      className="btn text-xs bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      aria-label={t("approve")}
                    >
                      {busy === r.id ? (
                        <Ic icon={Loader2} className="animate-spin" />
                      ) : (
                        <Ic icon={CircleCheck} />
                      )}
                      {t("approve")}
                    </button>
                    <button
                      onClick={() => void decide(r.id, false)}
                      disabled={busy !== null}
                      className="btn text-xs bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                      aria-label={t("reject")}
                    >
                      <Ic icon={X} />
                      {t("reject")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
