import { Fragment, useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  CircleCheck,
  CircleX,
  Ban,
  Gamepad2,
  Inbox,
  KeyRound,
  Layers,
  Loader2,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { api } from "../../api/client";
import type { Order, OrderDetail, OrderStatus } from "../../types";
import { STATUS_META } from "../../types";
import { useApp } from "../../context/AppContext";
import { Ic } from "../../components/Icons";
import GameLogo from "../../components/GameLogo";

const FILTERS: (OrderStatus | "all")[] = [
  "all",
  "pending",
  "checking",
  "paid",
  "delivered",
  "failed",
];

/** Идораи фармоишҳо */
export default function Orders() {
  const { t } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  /** Ҳузвати харидорон: {id: "Ном · @user · 📞 рақам"} — бе онҳам кор мекунад */
  const [labels, setLabels] = useState<Record<string, string>>({});
  /** 🎮 Логотипи бозӣ барои корт: {номи бозӣ (tj) → расм} аз /admin/games */
  const [gameImgs, setGameImgs] = useState<Record<string, string>>({});
  /** 🔍 Кодҳои махфияш: зер → тафсилот ЯК дафъа гирифта мешавад */
  const [openId, setOpenId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, OrderDetail>>({});

  const toggleDetail = async (id: number) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (details[id]) return;
    try {
      const d = await api.orderDetail(id);
      setDetails((prev) => ({ ...prev, [id]: d }));
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
      setOpenId(null);
    }
  };

  // Логотипҳо як дафъа бор мешаванд (админ танҳо иҷозат дорад)
  useEffect(() => {
    let alive = true;
    api
      .adminGames()
      .then((gs) => {
        if (!alive) return;
        const m: Record<string, string> = {};
        for (const g of gs) if (g.image_url) m[g.name] = g.image_url;
        setGameImgs(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.adminOrders(filter === "all" ? undefined : filter);
      setOrders(d);
      setErr("");
      // Сатри харидор дар корт (хатогӣ → сатр пинҳон мемонад)
      api
        .buyerLabels(d.map((o) => o.id))
        .then(setLabels)
        .catch(() => {});
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: number, status: OrderStatus) => {
    setBusy(id);
    try {
      await api.updateOrder(id, status);
      await load();
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Филтрҳо */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn text-xs whitespace-nowrap ${
              filter === f
                ? "bg-brand-600 text-white"
                : "bg-white border border-slate-200 text-slate-700"
            }`}
          >
            {f === "all" ? (
              <>
                <Ic icon={Layers} />
                {t("orders")}
              </>
            ) : (
              <>
                <Ic icon={STATUS_META[f as OrderStatus].icon} />
                {t(STATUS_META[f as OrderStatus].key ?? "status")}
              </>
            )}
          </button>
        ))}
      </div>

      {err && <div className="card p-4 text-rose-600 text-sm">{err}</div>}

      {/* Мобилӣ: корт — Десктоп: ҷадвал */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card h-16 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          <div className="flex justify-center mb-2 text-slate-300">
            <Ic icon={Inbox} size="xl" />
          </div>
          {t("noOrders")}
        </div>
      ) : (
        <>
          {/* Десктоп */}
          <div className="card hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">{t("game")}</th>
                  <th className="text-left px-4 py-3">{t("product")}</th>
                  <th className="text-left px-4 py-3">Player ID</th>
                  <th className="text-right px-4 py-3">{t("amount")}</th>
                  <th className="text-left px-4 py-3">{t("status")}</th>
                  <th className="text-left px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Ic icon={ReceiptText} size="xs" />
                      {t("receiptPhoto")}
                    </span>
                  </th>
                  <th className="text-right px-4 py-3">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <Fragment key={o.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono">#{o.id}</td>
                      <td className="px-4 py-3">
                        {/* 🎮 Иконкаи бозӣ + ном — ҳамон тавр мисли корти корбар */}
                        <span className="flex items-center gap-2">
                          <span aria-hidden className="w-6 h-6 shrink-0">
                            <GameLogo
                              game={{
                                name: o.game_name ?? "",
                                image_url: gameImgs[o.game_name ?? ""],
                              }}
                            />
                          </span>
                          {o.game_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">{o.product_name}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {o.player_id}
                        {o.region && (
                          <span className="ml-1.5 inline-block rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-sans text-[10px] text-sky-600">
                            {o.region}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {Number(o.amount_tjs).toLocaleString("tj-TJ")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${STATUS_META[o.status].cls}`}>
                          <Ic icon={STATUS_META[o.status].icon} size="xs" strokeWidth={2.25} />
                          {t(STATUS_META[o.status].key ?? "status")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ReceiptCell order={o} t={t} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* 🔍 Кодҳои махфияш */}
                          <button
                            type="button"
                            onClick={() => void toggleDetail(o.id)}
                            aria-expanded={openId === o.id}
                            aria-label={t("hiddenCodes")}
                            title={t("hiddenCodes")}
                            className={`btn text-xs px-2 py-1.5 border ${
                              openId === o.id
                                ? "border-brand-600 bg-brand-600 text-white"
                                : "border-slate-200 bg-white text-slate-600"
                            }`}
                          >
                            <Ic icon={KeyRound} size="xs" />
                          </button>
                          <RowActions order={o} busy={busy === o.id} onSet={setStatus} t={t} />
                        </div>
                      </td>
                    </tr>
                    {openId === o.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={8} className="px-4 py-3">
                          {details[o.id] ? (
                            <DetailCodes d={details[o.id]} t={t} />
                          ) : (
                            <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              {t("loading")}
                            </span>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Мобилӣ */}
          <div className="md:hidden space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="card p-4">
                {/* 🔍 Сарлавҳа = тугмаи пурра: зер → кодҳои махфияш */}
                <button
                  type="button"
                  onClick={() => void toggleDetail(o.id)}
                  aria-expanded={openId === o.id}
                  aria-controls={`odetail-${o.id}`}
                  className="mb-2 flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="font-mono font-bold">#{o.id}</span>
                  <span className="flex items-center gap-2">
                    <span className={`badge ${STATUS_META[o.status].cls}`}>
                      <Ic icon={STATUS_META[o.status].icon} size="xs" strokeWidth={2.25} />
                      {t(STATUS_META[o.status].key ?? "status")}
                    </span>
                    <ChevronDown
                      aria-hidden
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                        openId === o.id ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </button>
                <div className="text-sm text-slate-600 space-y-1">
                  <div className="flex items-center gap-2">
                    {/* 🎮 Иконкаи бозӣ + ном — ҳамон тавр мисли корти корбар */}
                    <span aria-hidden className="w-7 h-7 shrink-0">
                      <GameLogo
                        game={{
                          name: o.game_name ?? "",
                          image_url: gameImgs[o.game_name ?? ""],
                        }}
                      />
                    </span>
                    <span className="min-w-0">
                      {o.game_name} — {o.product_name}
                    </span>
                  </div>
                  <div className="font-mono text-xs">
                    ID: {o.player_id}
                    {o.region && (
                      <span className="ml-1.5 inline-block rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-sans text-[10px] text-sky-600">
                        {o.region}
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-brand-700">
                    {Number(o.amount_tjs).toLocaleString("tj-TJ")} {t("currency")}
                  </div>
                  {labels[o.id] && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Ic
                        icon={UserRound}
                        size="xs"
                        className="shrink-0 text-slate-400"
                      />
                      <span className="truncate" title={labels[o.id]}>
                        {labels[o.id]}
                      </span>
                    </div>
                  )}
                </div>
                {(o.receipt_file || o.receipt_text) && (
                  <div className="mt-2">
                    <ReceiptCell order={o} t={t} />
                  </div>
                )}
                {o.status !== "delivered" && (
                  <div className="mt-3">
                    <RowActions
                      order={o}
                      busy={busy === o.id}
                      onSet={setStatus}
                      t={t}
                    />
                  </div>
                )}
                {/* 🔍 Кодҳои махфияш — баъд аз зер ба сарлавҳа */}
                {openId === o.id && (
                  <div id={`odetail-${o.id}`} className="mt-3">
                    {details[o.id] ? (
                      <DetailCodes d={details[o.id]} t={t} />
                    ) : (
                      <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        {t("loading")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** 🧾 Чеки пардохти корбар — расми бехатар (бо токени админ) + матн */
function ReceiptCell({ order, t }: { order: Order; t: (k: string) => string }) {
  const [err, setErr] = useState("");

  const open = async () => {
    if (!order.receipt_file) return;
    setErr("");
    try {
      const url = await api.fetchReceipt(order.receipt_file);
      const w = window.open(url, "_blank", "noopener");
      if (!w) setErr(t("popupBlocked"));
      // 1 дақиқа баъд blob-ро нест мекунем
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setErr((e as Error)?.message ?? t("error"));
    }
  };

  if (!order.receipt_file && !order.receipt_text) {
    return <span className="text-slate-300">—</span>;
  }
  return (
    <div className="space-y-1 max-w-[220px]">
      {order.receipt_file && (
        <button
          type="button"
          onClick={() => void open()}
          className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 text-xs font-semibold underline"
        >
          <Ic icon={ReceiptText} size="xs" />
          {t("receiptPhoto")}
        </button>
      )}
      {err && <div className="text-[11px] text-rose-600">{err}</div>}
      {order.receipt_text && (
        <div className="text-xs text-slate-500 break-words">{order.receipt_text}</div>
      )}
    </div>
  );
}

function RowActions({
  order,
  busy,
  onSet,
  t,
}: {
  order: Order;
  busy: boolean;
  onSet: (id: number, s: OrderStatus) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="flex gap-1.5 justify-end flex-wrap">
      {/* 🧾 Чек расид — админ қабул ё рад мекунад */}
      {order.status === "checking" && (
        <>
          <button
            disabled={busy}
            onClick={() => onSet(order.id, "paid")}
            className="btn bg-emerald-600 text-white text-xs px-3 py-1.5 hover:bg-emerald-700"
          >
            <Ic icon={CircleCheck} size="xs" />
            {t("approve")}
          </button>
          <button
            disabled={busy}
            onClick={() => onSet(order.id, "cancelled")}
            className="btn-danger text-xs px-3 py-1.5"
          >
            <Ic icon={Ban} size="xs" />
            {t("reject")}
          </button>
        </>
      )}

      {order.status !== "delivered" && (
        <button
          disabled={busy}
          onClick={() => onSet(order.id, "delivered")}
          className="btn bg-sky-600 text-white text-xs px-3 py-1.5 hover:bg-sky-700"
        >
          <Ic icon={Gamepad2} size="xs" />
          {t("markDelivered")}
        </button>
      )}
      {order.status === "pending" && (
        <button
          disabled={busy}
          onClick={() => onSet(order.id, "failed")}
          aria-label={t("failed")}
          title={t("failed")}
          className="btn-danger text-xs px-3 py-1.5"
        >
          <Ic icon={CircleX} size="xs" />
        </button>
      )}
    </div>
  );
}

/** 🔍 Кодҳои махфияши фармоиш — ник, fl_ref, транзаксия, ҳисоби DC … */
function DetailCodes({ d, t }: { d: OrderDetail; t: (k: string) => string }) {
  const fmt = (v?: string | null) =>
    v ? new Date(v).toLocaleString("tj-TJ") : "—";
  const rows: { k: string; v: string }[] = [
    { k: t("nickname"), v: d.player_nickname || "—" },
    { k: t("qtyLabel"), v: String(d.quantity || 1) },
    { k: t("flRef"), v: d.fl_ref || "—" },
    { k: t("txnId"), v: d.transaction_id || "—" },
    { k: t("dcInvoice"), v: d.dc_invoice_id || "—" },
    { k: t("language"), v: d.language || "—" },
    { k: t("payMethod"), v: d.payment_method || "—" },
    { k: t("date"), v: fmt(d.created_at) },
    { k: t("updatedAt"), v: fmt(d.updated_at) },
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <Ic icon={KeyRound} size="xs" />
        {t("hiddenCodes")}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        {rows.map((r) => (
          <Fragment key={r.k}>
            <dt className="whitespace-nowrap text-slate-500">{r.k}</dt>
            <dd className="break-all font-mono text-slate-800">{r.v}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
