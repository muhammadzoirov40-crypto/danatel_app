import { useEffect } from "react";
import { useApp } from "../context/AppContext";
import BackButton from "../components/BackButton";
import StickyHeader from "../components/StickyHeader";
import InfoSections from "../components/InfoSections";

/**
 * Саҳифаи «Дар бораи мо» — маълумоти дароз (SEO/FAQ/тамос) аз саҳифаи
 * асосӣ ба ин ҷо кӯчидааст. Ҳамаи матн ва пайвандҳо (бозиҳо, Telegram,
 * телефон) дар InfoSections боқӣ мемонанд.
 */
export default function About() {
  const { t } = useApp();

  useEffect(() => {
    document.title = `${t("navAbout")} — donatshop`;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prev = meta?.getAttribute("content") ?? "";
    const intro = t("seoIntro");
    if (meta) meta.setAttribute("content", intro.slice(0, 160));
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}/about`;
    window.scrollTo(0, 0);

    return () => {
      document.title = "donatshop.tj — Донати бозиҳо";
      if (meta) meta.setAttribute("content", prev || "donatshop.tj — Донати бозиҳо: Free Fire, PUBG Mobile, Mobile Legends");
      canonical?.remove();
    };
  }, [t]);

  return (
    <div className="pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-0">
      <StickyHeader title={t("navAbout")} />
      {/* pt: сари ҳамешагӣ (56px + safe-area) дар мобилӣ → мазмун аз зери
          он оғоз меёбад; дар md+ сар пинҳон → padding-и аслӣ барқарор. */}
      <div className="mx-auto max-w-6xl px-4 pt-[calc(64px_+_env(safe-area-inset-top,0px))] pb-5 sm:pb-8 md:pt-8">
        {/* Сатри ← + ном: дар мобилӣ САР пинҳон (такрорӣ аз сар нест),
            дар десктоп ба ҷои он ҳамчун сарлавҳаи саҳифа кор мекунад. */}
        <div className="mb-4 hidden items-center gap-2.5 md:flex">
          <BackButton iconOnly />
          <h1 className="text-xl sm:text-2xl font-black leading-tight">{t("navAbout")}</h1>
        </div>
        <InfoSections />
      </div>
    </div>
  );
}
