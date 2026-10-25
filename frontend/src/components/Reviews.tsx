import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MessageSquare, PenLine, Send, Star } from "lucide-react";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import type { Review, ReviewSummary } from "../types";
import { Ic } from "./Icons";

/** Рейтинги 5-ситорагӣ бо иконкаҳои касбӣ (Lucide Star) */
function Stars({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const n = Math.round(value);
  const iconSize = size === "sm" ? "xs" : "sm";
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${n}/5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Ic
          key={i}
          icon={Star}
          size={iconSize}
          className={
            i <= n ? "text-amber-400 fill-current" : "text-slate-300"
          }
        />
      ))}
    </span>
  );
}

/**
 * ⭐ Блоки отзывҳои ВОҚЕӢ.
 *  - рейтинги миёна аз ҷадвали reviews (тасдиқшудаҳо);
 *  - танҳо муштарии фармоиши иҷрочуда метавонад нависад;
 *  - админ пеш аз намоиш тасдиқ мекунад.
 */
export default function Reviews() {
  const { t, user } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<Review[]>([]);
  const [sum, setSum] = useState<ReviewSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = () => {
    api.reviews(12).then(setItems).catch(() => setItems([]));
    api.reviewSummary().then(setSum).catch(() => setSum(null));
  };

  useEffect(load, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      await api.createReview({ rating, text: text.trim() });
      setMsg(t("reviewSent"));
      setText("");
      setOpen(false);
      load();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const avg = sum?.rating_avg ?? 0;
  const total = sum?.reviews_total ?? 0;

  return (
    <section id="reviews" className="mt-10 sm:mt-14 scroll-mt-20">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-xl sm:text-2xl font-bold inline-flex items-center gap-2">
          <Ic icon={Star} size="md" className="text-amber-400 fill-current" />
          {t("reviewsTitle")}
        </h2>

        <div className="flex items-center gap-3">
          {total > 0 ? (
            <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Stars value={avg} />
              {avg.toFixed(1)}
              <span className="font-medium text-slate-500">
                ({total} {t("reviewsCount")})
              </span>
            </span>
          ) : (
            <span className="text-sm text-slate-500">{t("reviewsEmpty")}</span>
          )}

          {sum?.can_review && !sum.my_review_id && (
            <button onClick={() => setOpen((v) => !v)} className="btn text-sm">
              <Ic icon={PenLine} />
              {t("writeReview")}
            </button>
          )}
        </div>
      </div>

      {/* ✍️ Шакли навиштан — танҳо барои муштарии фармоиши иҷрочуда */}
      {open && (
        <form
          onSubmit={submit}
          className="card p-4 sm:p-5 mb-4 border border-brand-200 space-y-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold">{t("yourRating")}</span>
            <div className="flex gap-1.5">
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
            placeholder={t("reviewPlaceholder")}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                       outline-none focus:ring-2 focus:ring-brand-400"
          />

          {err && <div className="text-sm text-rose-600">{err}</div>}

          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy || text.trim().length < 5} className="btn">
              <Ic icon={busy ? Loader2 : Send} className={busy ? "animate-spin" : ""} />
              {t("send")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              {t("cancel")}
            </button>
            <span className="ml-auto text-xs text-slate-400">{t("reviewModerated")}</span>
          </div>
        </form>
      )}

      {msg && <div className="mb-3 text-sm text-emerald-600">{msg}</div>}

      {/* 📋 Рӯйхати отзывҳои тасдиқшуда */}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((r) => (
            <article key={r.id} className="card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-slate-800 truncate">
                  {r.author_name}
                </span>
                <Stars value={r.rating} size="sm" />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{r.text}</p>
              <time className="text-xs text-slate-400">
                {new Date(r.created_at).toLocaleDateString()}
              </time>
            </article>
          ))}
        </div>
      ) : (
        !open && (
          <div className="card p-6 text-center text-sm text-slate-500">
            <div className="flex justify-center mb-2 text-slate-300">
              <Ic icon={MessageSquare} size="xl" />
            </div>
            {t("reviewsNoYet")}
            {!user && (
              <div className="mt-3">
                <button onClick={() => navigate("/login")} className="btn-ghost text-sm">
                  {t("login")} →
                </button>
              </div>
            )}
          </div>
        )
      )}
    </section>
  );
}
