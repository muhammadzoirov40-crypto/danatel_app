import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  CircleHelp,
  Coins,
  Copy,
  Gamepad2,
  History,
  Loader2,
  Percent,
  RefreshCw,
  ScrollText,
  Sparkles,
  Trophy,
  UserPlus,
} from "lucide-react";
import { api, ApiError } from "../api/client";
import { useApp } from "../context/AppContext";
import type { CoinsInfo, CoinTx, Game, WheelData, WheelSpin } from "../types";
import BackButton from "../components/BackButton";
import { GoldCoin, Ic } from "../components/Icons";
import { copyText } from "../utils/clipboard";

/**
 * 🎡 САҲИФАИ «ЧАРХ» — гардиши тангаҳо (Фаза 2).
 *
 * Ҳама рақамҳо аз backend:
 *   • сегментҳо + эҳтимолиётҳо        → GET /api/coins/wheel
 *   • ҷоиза                            → POST /api/coins/spin
 *   • тангаҳои ман + таърихи гардишҳо  → GET /api/coins/me
 *   • бурдиҳони охирин                 → сатрҳои воқеии coin_transactions
 * Фронт ҲЕҶ ГОҲ маблағ ё натиҷа намесозад — танҳо нишон медиҳад.
 */

/** Рангҳои сегментҳо (аз ҷоизаи хурд → Ҷекпот) */
/* 🎨 Рангҳои ҳамвору бодлом — мисли тасвир (сенечҳо бо сарҳади
   сиёҳи ғафс, ҳар сенеч ранги алоҳидаи бодлом). */
const PALETTE = [
  { bg: "#ef4444", fg: "#ffffff" }, // сурх
  { bg: "#f97316", fg: "#ffffff" }, // норинҷӣ
  { bg: "#f59e0b", fg: "#ffffff" }, // кҳӯда/amber
  { bg: "#22c55e", fg: "#ffffff" }, // сабз
  { bg: "#14b8a6", fg: "#ffffff" }, // teal
  { bg: "#06b6d4", fg: "#ffffff" }, // cyan
  { bg: "#3b82f6", fg: "#ffffff" }, // кабуд
  { bg: "#6366f1", fg: "#ffffff" }, // indigo
  { bg: "#8b5cf6", fg: "#ffffff" }, // violet
  { bg: "#ec4899", fg: "#ffffff" }, // гулобӣ
];

/** 🖤 Сарҳади сиёҳи ғафси сенечҳо (мисли тасвир) */
const SEG_STROKE = "#0f172a";
const SEG_STROKE_W = 2.5;
/** ⬛ Рими сиёҳи берунӣ (мисли тасвир) */
const RIM_DARK = "#111827";

const SIZE = 360; // viewBox
const CENTER = SIZE / 2;
const RADIUS = 152;
const TEXT_R = 116;
const SPIN_MS = 5200;

/** Нуқта дар доира: 0° = боло (дар ҷои нӯги) */
function point(angle: number, radius: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
}

/** Сектори чарх аз a1 то a2 (аз рӯи ақрабӣ) */
function sectorPath(a1: number, a2: number) {
  const p1 = point(a1, RADIUS);
  const p2 = point(a2, RADIUS);
  const large = a2 - a1 > 180 ? 1 : 0;
  return (
    `M ${CENTER} ${CENTER} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} ` +
    `A ${RADIUS} ${RADIUS} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`
  );
}

