import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { GoldCoin } from "./Icons";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESETS = [20, 50, 100, 200, 500, 1000];

export default function TopUpModal({ open, onClose }: Props) {
  const { user, balance, lang } = useApp();
  const [amount, setAmount] = useState<number>(50);
  const [custom, setCustom] = useState<string>("50");

  if (!open) return null;

  const handleSelect = (val: number) => {
    setAmount(val);
    setCustom(String(val));
  };

  const handleCustomChange = (val: string) => {
    setCustom(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setAmount(num);
    }
  };

  const handlePay = () => {
    // Линки пардохти DC Wallet бо маблағ
    const dcUrl = `https://pay.dc.tj?amount=${amount}`;
    window.open(dcUrl, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Тугмаи пӯшидан ✕ */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 grid place-items-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
          aria-label="Пӯшидан"
        >
          ✕
        </button>

        {/* Сарлавҳа */}
        <div className="flex items-center gap-3 mb-4">
          <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 text-xl">
            ➕
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {lang === "ru" ? "Пополнение баланса" : "Пур кардани баланс"}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === "ru" ? "Мгновенное зачисление в сомони (TJS)" : "Пуркунии фаврӣ бо пули миллии сомонӣ"}
            </p>
          </div>
        </div>

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
          <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-center justify-between">
            <span>⚠️ Барои сабти баланс дар аккаунти худ лутфан ворид шавед:</span>
            <Link
              to="/login"
              onClick={onClose}
              className="font-bold underline text-brand-700 ml-2 shrink-0"
            >
              Вуруд
            </Link>
          </div>
        )}

        {/* Интихоби маблағ (presets) */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-700 mb-2">
            {lang === "ru" ? "Выберите сумму (сомони):" : "Маблағро интихоб кунед (сомонӣ):"}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleSelect(p)}
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
            {lang === "ru" ? "Или введите другую сумму:" : "Ё маблағи дилхоҳро нависед:"}
          </label>
          <div className="relative">
            <input
              type="number"
              min="1"
              step="1"
              value={custom}
              onChange={(e) => handleCustomChange(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
              placeholder="Маблағ бо сомонӣ..."
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              сомонӣ
            </span>
          </div>
        </div>

        {/* Тугмаи пардохт */}
        <div className="space-y-2">
          <button
            onClick={handlePay}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition flex items-center justify-center gap-2"
          >
            <span>💳</span>
            <span>
              {lang === "ru"
                ? `Оплатить ${amount} сомони (DC Wallet)`
                : `Пардохти ${amount} сомонӣ (DC Wallet)`}
            </span>
          </button>

          <a
            href="https://t.me/ONLAYN_ALMAZ_TJ_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs transition flex items-center justify-center gap-2"
          >
            <span>💬</span>
            <span>
              {lang === "ru"
                ? "Пополнить через Telegram Bot"
                : "Пур кардан тавассути Telegram Bot"}
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
