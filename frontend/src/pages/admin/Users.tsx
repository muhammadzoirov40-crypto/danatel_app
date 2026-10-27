import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Bot,
  CircleCheck,
  CircleX,
  History,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  Smartphone,
  User,
  Users as UsersIcon,
  Wallet,
  X,
} from "lucide-react";
import { api } from "../../api/client";
import type { AdminUser, BalanceTx, TxKind } from "../../types";
import { TX_META } from "../../types";
import { useApp } from "../../context/AppContext";
import { Ic } from "../../components/Icons";

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
        <div className="card p-4 text-emerald-700 bg-emerald-50 border-emerald-200 text-sm inline-flex items-center gap-2">
          <Ic icon={CircleCheck} />
          {msg}
        </div>
      )}

      {/* Ҷустуҷӯ + умумӣ */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Ic icon={Search} />
          </span>
          <input
            className="input !py-2 !pl-9 text-sm"
            placeholder={`${t("search")}…`}
            aria-label={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-xs text-slate-500">
          {t("users")}: <b>{filtered.length}</b> / {users.length}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-sm flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <Ic icon={UsersIcon} className="text-brand-600" />
            {t("users")}
          </span>
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
                    <div className="text-xs text-slate-500 inline-flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Ic icon={Smartphone} size="xs" className="text-slate-400" />
                        {u.phone || "—"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Ic icon={Package} size="xs" className="text-slate-400" />
                        {u.orders_count}
                      </span>
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
                      aria-expanded={openId === u.id}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      <Ic icon={Wallet} size="xs" />
                      {t("manageBalance")}
                    </button>
                    <button
                      onClick={() => void openHistory(u)}
                      className="btn-ghost text-xs px-3 py-1.5"
                    >
                      <Ic icon={History} size="xs" />
                      {t("history")}
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

  /** Як амал: «+ Илова» ё «− Буриш» — як форма, ду тугма */
  const run = async (dir: "add" | "deduct") => {
    setErr("");
    const n = Number(amount);
    if (!amount || Number.isNaN(n) || n <= 0) {
      setErr(t("invalidAmount") || t("requiredField"));
      return;
    }
    setBusy(true);
    try {
      if (dir === "add") {
        await api.addBalance(u.id, n, reason.trim() || undefined);
      } else {
        await api.deductBalance(u.id, n, reason.trim() || undefined);
      }
      onDone(
        dir === "add"
          ? `${t("balanceAdded")}: +${n.toFixed(2)} ${t("somoni")} → ${u.full_name || u.phone || "#" + u.id}`
          : `${t("balanceDeducted")}: −${n.toFixed(2)} ${t("somoni")} → ${u.full_name || u.phone || "#" + u.id}`,
      );
    } catch (e2) {
      setErr((e2 as Error)?.message ?? t("error"));
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run("add");
  };

  return (
    <form
      onSubmit={submit}
      className="mt-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3"
    >
      <div className="text-xs font-semibold text-brand-800 mb-2 inline-flex items-center gap-1.5">
        <Ic icon={Wallet} size="xs" />
        {t("manageBalance")} — {u.full_name || u.phone || `#${u.id}`}
      </div>

      {err && (
        <div role="alert" className="mb-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 flex items-start gap-2">
          <Ic icon={CircleX} size="xs" className="text-rose-500 mt-0.5" />
          <span>{err}</span>
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

      {/* Пешнамоиш — ҳам илова ҳам буриш */}
      {amount && !Number.isNaN(Number(amount)) && Number(amount) > 0 && (
        <div className="mt-2 text-xs text-slate-600">
          {t("currentBalance")}: <b>{Number(u.balance).toFixed(2)}</b> · +{" "}
          {Number(amount).toFixed(2)} →{" "}
          <b className="text-emerald-600">
            {(Number(u.balance) + Number(amount)).toFixed(2)}
          </b>{" "}
          · − {Number(amount).toFixed(2)} →{" "}
          <b className="text-rose-600">
            {(Number(u.balance) - Number(amount)).toFixed(2)}
          </b>{" "}
          {t("somoni")}
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary text-xs px-4 py-2">
          {busy ? (
            <>
              <Ic icon={Loader2} className="animate-spin" /> {t("loading")}
            </>
          ) : (
            <>
              <Ic icon={Plus} size="xs" />
              {t("addBalance")}
            </>
          )}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run("deduct")}
          className="btn bg-rose-600 text-xs px-4 py-2 text-white hover:bg-rose-700 disabled:opacity-50"
          aria-label={t("deductBalance")}
        >
          <Ic icon={Minus} size="xs" />
          {t("deductBalance")}
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
  // Ранг/иконкаи навъҳо аз ягонаи манбаи TX_META (на дубликати emoji)
  const metaOf = (kind: TxKind) => TX_META[kind] ?? TX_META.credit;

  // Пӯшидани модал бо Escape (дастрасӣ барои клавиатура)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 grid place-items-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("transactionHistory")}
        className="card w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-sm inline-flex items-center gap-2">
              <Ic icon={History} className="text-brand-600" />
              {t("transactionHistory")}
            </div>
            <div className="text-xs text-slate-500">
              {data.user.full_name || data.user.phone || `#${data.user.id}`} ·{" "}
              {t("currentBalance")}:{" "}
              <b>{Number(data.user.balance).toFixed(2)} {t("somoni")}</b>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="grid place-items-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <Ic icon={X} />
          </button>
        </div>

        <div className="overflow-y-auto divide-y divide-slate-100">
          {data.txs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              {t("noHistory")}
            </div>
          ) : (
            data.txs.map((x) => {
              const m = metaOf(x.kind as TxKind);
              const MIcon = m.icon;
              const sign = Number(x.amount) >= 0 ? "+" : "";
              return (
                <div key={x.id} className="px-4 py-3 flex items-start gap-3">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${m.cls} shrink-0 mt-0.5`}
                  >
                    <Ic icon={MIcon} size="xs" strokeWidth={2.5} />
                    {t(x.kind)}
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
                    <div className="text-[11px] text-slate-500 inline-flex items-center justify-end gap-1">
                      <Ic
                        icon={x.admin_name ? User : Bot}
                        size="xs"
                        className="text-slate-400"
                      />
                      {x.admin_name ? x.admin_name : t("system")}
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
