import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  CircleCheck,
  ClipboardList,
  ClipboardPaste,
  Coins,
  CreditCard,
  Flame,
  Gem,
  Globe,
  Heart,
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
  onSelected?: (p: Product | null) => void;
  onCreated: (orderId: number, paymentUrl?: string | null) => void;
}

/**
 * 📦 Номи кӯтоҳи корти баста (талаби корбар: танҳо иконка + рақам/ном + нарх):
 *   «FF 110 Diamonds»     → 💎 110 алмос   (асъори FF — алмос, на UC!)
 *   «MLBB RU 32 + 3 Diamonds» → 💎 32 + 3 алмос  (тӯҳфаи воқеӣ аз каталог)
 *   «PUBG 60 UC»          → 🪙 60 UC       (асъори воқеӣ аз номи маҳсулот)
 *   «Blood Strike 51 Gold» → 🪙 51 Gold
 *   «FF Level Up Pass 6»  → 🎟 «Level 6»   (бастаи номдор — рақам надорад)
 * ⚠️ Асъор ҲАМЕША аз номи воқеии маҳсулот гирифта мешавад.
 *    Хатогии 26.10: «UC» ба ҳамаи бастаҳо замима шуд → Free Fire
 *    «110 UC» нишон дод, дар ҳоле ки асъори FF алмос аст.
 * Номи ПУРРА дар `title`/`aria-label` мемонад (скринридер + муштарӣ).
 */
/** 💎 Тасвири алмос — барои бастаҳои Алмос (мувоиқи тасвири корбар).
 *    Танҳо барои бастаҳои алмос; бастаҳои дигар (UC/Gold/Pass) иконкаи худро доранд. */
function DiamondArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="dmt" x1="12" y1="6" x2="36" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e0f2fe" />
          <stop offset="1" stopColor="#93c5fd" />
        </linearGradient>
        <linearGradient id="dmp" x1="24" y1="17" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60a5fa" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      {/* Кунҷи болоӣ (crown) */}
      <path d="M4 17 L12 6 H36 L44 17 Z" fill="#3b82f6" />
      <path d="M12 6 H36 L33 12 H15 Z" fill="url(#dmt)" />
      <path d="M4 17 L15 12 L15 17 Z" fill="#60a5fa" />
      <path d="M44 17 L33 12 L33 17 Z" fill="#1e40af" />
      {/* Павillon (поён — нӯги алмос) */}
      <path d="M4 17 L44 17 L24 42 Z" fill="url(#dmp)" />
      <path d="M4 17 L16 17 L24 42 Z" fill="#2563eb" />
      <path d="M44 17 L32 17 L24 42 Z" fill="#1e3a8a" />
      {/* Кунҷҳо / edges */}
      <g stroke="#eff6ff" strokeWidth="1" strokeLinejoin="round" fill="none" opacity="0.85">
        <path d="M4 17 L12 6 H36 L44 17 L24 42 Z" />
        <path d="M4 17 H44" />
        <path d="M15 17 L24 42 M33 17 L24 42 M12 6 L15 17 M36 6 L33 17" />
      </g>
      {/* Дурахши сафед */}
      <path d="M16.5 8 H23 L21 11.5 H18 Z" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}

