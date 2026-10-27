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
  expired: "topupExpiredShort",
};

const STATUS_CLS: Record<Topup["status"], string> = {
  awaiting_receipt: "bg-sky-100 text-sky-800",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
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
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Тугмаи пӯшидан */}
        <button
          onClick={onClose}
          aria-label={t("close")}
          className="absolute top-4 right-4 grid place-items-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Ic icon={X} />
        </button>

        {/* Сарлавҳа */}
        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
            <Ic icon={step === "pay" ? Timer : Send} size="lg" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {lang === "ru" ? "Пополнение баланса" : "Пур кардани баланс"}
            </h2>
            <p className="text-xs text-slate-500">
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
            {/* Ҳолати корбар */}
            {user ? (
              <div className="mb-4 rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500">
                    {lang === "ru" ? "Текущий баланс:" : "Баланси ҷорӣ:"}
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    {user.phone || user.username || `#${user.id}`}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-slate-200 text-slate-900 font-black tabular-nums shadow-xs">
                  <GoldCoin className="w-4 h-4" />
                  <span>{Number(balance || 0).toLocaleString("tj-TJ")} сомонӣ</span>
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

            {/* Интихоби маблағ (presets) */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                {lang === "ru"
                  ? "Выберите сумму (сомони):"
                  : "Маблағро интихоб кунед (сомонӣ):"}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSelect(p)}
                    aria-pressed={amount === p}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                      amount === p
                        ? "bg-brand-600 text-white shadow-md shadow-brand-500/25 scale-[1.02]"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {p} TJS
                  </button>
                ))}
              </div>
            </div>

            {/* Ворид кардани маблағи дилхоҳ */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {lang === "ru"
                  ? "Или введите другую сумму:"
                  : "Ё маблағи дилхоҳро нависед:"}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={custom}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
                  placeholder={lang === "ru" ? "Сумма в сомони..." : "Маблағ бо сомонӣ..."}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
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

            {/* Тугмаи пардохт */}
            <button
              onClick={handlePrepare}
              disabled={!user || sending || !(amount > 0)}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
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
                  : `${t("topupPay")} — ${amount} TJS`}
              </span>
            </button>
          </>
        ) : (
          /* ============ 2️⃣ ПАРДОХТ → ЧЕК ДАР 1 ДАҚИҚА ============ */
          <>
            {/* Маблағ + шумораи воз */}
            <div className="mb-4 rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  {lang === "ru" ? "Сумма заявки:" : "Маблағи дархост:"}
                </div>
                <div className="text-sm font-black text-slate-900 tabular-nums">
                  {Number(prepared?.amount_tjs || 0).toLocaleString("tj-TJ")} сомонӣ
                </div>
              </div>
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border font-black tabular-nums shadow-xs ${
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
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
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
