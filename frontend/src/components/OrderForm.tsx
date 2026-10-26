import { useEffect, useRef, useState } from "react";
import {
  Check,
  CircleCheck,
  ClipboardList,
  Coins,
  CreditCard,
  Flame,
  Gem,
  Layers,
  Loader2,
  Lock,
  Package,
  Search,
  Ticket,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Game, Product, PlayerLookupResponse } from "../types";
import { api, ApiError } from "../api/client";
import { useApp } from "../context/AppContext";
import BankPicker from "./BankPicker";
import { Ic } from "./Icons";

interface Props {
  game: Game;
  /** Интихоби маҳсулот аз сарчашма (барои sticky-сумма) */
  selected?: Product | null;
  onSelected?: (p: Product) => void;
  onCreated: (orderId: number, paymentUrl?: string | null) => void;
}

/**
 * 📦 Номи кӯтоҳи корти баста (талаби корбар: танҳо иконка + рақам/ном + нарх):
 *   «FF 110 Diamonds»     → 💎 110 алмос   (асъори FF — алмос, на UC!)
 *   «PUBG 60 UC»          → 🪙 60 UC       (асъори воқеӣ аз номи маҳсулот)
 *   «Blood Strike 51 Gold» → 🪙 51 Gold
 *   «FF Level Up Pass 6»  → 🎟 «Level 6»   (бастаи номдор — рақам надорад)
 * ⚠️ Асъор ҲАМЕША аз номи воқеии маҳсулот гирифта мешавад.
 *    Хатогии 26.10: «UC» ба ҳамаи бастаҳо замима шуд → Free Fire
 *    «110 UC» нишон дод, дар ҳоле ки асъори FF алмос аст.
 * Номи ПУРРА дар `title`/`aria-label` мемонад (скринридер + муштарӣ).
 */
function packView(
  p: Product,
  game: Game,
  t: (key: string) => string,
): { icon: LucideIcon; text: string; sub?: string } {
  const amount = Number(p.amount || 0);
  // 1️⃣ Бастаи рақамдор: рақам + асъор аз НОМИ воқеӣ (Diamonds/UC/Gold/Bonds/Tokens/Lattice)
  if (amount > 0) {
    const unit = p.name.match(/^\D*?\d[\d\s]*\s+(.+)$/)?.[1]?.trim() ?? "";
    const isDiamond = /^diamonds?$/i.test(unit);
    return {
      icon: isDiamond ? Gem : Coins,
      text: `${amount.toLocaleString("tj-TJ")}${
        unit ? ` ${isDiamond ? t("unitDiamonds") : unit}` : ""
      }`,
      sub: undefined,
    };
  }
  // 2️⃣ Бастаи номдор: номи бозӣ ва брендҳои ҳарфӣ (FF · PUBG · MLBB RU) канор
  const brand = game.slug.split("-").join(" ");
  let text = p.name
    .replace(new RegExp(`^${brand}\s+`, "i"), "")
    .replace(/^[A-Z]{2,8}(?:\s+[A-Z]{2,8})?\s+/, "");
  // 🎫 «Level Up Pass 6» → «Level 6» (танқо сатр ва рақам)
  text = text.replace(/^Level Up Pass\s+(\d+)/i, "Level $1");
  // 📅 «Weekly Lite Voucher» → «Weekly», «Monthly Voucher» → «Monthly»
  let sub: string | undefined;
  const voucherMatch = text.match(/^(Weekly|Monthly)(?:\s+(Lite|Basic|Pro|Plus))?/i);
  if (voucherMatch) {
    const tier = voucherMatch[2] ? voucherMatch[2].toLowerCase() : undefined;
    sub = tier ? tier : voucherMatch[1].toLowerCase() === "weekly" ? "week" : "month";
    text = text.replace(/^(Weekly|Monthly)(?:\s+(Lite|Basic|Pro|Plus))?/i, "").trim() || text;
  }
  // 📅 «1 Lite» / «2 Week» / «3 Month» — барои нишон додани давра
  const m = text.match(/^(\d+)\s+(Lite|Week|Month)/i);
  if (m) {
    const n = m[1];
    const unit = m[2].toLowerCase();
    sub = unit === "lite" ? "lite" : unit === "week" ? "week" : "month";
    // Вайрон кардани «2 Lite» → «2» (танқо рақам, давра дар sub)
    text = n;
  }
  return { icon: Ticket, text: text || p.name, sub };
}

