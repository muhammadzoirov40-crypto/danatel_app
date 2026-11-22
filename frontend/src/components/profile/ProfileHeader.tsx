import BackButton from "../BackButton";

/**
 * 📌 Сари саҳифаи «Профил» — услуби MegaFon:
 *   · часпак (sticky), баландии 56px (`h-14`) + `env(safe-area-inset-top)`;
 *   · танҳо иконкаи ← ва унвони 20px ним-ғафс;
 *   · дар десктоп зери Navbar-и часпак (`md:top-16` = 64px) меистад.
 */
export default function ProfileHeader({ title }: { title: string }) {
  return (
    <header
      className="sticky top-0 z-30 bg-[var(--mf-bg)] md:top-16"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-2">
        <BackButton iconOnly />
        <h1 className="truncate text-xl font-semibold text-[var(--mf-text)]">
          {title}
        </h1>
      </div>
    </header>
  );
}
