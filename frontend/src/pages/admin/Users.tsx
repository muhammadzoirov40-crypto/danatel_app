import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { AdminUser, BalanceTx } from "../../types";
import { useApp } from "../../context/AppContext";

/**
 * 👥 Идоракунии баланси корбарон.
 *
 *  - Рӯйхати корбарон бо баланси ҷорӣ
 *  - Тугмаи «Идоракунии баланс» → иловаи маблағ
 *  - Таърихи ҳамаи тағйирот (User, маблағ, сана, Admin, сабаб)
 */
export default function Users() {
  const { t } = useApp();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  // Корбари кушодашуда барои идоракунӣ
  const [openId, setOpenId] = useState<number | null>(null);
  const [history, setHistory] = useState<{ user: AdminUser; txs: BalanceTx[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await api.adminUsers());
      setErr("");
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3500);
  };

  const openHistory = async (u: AdminUser) => {
    try {
      const txs = await api.userTransactions(u.id);
      setHistory({ user: u, txs });
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = users.filter(
    (u) =>
      !q ||
      (u.phone ?? "").includes(q) ||
      (u.full_name ?? "").toLowerCase().includes(q) ||
      (u.username ?? "").toLowerCase().includes(q),
  );

  if (loading) return <div className="card h-40 animate-pulse bg-slate-100" />;

  return (
    <div className="space-y-4">
      {err && <div className="card p-4 text-rose-600 text-sm">{err}</div>}
      {msg && (
        <div className="card p-4 text-emerald-700 bg-emerald-50 border-emerald-200 text-sm">
          ✅ {msg}
        </div>
      )}

      {/* Ҷустуҷӯ + умумӣ */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <input
          className="input !py-2 text-sm flex-1 min-w-[180px]"
          placeholder={`🔍 ${t("search")}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="text-xs text-slate-500">
          {t("users")}: <b>{filtered.length}</b> / {users.length}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-sm flex items-center justify-between">
          <span>👥 {t("users")}</span>
          <span className="text-xs font-normal text-slate-500">{t("adminNote")}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">{t("notFound")}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((u) => (
              <div key={u.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-medium text-sm flex items-center gap-1.5">
                      {u.full_name || u.username || `#${u.id}`}
                      {u.is_admin && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-100 text-brand-700">
                          {t("admin")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      📱 {u.phone || "—"} · 📦 {u.orders_count}
                    </div>
                  </div>

                  {/* 💰 Баланс */}
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400">{t("currentBalance")}</div>
                    <div
                      className={`font-bold text-sm ${
                        Number(u.balance) > 0 ? "text-emerald-600" : "text-slate-400"
                      }`}
                    >
                      {Number(u.balance).toFixed(2)} {t("somoni")}
                    </div>
                  </div>

                  <div className="flex gap-1.5 ml-auto">
                    <button
                      onClick={() => setOpenId(openId === u.id ? null : u.id)}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      💰 {t("manageBalance")}
                    </button>
                    <button
                      onClick={() => void openHistory(u)}
                      className="btn-ghost text-xs px-3 py-1.5"
                    >
                      📜 {t("history")}
                    </button>
                  </div>
                </div>

                {/* Формаи иловаи баланс */}
                {openId === u.id && (
                  <AddBalanceForm
                    user={u}
                    t={t}
                    onDone={async (m) => {
                      setOpenId(null);
                      flash(m);
                      await load();
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Таърихи баланс */}
      {history && (
        <TxModal data={history} t={t} onClose={() => setHistory(null)} />
      )}
    </div>
  );
}

/** Формаи иловаи маблағ ба баланси корбар */
function AddBalanceForm({
  user: u,
  t,
  onDone,
}: {
  user: AdminUser;
  t: (k: string) => string;
  onDone: (msg: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    const n = Number(amount);
    if (!amount || Number.isNaN(n) || n <= 0) {
      setErr(t("invalidAmount") || t("requiredField"));
      return;
    }
    setBusy(true);
    try {
      await api.addBalance(u.id, n, reason.trim() || undefined);
      onDone(
        `${t("balanceAdded")}: +${n.toFixed(2)} ${t("somoni")} → ${u.full_name || u.phone || "#" + u.id}`,
      );
    } catch (e2) {
      setErr((e2 as Error)?.message ?? t("error"));
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mt-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3"
    >
      <div className="text-xs font-semibold text-brand-800 mb-2">
        💰 {t("addBalance")} — {u.full_name || u.phone || `#${u.id}`}
      </div>

      {err && (
        <div className="mb-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="label">{t("amount")} ({t("somoni")})</label>
          <input
            className="input !py-2 text-sm"
            inputMode="decimal"
            placeholder="50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">{t("reasonOptional")}</label>
          <input
            className="input !py-2 text-sm"
            placeholder={t("reason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>

      {/* Пешнамоиш */}
      {amount && !Number.isNaN(Number(amount)) && Number(amount) > 0 && (
        <div className="mt-2 text-xs text-slate-600">
          {t("currentBalance")}:{" "}
          <b>{Number(u.balance).toFixed(2)}</b> → {t("afterPayment")}:{" "}
          <b className="text-emerald-600">
            {(Number(u.balance) + Number(amount)).toFixed(2)}
          </b>{" "}
          {t("somoni")}
        </div>
      )}

      <div className="flex gap-2 mt-2">
        <button type="submit" disabled={busy} className="btn-primary text-xs px-4 py-2">
          {busy ? t("loading") : `➕ ${t("addBalance")}`}
        </button>
        <button
          type="button"
          onClick={() => onDone("")}
          className="btn-ghost text-xs px-3 py-2"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

/** Модали таърихи тағйирот */
function TxModal({
  data,
  t,
  onClose,
}: {
  data: { user: AdminUser; txs: BalanceTx[] };
  t: (k: string) => string;
  onClose: () => void;
}) {
  const kindMeta: Record<string, { cls: string; icon: string }> = {
    credit: { cls: "bg-emerald-100 text-emerald-800", icon: "➕" },
    debit: { cls: "bg-rose-100 text-rose-800", icon: "➖" },
    refund: { cls: "bg-sky-100 text-sky-800", icon: "🔄" },
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 grid place-items-center p-4">
      <div className="card w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">
              📜 {t("transactionHistory")}
            </div>
            <div className="text-xs text-slate-500">
              {data.user.full_name || data.user.phone || `#${data.user.id}`} ·{" "}
              {t("currentBalance")}:{" "}
              <b>{Number(data.user.balance).toFixed(2)} {t("somoni")}</b>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost text-sm px-3 py-1.5">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto divide-y divide-slate-100">
          {data.txs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              {t("noHistory")}
            </div>
          ) : (
            data.txs.map((x) => {
              const m = kindMeta[x.kind] ?? kindMeta.credit;
              const sign = Number(x.amount) >= 0 ? "+" : "";
              return (
                <div key={x.id} className="px-4 py-3 flex items-start gap-3">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${m.cls} shrink-0 mt-0.5`}
                  >
                    {m.icon} {t(x.kind)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <b>
                        {sign}
                        {Number(x.amount).toFixed(2)}
                      </b>{" "}
                      <span className="text-slate-500">{t("somoni")}</span>
                      {x.order_id && (
                        <span className="text-xs text-slate-400">
                          {" "}
                          · {t("forOrder")} #{x.order_id}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {t("afterPayment")}: {Number(x.balance_after).toFixed(2)}
                      {x.reason && <> · {x.reason}</>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-slate-400">
                      {x.created_at?.slice(0, 16).replace("T", " ")}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {x.admin_name ? `👤 ${x.admin_name}` : `🤖 ${t("system")}`}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
