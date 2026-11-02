import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, PenLine, Star } from "lucide-react";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import type { Review, ReviewSummary } from "../types";
import { Ic } from "./Icons";
import ReviewForm from "./ReviewForm";

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
export default function Reviews({ hideTitle = false }: { hideTitle?: boolean }) {
  const { t, user } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<Review[]>([]);
  const [sum, setSum] = useState<ReviewSummary | null>(null);
  const [open, setOpen] = useState(false);

  const load = () => {
    api.reviews(12).then(setItems).catch(() => setItems([]));
    api.reviewSummary().then(setSum).catch(() => setSum(null));
  };

  useEffect(load, []);

  const avg = sum?.rating_avg ?? 0;
  const total = sum?.reviews_total ?? 0;
  const canWrite = Boolean(sum?.can_review && !sum.my_review_id);

  return (
    <section
      id="reviews"
      className={`${hideTitle ? "mt-4 sm:mt-6" : "mt-10 sm:mt-14"} scroll-mt-20`}
    >
      {/* Сарлавҳа: танҳо вақте ки чизе дорад (рейтинг/тугмаи навиштан).
          Матни холӣ «Ҳанӯз тақриз нест» дар ин ҷо НАМЕНОВИСЕМ — картҳои
          поёнӣ (reviewsNoYet + «Вуруд») ягона манбаи холии воқеӣ аст,
          то матн ду маротиба такрор нашавад. */}
      {!(hideTitle && total === 0 && !canWrite) && (
        <div
          className={`flex items-center gap-3 mb-4 flex-wrap ${
            hideTitle ? "justify-start" : "justify-between"
          }`}
        >
          {!hideTitle && (
            <h2 className="text-xl sm:text-2xl font-bold inline-flex items-center gap-2">
              <Ic icon={Star} size="md" className="text-amber-400 fill-current" />
              {t("reviewsTitle")}
            </h2>
          )}

          {total > 0 && (
            <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Stars value={avg} />
              {avg.toFixed(1)}
              <span className="font-medium text-slate-500">
                ({total} {t("reviewsCount")})
              </span>
            </span>
          )}

          {canWrite && (
            <button onClick={() => setOpen((v) => !v)} className="btn text-sm">
              <Ic icon={PenLine} />
              {t("writeReview")}
            </button>
          )}
        </div>
      )}

      {/* ✍️ Шакли навиштан — танҳо барои муштарии фармоиши иҷрочуда.
          Ягона компоненти ReviewForm (ҳамон чиз дар саҳифаи фармоиш). */}
      {open && (
        <ReviewForm onSubmitted={load} onCancel={() => setOpen(false)} />
      )}

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