/** 🎨 Ранги hex-ро равшан/тарак соз барои градиенти сенечҳо */
function shade(hex: string, amt: number) {
  const num = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((num >> 16) & 0xff) + amt);
  const g = clamp(((num >> 8) & 0xff) + amt);
  const b = clamp((num & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export default function Wheel() {
  const { t, lang, user, refreshUser, balance } = useApp();
  const nav = useNavigate();

  const [data, setData] = useState<WheelData | null>(null);
  const [mine, setMine] = useState<CoinsInfo | null>(null);
  const [err, setErr] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<WheelSpin | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [rotation, setRotation] = useState(0);

  // 💱 Иваз ба баланс
  const [busyEx, setBusyEx] = useState(false);
  const [exMsg, setExMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // 💱 Иваз — самт: ба баланс (танга→сомонӣ) ё ба танга (сомонӣ→танга)
  const [exDir, setExDir] = useState<"toBalance" | "toCoins">("toBalance");
  const [tjsAmount, setTjsAmount] = useState("");
  const [busyEx2, setBusyEx2] = useState(false);

  const timerRef = useRef<number | null>(null);

  // 🎮 Бозиҳо — рӯйхати интихоб пеш аз гардиш
  const [games, setGames] = useState<Game[]>([]);
  const [savingGame, setSavingGame] = useState(false);
  // 🔗 Линки даъват
  const [inviteCopied, setInviteCopied] = useState(false);

  const loadWheel = useCallback(async () => {
    try {
      setData(await api.wheel());
      setErr("");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("error"));
    }
  }, [t]);

  const loadMine = useCallback(async () => {
    if (!user) {
      setMine(null);
      return;
    }
    try {
      setMine(await api.myCoins());
    } catch {
      setMine(null);
    }
  }, [user]);

  useEffect(() => {
    void loadWheel();
  }, [loadWheel]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  // 🎮 Рӯйхати бозиҳо барои интихоб (забони ҷорӣ)
  useEffect(() => {
    api
      .games(lang)
      .then(setGames)
      .catch(() => setGames([]));
  }, [lang]);

  // Таймери аниматсия → ҳангоми баромад аз саҳифа пок мешавад
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const cost = data?.cost ?? 0;
  const exchangeRate = mine?.exchange_rate ?? data?.exchange_rate ?? 0;
  const minExchange = mine?.min_exchange ?? data?.min_exchange ?? 0;
  const minExchangeTjs = mine?.min_exchange_tjs ?? 1;
  const tjsNum = Number(tjsAmount);
  const tjsOk =
    !!tjsAmount &&
    !Number.isNaN(tjsNum) &&
    Number.isInteger(tjsNum) &&
    tjsNum >= minExchangeTjs;
  const myCoins = mine?.coins ?? null;
  const missing = myCoins !== null && myCoins < cost;
  const waitLogin = !user;
  const waitCoins = !!user && myCoins === null;
  const pickedSlug = mine?.favorite_game ?? null;
  const pickedGame = games.find((g) => g.slug === pickedSlug) ?? null;
  // Қоидаи соҳиб: «ба ҳама накун» — корбар аввал бозии худашро интихоб мекунад
  const needGame = !!user && !!mine && !pickedSlug;
  const disabled =
    spinning || !data || waitCoins || missing || needGame || savingGame;

  /** 🎮 Интихоби бозӣ: корбар худаш мегузорад → сабт дар backend */
  const pickGame = async (slug: string) => {
    if (!user) {
      nav("/login", { replace: false });
      return;
    }
    if (savingGame || mine?.favorite_game === slug) return;
    setSavingGame(true);
    try {
      const res = await api.setMyGame(slug);
      setMine((m) => (m ? { ...m, favorite_game: res.game_slug } : m));
      setErr("");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("error"));
    } finally {
      setSavingGame(false);
    }
  };

  // 🔗 Линки даъват (аз коди шахсии корбар)
  const inviteLink = mine?.referral_code
    ? `${window.location.origin}/?ref=${mine.referral_code}`
    : "";

  const copyInvite = async () => {
    if (!inviteLink) return;
    const ok = await copyText(inviteLink);
    if (ok) {
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 1800);
    }
  };

  /** 🎡 Як гардиш: ҷоиза аз backend → чарх ба ҷои ғолиб мегардад */
  const doSpin = async () => {
    if (spinning) return;
    if (waitLogin) {
      nav("/login", { replace: false });
      return;
    }
    if (!data) return;
    if (needGame) return; // қоида: аввал бозии худашро интихоб кунад

    setResult(null);
    setErr("");
    setSpinning(true);

    try {
      const res = await api.spinWheel();

      const idx = data.segments.findIndex((s) => s.coins === res.prize);
      const count = data.segments.length || 1;
      const seg = 360 / count;
      const mid = idx >= 0 ? idx * seg + seg / 2 : 0;

      // Чарх бояд ҷои ғолибро зери нӯги боло биёрад
      const norm = ((rotation % 360) + 360) % 360;
      let delta = 360 - mid - norm;
      if (delta < 0) delta += 360;
      setRotation(rotation + 360 * 6 + delta);

      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setSpinning(false);
        setResult(res);
        void loadMine(); // тангаҳо + таърихи гардишҳо нав
        void loadWheel(); // бурдиҳони охирин нав
      }, SPIN_MS + 200);
    } catch (e) {
      setSpinning(false);
      setErr(e instanceof ApiError ? e.message : t("error"));
    }
  };

  /** 💱 Ивази танга ба баланс (танҳо адади куллӣ аз backend) */
  const doExchange = async () => {
    if (!mine || busyEx) return;
    if (mine.coins < mine.min_exchange) return;
    setBusyEx(true);
    setExMsg(null);
    try {
      const res = await api.exchangeCoins();
      setExMsg({
        ok: true,
        text: t("exchangeDone").replace(
          "{amount}",
          Number(res.credited_tjs).toLocaleString("tj-TJ"),
        ),
      });
      await refreshUser();
      await loadMine();
    } catch (e) {
      setExMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : t("error"),
      });
    } finally {
      setBusyEx(false);
    }
  };

  /** 💱 Ивази БАЛАНС ба танга: 1 сомонӣ = N танга (танҳо адади куллӣ) */
  const doExchangeToCoins = async () => {
    if (!mine || busyEx2 || !tjsOk) return;
    setBusyEx2(true);
    setExMsg(null);
    try {
      const res = await api.exchangeToCoins(tjsNum);
      setExMsg({
        ok: true,
        text: t("exchangeToCoinsDone").replace(
          "{amount}",
          String(res.gained_coins),
        ),
      });
      setTjsAmount("");
      await refreshUser();
      await loadMine();
    } catch (e) {
      setExMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : t("error"),
      });
    } finally {
      setBusyEx2(false);
    }
  };

  // 📖 Гардишҳои худи ман (аз таърихи тангаҳо — ҳамон backend)
  const mySpinRows: CoinTx[] = (mine?.history ?? []).filter(
    (h) => h.kind === "spin" || h.kind === "spin_reward",
  );

  const KIND_KEY: Record<string, string> = {
    spin: "kindSpin",
    spin_reward: "kindSpinReward",
  };

  const segments = data?.segments ?? [];
  const segAngle = 360 / (segments.length || 1);

  return (
    <div className="profile-soft min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        {/* ⬅️🪙 САТРИ БОЛО мисли HEADER: Бозгашт (чап) + Монета (рост),
            ҳама бо iconka. ⚠️ 30.10.2026: «Таърих» аз ин сатр ХОРИҶ шуд
            (талаби соҳиб: «na tarux»). */}
        <div className="flex items-center justify-between gap-2">
          <BackButton className="mb-0" />
          {mine && (
            <div
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3 text-xs font-extrabold text-white shadow-md shadow-indigo-500/30"
              aria-label={`${mine.coins} танга`}
            >
              <GoldCoin className="w-4 h-4" />
              <span className="tabular-nums">{mine.coins}</span>
              <span className="font-bold opacity-85">танга</span>
            </div>
          )}
        </div>

        {/* ===== САРЛАВҲА ===== */}
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight inline-flex items-center gap-2">
              <Ic icon={Sparkles} size="md" className="text-brand-600" />
              {t("wheel")}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("wheelHint")}
            </p>
          </div>
        </header>

        {/* ===== 📖 ГАРДИШҲОИ МАН ===== */}
        {showHistory && (
          <section className="card p-4" aria-label={t("mySpins")}>
            <h2 className="mb-3 text-base font-extrabold inline-flex items-center gap-2">
              <Ic icon={History} size="md" className="text-amber-600" />
              {t("mySpins")}
            </h2>
            {mySpinRows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center text-sm text-slate-500 dark:border-white/10">
                {t("noSpins")}
              </p>
            ) : (
              <ul className="space-y-2">
                {mySpinRows.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5 dark:border-white/10"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        {t(KIND_KEY[tx.kind] ?? "kindSpin")}
                      </div>
                      {tx.reason && (
                        <div className="truncate text-xs text-slate-500">
                          {tx.reason}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={`text-sm font-black tabular-nums ${
                          tx.amount >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(tx.created_at).toLocaleString(lang)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ===== ХАТОГӢ ===== */}
        {err && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span>{err}</span>
              <button
                type="button"
                onClick={() => {
                  void loadWheel();
                  if (user) void loadMine();
                }}
                className="btn-ghost text-sm"
              >
                <Ic icon={RefreshCw} />
                {t("loading")}
              </button>
            </div>
          </div>
        )}

        {/* ===== 🎮 БОЗИИ МАН — интихоб пеш аз гардиш ===== */}
        {user && games.length > 0 && (
          <section className="card p-4" aria-label={t("myGame")}>
            <div className="flex items-center gap-2 mb-3">
              <Ic icon={Gamepad2} size="md" className="text-brand-600" />
              <span className="text-sm font-extrabold">{t("myGame")}</span>
            </div>
            <p className="mt-0.5 mb-3 text-xs text-slate-500 dark:text-slate-400">
              {t("myGameHint")}
            </p>
            {/* 🎮 Бозиҳо — ЯК САТР бо скролли чап-рост (overflow-x).
                ⚠️ 30.10.2026 (талаби соҳиб): «inro dar 1 row soz bo
                sclori chapu rost» → ҳамаи чипҳо дар як сатр, скролл
                уфуқӣ. `shrink-0` → чипҳо насӯзианд. */}
            <div
              className="flex gap-2 overflow-x-auto overscroll-x-contain -mx-1 px-1 pb-1 wheel-hscroll"
              role="radiogroup"
              aria-label={t("myGame")}
            >
              {games.map((g) => {
                const active = g.slug === pickedSlug;
                return (
                  <button
                    key={g.slug}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={g.name}
                    onClick={() => void pickGame(g.slug)}
                    disabled={savingGame}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl border px-3 py-2 text-sm font-bold whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60 ${
                      active
                        ? "border-brand-500 bg-brand-600 text-white shadow-md shadow-brand-500/25"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                    }`}
                  >
                    {g.emoji && (
                      <span aria-hidden className="text-base leading-none">
                        {g.emoji}
                      </span>
                    )}
                    {g.name}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== 🎡 ЧАРХ + ТУГМА ===== */}
        <section className="card p-4 sm:p-6" aria-label={t("wheel")}>
          <div className="relative mx-auto aspect-square w-full max-w-[330px]">
            {/* Чарх — мечархад */}
            <div
              className="absolute inset-0"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.2, 1)`
                  : "none",
              }}
            >
              {segments.length > 0 ? (
                <svg
                  viewBox={`0 0 ${SIZE} ${SIZE}`}
                  className="h-full w-full drop-shadow-[0_10px_20px_rgba(15,23,42,0.25)]"
                  role="img"
                  aria-label={t("wheel")}
                >
                  <defs>
                    {/* 🎨 Градиенти ҳар сенеч (равшан → тарак) */}
                    {PALETTE.map((c, i) => (
                      <linearGradient key={i} id={`wg${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={shade(c.bg, 26)} />
                        <stop offset="55%" stopColor={c.bg} />
                        <stop offset="100%" stopColor={shade(c.bg, -30)} />
                      </linearGradient>
                    ))}
                    {/* ✨ Глосс/оина дар болои чарҳ */}
                    <radialGradient id="wheelGloss" cx="34%" cy="26%" r="72%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.42)" />
                      <stop offset="45%" stopColor="rgba(255,255,255,0.08)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </radialGradient>
                    {/* 🔲 Сояи дохилӣ барои ҳалқаи дохилӣ */}
                    <radialGradient id="innerShade" cx="50%" cy="50%" r="50%">
                      <stop offset="70%" stopColor="rgba(15,23,42,0)" />
                      <stop offset="100%" stopColor="rgba(15,23,42,0.18)" />
                    </radialGradient>
                  </defs>

                  {/* ⬛ Рими берунии СИЁҲ + ҳалқаи сафед (мисли тасвир) */}
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS + 11}
                    fill={RIM_DARK}
                    stroke="#000000"
                    strokeWidth={2}
                  />
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS + 4}
                    fill="#ffffff"
                    stroke={RIM_DARK}
                    strokeWidth={2.5}
                  />
                  {segments.map((s, i) => {
                    const a1 = i * segAngle;
                    const mid = a1 + segAngle / 2;
                    const col = PALETTE[i % PALETTE.length];
                    const flip = mid > 90 && mid < 270;
                    return (
                      <g key={s.coins}>
                        <path
                          d={sectorPath(a1, a1 + segAngle)}
                          fill={`url(#wg${i % PALETTE.length})`}
                          stroke={SEG_STROKE}
                          strokeWidth={SEG_STROKE_W}
                        />
                        <g transform={`rotate(${mid} ${CENTER} ${CENTER})`}>
                          <text
                            x={CENTER}
                            y={CENTER - TEXT_R}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            /* 📐 Матн РАДИАЛӢ — аз боло ба поён (дарҷои тунҷа).
                               `rotate(±90)` дар маркази матн → хондан аз
                               берун ба дарун. `flip` барои нимаи поёнӣ,
                               то хондан боз «аз боло ба поён» бимонад. */
                            transform={`rotate(${flip ? -90 : 90} ${CENTER} ${CENTER - TEXT_R})`}
                            fontSize={14}
                            fontWeight={800}
                            fill={col.fg}
                            stroke="rgba(15,23,42,0.55)"
                            strokeWidth={3}
                            paintOrder="stroke"
                          >
                            {/* 📌 ТАНҲО рақам бо «+» (мисли +10, +25) —
                                «танга»/«смн» ва «Ҷекпот» бардошта шуд
                                (талаби соҳиб: «tanho raqam + shavad»). */}
                            {`+${s.coins}`}
                          </text>
                        </g>
                      </g>
                    );
                  })}

                  {/* ✨ Глосс/оина + сояи дохилӣ дар болои сенечҳо */}
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    fill="url(#innerShade)"
                    pointerEvents="none"
                  />
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    fill="url(#wheelGloss)"
                    pointerEvents="none"
                  />
                </svg>
              ) : (
                <div
                  aria-hidden
                  className="h-full w-full animate-pulse rounded-full bg-slate-200 dark:bg-white/10"
                />
              )}
            </div>

            {/* 🔺 Нӯги болоӣ — ҷои ғолиб (глоссӣ бо соя) */}
            <div
              aria-hidden
              className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_4px_6px_rgba(15,23,42,0.35)]"
            >
              <svg width="40" height="54" viewBox="0 0 40 54" fill="none">
                <defs>
                  <linearGradient id="pinGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb923c" />
                    <stop offset="100%" stopColor="#c2410c" />
                  </linearGradient>
                  <linearGradient id="pinTri" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#ea580c" />
                  </linearGradient>
                </defs>
                <path d="M20 50 L7 24 L33 24 Z" fill="url(#pinTri)" stroke="#0f172a" strokeWidth="2.5" strokeLinejoin="round" />
                <path d="M20 50 L7 24 L14 24 Z" fill="rgba(255,255,255,0.3)" />
                <circle cx="20" cy="15" r="13.5" fill="url(#pinGrad)" stroke="#0f172a" strokeWidth="3" />
                <ellipse cx="16" cy="11" rx="5" ry="3.4" fill="rgba(255,255,255,0.55)" />
              </svg>
            </div>

            {/* ⭕ Маркази чарх — ТИЛЛОӢ мисли тасвир */}
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 z-10 grid h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[5px] border-[#0f172a] bg-[conic-gradient(from_180deg,#fde68a,#f59e0b,#d97706,#f59e0b)] shadow-[0_6px_16px_rgba(15,23,42,0.4)]"
            >
              <span className="grid h-[54px] w-[54px] place-items-center rounded-full bg-[radial-gradient(circle_at_32%_28%,#fcd34d,#f59e0b_55%,#d97706)] text-xl font-black text-amber-950 shadow-[inset_0_-3px_8px_rgba(0,0,0,0.3),inset_0_3px_6px_rgba(255,255,255,0.5)]">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-blue-700 text-base font-black text-white shadow-[0_2px_5px_rgba(0,0,0,0.35)]">
                  {pickedGame?.emoji || "P"}
                </span>
              </span>
            </div>
          </div>

          {/* 🔵 ТУГМАИ ГАРДИШ */}
          <div className="mt-5 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => void doSpin()}
              disabled={disabled}
              aria-disabled={disabled}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-base font-black text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {spinning ? (
                <>
                  <Ic icon={Loader2} className="animate-spin" />
                  {t("loading")}
                </>
              ) : waitLogin ? (
                <>
                  <Ic icon={Sparkles} />
                  {t("loginToSpin")}
                </>
              ) : (
                <>
                  <Ic icon={Sparkles} />
                  {t("spin")} — {cost} {t("coinsUnit")}
                </>
              )}
            </button>

            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {needGame ? (
                <span className="text-rose-600 dark:text-rose-400">
                  {t("pickGameFirst")}
                </span>
              ) : missing ? (
                <span className="text-rose-600 dark:text-rose-400">
                  {t("notEnoughCoins").replace("{n}", String(cost))}
                </span>
              ) : mine ? (
                <span>
                  {t("yourCoins")}:{" "}
                  <span className="tabular-nums">
                    {myCoins?.toLocaleString("tj-TJ")}
                  </span>{" "}
                  {t("coinsUnit")}
                </span>
              ) : null}
            </div>

            {/* 🏆 НАТИҶА */}
            {result && !spinning && (
              <div
                role="status"
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${
                  result.jackpot
                    ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Ic icon={result.jackpot ? Trophy : Sparkles} />
                  {result.jackpot
                    ? `${t("jackpot")}! ${t("youWon").replace(
                        "{n}",
                        String(result.prize),
                      )}`
                    : t("youWon").replace("{n}", String(result.prize))}
                </span>
                <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                  → {result.coins_after} {t("coinsUnit")}
                </span>
              </div>
            )}

            {/* 🎮 Кушодани бозии интихобшуда — ҳамон лаҳзаи харид */}
            {result && !spinning && pickedGame && (
              <Link
                to={`/game/${pickedGame.slug}`}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 sm:w-auto"
              >
                <Ic icon={Gamepad2} />
                {t("openMyGame")} — {pickedGame.name}
              </Link>
            )}
          </div>
        </section>

        {/* ===== 💱 ИВАЗ: ба баланс / ба танга (ЗЕБО) ===== */}
        {user && mine && (
          <section className="card p-4 sm:p-5" aria-label={t("exchangeDir")}>
            {/* 🔘 Самти иваз — toggle-и сегментӣ (ду нима, баробар) */}
            <div
              role="tablist"
              aria-label={t("exchangeDir")}
              className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/80"
            >
              <button
                type="button"
                role="tab"
                aria-selected={exDir === "toBalance"}
                onClick={() => setExDir("toBalance")}
                className={`rounded-xl px-3 py-2 text-xs sm:text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  exDir === "toBalance"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30"
                    : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10"
                }`}
              >
                {t("exchangeCoins")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={exDir === "toCoins"}
                onClick={() => setExDir("toCoins")}
                className={`rounded-xl px-3 py-2 text-xs sm:text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  exDir === "toCoins"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30"
                    : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10"
                }`}
              >
                {t("exchangeToCoins")}
              </button>
            </div>

            {exDir === "toBalance" ? (
              /* ---- Танга → Баланс ---- */
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_3px_8px_rgba(245,158,11,0.4)]">
                    <Ic icon={Coins} size="sm" className="text-white" />
                  </span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    {t("exchangeCoins")}
                  </span>
                </div>

                {/* 📌 Callout-и нарху ҳадд — нарм ва хонда */}
                <div className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">
                  <Ic icon={CircleHelp} size="xs" className="mt-0.5 shrink-0" />
                  <span>
                    {t("coinsRate").replace("{n}", String(exchangeRate))} ·{" "}
                    {t("minExchange").replace("{n}", String(minExchange))}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void doExchange()}
                  disabled={busyEx || mine.coins < mine.min_exchange}
                  aria-disabled={busyEx || mine.coins < mine.min_exchange}
                  className="btn-primary w-full justify-center text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyEx ? (
                    <>
                      <Ic icon={Loader2} className="animate-spin" />
                      {t("loading")}
                    </>
                  ) : (
                    <>
                      <Ic icon={Coins} />
                      {t("exchangeCoins")}
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* ---- Баланс → Танга ---- */
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-[0_3px_8px_rgba(59,130,246,0.4)]">
                    <Ic icon={Coins} size="sm" className="text-white" />
                  </span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    {t("exchangeToCoins")}
                  </span>
                </div>

                {/* 📌 Callout-и нарху ҳадд */}
                <div className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">
                  <Ic icon={CircleHelp} size="xs" className="mt-0.5 shrink-0" />
                  <span>
                    {t("coinsRateTjs").replace("{n}", String(exchangeRate))} ·{" "}
                    {t("minExchangeTjs").replace("{n}", String(minExchangeTjs))}
                  </span>
                </div>

                <div>
                  <label className="label mb-1" htmlFor="ex-tjs-amount">
                    {t("amount")} ({t("somoni")})
                  </label>
                  <input
                    id="ex-tjs-amount"
                    className="input !py-2.5 text-sm"
                    inputMode="numeric"
                    placeholder="1"
                    value={tjsAmount}
                    onChange={(e) => setTjsAmount(e.target.value)}
                  />
                  {/* 💰 Баланси чорӣ + пешбинӣ — дар як сатри тоза */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {t("currentBalance")}:{" "}
                      <b className="tabular-nums text-slate-900 dark:text-white">
                        {Number(balance).toFixed(2)}
                      </b>{" "}
                      {t("somoni")}
                    </span>
                    {tjsOk && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
                        → <b className="tabular-nums">{(Number(balance) - tjsNum).toFixed(2)}</b>{" "}
                        {t("somoni")} · +<b className="tabular-nums">{tjsNum * exchangeRate}</b>{" "}
                        {t("coinUnit")}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void doExchangeToCoins()}
                  disabled={busyEx2 || !tjsOk}
                  aria-disabled={busyEx2 || !tjsOk}
                  className="btn-primary w-full justify-center text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyEx2 ? (
                    <>
                      <Ic icon={Loader2} className="animate-spin" />
                      {t("loading")}
                    </>
                  ) : (
                    <>
                      <Ic icon={Coins} />
                      {t("exchangeToCoins")}
                    </>
                  )}
                </button>
              </div>
            )}

            {exMsg && (
              <div
                role="status"
                className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                  exMsg.ok
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300"
                    : "bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300"
                }`}
              >
                {exMsg.text}
              </div>
            )}
          </section>
        )}

        {/* ===== 🔗 ЛИНКИ ДАЪВАТ ===== */}
        {user && mine && (
          <section className="card p-4" aria-label={t("inviteLink")}>
            <div className="inline-flex items-center gap-2 text-sm font-extrabold">
              <Ic icon={UserPlus} size="md" className="text-brand-600" />
              {t("inviteLink")}
            </div>
            <p className="mt-0.5 mb-3 text-xs text-slate-500 dark:text-slate-400">
              {t("inviteHint")}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
                aria-label={t("inviteLink")}
                className="input min-w-0 flex-1 !py-2 text-xs font-semibold"
              />
              <button
                type="button"
                onClick={() => void copyInvite()}
                disabled={!inviteLink}
                className="btn-primary text-sm shrink-0 disabled:opacity-50"
              >
                <Ic icon={inviteCopied ? Check : Copy} />
                {inviteCopied ? t("copied") : t("copy")}
              </button>
            </div>

            <div className="mt-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
              {t("referralCount").replace("{n}", String(mine.referred_count))}
              {mine.referred_count === 0 && (
                <span className="ml-1 font-normal text-slate-500">
                  — {t("noReferrals")}
                </span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              {t("invitePerPair").replace(
                "{n}",
                String(mine.referral_pair_coins),
              )}
            </div>
          </section>
        )}

        {/* ===== 🏆 БУРДҲОИ ОХИРИН (воқеӣ аз DB) ===== */}
        <section className="card p-4" aria-labelledby="wheel-wins">
          <h2
            id="wheel-wins"
            className="mb-3 text-base font-extrabold inline-flex items-center gap-2"
          >
            <Ic icon={Trophy} size="md" className="text-amber-500" />
            {t("recentWins")}
          </h2>

          {!data ? (
            <div
              aria-hidden
              className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5"
            />
          ) : data.recent_wins.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center text-sm text-slate-500 dark:border-white/10">
              {t("noRecentWins")}
            </p>
          ) : (
            <ul className="space-y-2">
              {data.recent_wins.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5 dark:border-white/10"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{w.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(w.created_at).toLocaleString(lang)}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{w.coins} {t("coinsUnit")}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {data && (
            <p className="mt-3 text-xs text-slate-400">
              {t("totalSpins").replace("{n}", String(data.total_spins))}
            </p>
          )}
        </section>

        {/* ===== 📊 ЭҲТИМОЛИЁТҲО (аз вазнҳои сервер) ===== */}
        <section className="card p-4" aria-labelledby="wheel-prob">
          <h2
            id="wheel-prob"
            className="mb-3 text-base font-extrabold inline-flex items-center gap-2"
          >
            <Ic icon={Percent} size="md" className="text-brand-600" />
            {t("probabilities")}
          </h2>

          {!data ? (
            <div
              aria-hidden
              className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-400">
                    <th className="pb-2 font-bold">{t("prizeCoins")}</th>
                    <th className="pb-2 text-right font-bold">{t("chance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.segments.map((s) => (
                    <tr
                      key={s.coins}
                      className="border-t border-slate-100 dark:border-white/10"
                    >
                      <td className="py-2 font-semibold tabular-nums">
                        {s.jackpot ? `${t("jackpot")} · ` : ""}
                        {s.coins} {t("coinsUnit")}
                      </td>
                      <td className="py-2 text-right tabular-nums font-bold">
                        {s.probability}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ===== 📜 ҚОИДАҲО ===== */}
        <section className="card p-4" aria-labelledby="wheel-rules">
          <h2
            id="wheel-rules"
            className="mb-3 text-base font-extrabold inline-flex items-center gap-2"
          >
            <Ic icon={ScrollText} size="md" className="text-slate-500" />
            {t("wheelRules")}
          </h2>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex gap-2">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              <span>{t("wheelRule1").replace("{n}", String(cost))}</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              <span>{t("wheelRule2").replace("{rate}", String(exchangeRate))}</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              <span>{t("wheelRule3")}</span>
            </li>
          </ul>
        </section>

        {/* ===== ❓ КАДОМҲО? ===== */}
        <section className="card p-4" aria-labelledby="wheel-faq">
          <h2
            id="wheel-faq"
            className="mb-3 text-base font-extrabold inline-flex items-center gap-2"
          >
            <Ic icon={CircleHelp} size="md" className="text-slate-500" />
            {t("faqTitle")}
          </h2>
          <dl className="space-y-3 text-sm">
            {[
              [t("faqQ1"), t("faqA1")],
              [t("faqQ2"), t("faqA2")],
              [t("faqQ3"), t("faqA3")],
            ].map(([q, a]) => (
              <div key={q}>
                <dt className="font-bold">{q}</dt>
                <dd className="mt-0.5 text-slate-600 dark:text-slate-300">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ===== 🔗 БА КОРТИ ТАНГАҲО ===== */}
        <div className="flex justify-center pt-1">
          <Link to="/profile" className="btn-ghost text-sm">
            {t("profile")}
          </Link>
        </div>
      </div>
    </div>
  );
}
