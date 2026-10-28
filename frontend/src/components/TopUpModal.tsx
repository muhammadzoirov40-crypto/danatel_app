import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CircleCheck,
  ExternalLink,
  ImagePlus,
  Loader2,
  Send,
  Timer,
  TriangleAlert,
  X,
} from "lucide-react";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import type { Topup, TopupPrepare } from "../types";
import { GoldCoin, Ic } from "./Icons";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESETS = [20, 50, 100, 200, 500, 1000];

const STATUS_LABEL: Record<Topup["status"], string> = {
  awaiting_receipt: "topupAwaiting",
  pending: "topupWaitReview",
  approved: "topupApproved",
  rejected: "topupRejected",
  reverted: "topupReverted",
  expired: "topupExpiredShort",
};

const STATUS_CLS: Record<Topup["status"], string> = {
  awaiting_receipt: "bg-sky-100 text-sky-800",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  reverted: "bg-violet-100 text-violet-800",
  expired: "bg-slate-200 text-slate-600",
};

/**
 * 💳 Пур кардани баланс:
 * 1️⃣ маблағ → линки пардохти DC City (pay.dc.tj)
 * 2️⃣ расми чек дар давоми 1 дақиқа → ба админ дар Telegram
 * 3️⃣ админ қабул мекунад → баланс худкор зиёд мешавад
 */
