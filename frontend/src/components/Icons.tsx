import type { SVGProps } from "react";

/**
 * 🎨 Иконкаҳои реалистии SVG (Realistic SVG Icons)
 * Бо градиентҳо, сояҳо ва ҷузъиёти баландсифат.
 */

/** 🇹🇯 Парчами ҳақиқии Тоҷикистон (Real Tajik Flag) */
export function TajikFlag({ className = "w-4 h-3 rounded-xs shadow-xs" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 16"
      className={`inline-block shrink-0 overflow-hidden ${className}`}
      aria-label="Тоҷикистон"
    >
      {/* Сурх (Боло) */}
      <rect width="24" height="4.5" fill="#d9242a" />
      {/* Сафед (Мобайн) */}
      <rect y="4.5" width="24" height="7" fill="#ffffff" />
      {/* Сабз (Поён) */}
      <rect y="11.5" width="24" height="4.5" fill="#008e3d" />
      {/* Тоҷ ва 7 ситораи тиллоӣ */}
      <g transform="translate(12, 8) scale(0.65)" fill="#f6b800">
        {/* Тоҷ */}
        <path d="M-4 -1.2 L-5 -3 L-2.5 -1.8 L0 -4 L2.5 -1.8 L5 -3 L4 -1.2 Q0 0 -4 -1.2 Z" />
        <ellipse cx="0" cy="-0.2" rx="3.5" ry="0.6" />
        {/* 7 ситора */}
        <circle cx="-5" cy="-4.8" r="0.6" />
        <circle cx="-3.4" cy="-5.8" r="0.6" />
        <circle cx="-1.5" cy="-6.4" r="0.6" />
        <circle cx="0" cy="-6.6" r="0.6" />
        <circle cx="1.5" cy="-6.4" r="0.6" />
        <circle cx="3.4" cy="-5.8" r="0.6" />
        <circle cx="5" cy="-4.8" r="0.6" />
      </g>
    </svg>
  );
}