/** 🗂 Калимаҳои бахшҳо — аз номи воқеии маҳсулотҳо. */
type GroupKey = "diamonds" | "currency" | "vouchers" | "passes" | "packs";

function groupOf(p: Product): GroupKey {
  const n = p.name.toLowerCase();
  if (Number(p.amount || 0) > 0) return n.includes("diamond") ? "diamonds" : "currency";
  if (n.includes("voucher")) return "vouchers";
  if (n.includes("pass") || n.includes("level")) return "passes";
  return "packs";
}

/** Тартиб + иконкаи бахшҳо — танҳо онҳое нишон мешаванд, ки маҳсулот доранд */
const SECTION_META: { key: GroupKey; titleKey: string; icon: LucideIcon }[] = [
  { key: "diamonds", titleKey: "secDiamonds", icon: Gem },
  { key: "currency", titleKey: "secCurrency", icon: Coins },
  { key: "vouchers", titleKey: "secVouchers", icon: Ticket },
  { key: "passes", titleKey: "secPasses", icon: Layers },
  { key: "packs", titleKey: "secPacks", icon: Package },
];

/**
 * Формаи фармоиш — тарҳи мисли persshop:
 *   1) Данные аккаунта — Player ID + «Санҷидан» (логини ник)
 *   2) Выберите номинал — сеткаи маҳсулотҳо
 *   3) Усули пардохт + тугмаи пардохт
 */