function packView(
  p: Product,
  game: Game,
  t: (key: string) => string,
): { icon: LucideIcon; text: string; sub?: string; diamond?: boolean } {
  const amount = Number(p.amount || 0);
  // 🎯 Leak Studio (талаби соҳиб 20.11.2026: «лайкҳо аз Studio API»):
  //    лайк/авто-лайк → иконкаи воқеии бахш + рақам аз `amount`
  //    (расми бегона ҷо НАМЕШАВAD — фолбэки рост мемонад)
  if (p.ls_kind === "likes") {
    return {
      icon: Heart,
      text:
        amount > 0
          ? `${amount.toLocaleString("tj-TJ")} ${t("unitLikes")}`
          : p.name,
    };
  }
  if (p.ls_kind === "auto_likes") {
    return {
      icon: CalendarClock,
      text:
        amount > 0
          ? `${amount.toLocaleString("tj-TJ")} ${t("unitDays")}`
          : p.name,
      sub: t("subAutoLikes"),
    };
  }
  // 1️⃣ Бастаи рақамдор: рақам + асъор аз НОМИ воқеӣ (Diamonds/UC/Gold/Bonds/Tokens/Lattice)
  if (amount > 0) {
    // 🎁 Тӯҳфа аз номи воқеӣ (каталоги FireLoot): «32 + 3 Diamonds» → «32 + 3 алмос»
    const bonus = p.name.match(/(\d[\d,]*)\s*\+\s*(\d[\d,]*)/);
    const unit = p.name.replace(/^\D*?\d[\d,\s]*(?:\+\s*\d[\d,\s]*)?\s+/, "").trim();
    const isDiamond = /^diamonds?$/i.test(unit);
    const bonusN =
      bonus && Number(bonus[1].replace(/\D/g, "")) === amount
        ? Number(bonus[2].replace(/\D/g, ""))
        : 0;
    return {
      icon: isDiamond ? Gem : Coins,
      diamond: isDiamond || undefined,
      text: `${amount.toLocaleString("tj-TJ")}${
        bonusN ? ` + ${bonusN.toLocaleString("tj-TJ")}` : ""
      }${unit ? ` ${isDiamond ? t("unitDiamonds") : unit}` : ""}`,
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
type GroupKey = "likes" | "diamonds" | "currency" | "vouchers" | "passes" | "packs";

function groupOf(p: Product): GroupKey {
  // 🎯 Leak Studio: лайкҳо/авто-лайк → бахши алоҳида (ПЕШ аз қоидаи amount>0,
  //    вагарна «220 лайк» ба бахши «асъор» мезанед)
  if (
    p.provider === "leakstudio" &&
    (p.ls_kind === "likes" || p.ls_kind === "auto_likes")
  ) {
    return "likes";
  }
  const n = p.name.toLowerCase();
  if (n.includes("лайк") || /\blikes?\b/i.test(n)) return "likes";
  if (Number(p.amount || 0) > 0) return n.includes("diamond") ? "diamonds" : "currency";
  if (n.includes("voucher")) return "vouchers";
  if (n.includes("pass") || n.includes("level")) return "passes";
  return "packs";
}

/*🖼️ Расмҳои воқеии маҳсулотҳои Free Fire (талаби соҳиб 11.11.2026:
   «va dar vaycherho inro mon … inhoro … tanho suratho va almazhoro») —
   расмҳо аз скриншоти соҳиб бурида шуданд: узвиятҳои FF (кортҳои W/M)
   + бастаҳои алмос. Танҳо барои `free-fire`; бозии дигар → иконкаи ҳозира.
   Нархи $ аз скриншот НОГИРИФТА шуд (нархи мо TJS воқеӣ мемонад). */
const FF_DIA_TIERS: Record<number, string> = {
  100: "dia-100", 110: "dia-100",
  310: "dia-310", 341: "dia-310",
  520: "dia-520", 572: "dia-520",
  1060: "dia-1060", 1166: "dia-1060",
  2180: "dia-2180", 2398: "dia-2180",
  5600: "dia-5600", 6160: "dia-5600",
};

/*🖼️ Расмҳои воқеии бастаҳои UCи PUBG (талаби соҳиб 11.11.2026
   «inhoro mon dar pugj» + «dar injo ho ham mon») — расмҳои воқеии
   мағозаи UC (buffbuff.com): ҲАМАИ 10 баста, ҳамонҳое ки бо
   маълумоти мо мутобиқанд (12000+4200=16200 … 30000+10500=40500 —
   ҷамъи бонус маҳз бастаҳои мо ҳастанд). Нархҳо НАБУРИДА шуд. */
const PUBG_UC_TIERS: Record<number, string> = {
  60: "uc-60",
  325: "uc-325",
  660: "uc-660",
  1800: "uc-1800",
  3850: "uc-3850",
  8100: "uc-8100",
  16200: "uc-16200",
  24300: "uc-24300",
  32400: "uc-32400",
  40500: "uc-40500",
};

/*🖼️ Расмҳои воқеии ҳамаи бозиҳо (талаби соҳиб 12.11.2026:
   «va ba daruni boziho daromada hamamaro realni kun … xulosa ki
   hamai bozihoro kun»). Расмҳо аз мағозаҳои воқеӣ (firelootshop,
   buffbuff, seagm, mtcgame, epinby, gamecore, voodoo, get4card,
   famly, shefo-games, tokogame) гирифта, дар `public/images/{game}/`.
   Мутобиқат АЗ НОМИ воқеии маҳсулот + `amount` (284/284 ном дар
   4 забон якхела санҷида шуд → аз рӯи забон хатогӣ намешавад).
   Ҷои расм вуҷуд надорад (0.99 Deal, Honor Point) → иконкаи ҳозира
   (фолбэки рост) — расми бегона ҷо НАМЕШАВАД. */
const BS_GOLD_TIERS: Record<number, string> = {
  51: "gold-51", 100: "gold-100", 300: "gold-300", 500: "gold-500",
  1000: "gold-1000", 2000: "gold-2000", 5000: "gold-5000",
};
const MLBB_RU_TIERS: Record<number, string> = {
  32: "ru-32", 50: "ru-50", 150: "ru-150", 250: "ru-250", 500: "ru-500",
  1000: "ru-1000", 1500: "ru-1500", 2500: "ru-2500", 5000: "ru-5000",
};
/* CIS 50/150 → ҳамон расми RU (ҷамъи бонус 55/165 = ҳамон бастаҳо) */
const MLBB_CIS_TIERS: Record<number, string> = {
  50: "ru-50", 78: "cis-78", 150: "ru-150", 156: "cis-156", 234: "cis-234",
  625: "cis-625", 1860: "cis-1860", 3099: "cis-3099", 4649: "cis-4649",
  7740: "cis-7740",
};
const HOK_TOKEN_TIERS: Record<number, string> = {
  16: "tokens-16", 80: "tokens-80", 240: "tokens-240", 400: "tokens-400",
  560: "tokens-560", 800: "tokens-800", 1200: "tokens-1200",
  2400: "tokens-2400", 4000: "tokens-4000", 8000: "tokens-8000",
};
const AB_BOND_TIERS: Record<number, string> = {
  60: "bonds-60", 310: "bonds-310", 630: "bonds-630", 1580: "bonds-1580",
  3200: "bonds-3200", 6500: "bonds-6500",
};
const ABI_BOND_TIERS: Record<number, string> = {
  100: "bonds-100", 500: "bonds-500", 1000: "bonds-1000",
  2500: "bonds-2500", 5000: "bonds-5000", 10000: "bonds-10000",
};
const MR_LATTICE_TIERS: Record<number, string> = {
  100: "lattice-100", 500: "lattice-500", 1000: "lattice-1000",
  2180: "lattice-2180", 5680: "lattice-5680", 11680: "lattice-11680",
};
const PUBG_WOW_TIERS: Record<number, string> = {
  60: "wow-60", 325: "wow-325", 660: "wow-660",
  1800: "wow-1800", 3850: "wow-3850", 8100: "wow-8100",
};

/** Расми воқеии маҳсулоти ҲАМАИ бозиҳоё null (расм нест → иконкаи ҳозира). */
function productArt(game: Game, p: Product): string | null {
  // 🎯 Leak Studio (лайк/авто-лайк): расми бегона ҷо НАМЕШАВAD — «100 лайк»
  //    ба 100 алмос зада, расми Алмаз мегирифт (задамаи FF_DIA_TIERS,
  //    20.11.2026) → иконкаи Heart/CalendarClock-и худи бахш мемонад
  //    (мисли «220 лайк» ки art=null дошт — якхела кард)
  // 20.11.2026 (соҳиб «monandi bashad»): иконкаи сабзи воқеӣ
  //    «Пакеты лайков» — ҳамон расм дар ҳарду корт (аз акси соҳиб)
  if (p.ls_kind === "likes" || p.ls_kind === "auto_likes")
    return "/images/likes/like-thumb.webp?v=20261120";
  const name = p.name.trim();
  const amount = Number(p.amount || 0);
  // ?v= → cache-bust: сервер /images/* = max-age 7 рӯз медиҳад, соҳиб дар
  // телефони худ расми кӯҳнаро то 7 рӯз мебинад. 18.11.2026: фонҳои тирфа
  // аз расмҳои маҳсулот бардошта шуд → ҳангоми тағйири расм v = БАЛАНД кунед.
  const img = (dir: string, key: string) => `/images/${dir}/${key}.webp?v=20261119`;
  /** Мутобиқати номдор → расм (тартиби сатрҳо муҳим: «Plus» пеш аз оддӣ) */
  const named = (dir: string, map: [RegExp, string][]): string | null => {
    for (const [re, key] of map) if (re.test(name)) return img(dir, key);
    return null;
  };

  switch (game.slug) {
    case "free-fire": {
      const sku = (p.sku || "").toLowerCase();
      const low = name.toLowerCase();
      if (sku.startsWith("voucher") || low.includes("voucher")) {
        if (sku.includes("week_lite") || low.includes("lite")) {
          return img("ff", "voucher-lite");
        }
        if (sku.includes("month") || low.includes("month")) {
          return img("ff", "voucher-month");
        }
        if (sku.includes("week") || low.includes("week")) {
          return img("ff", "voucher-week");
        }
        return null;
      }
      const lm = name.match(/Level Up(?: Pass)?\s*(\d+)/i);
      if (lm) {
        const n = Number(lm[1]);
        return [6, 10, 15, 20, 25, 30].includes(n) ? img("ff", `level-${n}`) : null;
      }
      if (/Evo Access/i.test(name)) {
        if (/\b3D\b/i.test(name)) return img("ff", "evo-3d");
        if (/\b7D\b/i.test(name)) return img("ff", "evo-7d");
        if (/\b30D\b/i.test(name)) return img("ff", "evo-30d");
        return null;
      }
      if (/Booyah/i.test(name)) {
        return /premium/i.test(name) ? img("ff", "booyah-premium") : img("ff", "booyah");
      }
      const tier = FF_DIA_TIERS[amount];
      return tier ? img("ff", tier) : null;
    }
    case "pubg-mobile": {
      if (/^PUBG \d+ UC$/.test(name)) {
        const uc = PUBG_UC_TIERS[amount];
        return uc ? img("pubg", uc) : null;
      }
      if (/^PUBG \d+ WOW Coins$/.test(name)) {
        const wow = PUBG_WOW_TIERS[amount];
        return wow ? img("pubg", wow) : null;
      }
      const pm = name.match(/Prime Plus \((\d+) Month/i);
      if (pm) return ["1", "3", "6", "12"].includes(pm[1]) ? img("pubg", `prime-plus-${pm[1]}m`) : null;
      const pr = name.match(/\bPrime \((\d+) Month/i);
      if (pr) return ["1", "3", "6", "12"].includes(pr[1]) ? img("pubg", `prime-${pr[1]}m`) : null;
      return named("pubg", [
        [/weekly mythic emblem value pack/i, "weekly-mythic"],
        [/mythic emblem pack/i, "mythic-emblem"],
        [/upgradable firearm materials/i, "firearm-materials"],
        [/first purchase/i, "first-purchase"],
        [/weekly deal pack 1/i, "weekly-deal-1"],
        [/weekly deal pack 2/i, "weekly-deal-2"],
        [/elite pass plus/i, "elite-plus"],
        [/elite pass lv1-100/i, "elite-100"],
        [/elite pass lv1-50/i, "elite-50"],
      ]);
    }
    case "blood-strike": {
      if (amount > 0) {
        const gold = BS_GOLD_TIERS[amount];
        return gold ? img("bs", gold) : null;
      }
      return named("bs", [
        [/ultra skin lucky chest/i, "chest-ultra"],
        [/lucky bag week/i, "lucky-bag-week"],
        [/value season pass/i, "pass-season"],
        [/strike pass elite/i, "pass-elite"],
        [/strike pass premium/i, "pass-premium"],
        [/level up pass/i, "pass-levelup"],
        // «0.99 Deal» → расм дар ҳеҷ манобеъ ёфт нашуд → фолбэк
      ]);
    }
    case "mobile-legends": {
      if (/Diamonds/i.test(name)) {
        const cis = /^MLBB CIS\b/.test(name);
        const tier = (cis ? MLBB_CIS_TIERS : MLBB_RU_TIERS)[amount];
        return tier ? img("mlbb", tier) : null;
      }
      return named("mlbb", [
        [/super value pass/i, "super-value"],
        [/weekly elite pack/i, "weekly-elite"],
        [/monthly elite pack/i, "monthly-elite"],
        [/twilight/i, "cis-twilight"],
        [/^MLBB CIS Weekly$/i, "cis-weekly"],
        [/^MLBB RU Weekly$/i, "ru-weekly"],
      ]);
    }
    case "honor-of-kings": {
      if (/Tokens/i.test(name) && amount > 0) {
        const tier = HOK_TOKEN_TIERS[amount];
        return tier ? img("hok", tier) : null;
      }
      return named("hok", [
        [/weekly card plus/i, "weekly-card-plus"],
        [/weekly card/i, "weekly-card"],
        [/double token lucky bag/i, "double-token"],
        // «Honor Point Value Pack» → расм рост нест → фолбэк
      ]);
    }
    case "arena-breakout": {
      if (amount > 0) {
        const tier = AB_BOND_TIERS[amount];
        return tier ? img("ab", tier) : null;
      }
      return named("ab", [
        [/beginner select/i, "beginner"],
        [/advanced battle pass/i, "advanced-bp"],
        [/premium battle pass/i, "premium-bp"],
      ]);
    }
    case "arena-breakout-infinite": {
      if (amount > 0) {
        const tier = ABI_BOND_TIERS[amount];
        return tier ? img("abi", tier) : null;
      }
      return named("abi", [
        [/craftsmanship skin bundle ii/i, "craft-2"],
        [/craftsmanship skin bundle i\b/i, "craft-1"],
        [/copper works skin bundle ii/i, "copper-2"],
        [/copper works skin bundle i\b/i, "copper-1"],
        [/advanced battle pass/i, "advanced-bp"],
        [/premium battle pass/i, "premium-bp"],
      ]);
    }
    case "marvel-rivals": {
      const tier = MR_LATTICE_TIERS[amount];
      return tier ? img("mr", tier) : null;
    }
    default:
      return null;
  }
}

/** 💎 Арзиши алмази узвият — аз скриншоти соҳиб11.11.2026 (воқеии FF):
 *   Weekly Lite =90 · Weekly =450 · Monthly =2600 (танҳо нишондод,
 *   ба `amount` НАМЕНАВИСЕМ — гурӯҳбандӣ «vouchers» ҳифз мешавад). */
function ffVoucherDia(p: Product): number | null {
  const sku = (p.sku || "").toLowerCase();
  const name = p.name.toLowerCase();
  if (sku.includes("week_lite") || name.includes("lite")) return 90;
  if (sku.includes("month") || name.includes("month")) return 2600;
  if (sku.includes("week") || name.includes("week")) return 450;
  return null;
}

/** 💎 Чанд алмос медиҳад — Level Up Package/Pass (Garena), ҷадвали
 *   воқеии фурӯшандаи ин маҳсулот (unibazar.net, «Level Up Package» —
 *   ҳамон Level Up Pass-и Garena бо номи нав):
 *     6→120 · 10→200 · 15→200 · 20→200 · 25→200 · 30→350
 *   Ҷамъ = 1270 = «All Packages»-и ҳамон ҷадвал (санҷиши дохилӣ ✓).
 *   Таҳрири соҳиб 16.11.2026 «level 6 minsol 120 almos» — рақами 6=120
 *   аз ҷониби соҳиб худаш тасдиқ шуд ва бо ҷадвал мувофиқ афтод
 *   (лангар/anchor ✓); рақамҳои боқимонда аз ҳамон ҷадвол.
 *   FireLoot (таъминкунанда) механикоро тасдиқ мекунад
 *   («бонусные алмазы за достижение уровней»), вале рақам надорад;
 *   роҳнамоҳои кӯҳна (2020/2024) версияҳои кӯҳнаанд (50/40).
 *   Сатр ёфт нашуд (tw/vn «Level Up Pass» бе рақам, ё сатри номаълум)
 *   → null → бейҷ намемонад (рақам сохта НАМЕШАВАД). */
const FF_PASS_DIA: Record<number, number> = { 6: 120, 10: 200, 15: 200, 20: 200, 25: 200, 30: 350 };
function ffPassDia(p: Product): number | null {
  const m = p.name.match(/pass[\s_-]+(\d{1,3})/i);
  if (!m) return null;
  return FF_PASS_DIA[Number(m[1])] ?? null;
}

/** Тартиб + иконкаи бахшҳо — танҳо онҳое нишон мешаванд, ки маҳсулот доранд */
const SECTION_META: { key: GroupKey; titleKey: string; icon: LucideIcon }[] = [
  { key: "likes", titleKey: "secLikes", icon: Heart },
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
  // 💾 ID-и бозингар дар браузер нигоҳ дошта мешавад (соҳиб 20.11.2026:
  //    «idiro sazranit kunad») — ҳангоми бозгашт худкор пур мешавад
  const pidKey = `danatel_pid_${game.slug}`;
  const [playerId, setPlayerId] = useState(() => {
    try { return window.localStorage.getItem(pidKey) || ""; } catch { return ""; }
  });
  const [nickname, setNickname] = useState("");
  const [innerSelected, setInnerSelected] = useState<Product | null>(null);
  const selected = extSelected !== undefined ? extSelected : innerSelected;
  const setSelected = (p: Product | null) => {
    setInnerSelected(p);
    onSelected?.(p);
  };
  const [method, setMethod] = useState<"dc" | "balance">("dc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 🔍 Логини ник
  const [nickLookup, setNickLookup] = useState<PlayerLookupResponse | null>(null);
  const [nickLoading, setNickLoading] = useState(false);
  // 🌍 Минтақа — пешфарз = аввали рӯйхати backend (CIS / MLBB RUSSIA)
  const [region, setRegion] = useState<string>(() => game.regions?.[0] ?? "");
  // 🎮 Зона/Server ID — талаби воқеии MLBB (FireLoot ҳам мепурсад)
  const [zone, setZone] = useState("");
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
  // 📱10.11.2026 (talabi соҳиб — скриншотҳо [1][2]: «tanho bardoxtro nishon
  //    dihad tamom narxro nishon nadihad» + «inro nishon nadihad to vaqteki
  //    pardoxtro zer nakunad»): дар мобилӣ корти «Фармоиши шумо» то зер
  //    кардани навори пардохт НИШОН НАМЕШАВАД; навор танҳо «Пардохт кардан»
  //    (бе нарх) дорад ва танҳо кортро мекушояд — пардохт аз тугмаи форма.
  const [payStep, setPayStep] = useState<"browse" | "form">("browse");
  const payCardRef = useRef<HTMLElement | null>(null);

  // 🙈 10.11.2026 (талаби соҳиб, давр1 — FAB аз болои навор мебаромад:
  //    «vaqteki pardoxt paydo shavad in nest shavad»; давр2 — «vaqte ki
  //    yagon chiro intixob nakardaast inro nishon nadihad … tanho in paydo
  //    shavad, in [nav] nest shavad»): класс = ФАРМОИШ КУШОДА АСТ
  //    (`!!selected`) — ҳам дар browse (навори пардохт) ва ҳам дар form
  //    (корт) → навигатсияи поёнӣ (бо FAB-и «Пур кардан») ПУРРА пинҳон;
  //    бе интихоб → класс нест → nav барқарор. Нав: `order-open`
  //    (собиқ `paybar-open` — пешин танҳо навор буд, ҳоло корт ҳам).
  const orderOpen = !!selected;
  useEffect(() => {
    document.body.classList.toggle("order-open", orderOpen);
    return () => document.body.classList.remove("order-open");
  }, [orderOpen]);

  // 🗂 Табҳои категорияҳо (талаби соҳиб10.11.2026 «va dar injo ... categoriya
  //    boshad:1 almosho2 vaycherho3 propustho»): дар мобилӣ гурӯҳҳо ҳамчун
  //    таб иваз мешаванд (як вақт танҳо як бахш); дар десктоп ҳамон стеки
  //    пас-пас мемонад (layout танҳо дар мобилӣ иваз мешавад).
  // 20.11.2026: `?group=likes` — гузариш аз корти «ЛАЙКҲО»-и саҳифаи асосӣ
  //    (`dar alohidagi soz`) → ҳамон бахш фавран кушода мешавад.
  const groupParam = new URLSearchParams(window.location.search).get("group");
  /** 20.11.2026 (талаби соҳиб) — ДУ ПАПКАИ АЛОҲИДА:
   *  /game/free-fire    → ТАНҲО алмос/вучер/пропуск (лайк НЕСТ);
   *  ?group=likes (корти «ЛАЙКҲО») → ТАНҲО лайк + Level Up Pass (Leak Studio). */
  const likesOnly = groupParam === "likes";
  const [activeGroup, setActiveGroup] = useState<GroupKey | null>(
    likesOnly
      ? "likes"
      : groupParam && groupParam !== "likes" &&
          ["diamonds", "currency", "vouchers", "passes", "packs"].includes(groupParam)
        ? (groupParam as GroupKey)
        : null,
  );
  useEffect(() => {
    setActiveGroup(likesOnly ? "likes" : null);
  }, [game.id]);

  // 🌍 Худкор-интихоби минтақа: вақте backend аз рӯи ID минтақаи ҳақиқиро
  //    бармегарронад → dropdown худор иваз мешавад. Ин ref ба effectҳо мегӯяд,
  //    ки ин ТАҒЙИРИ АВТОматист (натиҷаи санҷиш тоза аст, набӯяд).
  const autoRegionRef = useRef(false);

  // 🌍 Филтри минтақа: бастаҳои минтақаи интихобшуда (+ бе минтақа = барои ҳама)
  // 🌍 Филтри минтақа + ДУ ПАПКА (20.11.2026, талаби соҳиб):
  //    папкаи «ЛАЙКҲО» → ТАНҲО маҳсулоти Leak Studio: 2 бахш —
  //       Лайкҳо + Level Up Pass (мисли панели идораи ӯ);
  //    папкаи Free Fire → ТАНҲо FireLoot (алмос/вучер/пропуск).
  const products = (game.products ?? []).filter(
    (p) =>
      (!p.region || p.region === region) &&
      (likesOnly ? groupOf(p) === "likes" : groupOf(p) !== "likes"),
  );
  const price = selected ? Number(selected.price_tjs) : 0;
  const canUseBalance = !!user && balance >= price && price > 0;

  /** 🗂 Гурӯҳбандии воқеӣ аз номи маҳсулот (на логикаи сахткӯҳ) */
  const groups: Record<GroupKey, Product[]> = {
    likes: [],
    diamonds: [],
    currency: [],
    vouchers: [],
    passes: [],
    packs: [],
  };
  for (const p of products) groups[groupOf(p)].push(p);
  // 🔢 Тартиби воқеӣ (талаби соҳиб 20.11.2026 «bo paryaduk mon»):
  //    Level Up 6 → 10 → 15 → 20 → 25 → 30 (ном рақами воқеӣ дорад)
  for (const key of Object.keys(groups) as GroupKey[]) {
    groups[key].sort((a, b) => {
      const lvl = (p: Product) => {
        const m = p.name.match(/Level Up(?: Pass)?\s*(\d+)/i);
        return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
      };
      return lvl(a) - lvl(b) || a.id - b.id;
    });
  }

  /** Гурӯҳҳои маҳсулотдошта (тартиб аз SECTION_META) + таби фаъол */
  const visibleSections = SECTION_META.filter((m) => groups[m.key].length > 0);
  const activeKey: GroupKey | undefined =
    activeGroup && groups[activeGroup].length ? activeGroup : visibleSections[0]?.key;
  /** Табҳо танҳо ҳангоми ≥2 бахш (дар мобилӣ; десктоп = стеки пешин) */
  // 20.11.2026 (соҳиб «dar injo propusk daror nest»): дар папкаи ЛАЙКҲО
  //    ҳарду бахш — Лайкҳо + Level Up Pass — якҷоя намоён, таби ивазкунӣ нест
  const tabsOn = !likesOnly && visibleSections.length >= 2;

  // 🙈 Навори пардохт ТАНҲО ҳангоми интихоби бахши фаъол (талаби соҳиб
  //    10.11.2026 «va inro nishon nadihad to inhoro intixob nakunad»):
  //    агар бастаи интихобшуда дар таби дигар пинҳон бошад → ПАРТОФТА
  //    мешавад, то корбар дар рӯйхати ҷорӣ баста интихоб накунад.
  //    Дар десктоп ҳамаи бахшҳо пас-пас намоён → интихоб аз ҳар бахш
  //    эътибор дорад → тағйир намеёбад (танҳо мобилӣ).
  useEffect(() => {
    if (!selected || !activeKey) return;
    if (!window.matchMedia("(max-width: 767px)").matches) return; // десктоп
    if (!groups[activeKey].some((p) => p.id === selected.id)) {
      setSelected(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, activeKey]);
  /** Номи кӯтоҳи маҳсулоти интихобшуда — барои «Фармоиши шумо» */
  const selView = selected ? packView(selected, game, t) : null;

  /** ID-и пурра: «12345678» ё «12345678 (1234)» барои бозиҳои бо Zone (MLBB) */
  const uidValue = (() => {
    const id = playerId.trim();
    if (!id) return "";
    const z = zone.trim();
    return z ? `${id} (${z})` : id;
  })();

  /** 📞 Пурсидани ник (барои тугмаи «Санҷидан» + дебаунс). */
  const runLookup = async (uid: string) => {
    if (uid.length < 3) {
      setNickLookup(null);
      return;
    }
    setNickLoading(true);
    try {
      const res = await api.lookupPlayer(game.slug, uid, region);
      setNickLookup(res);
      if (res.found && res.nickname && !nickname) {
        setNickname(res.nickname);
      }
      // 🌍 Худкор-интихоби минтақа аз ID: агар backend минтақаи ҳақиқии
      //    бозигарро баргардонад ва он аз интихоби ҷорӣ фарқ кунад →
      //    dropdown худор ба он мегузарад → бастаҳо аз он минтақа меафтанд.
      const detected = (res.region || "").trim();
      if (
        res.found &&
        detected &&
        detected !== region &&
        (game.regions ?? []).some((r) => r === detected)
      ) {
        autoRegionRef.current = true;
        setRegion(detected);
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
    const uid = uidValue;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // 🌍 Минтақа аз ID худор иваз шуд → натиҷаи санҷиш аллакай тоза аст,
    //    дубора дархост накӯшем (дархости такрорӣ). Ref-ро clear-effect мегирад.
    if (autoRegionRef.current) return;

    // Zone-бозиҳо (MLBB): мин 7 рақам; боқия: мин 8 (ҳамон backend)
    const minDigits = game.needs_zone ? 7 : 8;
    const digits = uid.replace(/\D/g, "");
    if (uid.length >= 3 && digits.length >= minDigits) {
      debounceRef.current = setTimeout(() => runLookup(uid), 700);
    } else {
      setNickLookup(null);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uidValue, game.slug, game.needs_zone, region]);

  // 🌍 Минтақа иваз шуд → бастаи кӯҳна аз рӯйхат нопадид мешавад,
  //    пас интихоб ва натиҷаи санҷиш низ бояд пок шавад (нархи кӯҳна нодуруст мешуд!)
  useEffect(() => {
    setInnerSelected(null);
    onSelected?.(null);
    if (autoRegionRef.current) {
      // Минтақа аз ID худор иваз шуд → натиҷаи санҷиш (нику минтақа)
      //    тоза аст — нигаҳ дор; танҳо интихоби баста пок мешавад.
      autoRegionRef.current = false;
    } else {
      setNickLookup(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  // Ивази баста (ё нопадид шудани интихоб) → қадам ба «browse»: корт дар
  // мобилӣ дубора пинҳон, навор боз пайдо мешавад.
  useEffect(() => {
    setPayStep("browse");
  }, [selected?.id]);

  /** Сохтани фармоиш дар сервер (муштарак барои баланс ва DC). */
  const createOrder = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await api.createOrder({
        game_slug: game.slug,
        product_id: selected!.id,
        // Зона дар дохили player_id: «12345678 (1234)» — ҳамон формати кӯҳна
        player_id: uidValue,
        player_nickname: nickname.trim() || undefined,
        region: region.trim(),
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
    // 🎮 Зона барои MLBB ҳатми воқеӣ — бе он иҷро имкон нест (FireLoot ҳам мепурсад)
    if (game.needs_zone && !zone.trim()) {
      setError(t("zoneRequired"));
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* ---------- ЧАП: ҲИСОБ + БАХШҲОИ МАҲСУЛОТ ---------- */}
        <div className="min-w-0 space-y-5">
          <div className="glass rounded-3xl p-4 sm:p-6">
            {/* ============ 1. ДАННЫЕ АККАУНТА ============ */}
            <SectionHead n={1} title={t("accountData")} hint={t("accountDataHint")} />

            {/* 🌍 Минтақа — танҳо вақте ки каталог зиёда аз 1 минтақа дорад (FF, MLBB) */}
            {game.regions && game.regions.length > 1 && (
              <div className="mb-4">
                <label className="label" htmlFor="region-select">
                  <span className="inline-flex items-center gap-1.5">
                    <Ic icon={Globe} size="xs" />
                    {t("region")}
                  </span>
                  <span className="text-rose-500">*</span>
                </label>
                <select
                  id="region-select"
                  className="input"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  {game.regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
                  onChange={(e) => {
                    setPlayerId(e.target.value);
                    try { window.localStorage.setItem(pidKey, e.target.value); } catch { /* бехатар */ }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && uidValue.length >= 3) runLookup(uidValue);
                  }}
                />
                {/* 📋 «Вставить» — гузоридани ID аз clipboard (соҳиб 20.11.2026) */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = (await navigator.clipboard.readText()).trim();
                      if (text) {
                        setPlayerId(text);
                        try { window.localStorage.setItem(pidKey, text); } catch { /* бехатар */ }
                      }
                    } catch { /* clipboard дастрас нест — бехатар */ }
                  }}
                  aria-label={t("paste")}
                  title={t("paste")}
                  className="shrink-0 px-3 rounded-xl border border-slate-200 bg-white text-slate-600
                             text-sm font-semibold hover:bg-slate-50 transition flex items-center gap-1.5"
                >
                  <Ic icon={ClipboardPaste} />
                  <span className="max-[420px]:hidden">{t("paste")}</span>
                </button>
                <button
                  type="button"

                  aria-label={t("check")}
                  title={t("check")}
                  onClick={() => runLookup(uidValue)}
                  disabled={nickLoading || uidValue.length < 3}
                  className="shrink-0 px-3.5 rounded-xl bg-brand-600 text-white text-sm font-semibold
                             hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed
                             transition flex items-center gap-1.5"
                >
                  {nickLoading ? (
                    <Ic icon={Loader2} className="animate-spin" />
                  ) : (
                    <>
                      <Ic icon={Search} />
                    </>
                  )}
                </button>
              </div>

              {/* 🎮 Зона/Server ID — талаби воқеии MLBB (FireLoot ҳам мепурсад) */}
              {game.needs_zone && (
                <div className="mt-3">
                  <label className="label" htmlFor="zone-input">
                    {t("zoneId")} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="zone-input"
                    className="input font-mono"
                    inputMode="numeric"
                    placeholder={t("zonePh")}
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                  />
                </div>
              )}

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

          {/* 🗂 Табҳои категорияҳо — ТАНҲО мобилӣ (талаби соҳиб10.11.2026:
              «1 Алмосҳо,2 Ваучерҳо,3 Пропускҳо») — як вақт танҳо як бахш;
              дар десктоп ҳамаи бахшҳо пас-пас мемонанд. Танҳо ≥2 бахш. */}
          {tabsOn && (
            <div
              role="tablist"
              aria-label={t("categories")}
              className="md:hidden flex gap-2 overflow-x-auto pb-1 mb-3"
            >
              {visibleSections.map((m) => {
                const on = m.key === activeKey;
                return (
                  <button
                    key={m.key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setActiveGroup(m.key)}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-2
                      text-xs font-extrabold transition-all active:scale-95
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                        on
                          ? "border-brand-600 bg-brand-600 text-white shadow-[0_8px_18px_-8px_rgba(37,99,235,0.5)]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                  >
                    <Ic icon={m.icon} size="xs" />
                    {t(m.titleKey)}
                    <span className={`text-[10px] font-bold ${on ? "text-white/85" : "text-slate-400"}`}>
                      {groups[m.key].length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {SECTION_META.map(({ key, titleKey, icon }) => {
            const items = groups[key];
            if (!items.length) return null;
            return (
              <section
                key={key}
                className={`glass rounded-3xl p-4 sm:p-6 ${
                  tabsOn && key !== activeKey ? "max-[767px]:hidden" : ""
                }`}
              >
                {/* Сарлавҳаи бахш дар мобилӣ аз табҳо пинҳон (дар десктоп мемонад) */}
                <div className={`flex items-center gap-3 mb-4 ${tabsOn ? "max-[767px]:hidden" : ""}`}>
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

                        {/* ⏰ Қоидаи воқеии Leak Studio (соҳиб 20.11.2026):
                            «dar davomi 1 ruz 1bor meshavad» — танҳо дар бахши лайк */}
                        {key === "likes" && (
                          <p className="mb-3 flex items-start gap-2 rounded-2xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-[11px] leading-snug text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                            <Ic icon={CalendarClock} size="xs" className="mt-0.5 shrink-0" />
                            <span>{t("likesDailyNote")}</span>
                          </p>
                        )}
                {/* 20.11.2026 (соҳиб «dar 1 row nishon dihad»): ду лайк
                    ёнбаш дар як сатр, дигар бахшҳо — мисли пешин */}
                <div
                  className={`grid gap-2 sm:gap-2.5 mb-6 ${
                    key === "likes"
                      ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                      : "grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4"
                  }`}
                >
                  {items.map((p) => {
                    const active = selected?.id === p.id;
                    const view = packView(p, game, t);
                    const art = productArt(game, p);
                    // 💎 Ҷамъи алмази узвият — ТАНҲО FF (бақияи бозиҳо номи
                    // «Weekly…» доранд → баҷои 450 ғалат намешавад)
                    const dia = art && game.slug === "free-fire" ? ffVoucherDia(p) : null;
                    // 💎 Пропуск: чанд алмос медиҳад (соҳиб16.11.2026
                    // «chand almos medihad haminro nishon dihad» — 6=120)
                    const passDia =
                      dia === null && art && game.slug === "free-fire" ? ffPassDia(p) : null;
                    const pill = dia ?? passDia;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelected(p)}
                        aria-pressed={active}
                        aria-label={p.name}
                        title={p.name}
                        className={`relative flex min-w-0 flex-row items-center ${key === "likes" ? "gap-2 px-2.5" : "gap-3 px-3"} rounded-2xl border-2 py-3 text-left transition-all
                          ${
                              key === "likes"
                                ? active
                                  ? "border-emerald-600 bg-emerald-50 shadow-[0_8px_20px_-10px_rgba(5,150,105,0.7)] scale-[1.02]"
                                  : "border-emerald-100 bg-white hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5"
                                : active
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

                        {/* 💎 Бейҷ дар болои рост (манобеъ: скриншоти
                            соҳиб 11.11.2026): вouchер = алмос (Weekly Lite=90
                            · Weekly=450 · Monthly=2600); ПРОПУСК = ҳамон 💎 +
                            ЧАНД АЛМОС МЕДИҲАД — таҳрири соҳиб16.11.2026
                            «chand almos medihad haminro nishon dihad»
                            («level 6 minsol 120 almos»): 6→120 · 10/15/20/25→
                            200 · 30→350 (ҷадвали воқеӣ, ҷамъ=1270 — тафсилот
                            дар `FF_PASS_DIA`); сатри номаълум → бейҷ нест,
                            ягон рақам сохта НАШУД; бастаҳои алмос дар матн
                            «110 алмос» доранд → бейҷ намегиранд */}
                        {pill !== null && (
                          <span
                            aria-hidden
                            className={`absolute -top-2.5 ${
                              p.is_popular ? "left-2" : "right-2"
                            } inline-flex items-center gap-1 rounded-full border border-brand-100
                               bg-white px-1.5 py-0.5 shadow-sm`}
                          >
                            <DiamondArt className="h-3 w-3" />
                            <span className="text-[10px] font-extrabold tabular-nums text-brand-600">
                              {pill.toLocaleString("tj-TJ")}
                            </span>
                          </span>
                        )}

                        {/* 🖼️ Расми воқеии маҳсулот (талаби соҳиб 12.11.2026
                            «hamai bozihoro kun») — ҳамаи 8 бозӣ; расм нест
                            → иконкаи ҳозира (фолбэк рост) */}
                        {art ? (
                          <img
                            src={art}
                            alt=""
                            aria-hidden
                            className={
                              key === "likes"
                                ? "h-10 w-10 shrink-0 rounded-full object-contain"
                                : "inline-flex h-12 w-14 shrink-0 rounded-xl object-contain"
                            }
                          />
                        ) : (
                          <span
                            aria-hidden
                            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border
                            ${
                              active
                                ? "border-brand-200 bg-white"
                                : "border-brand-100 bg-gradient-to-br from-brand-50 to-blue-50"
                            }`}
                          >
                            {view.diamond ? (
                              /* 💎 Алмос → тасвири воқеии алмос (танҳо барои алмосҳо) */
                              <DiamondArt className="h-5 w-5" />
                            ) : (
                              <Ic
                                icon={view.icon}
                                size="sm"
                                className={active ? "text-brand-700" : "text-brand-600"}
                              />
                            )}
                          </span>
                        )}

                        {/* 20.11.2026 (соҳиб «monandi bashad»): корти сабз —
                            расм + РАҚАМ калон + «лайк» + нархи поён */}
                        {key === "likes" ? (
                          <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                            <span className="flex items-baseline gap-1">
                              <span
                                className={`text-base font-extrabold tabular-nums leading-none ${
                                  active ? "text-emerald-700" : "text-emerald-800"
                                }`}
                              >
                                {Number(p.amount || 0).toLocaleString("tj-TJ")}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-500 truncate ml-0.5">
                                {t("unitLikes")}
                              </span>
                            </span>
                            <span
                              className={`font-extrabold tabular-nums text-[11px] whitespace-nowrap ${
                                active ? "text-emerald-700" : "text-emerald-600"
                              }`}
                            >
                              {Number(p.price_tjs).toLocaleString("tj-TJ")} {t("currency")}
                            </span>
                          </span>
                        ) : (
                          <>
                            {/* Ном/рақам — ҳеҷ гоҳ берун намебарояд */}
                            <span
                              className={`line-clamp-1 min-w-0 flex-1 text-xs sm:text-sm font-bold leading-tight ${
                                active ? "text-brand-700" : "text-slate-700"
                              }`}
                            >
                              {view.text}
                              {view.sub && (
                                <span className="ml-1 font-medium text-slate-400">{view.sub}</span>
                              )}
                            </span>
                            {/* Нарх — доимо бо асъор, набурда */}
                            <span
                              className={`flex min-w-0 shrink-0 items-baseline gap-1 ${
                                active ? "text-brand-700" : "text-brand-600"
                              }`}
                            >
                              <span className="truncate font-extrabold tabular-nums text-sm sm:text-base">
                                {Number(p.price_tjs).toLocaleString("tj-TJ")}
                              </span>
                              <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                                {t("currency")}
                              </span>
                            </span>
                          </>
                        )}

                        {active && (
                          <span
                            className="absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full bg-brand-600 text-white
                                       flex items-center justify-center border-2 border-white shadow-md"
                          >
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

        {/* ---------- ФАРМОИШИ ШУМО ----------
            📱 Мобилӣ (талаби соҳиб10.11.2026 «vaqte ki yagon chiro intixob
            nakardaast inro nishon nadihad … tanho in paydo shavad»): корт
            ТАНҲО ҳангоми кушодани форма (`selected && payStep="form"`)
            нишон дода мешавад → корти холии «Фармоиши шумо» (Ҳамагӣ 0)
            пайдо НАМЕШАВАД; бе интихоб ё дар browse → пинҳон (ҷои кортро
            навори пардохт мегирад). Дар десктоп ҳамеша нишон (класс
            танҳо max-[767px] = мобилӣ). */}
        <aside
          ref={payCardRef}
          className={`lg:sticky lg:top-[72px] min-w-0${
            selected && payStep === "form" ? "" : " max-[767px]:hidden"
          }`}
        >
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
              <div
                className="rounded-2xl border border-brand-200 bg-brand-50 p-3.5 flex items-center gap-3"
                title={selected.name}
              >
                {/* 🖼️ Ҳамон расми воқеии маҳсулот (талаби соҳиб 11.11.2026
                    «injoro kame zobo tar kun») — бо кортҳои бахш мутобиқат */}
                {productArt(game, selected) ? (
                  <img
                    src={productArt(game, selected) as string}
                    alt=""
                    aria-hidden
                    className="h-10 w-12 shrink-0 rounded-xl object-contain"
                  />
                ) : (
                  <span className="w-10 h-10 shrink-0 rounded-xl bg-white border border-brand-100 flex items-center justify-center">
                    <Ic icon={selView.icon} className="text-brand-600" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800 text-sm truncate">
                    {selView.text}
                    {selView.sub && (
                      <span className="ml-1 font-medium text-slate-400">{selView.sub}</span>
                    )}
                  </p>
                  {/* Номи пурра танҳо барои скринридер/тултип — дар сатр
                      НАМЕОМАД («572 алмос» + «FF 572 Diamonds» такрорӣ буд,
                      «зобо» кардан лозим) */}
                  <span className="sr-only">{selected.name}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-400">
                {t("chooseAmountHint")}
              </div>
            )}

            {/* 🆔 Player ID — соҳиб 21.11.2026: ID дар корти «Фармоиши шумо» */}
            {/* 🆔 Player ID — соҳиб 21.11.2026: ҳамеша дар корти «Фармоиши шумо» */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-500">
                {game.player_id_label || t("playerId")}
              </span>
              <span
                className={`min-w-0 truncate font-mono text-sm font-bold ${
                  uidValue ? "text-slate-800" : "text-slate-400"
                }`}
              >
                {uidValue || "—"}
              </span>
            </div>

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

            <p className="mb-3 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
              {t("choosePayment")}
              <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-slate-200 to-transparent" />
            </p>

            <div className="space-y-2.5 mb-4">
              {/* DC Wallet */}
              <button
                onClick={() => setMethod("dc")}
                aria-pressed={method === "dc"}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-all
                  ${
                    method === "dc"
                      ? "border-brand-600 bg-brand-50/70 shadow-[0_10px_26px_-16px_rgba(37,99,235,0.9)]"
                      : "border-slate-200 bg-white hover:border-brand-300 hover:shadow-md"
                  }`}
              >
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-[0_6px_14px_-6px_rgba(37,99,235,0.85)]"
                >
                  <Ic icon={CreditCard} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">{t("dcPayment")}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{t("payWithDC")}</span>
                </span>
                {/* Радиои ороишӣ — ҳолати воқеӣ дар `aria-pressed`-и кнопка */}
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors
                    ${method === "dc" ? "border-brand-600" : "border-slate-300"}`}
                >
                  {method === "dc" && (
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-600 shadow-[0_0_0_2px_rgba(255,255,255,0.7)]" />
                  )}
                </span>
              </button>

              {/* Баланс */}
              <button
                onClick={() => setMethod("balance")}
                aria-pressed={method === "balance"}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-all
                  ${
                    method === "balance"
                      ? "border-emerald-600 bg-emerald-50/70 shadow-[0_10px_26px_-16px_rgba(16,185,129,0.9)]"
                      : "border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md"
                  }`}
              >
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_6px_14px_-6px_rgba(16,185,129,0.85)]"
                >
                  <Ic icon={Wallet} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">{t("balancePayment")}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {user ? (
                      <>
                        {t("currentBalance")}:{" "}
                        <span className={balance >= price ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>
                          {balance.toLocaleString("tj-TJ")} {t("currency")}
                        </span>
                      </>
                    ) : (
                      t("loginForBalance")
                    )}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors
                    ${method === "balance" ? "border-emerald-600" : "border-slate-300"}`}
                >
                  {method === "balance" && (
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 shadow-[0_0_0_2px_rgba(255,255,255,0.7)]" />
                  )}
                </span>
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
              className="btn-primary w-full rounded-2xl py-4 shadow-[0_16px_34px_-14px_rgba(37,99,235,0.95)] transition-transform active:scale-[0.99]"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Ic icon={Loader2} className="animate-spin" /> {t("loading")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-base font-semibold">
                  <Ic icon={Lock} />
                  {method === "balance" ? t("payFromBalance") : t("pay")}
                </span>
              )}
            </button>

            {/* 16.11.2026 (талаби соҳиб — скриншотҳо [1][2]: «chand pardoxt
                meshavad ku haminro nishon nadihad») — рақами «N сомонӣ» АЗ
                ТУГМАИ пардохт БАРДОШТА шуд: маблағ дар «Хамагӣ» менависад;
                тугма танҳо матн (мисли навори browse-и 10.11.2026, ки нарх
                он ҷо ҳам набуд). */}

            {/*10.11.2026 (talabi соҳиб — скриншот): падпаи secureNote дар ин
                ҷо НАШАВАД — дар ҷараёни пардохти алмос нодаркор аст; тугмаи
                пардохт охирин элемент мемонад (сабти Home.tsx даст назадааст). */}
          </div>
        </aside>
      </div>

      {/* 📱10.11.2026 (talabi соҳиб — скриншотҳо [1][2] — ивази мантиқи давр):
          (1) навор ТАНҲО «Пардохт кардан» — НАРХ дар навор НЕСТ;
          (2) корти «Фармоиши шумо» дар мобилӣ то зер кардани навор нишон
          НАМЕШАВАД → навор зер → корт пайдо мешавад ва ба он мебарад.
          Навор ҳоло submit НАМЕКУНАД — танҳо `payStep="form"` + скролл;
          пардохт ва ҳама санҷишҳо (Player ID/зона/баланс) аз тугмаи форма.
          Баъди сохтани фармоиш GameDetail ба `/order/:id` мегузарад → ин
          блок нопаид → BottomNav барқарор («баъд пардохт пок шавад»).
          Танҳо мобилӣ (md:hidden); дар десктоп корт ҳамеша нишон. */}
      {selected && payStep === "browse" && (
        <div className="md:hidden fixed bottom-3 inset-x-3 z-[55] max-w-md mx-auto">
          <button
            onClick={() => {
              setPayStep("form");
              // Корт пас аз render пайдо мешавад → ба он мебарем
              window.setTimeout(() => {
                payCardRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }, 100);
            }}
            disabled={loading}
            className="btn-primary w-full rounded-2xl py-4 shadow-[0_16px_34px_-14px_rgba(37,99,235,0.95)] transition-transform active:scale-[0.99]"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Ic icon={Loader2} className="animate-spin" /> {t("loading")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-base font-semibold">
                <Ic icon={Lock} />
                {t("pay")}
              </span>
            )}
          </button>
        </div>
      )}

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
