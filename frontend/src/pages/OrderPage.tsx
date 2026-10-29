import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Check,
  CircleCheck,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Frown,
  House,
  Loader2,
  PartyPopper,
  ReceiptText,
  RefreshCw,
  Smartphone,
  Upload,
} from "lucide-react";
import { api } from "../api/client";
import type { Order } from "../types";
import StatusBadge from "../components/StatusBadge";
import Customers from "../components/Customers";
import BackButton from "../components/BackButton";
import { useApp } from "../context/AppContext";
import { copyText } from "../utils/clipboard";
import { Ic } from "../components/Icons";

/** Саҳифаи санҷиши статуси фармоиш */
export default function OrderPage() {
  const { id = "" } = useParams();
  const { t, lang } = useApp();
  const orderId = Number(id);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  // 🧾 Формаи фиристодани чек
  const [receiptText, setReceiptText] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [copied, setCopied] = useState(false);

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

  // 🧾 Фиристодани чеки пардохт (расм ё матн)
  const sendReceipt = async () => {
    setSending(true);
    setSendErr("");
    try {
      const updated = await api.submitReceipt(orderId, {
        text: receiptText,
        file: receiptFile,
        lang,
      });
      setOrder(updated);
      setSentOk(true);
      setReceiptText("");
      setReceiptFile(null);
    } catch (e) {
      setSendErr((e as Error)?.message ?? t("error"));
    } finally {
      setSending(false);
    }
  };

  // 📋 Нусхабардории линки пардохт
  const copyLink = async (text: string) => {
    if (await copyText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

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
        <div className="card p-6">
          <div className="flex justify-center mb-3 text-slate-300">
            <Ic icon={Frown} size="2xl" strokeWidth={1.75} />
          </div>
          <p className="text-slate-600 mb-6">{error || t("notFound")}</p>
          <Link to="/" className="btn-primary">
            {t("goHome")}
          </Link>
        </div>
      </div>
    );
  }

  const paid = ["paid", "delivered"].includes(order.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      {/* ⬅️ Тугмаи бозгашт (услуби якхела дар ҳамаи саҳифаҳо) */}
      <BackButton />
      <div className="card p-5 sm:p-8 text-center">
        <div className="flex justify-center mb-4">
          <Ic
            icon={paid ? PartyPopper : Clock}
            size="3xl"
            strokeWidth={1.75}
            className={paid ? "text-emerald-500" : "text-amber-400"}
          />
        </div>

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

        {/* 💳 Пардохти берунӣ: линк + рақами корта (танҳо ҳоло pending) */}
        {order.status === "pending" &&
          order.payment_method === "dc_wallet" &&
          (order.payment_link || order.dc_payment_url) && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white text-left overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-700 inline-flex items-center gap-2">
                <Ic icon={CreditCard} className="text-brand-600" />
                {t("payLink")}
              </div>
              <div className="p-4 space-y-3">
                {order.payment_card && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">{t("cardNumber")}</span>
                    <span className="font-mono font-bold text-slate-800">
                      {order.payment_card}
                    </span>
                  </div>
                )}
                {order.payment_phone && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500 inline-flex items-center justify-end">
                      <Ic icon={Smartphone} className="text-slate-400" />
                    </span>
                    <span className="font-mono font-semibold text-slate-800">
                      {order.payment_phone}
                    </span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <a
                    href={order.payment_link || order.dc_payment_url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 text-center rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold py-2.5 transition inline-flex items-center justify-center gap-2"
                  >
                    <Ic icon={ExternalLink} />
                    {t("openPayLink")}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyLink(order.payment_link || order.dc_payment_url || "")}
                    aria-label={t("copy")}
                    className="shrink-0 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-600 px-4 py-2.5 transition inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                  >
                    <Ic icon={copied ? Check : Copy} className={copied ? "text-emerald-600" : ""} />
                    {t(copied ? "copied" : "copy")}
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* 🧾 Формаи фиристодани чек (барои пардохти DC) */}
        {order.status === "pending" && order.payment_method === "dc_wallet" && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-left">
            <div className="font-semibold text-sm text-slate-800 mb-1 inline-flex items-center gap-2">
              <Ic icon={ReceiptText} className="text-brand-600" />
              {t("receiptTitle")}
            </div>
            <p className="text-xs text-slate-500 mb-3">{t("receiptNote")}</p>

            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t("receiptPhoto")}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-700 file:font-semibold hover:file:bg-brand-100"
            />

            <label className="block text-xs font-medium text-slate-600 mt-3 mb-1">
              {t("receiptText")}
            </label>
            <input
              type="text"
              maxLength={512}
              className="input"
              placeholder={t("receiptText")}
              value={receiptText}
              onChange={(e) => setReceiptText(e.target.value)}
            />

            {sendErr && (
              <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
                {sendErr}
              </div>
            )}
            {sentOk && !sendErr && (
              <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 inline-flex items-center gap-2">
                <Ic icon={CircleCheck} size="xs" />
                {t("receiptSent")}
              </div>
            )}

            <button
              onClick={sendReceipt}
              disabled={sending || (!receiptFile && !receiptText.trim())}
              className="btn-primary w-full mt-3 py-3"
            >
              {sending ? (
                <>
                  <Ic icon={Loader2} className="animate-spin" /> {t("loading")}
                </>
              ) : (
                <>
                  <Ic icon={Upload} />
                  {t("sendReceipt")}
                </>
              )}
            </button>
          </div>
        )}

        {/* 🧾 Чеки фиристода — интизори тасдиқи админ */}
        {order.status === "checking" && (
          <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-left">
            <div className="text-sm font-semibold text-indigo-800 mb-1 inline-flex items-center gap-2">
              <Ic icon={ReceiptText} />
              {t("receiptReview")}
            </div>
            {order.receipt_text && (
              <div className="text-xs text-indigo-700 break-words">
                {order.receipt_text}
              </div>
            )}
            {order.receipt_file && (
              <img
                src={order.receipt_file}
                alt="receipt"
                className="mt-2 rounded-xl max-h-44 border border-indigo-100"
              />
            )}
          </div>
        )}

        {/* Амалҳо */}
        <div className="mt-6 space-y-3">
          {order.status === "pending" && order.dc_payment_url && (
            <a
              href={order.dc_payment_url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary w-full py-3.5 text-base"
            >
              <Ic icon={CreditCard} />
              {t("pay")}
            </a>
          )}

          <button onClick={load} className="btn-ghost w-full" disabled={checking}>
            {checking ? (
              <>
                <Ic icon={Loader2} className="animate-spin" /> {t("statusChecking")}
              </>
            ) : (
              <>
                <Ic icon={RefreshCw} />
                {t("refresh")}
              </>
            )}
          </button>

          <Link to="/" className="btn-ghost w-full">
            <Ic icon={House} />
            {t("goHome")}
          </Link>
        </div>

        {!paid && (
          <p className="mt-5 text-xs text-slate-500">{t("statusChecking")}</p>
        )}
      </div>

      {/* 👥 Муштариёни воқеӣ — аз фармоишҳои иҷрочуда */}
      <Customers />

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