export default function TopUpModal({ open, onClose }: Props) {
  const { user, balance, lang, t } = useApp();
  // маблағ
  const [amount, setAmount] = useState<number>(50);
  const [custom, setCustom] = useState<string>("50");
  // қадамҳо
  const [step, setStep] = useState<"amount" | "pay" | "done">("amount");
  const [prepared, setPrepared] = useState<TopupPrepare | null>(null);
  const [left, setLeft] = useState(0); // сонияҳо то охири вақти чек
  // чек
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Topup | null>(null);
  const [requests, setRequests] = useState<Topup[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    try {
      const rows = await api.myTopups();
      setRequests(rows);
      // агар дархости фаъоли бе чек монда бошад → қадамро идома медиҳем
      const active = rows.find(
        (r) =>
          r.status === "awaiting_receipt" &&
          r.receipt_deadline &&
          new Date(r.receipt_deadline).getTime() > Date.now() &&
          r.dc_payment_url,
      );
      if (active) {
        setPrepared({
          id: active.id,
          amount_tjs: active.amount_tjs,
          payment_url: active.dc_payment_url!,
          receipt_deadline: active.receipt_deadline!,
        });
        setStep("pay");
      }
    } catch {
      /* рӯйхат гирифт нашуд — хатогӣ нишон намедиҳем */
    }
  }, [user]);

  // Пӯшидани модал бо Escape + боргирии дархостҳои корбар
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    void loadRequests();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, loadRequests]);

  // ⏱ Шумораи воз барои чек: 1 сония = 1 тик
  useEffect(() => {
    if (step !== "pay" || !prepared) return;
    const tick = () => {
      const ms = new Date(prepared.receipt_deadline).getTime() - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [step, prepared]);

  if (!open) return null;

  const expired = step === "pay" && left <= 0;
  const mmss = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;

  const handleSelect = (val: number) => {
    setAmount(val);
    setCustom(String(val));
  };

  const handleCustomChange = (val: string) => {
    setCustom(val);
    const num = parseFloat(val);
    setAmount(!isNaN(num) && num > 0 ? num : 0);
  };

  // 1️⃣ Омодасозии пардохт → кушодани саҳифаи pay.dc.tj
  const handlePrepare = async () => {
    if (!user || sending) return; // як дафъа — бе дубликация
    if (!(amount > 0)) {
      setErr(lang === "ru" ? "Введите сумму" : "Маблағро ворид кунед");
      return;
    }
    setErr("");
    setSending(true);
    try {
      const p = await api.prepareTopup(amount);
      setPrepared(p);
      setStep("pay");
      window.open(p.payment_url, "_blank"); // саҳифаи пардохт
      await loadRequests();
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : lang === "ru"
            ? "Ошибка отправки"
            : "Хатогӣ ҳангоми фиристодан",
      );
    } finally {
      setSending(false);
    }
  };

  // 2️⃣ Расми чек → Telegram-и админ
  const handleSendReceipt = async () => {
    if (!prepared || !file || sending || expired) return;
    setSending(true);
    setErr("");
    try {
      const req = await api.submitTopupReceipt(prepared.id, file);
      setDone(req);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await loadRequests();
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : lang === "ru"
            ? "Ошибка отправки"
            : "Хатогӣ ҳангоми фиристодан",
      );
    } finally {
      setSending(false);
    }
  };

  const backToAmount = () => {
    setStep("amount");
    setPrepared(null);
    setFile(null);
    setErr("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    /* 🔵 Overlay: торики + blur — қисми поёнро нопайдар мекунад.
       z-[60] > z-50-и BottomNav → навигатсияи поёнӣ ҳангоми кушодани
       модалка аз боло намебарояд */
    <div className="fixed inset-0 z-[60] grid place-items-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-[28px] bg-white/95 backdrop-blur-xl p-5 sm:p-6
                   shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_24px_60px_-20px_rgba(15,23,42,0.45),0_60px_120px_-40px_rgba(37,99,235,0.35)]
                   border border-white/70 ring-1 ring-blue-200/50
                   max-h-[92dvh] overflow-y-auto overscroll-contain"
        role="dialog"
        aria-modal="true"
        aria-label={lang === "ru" ? "Пополнение баланса" : "Пур кардани баланс"}
      >
        {/* 🎯 Glow-и болоии кабуд — ҳисси «дорогой» */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 rounded-t-[28px]
                     bg-[radial-gradient(120%_90%_at_50%_-20%,rgba(37,99,235,0.16),transparent_70%)]"
        />

        {/* Тугмаи пӯшидан — доираи равшан, дастрасии калон (44px тавсия) */}
        <button
          onClick={onClose}
          aria-label={t("close")}
          className="absolute top-4 right-4 grid place-items-center w-9 h-9 rounded-full
                     bg-slate-100/90 text-slate-500 ring-1 ring-slate-200/80
                     hover:bg-slate-200 hover:text-slate-700 active:scale-95 transition
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Ic icon={X} />
        </button>

        {/* Сарлавҳа: иконка-плита + матн бо типографияи фишурда */}
        <div className="relative flex items-center gap-3.5 mb-5 pr-10">
          <div
            className="grid place-items-center w-12 h-12 shrink-0 rounded-2xl
                       bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white
                       shadow-[0_10px_22px_-8px_rgba(37,99,235,0.75)] ring-1 ring-white/25"
          >
            <Ic icon={step === "pay" ? Timer : Send} size="lg" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[1.15rem] leading-tight font-extrabold tracking-[-0.01em] text-slate-900">
              {lang === "ru" ? "Пополнение баланса" : "Пур кардани баланс"}
            </h2>
            <p className="mt-0.5 text-[11px] sm:text-xs leading-snug font-medium text-slate-500">
              {lang === "ru"
                ? "Оплата DC City (pay.dc.tj) в сомони"
                : "Пардохти DC City (pay.dc.tj) бо сомонӣ"}
            </p>
          </div>
        </div>

        {done ? (
          /* ============ 3️⃣ ДАРХОСТ ФИРИСТОДА ШУД ============ */
          <div className="text-center py-2">
            <div className="grid place-items-center w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-600 mb-3">
              <Ic icon={CircleCheck} size="xl" strokeWidth={2} />
            </div>
            <h3 className="font-black text-slate-900 mb-1">{t("topupSent")}</h3>
            <p className="text-xs text-slate-500 mb-2">
              #{done.id} · {Number(done.amount_tjs).toLocaleString("tj-TJ")} сомонӣ
            </p>
            <span
              className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${STATUS_CLS[done.status]}`}
            >
              {t(STATUS_LABEL[done.status])}
            </span>
            <div className="mt-5 space-y-2">
              <button
                onClick={backToAmount}
                className="w-full btn btn-primary text-sm"
              >
                {lang === "ru" ? "Новая заявка" : "Дархости нав"}
              </button>
              <button
                onClick={onClose}
                className="w-full btn text-sm bg-slate-100 text-slate-700"
              >
                {t("close")}
              </button>
            </div>
          </div>
        ) : step === "amount" ? (
          /* ============ 1️⃣ ИНТИХОБИ МАБЛАҒ ============ */
          <>
            {/* Ҳолати корбар — картти glass бо кикер + рақами калон.
                320px: телефон дар як сатр (nowrap), «сомонӣ» зери рақам → ҳеҷ печидан */}
            {user ? (
              <div className="mb-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/70 border border-slate-200/80 p-3.5 sm:p-4 flex items-center justify-between gap-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <div className="min-w-0">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400 whitespace-nowrap">
                    {lang === "ru" ? "Текущий баланс:" : "Баланси ҷорӣ:"}
                  </div>
                  <div className="mt-1 text-[13px] sm:text-sm font-bold tabular-nums text-slate-800 whitespace-nowrap">
                    {user.phone || user.username || `#${user.id}`}
                  </div>
                </div>
                <div
                  className="flex shrink-0 items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-white
                             border border-slate-200/80 text-slate-900
                             shadow-[0_6px_16px_-8px_rgba(15,23,42,0.3)]"
                >
                  <GoldCoin className="w-4 h-4 shrink-0" />
                  <div className="leading-none text-right">
                    <div className="font-black text-[15px] tabular-nums tracking-[-0.01em]">
                      {Number(balance || 0).toLocaleString("tj-TJ")}
                    </div>
                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
                      сомонӣ
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
                <Ic
                  icon={TriangleAlert}
                  size="xs"
                  className="text-amber-500 mt-0.5 shrink-0"
                />
                <span className="flex-1">
                  {lang === "ru"
                    ? "Чтобы пополнить баланс, войдите в аккаунт:"
                    : "Барои пур кардани баланс лутфан ворид шавед:"}
                </span>
                <Link
                  to="/login"
                  onClick={onClose}
                  className="font-bold underline text-brand-700 shrink-0"
                >
                  {lang === "ru" ? "Войти" : "Вуруд"}
                </Link>
              </div>
            )}

            {/* Интихоби маблағ (presets) — 3 сатр, ҳар як кнопка «объёмӣ» */}
            <div className="mb-5">
              <label className="block text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-500 mb-2.5">
                {lang === "ru"
                  ? "Выберите сумму (сомони):"
                  : "Маблағро интихоб кунед (сомонӣ):"}
              </label>
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {PRESETS.map((p) => {
                  const active = amount === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleSelect(p)}
                      aria-pressed={active}
                      className={`relative rounded-2xl py-3 px-2 text-[13px] font-extrabold
                                  tabular-nums tracking-[0.01em] transition-all duration-150
                                  ring-1 active:scale-[0.97]
                                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1
                                  ${
                                    active
                                      ? "bg-gradient-to-b from-blue-500 to-blue-600 text-white ring-blue-400/60 shadow-[0_10px_20px_-8px_rgba(37,99,235,0.7),inset_0_1px_0_rgba(255,255,255,0.35)]"
                                      : "bg-white text-slate-700 ring-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_14px_-10px_rgba(15,23,42,0.25)] hover:ring-blue-300 hover:text-blue-700 hover:shadow-[0_10px_20px_-10px_rgba(37,99,235,0.45)]"
                                  }`}
                    >
                      <span className="block leading-none">{p}</span>
                      <span
                        className={`block mt-1 text-[9px] font-bold uppercase tracking-[0.14em] ${
                          active ? "text-blue-100/90" : "text-slate-400"
                        }`}
                      >
                        TJS
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ворид кардани маблағи дилхоҳ */}
            <div className="mb-5">
              <label
                htmlFor="topup-custom-amount"
                className="block text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-500 mb-2"
              >
                {lang === "ru"
                  ? "Или введите другую сумму:"
                  : "Ё маблағи дилхоҳро нависед:"}
              </label>
              <div className="relative">
                <input
                  id="topup-custom-amount"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="decimal"
                  value={custom}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/80
                             px-4 py-3 pr-24 text-[17px] font-extrabold tabular-nums
                             tracking-[-0.01em] text-slate-900 placeholder:font-medium placeholder:text-slate-400
                             outline-none transition
                             focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder={lang === "ru" ? "Сумма в сомони..." : "Маблағ бо сомонӣ..."}
                />
                <span
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold
                             uppercase tracking-[0.1em] text-slate-400"
                >
                  сомонӣ
                </span>
              </div>
            </div>

            {err && (
              <div
                role="alert"
                className="mb-3 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs font-bold text-rose-700"
              >
                {err}
              </div>
            )}

            {/* Тугмаи пардохт — CTA бо градиент + сояи равшан + сатри болоӣ */}
            <button
              onClick={handlePrepare}
              disabled={!user || sending || !(amount > 0)}
              className="w-full relative overflow-hidden rounded-2xl py-3.5 px-4
                         bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600
                         text-white text-[15px] font-extrabold tracking-[0.01em]
                         shadow-[0_14px_30px_-12px_rgba(37,99,235,0.85),inset_0_1px_0_rgba(255,255,255,0.3)]
                         transition hover:from-blue-700 hover:to-indigo-700
                         active:scale-[0.98]
                         flex items-center justify-center gap-2.5
                         disabled:opacity-60 disabled:pointer-events-none
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
            >
              {sending ? (
                <Ic icon={Loader2} className="animate-spin" />
              ) : (
                <Ic icon={Send} />
              )}
              <span className="tabular-nums">
                {sending
                  ? lang === "ru"
                    ? "Отправка..."
                    : "Мефиристад..."
                  : `${t("topupPay")} — ${amount} TJS`}
              </span>
            </button>
          </>
        ) : (
          /* ============ 2️⃣ ПАРДОХТ → ЧЕК ДАР 1 ДАҚИҚА ============ */
          <>
            {/* Маблағ + шумораи воз */}
            <div className="mb-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/70 border border-slate-200/80 p-4 flex items-center justify-between gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                  {lang === "ru" ? "Сумма заявки:" : "Маблағи дархост:"}
                </div>
                <div className="mt-1 text-[17px] font-black text-slate-900 tabular-nums tracking-[-0.01em]">
                  {Number(prepared?.amount_tjs || 0).toLocaleString("tj-TJ")}
                  <span className="ml-1 text-[11px] font-bold text-slate-400">сомонӣ</span>
                </div>
              </div>
              <div
                className={`flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-xl border font-black text-[15px] tabular-nums shadow-sm transition ${
                  left <= 15
                    ? "bg-rose-50 border-rose-300 text-rose-700"
                    : "bg-white border-slate-200 text-slate-900"
                }`}
                aria-label={t("topupTimeLeft")}
              >
                <Ic icon={Timer} />
                <span>{mmss}</span>
              </div>
            </div>

            {/* Дастур */}
            <div className="mb-4 rounded-xl bg-sky-50 border border-sky-200 p-3 text-xs font-semibold text-sky-900">
              {t("topupPayStep")}
            </div>

            {/* Кушодани саҳифаи пардохт (дубора) */}
            <button
              onClick={() =>
                prepared && window.open(prepared.payment_url, "_blank")
              }
              disabled={expired}
              className="w-full mb-4 py-2.5 px-4 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Ic icon={ExternalLink} />
              {t("topupReopenPay")}
            </button>

            {/* 📷 Чеки пардохт */}
            <div className="mb-4">
              <label
                htmlFor="topup-receipt"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                {t("topupReceipt")} *
              </label>
              <input
                ref={fileRef}
                id="topup-receipt"
                type="file"
                accept="image/*"
                disabled={expired}
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setErr("");
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={expired}
                aria-label={t("topupChooseReceipt")}
                className={`w-full py-2.5 px-4 rounded-xl border-2 border-dashed text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 ${
                  file
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-300 bg-slate-50 text-slate-600 hover:border-brand-400"
                }`}
              >
                <Ic icon={ImagePlus} />
                <span className="truncate max-w-[230px]">
                  {file ? file.name : t("topupChooseReceipt")}
                </span>
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

            {expired ? (
              /* ⏱ Вақт гузашт */
              <div className="space-y-2">
                <div
                  role="alert"
                  className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700 text-center"
                >
                  {t("topupExpired")}
                </div>
                <button onClick={backToAmount} className="w-full btn btn-primary text-sm">
                  {t("topupNewRequest")}
                </button>
              </div>
            ) : (
              <button
                onClick={handleSendReceipt}
                disabled={!file || sending}
                className="w-full rounded-2xl py-3.5 px-4
                           bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600
                           text-white text-[15px] font-extrabold tracking-[0.01em]
                           shadow-[0_14px_30px_-12px_rgba(37,99,235,0.85),inset_0_1px_0_rgba(255,255,255,0.3)]
                           transition hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98]
                           flex items-center justify-center gap-2.5
                           disabled:opacity-60 disabled:pointer-events-none
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
              >
                {sending ? (
                  <Ic icon={Loader2} className="animate-spin" />
                ) : (
                  <Ic icon={Send} />
                )}
                <span>
                  {sending
                    ? lang === "ru"
                      ? "Отправка..."
                      : "Мефиристад..."
                    : t("topupSendReceipt")}
                </span>
              </button>
            )}
          </>
        )}

        {/* 📜 Дархостҳои ман */}
        {user && requests.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-700 mb-2">
              {t("topupRequests")}
            </div>
            <ul className="space-y-1.5 max-h-36 overflow-y-auto">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 text-xs bg-slate-50 rounded-xl px-3 py-2"
                >
                  <span className="font-bold text-slate-800 tabular-nums">
                    #{r.id} · {Number(r.amount_tjs).toLocaleString("tj-TJ")} сомонӣ
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CLS[r.status]}`}
                  >
                    {t(STATUS_LABEL[r.status])}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