/** 🪙 Тангаи воқеии тиллоӣ (Realistic 3D Gold Coin) */
export function GoldCoin({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block shrink-0 ${className}`}>
      <defs>
        <radialGradient id="coinGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#facc15" />
          <stop offset="85%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </radialGradient>
        <linearGradient id="coinRim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="50%" stopColor="#ca8a04" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>
      </defs>
      {/* Ҳалқаи берунӣ */}
      <circle cx="12" cy="12" r="10.5" fill="url(#coinRim)" />
      {/* Баданаи тиллоӣ */}
      <circle cx="12" cy="12" r="9.2" fill="url(#coinGrad)" />
      {/* Канори дохилӣ */}
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="#ca8a04" strokeWidth="0.8" opacity="0.6" strokeDasharray="1.2,1.2" />
      {/* Рамзи танга / Т */}
      <path
        d="M12 6.5 L12 17.5 M9 8.5 L15 8.5 M9 11.5 L15 11.5"
        stroke="#854d0e"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Ҷило (shine) */}
      <ellipse cx="8.5" cy="7.5" rx="3" ry="1.5" fill="#ffffff" opacity="0.45" transform="rotate(-30 8.5 7.5)" />
    </svg>
  );
}

/** 💎 Алмоси воқеии 3D (Realistic 3D Diamond) */
export function Diamond3D({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={`inline-block ${className}`}>
      <defs>
        <linearGradient id="dTop" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>
        <linearGradient id="dMidLeft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="dMidCenter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <linearGradient id="dMidRight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
      </defs>
      {/* Ҷабҳаи болоӣ (Table) */}
      <polygon points="14,12 34,12 28,19 20,19" fill="#e0f2fe" />
      <polygon points="6,19 14,12 20,19" fill="url(#dTop)" />
      <polygon points="34,12 42,19 28,19" fill="url(#dTop)" opacity="0.9" />
      {/* Ҷабҳаҳои миёна ба нӯг */}
      <polygon points="6,19 20,19 24,38" fill="url(#dMidLeft)" />
      <polygon points="20,19 28,19 24,38" fill="url(#dMidCenter)" />
      <polygon points="28,19 42,19 24,38" fill="url(#dMidRight)" />
      {/* Дурахш (glint) */}
      <circle cx="15" cy="15" r="1.5" fill="#ffffff" />
      <circle cx="24" cy="20" r="1.2" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}

/** 🎮 Геймпад / Ҷойстики воқеӣ (Realistic 3D Gamepad) */
export function Gamepad3D({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={`inline-block ${className}`}>
      <defs>
        <linearGradient id="padBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="padGrip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      {/* Баданаи геймпад */}
      <path
        d="M10 16 C12 12, 36 12, 38 16 C41 21, 44 32, 39 37 C35 41, 31 35, 29 30 C27 28, 21 28, 19 30 C17 35, 13 41, 9 37 C4 32, 7 21, 10 16 Z"
        fill="url(#padBody)"
      />
      {/* Дастаҳои поёнӣ */}
      <path d="M7 28 C6 33, 8 38, 10 37 C13 36, 16 30, 16 28 Z" fill="url(#padGrip)" opacity="0.6" />
      <path d="M41 28 C42 33, 40 38, 38 37 C35 36, 32 30, 32 28 Z" fill="url(#padGrip)" opacity="0.6" />
      {/* D-Pad (салибча) */}
      <path
        d="M14 20 h3 v-3 h2 v3 h3 v2 h-3 v3 h-2 v-3 h-3 Z"
        fill="#ffffff"
        opacity="0.95"
      />
      {/* Тугмаҳои амал (ABXY) */}
      <circle cx="34" cy="18.5" r="1.6" fill="#f87171" />
      <circle cx="37" cy="21.5" r="1.6" fill="#34d399" />
      <circle cx="31" cy="21.5" r="1.6" fill="#60a5fa" />
      <circle cx="34" cy="24.5" r="1.6" fill="#fbbf24" />
      {/* Стики аналоги */}
      <circle cx="20" cy="26" r="3" fill="#1e3a8a" />
      <circle cx="20" cy="26" r="2.2" fill="#60a5fa" opacity="0.9" />
      <circle cx="28" cy="26" r="3" fill="#1e3a8a" />
      <circle cx="28" cy="26" r="2.2" fill="#60a5fa" opacity="0.9" />
    </svg>
  );
}

/** 🆔 Корти ID-и воқеӣ (Realistic ID Badge) */
export function IdBadge3D({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={`inline-block ${className}`}>
      <defs>
        <linearGradient id="idCardGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6b21a8" />
        </linearGradient>
      </defs>
      {/* Қолаби корт */}
      <rect x="8" y="10" width="32" height="28" rx="5" fill="url(#idCardGrad)" />
      {/* Сӯрохии лента */}
      <rect x="21" y="12" width="6" height="2" rx="1" fill="#ffffff" opacity="0.5" />
      {/* Аватар / Расми корбар */}
      <circle cx="17" cy="23" r="4.5" fill="#ffffff" opacity="0.95" />
      <path d="M11 31 C11 28, 14 27, 17 27 C20 27, 23 28, 23 31 Z" fill="#ffffff" opacity="0.95" />
      {/* Хатҳои маълумот */}
      <rect x="25" y="20" width="11" height="2.5" rx="1" fill="#ffffff" />
      <rect x="25" y="24.5" width="8" height="2" rx="1" fill="#f3e8ff" opacity="0.8" />
      <rect x="25" y="28.5" width="10" height="2" rx="1" fill="#f3e8ff" opacity="0.8" />
      {/* Нишони бехатарӣ */}
      <circle cx="34" cy="33" r="2" fill="#34d399" />
    </svg>
  );
}

/** 💳 Корти пардохти воқеӣ (Realistic Credit Card) */
export function CreditCard3D({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={`inline-block ${className}`}>
      <defs>
        <linearGradient id="ccGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="chipGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
      </defs>
      {/* Баданаи корт */}
      <rect x="6" y="11" width="36" height="26" rx="4.5" fill="url(#ccGrad)" />
      {/* Хатти сиёҳи магнитӣ */}
      <rect x="6" y="16" width="36" height="5" fill="#78350f" opacity="0.5" />
      {/* Чипи тиллоӣ */}
      <rect x="11" y="23" width="7" height="6" rx="1.5" fill="url(#chipGrad)" />
      <path d="M11 26 h7 M14.5 23 v6" stroke="#854d0e" strokeWidth="0.5" />
      {/* Хатти рақами корт */}
      <rect x="21" y="25" width="16" height="2" rx="1" fill="#ffffff" opacity="0.8" />
      {/* Рамзи пардохт */}
      <circle cx="32" cy="31" r="2.5" fill="#ef4444" opacity="0.9" />
      <circle cx="35" cy="31" r="2.5" fill="#facc15" opacity="0.9" />
    </svg>
  );
}

/** 🎁 Қуттии туҳфаи воқеӣ (Realistic 3D Gift Box) */
export function GiftBox3D({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={`inline-block ${className}`}>
      <defs>
        <linearGradient id="giftBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#be123c" />
        </linearGradient>
        <linearGradient id="giftRibbon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#eab308" />
        </linearGradient>
      </defs>
      {/* Сарпӯш (Lid) */}
      <rect x="8" y="16" width="32" height="7" rx="2.5" fill="#fb7185" />
      {/* Баданаи қуттӣ */}
      <rect x="10" y="22" width="28" height="17" rx="3" fill="url(#giftBody)" />
      {/* Лентаи амудӣ */}
      <rect x="21.5" y="16" width="5" height="23" fill="url(#giftRibbon)" />
      {/* Бандинаи болоӣ (Bow) */}
      <path
        d="M24 16 C20 10, 14 11, 16 15 C18 18, 22 16, 24 16 Z"
        fill="url(#giftRibbon)"
      />
      <path
        d="M24 16 C28 10, 34 11, 32 15 C30 18, 26 16, 24 16 Z"
        fill="url(#giftRibbon)"
      />
      <circle cx="24" cy="16" r="2" fill="#ca8a04" />
    </svg>
  );
}

/** 📖 Нишони каталоги воқеӣ (Catalog Icon) */
export function CatalogIcon({ className = "w-4 h-4" }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" fill="currentColor" fillOpacity="0.15" />
      <path d="M6 6h10M6 10h10M6 14h6" />
    </svg>
  );
}

/** 📦 Нишони фармоишҳо / қуттӣ (Orders Box Icon) */
export function OrdersIcon({ className = "w-4 h-4" }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" fill="currentColor" fillOpacity="0.15" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </svg>
  );
}
