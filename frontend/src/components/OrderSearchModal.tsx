import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function OrderSearchModal({ open, onClose }: Props) {
  const { lang } = useApp();
  const nav = useNavigate();
  const [orderId, setOrderId] = useState("");
  const [err, setErr] = useState("");

  if (!open) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(orderId.trim(), 10);
    if (isNaN(id) || id <= 0) {
      setErr(lang === "ru" ? "Введите правильный номер заказа" : "Рақами дурусти фармоишро нависед");
      return;
    }
    onClose();
    nav(`/order/${id}`);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 grid place-items-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
          aria-label="Пӯшидан"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="grid place-items-center w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100 text-xl">
            🛒
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">
              {lang === "ru" ? "Поиск заказа" : "Санҷиши фармоиш"}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === "ru" ? "Введите номер заказа (Order ID)" : "Рақами фармоишро нависед"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="space-y-3">
          <div>
            <input
              type="number"
              min="1"
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                setErr("");
              }}
              placeholder="Масалан: 1, 2, 7..."
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              autoFocus
            />
            {err && <p className="text-xs text-rose-600 mt-1">{err}</p>}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-brand-600 text-white font-bold text-sm shadow-md hover:bg-brand-700 transition"
          >
            {lang === "ru" ? "Найти заказ →" : "Ҷустуҷӯи фармоиш →"}
          </button>
        </form>
      </div>
    </div>
  );
}
