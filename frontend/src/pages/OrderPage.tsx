import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Order } from "../types";
import StatusBadge from "../components/StatusBadge";
import { useApp } from "../context/AppContext";

/** Саҳифаи санҷиши статуси фармоиш */
export default function OrderPage() {
  const { id = "" } = useParams();
  const { t, lang } = useApp();
  const orderId = Number(id);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      const o = await api.order(orderId, lang);
      setOrder(o);
      setError("");
    } catch (e) {
      setError((e as Error)?.message ?? t("error"));
    } finally {
      setLoading(false);
    }
  }, [orderId, lang, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Санҷиши худкори статус ҳар 5 сония (то paid/delivered)
  useEffect(() => {
    if (!order) return;
    if (["paid", "delivered", "failed", "refunded"].includes(order.status)) return;

    const timer = setInterval(async () => {
      setChecking(true);
      try {
        const s = await api.orderStatus(orderId);
        if (["paid", "delivered", "failed"].includes(s.status)) {
          await load();
        }
      } catch {
        /* ignore */
      } finally {
        setChecking(false);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [order, orderId, load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="card h-56 animate-pulse bg-slate-100" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="text-4xl mb-3">😕</div>
        <p className="text-slate-600 mb-6">{error || t("notFound")}</p>
        <Link to="/" className="btn-primary">
          {t("goHome")}
        </Link>
      </div>
    );
  }

  const paid = ["paid", "delivered"].includes(order.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="card p-5 sm:p-8 text-center">
        <div className="text-5xl mb-4">{paid ? "🎉" : "⏳"}</div>

        <h1 className="text-xl sm:text-2xl font-bold mb-2">{t("orderCreated")}</h1>

        <div className="inline-block mb-5">
          <StatusBadge status={order.status} />
        </div>

        {/* Тафсилот */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200 divide-y divide-slate-200 text-sm text-left">
          <Row label={t("orderNumber")} value={`#${order.id}`} mono />
          <Row label={t("game")} value={order.game_name ?? "-"} />
          <Row label={t("product")} value={order.product_name ?? "-"} />
          <Row label="Player ID" value={order.player_id} mono />
          <Row
            label={t("total")}
            value={`${Number(order.amount_tjs).toLocaleString("tj-TJ")} ${t("currency")}`}
            strong
          />
        </div>

        {/* Амалҳо */}
        <div className="mt-6 space-y-3">
          {order.status === "pending" && order.dc_payment_url && (
            <a
              href={order.dc_payment_url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary w-full py-3.5 text-base"
            >
              💳 {t("pay")}
            </a>
          )}

          <button onClick={load} className="btn-ghost w-full" disabled={checking}>
            {checking ? (
              <>
                <span className="animate-spin">⏳</span> {t("statusChecking")}
              </>
            ) : (
              <>🔄 {t("refresh")}</>
            )}
          </button>

          <Link to="/" className="btn-ghost w-full">
            🏠 {t("goHome")}
          </Link>
        </div>

        {!paid && (
          <p className="mt-5 text-xs text-slate-500">{t("statusChecking")}</p>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span
        className={`${mono ? "font-mono" : ""} ${
          strong ? "font-bold text-brand-700" : "font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
