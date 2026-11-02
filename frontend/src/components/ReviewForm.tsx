import { useState, type FormEvent } from "react";
import { Loader2, Send, Star } from "lucide-react";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import { Ic } from "./Icons";

/**
 * ✍️ Шакли тақриз — ягона барои ҳамаи ҷоҳо (саҳифаи фармоиш + «Тақризҳо»).
 *
 *  - `orderId` → тақриз барои ҲАМОН фармоиш (пас аз иҷро худкор пайдо мешавад);
 *  - бе `orderId` → backend худаш фармоиши иҷрочудаи охиринро мегирад;
 *  - як дархост (busy-guard) — дубликати POST намеравад;
 *  - натиҷа `role="status"` — ба screen reader низ хабар медиҳад.
 */
export default function ReviewForm({
  orderId,
  onSubmitted,
  onCancel,
}: {
  orderId?: number;
  onSubmitted?: () => void;
  onCancel?: () => void;
}) {
  const { t } = useApp();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return; // 🛡️ дархости дубра нест
    setErr("");
    setBusy(true);
    try {
      await api.createReview({
        rating,
        text: text.trim(),
        ...(orderId ? { order_id: orderId } : {}),
      });
      setDone(true);
      setText("");
      onSubmitted?.();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ✅ Фиристода шуд — пас аз тасдиқи админ намоиш дода мешавад
  if (done) {
    return (
      <div
        role="status"
        className="card mb-4 p-4 sm:p-5 border border-emerald-200 bg-emerald-50
                   text-sm font-medium text-emerald-700 text-left"
      >
        {t("reviewSent")}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="card mb-4 p-4 sm:p-5 border border-brand-200 space-y-3 text-left"
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold">{t("yourRating")}</span>
        <div className="flex gap-1.5" role="group" aria-label={t("yourRating")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className="rounded-lg p-1 transition hover:scale-110 active:scale-95
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              aria-label={`${n}`}
              aria-pressed={rating === n}
            >
              <Ic
                icon={Star}
                size="lg"
                strokeWidth={1.5}
                className={
                  n <= rating ? "text-amber-400 fill-current" : "text-slate-300"
                }
              />
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={600}
        required
        aria-label={t("reviewPlaceholder")}
        placeholder={t("reviewPlaceholder")}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                   outline-none focus:ring-2 focus:ring-brand-400"
      />

      {err && (
        <div role="alert" className="text-sm text-rose-600">
          {err}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button type="submit" disabled={busy || text.trim().length < 5} className="btn">
          <Ic icon={busy ? Loader2 : Send} className={busy ? "animate-spin" : ""} />
          {t("send")}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            {t("cancel")}
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">{t("reviewModerated")}</span>
      </div>
    </form>
  );
}
