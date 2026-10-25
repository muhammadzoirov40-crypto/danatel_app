import os

home_path = r"C:\Users\User\Desktop\danatel\frontend\src\pages\Home.tsx"
with open(home_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update state
old_state = """  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** ⭐ Рейтинги воқеӣ аз ҷадвали отзывҳо (админ тасдиқкардаҳо) */
  const [reviewSum, setReviewSum] = useState<{
    rating_avg: number;
    reviews_total: number;
  } | null>(null);"""

new_state = """  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** ⭐ Рейтинги воқеӣ аз ҷадвали отзывҳо (админ тасдиқкардаҳо) */
  const [reviewSum, setReviewSum] = useState<{
    rating_avg: number;
    reviews_total: number;
  } | null>(null);

  /** ❤️ Дӯстдоштаҳо (нигоҳдорӣ дар хотираи браузер) */
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("danatel_favorites") || "[]");
    } catch {
      return [];
    }
  });

  const [filterTab, setFilterTab] = useState<"all" | "popular" | "favorites">("all");

  const toggleFavorite = (slug: string) => {
    setFavorites((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      try {
        localStorage.setItem("danatel_favorites", JSON.stringify(next));
      } catch {}
      return next;
    });
  };"""

# Normalize CRLF/LF for replacement
content_norm = content.replace("\r\n", "\n")
old_state_norm = old_state.replace("\r\n", "\n")
new_state_norm = new_state.replace("\r\n", "\n")

if old_state_norm in content_norm:
    content_norm = content_norm.replace(old_state_norm, new_state_norm, 1)
    print("State replaced successfully")
else:
    print("Warning: old_state not found")

# 2. Update filtered logic
old_filter_norm = """  /** Ҷустуҷӯи зинда — аз рӯи ном ё slug */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games;
    return games.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.slug.toLowerCase().includes(q) ||
        (g.currency ?? "").toLowerCase().includes(q),
    );
  }, [games, query]);"""

new_filter_norm = """  /** Ҷустуҷӯи зинда ва филтр — ҳама / машҳур / дӯстдоштаҳо */
  const filtered = useMemo(() => {
    let list = games;
    if (filterTab === "popular") {
      list = list.filter((g) => g.is_popular);
    } else if (filterTab === "favorites") {
      list = list.filter((g) => favorites.includes(g.slug));
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.slug.toLowerCase().includes(q) ||
        (g.currency ?? "").toLowerCase().includes(q),
    );
  }, [games, query, filterTab, favorites]);"""

if old_filter_norm in content_norm:
    content_norm = content_norm.replace(old_filter_norm, new_filter_norm, 1)
    print("Filter logic replaced successfully")
else:
    print("Warning: old_filter not found")

# 3. Update section header
old_section_norm = """        {/* ===== 4) РӮЙХАТИ БОЗИҲО ===== */}
        <section id="games" className="mt-8 sm:mt-12 scroll-mt-20">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-xl font-extrabold tracking-tight inline-flex items-center gap-2">
              <Ic icon={Gamepad2} size="md" className="text-brand-600" />
              {query ? t("resultsFor") : t("chooseGame")}
            </h2>
            <Link
              to="/#games"
              className="text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-700 transition shrink-0"
            >
              {lang === "ru" ? "Весь каталог →" : lang === "uz" ? "Barcha katalog →" : lang === "en" ? "All catalog →" : "Ҳамаи каталог →"}
            </Link>
          </div>"""

new_section_norm = """        {/* ===== 4) РӮЙХАТИ БОЗИҲО ===== */}
        <section id="games" className="mt-8 sm:mt-12 scroll-mt-20">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-base sm:text-xl font-extrabold tracking-tight inline-flex items-center gap-2">
              <Ic icon={Gamepad2} size="md" className="text-brand-600" />
              {query ? t("resultsFor") : t("chooseGame")}
            </h2>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                aria-pressed={filterTab === "all"}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                  filterTab === "all"
                    ? "bg-brand-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Ic icon={LayoutGrid} size="xs" />
                <span>{lang === "ru" ? "Все" : lang === "uz" ? "Barchasi" : lang === "en" ? "All" : "Ҳама"}</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("popular")}
                aria-pressed={filterTab === "popular"}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                  filterTab === "popular"
                    ? "bg-rose-500 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Ic icon={Flame} size="xs" />
                <span>{lang === "ru" ? "Популярные" : lang === "uz" ? "Ommabop" : lang === "en" ? "Popular" : "Машҳур"}</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("favorites")}
                aria-pressed={filterTab === "favorites"}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                  filterTab === "favorites"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Ic icon={Heart} size="xs" className={favorites.length ? "fill-current" : ""} />
                <span>{lang === "ru" ? "Избранное" : lang === "uz" ? "Sevimlilar" : lang === "en" ? "Favorites" : "Дӯстдоштаҳо"}</span>
                {favorites.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{favorites.length}</span>
                )}
              </button>
            </div>
          </div>"""

if old_section_norm in content_norm:
    content_norm = content_norm.replace(old_section_norm, new_section_norm, 1)
    print("Section header replaced successfully")
else:
    print("Warning: old_section not found")

# 4. Pass props to GameCard
old_card = "<GameCard key={g.id} game={g} />"
new_card = "<GameCard key={g.id} game={g} isFavorite={favorites.includes(g.slug)} onToggleFavorite={toggleFavorite} />"
if old_card in content_norm:
    content_norm = content_norm.replace(old_card, new_card, 1)
    print("GameCard props replaced successfully")
else:
    print("Warning: old_card not found")

with open(home_path, "w", encoding="utf-8") as f:
    f.write(content_norm.replace("\n", "\r\n"))
print("Done Home.tsx")