export default function OrderForm({ game, selected: extSelected, onSelected, onCreated }: Props) {
  const { t, lang, user, balance, refreshUser } = useApp();
  const [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("");
  const [innerSelected, setInnerSelected] = useState<Product | null>(null);
  const selected = extSelected !== undefined ? extSelected : innerSelected;
  const setSelected = (p: Product) => {
    setInnerSelected(p);
    onSelected?.(p);
  };
  const [method, setMethod] = useState<"dc" | "balance">("dc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 🔍 Логини ник
  const [nickLookup, setNickLookup] = useState<PlayerLookupResponse | null>(null);
  const [nickLoading, setNickLoading] = useState(false);
  // 🛡️ Идемпотентность — token-и ягона барои ҳар як форма
  // crypto.randomUUID танҳо дар HTTPS/localhost дастрас аст (dar HTTP+IP undefined!)
  const [clientToken] = useState(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    // Фолбэк барои HTTP (IP): timestamp + random
    return `tk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  });
  // 🏦 Кушодани интихоби банк (марҳилаи 2-юм пардохти DC)
  const [showBank, setShowBank] = useState(false);

  const products = game.products ?? [];
  const price = selected ? Number(selected.price_tjs) : 0;
  const canUseBalance = !!user && balance >= price && price > 0;

  /** 🗂 Гурӯҳбандии воқеӣ аз номи маҳсулот (на логикаи сахткӯҳ) */
  const groups: Record<GroupKey, Product[]> = {
    diamonds: [],
    currency: [],
    vouchers: [],
    passes: [],
    packs: [],
  };
  for (const p of products) groups[groupOf(p)].push(p);
  /** Номи кӯтоҳи маҳсулоти интихобшуда — барои «Фармоиши шумо» */
  const selView = selected ? packView(selected, game, t) : null;

  /** 📞 Пурсидани ник (барои тугмаи «Санҷидан» + дебаунс). */
  const runLookup = async (uid: string) => {
    if (uid.length < 3) {
      setNickLookup(null);
      return;
    }
    setNickLoading(true);
    try {
      const res = await api.lookupPlayer(game.slug, uid);
      setNickLookup(res);
      if (res.found && res.nickname && !nickname) {
        setNickname(res.nickname);
      }
    } catch {
      setNickLookup({ found: false, uid, game: game.slug, nickname: "", region: "", message: "" });
    } finally {
      setNickLoading(false);
    }
  };

  // 🔍 Дебаунсинг логини ник (700мс пас аз гузашт навишт)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const uid = playerId.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (uid.length >= 8 && /^\d+$/.test(uid)) {
      debounceRef.current = setTimeout(() => runLookup(uid), 700);
    } else {
      setNickLookup(null);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, game.slug]);

  /** Сохтани фармоиш дар сервер (муштарак барои баланс ва DC). */
  const createOrder = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await api.createOrder({
        game_slug: game.slug,
        product_id: selected!.id,
        player_id: playerId.trim(),
        player_nickname: nickname.trim() || undefined,
        language: lang,
        payment_method: method === "balance" ? "balance" : "dc_wallet",
        client_token: clientToken,
      });
      // 💰 Баланс кам шуд → навсозӣ кунед
      if (method === "balance") await refreshUser();
      onCreated(res.order_id, res.payment_url);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("error"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!playerId.trim() || playerId.trim().length < 2) {
      setError(t("invalidId"));
      return;
    }
    if (!selected) {
      setError(t("requiredField"));
      return;
    }
    // 💰 Санҷиши пешакии баланс дар фронт (backend ҳатмо дубра месанҷад)
    if (method === "balance") {
      if (!user) {
        setError(t("loginForBalance"));
        return;
      }
      if (balance < price) {
        setError(t("insufficientBalance"));
        return;
      }
      await createOrder();
      return;
    }

    // 💳 DC Wallet → аввал интихоби банк (ҳамон усули rent_frow)
    setShowBank(true);
  };

  /** Сарлавҳаи бахш — рақам + унвон (глассморфизм) */
  const SectionHead = ({ n, title, hint }: { n: number; title: string; hint?: string }) => (
    <div className="flex items-center gap-3 mb-4">
      <span
        className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-brand-700
                   text-white text-sm font-bold flex items-center justify-center
                   shadow-[0_8px_18px_-8px_rgba(37,99,235,0.95)]"
      >
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="font-bold text-slate-800 text-base sm:text-lg leading-tight">{title}</h3>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  );

  return (
    <>
      {/* ============ 2 СУТУН: ЧАП — МАЗМУН · РОСТ — ФАРМОИШИ ШУМО ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        {/* ---------- ЧАП: ҲИСОБ + БАХШҲОИ МАҲСУЛОТ ---------- */}
        <div className="min-w-0 space-y-5">
          <div className="glass rounded-3xl p-4 sm:p-6">
            {/* ============ 1. ДАННЫЕ АККАУНТА ============ */}
            <SectionHead n={1} title={t("accountData")} hint={t("accountDataHint")} />

            <div className="mb-4">
              <label className="label">
                {game.player_id_label || t("playerId")} <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  className="input font-mono flex-1 min-w-0"
                  inputMode="numeric"
                  placeholder={t("enterPlayerId")}
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && playerId.trim().length >= 3) runLookup(playerId.trim());
                  }}
                />
                <button
                  type="button"
                  onClick={() => runLookup(playerId.trim())}
                  disabled={nickLoading || playerId.trim().length < 3}
                  className="shrink-0 px-4 rounded-xl bg-brand-600 text-white text-sm font-semibold
                             hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed
                             transition flex items-center gap-1.5"
                >
                  {nickLoading ? (
                    <Ic icon={Loader2} className="animate-spin" />
                  ) : (
                    <>
                      <Ic icon={Search} />
                      {t("check")}
                    </>
                  )}
                </button>
              </div>

              {/* Натиҷаи логини ник */}
              {nickLookup?.found && nickLookup.nickname && (
                <div className="mt-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 rounded-2xl flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Ic icon={CircleCheck} size="xs" className="text-emerald-600" />
                  </span>
                  <span className="font-mono font-semibold">{nickLookup.nickname}</span>
                  {nickLookup.region && (
                    <span className="text-emerald-500 text-xs">({nickLookup.region})</span>
                  )}
                </div>
              )}
              {nickLookup?.found === false && !nickLoading && playerId.trim().length >= 3 && (() => {
                // "ID дуруст ✓" → сабз (мусбат) | "Zone лозим" ё "ID ёфт нашуд" → амбер
                const ok = /дуруст|✓/.test(nickLookup.message || "");
                const cls = ok
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                  : "text-amber-700 bg-amber-50 border-amber-200";
                return (
                  <div className={`mt-2 text-sm border px-3.5 py-2.5 rounded-2xl flex items-center gap-2 ${cls}`}>
                    <Ic icon={ok ? CircleCheck : TriangleAlert} />
                    <span>{nickLookup.message || t("nicknameNotFound")}</span>
                  </div>
                );
              })()}
            </div>

          </div>

          {SECTION_META.map(({ key, titleKey, icon }) => {
            const items = groups[key];
            if (!items.length) return null;
            return (
              <section key={key} className="glass rounded-3xl p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700
                               text-white flex items-center justify-center
                               shadow-[0_8px_18px_-8px_rgba(37,99,235,0.95)]"
                  >
                    <Ic icon={icon} size="sm" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-slate-800 text-base sm:text-lg leading-tight">
                      {t(titleKey)}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {items.length} {t("statProducts")}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {items.map((p) => {
                    const active = selected?.id === p.id;
                    const view = packView(p, game, t);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelected(p)}
                        aria-pressed={active}
                        aria-label={p.name}
                        title={p.name}
                        className={`relative rounded-2xl border-2 px-3.5 py-3 text-left overflow-hidden transition-all
                          ${
                            active
                              ? "border-brand-600 bg-brand-50 shadow-[0_8px_20px_-10px_rgba(37,99,235,0.7)] scale-[1.02]"
                              : "border-slate-200 bg-white hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5"
                          }`}
                      >
                        {p.is_popular && (
                          <span className="absolute -top-2.5 right-2 badge bg-rose-500 text-white shadow">
                            <Ic icon={Flame} size="xs" className="fill-current" />
                            {t("popular")}
                          </span>
                        )}
                        {/* 🖇 ҲАМА ДАР 1 САТР: иконка + рақам/ном … … … нарх (талаби корбар) */}
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <Ic
                              icon={view.icon}
                              size="sm"
                              className={`shrink-0 ${active ? "text-brand-600" : "text-brand-500"}`}
                            />
                            <span
                              className={`min-w-0 truncate font-bold text-sm leading-tight ${
                                active ? "text-brand-700" : "text-slate-700"
                              }`}
                            >
                              {view.text}
                              {view.sub && (
                                <span className="ml-1 font-medium text-slate-400">{view.sub}</span>
                              )}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 font-extrabold tabular-nums text-sm ${
                              active ? "text-brand-700" : "text-brand-600"
                            }`}
                          >
                            {Number(p.price_tjs).toLocaleString("tj-TJ")}
                            <span className="ml-1 text-[10px] font-semibold text-slate-400 hidden sm:inline">
                              {t("currency")}
                            </span>
                          </span>
                        </div>
                        {active && (
                          <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center shadow">
                            <Ic icon={Check} size="xs" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* ---------- РОСТ: ФАРМОИШИ ШУМО (БЕ ТАҒЙИРИ МАНТИҚ — ЧИПҲОИ ВОҚЕӢ) ---------- */}
        <aside className="lg:sticky lg:top-[72px] min-w-0">
          <div className="glass rounded-3xl p-4 sm:p-5">
            {/* Сарлавҳаи фармоиш */}
            <div className="flex items-center gap-2.5 mb-3.5">
              <span
                className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-brand-700
                           text-white flex items-center justify-center
                           shadow-[0_8px_18px_-8px_rgba(37,99,235,0.95)]"
              >
                <Ic icon={ClipboardList} size="sm" />
              </span>
              <h3 className="font-extrabold text-slate-800 text-base sm:text-lg leading-tight">
                {t("yourOrder")}
              </h3>
            </div>

            {/* Маҳсулоти интихобшуда */}
            {selected && selView ? (
              <div className="rounded-2xl border border-brand-200 bg-brand-50 p-3.5 flex items-center gap-3">
                <span className="w-10 h-10 shrink-0 rounded-xl bg-white border border-brand-100 flex items-center justify-center">
                  <Ic icon={selView.icon} className="text-brand-600" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800 text-sm truncate">
                    {selView.text}
                    {selView.sub && (
                      <span className="ml-1 font-medium text-slate-400">{selView.sub}</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 truncate" title={selected.name}>
                    {selected.name}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-400">
                {t("chooseAmountHint")}
              </div>
            )}

            {/* Ҳамагӣ */}
            <div className="mt-3.5 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-500">{t("total")}</span>
              <span className="text-lg font-extrabold text-slate-800 tabular-nums">
                {price.toLocaleString("tj-TJ")}
                <span className="ml-1 text-xs font-semibold text-slate-400">{t("currency")}</span>
              </span>
            </div>

            {/* Баланс — танҳо барои корбари вурудшуда (маълумоти воқеӣ) */}
            {user && (
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <span className="text-sm text-slate-500">{t("balance")}</span>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    balance >= price ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {balance.toLocaleString("tj-TJ")} {t("currency")}
                </span>
              </div>
            )}

            <div className="h-px bg-slate-100 my-3.5" />

            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              {t("choosePayment")}
            </p>
            <div className="space-y-2.5 mb-4">
              {/* DC Wallet */}
              <button
                onClick={() => setMethod("dc")}
                aria-pressed={method === "dc"}
                className={`rounded-2xl border-2 p-3.5 text-left transition
                  ${
                    method === "dc"
                      ? "border-brand-600 bg-brand-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
              >
                <div className="flex items-center gap-2">
                  <Ic icon={CreditCard} className="text-brand-600" />
                  <span className="font-semibold text-sm">{t("dcPayment")}</span>
                  {/* Радиои ороишӣ — ҳолати воқеӣ дар `aria-pressed`-и кнопка */}
                  <span
                    aria-hidden
                    className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      method === "dc" ? "border-brand-600" : "border-slate-300"
                    }`}
                  >
                    {method === "dc" && <span className="w-2 h-2 rounded-full bg-brand-600" />}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{t("payWithDC")}</div>
              </button>

              {/* Баланс */}
              <button
                onClick={() => setMethod("balance")}
                aria-pressed={method === "balance"}
                className={`rounded-2xl border-2 p-3.5 text-left transition
                  ${
                    method === "balance"
                      ? "border-emerald-600 bg-emerald-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
              >
                <div className="flex items-center gap-2">
                  <Ic icon={Wallet} className="text-emerald-600" />
                  <span className="font-semibold text-sm">{t("balancePayment")}</span>
                  <span
                    aria-hidden
                    className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      method === "balance" ? "border-emerald-600" : "border-slate-300"
                    }`}
                  >
                    {method === "balance" && <span className="w-2 h-2 rounded-full bg-emerald-600" />}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {user ? (
                    <>
                      {t("currentBalance")}:{" "}
                      <span className={balance >= price ? "text-emerald-600" : "text-rose-600"}>
                        {balance.toLocaleString("tj-TJ")} {t("currency")}
                      </span>
                    </>
                  ) : (
                    t("loginForBalance")
                  )}
                </div>
              </button>
            </div>

            {/* Огоҳиномаи баланс */}
            {method === "balance" && user && price > 0 && !canUseBalance && (
              <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                <Ic icon={TriangleAlert} className="text-amber-500 mt-0.5" />
                <span>
                  {t("insufficientBalance")} — {t("currentBalance")}: {balance.toLocaleString("tj-TJ")} /{" "}
                  {t("total")}: {price.toLocaleString("tj-TJ")} {t("currency")}
                </span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-4 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex items-start gap-2"
              >
                <Ic icon={TriangleAlert} className="text-rose-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={submit}
              disabled={loading || !selected || (method === "balance" && !canUseBalance)}
              className="btn-primary w-full py-4 text-base rounded-2xl shadow-[0_12px_28px_-12px_rgba(37,99,235,0.9)]"
            >
              {loading ? (
                <>
                  <Ic icon={Loader2} className="animate-spin" /> {t("loading")}
                </>
              ) : (
                <>
                  <Ic icon={Lock} />
                  {method === "balance" ? t("payFromBalance") : t("pay")}
                  {price > 0 ? ` — ${price.toLocaleString("tj-TJ")} ${t("currency")}` : ""}
                </>
              )}
            </button>

            <p className="mt-3 text-xs text-slate-500 text-center leading-relaxed inline-flex items-center justify-center gap-1.5 flex-wrap">
              <Ic icon={Lock} size="xs" className="text-slate-400" />
              {t("secureNote")}
            </p>
          </div>
        </aside>
      </div>

      {/* 🏦 Интихоби банк — танҳо барои пардохти DC */}
      {showBank && (
        <BankPicker
          price={price}
          loading={loading}
          onConfirm={async () => {
            const ok = await createOrder();
            // Агар хато шуд → модалка мепӯшад, хато дар корт нишон дода мешавад
            if (!ok) setShowBank(false);
          }}
          onClose={() => setShowBank(false)}
        />
      )}
    </>
  );
}
