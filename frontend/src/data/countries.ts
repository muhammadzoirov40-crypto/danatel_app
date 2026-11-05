import type { Lang } from "../i18n";

/**
 * 🌍 Рӯйхати кодҳои байналмилалии телефон (dial codes) барои
 *    саҳифаҳои Вуруд / Қайд — корбар кодро ИНТИХОБ мекунад ва
 *    `+`-ро худаш ворид намекунад (талаби соҳиб, 05.11.2026).
 *
 * Танҳо маълумоти воқеӣ: ISO-3166 код, коди даъват, парчам (emoji),
 * ном ба 4 забони лоиҳа (tj/ru/en/uz). Тартиб = тартиби дархости
 * соҳиб → Тоҷикистон аввал. Дупликатҳо аз рӯйхати аслӣ пок шуданд
 * (Русия/Қазоқистон ҳар ду +7, Кореяи Ҷанубӣ, Эморот, Бритония, Амрико).
 *
 * ⚠️ Windows emoji-ҳои парчамро ҳамчун 2 ҳарф (TJ/KZ) нишон медиҳад —
 *    дар телефонҳо (Android/iOS) парчам воқеӣ аст; ҳарфҳо ҳам вазъиятро
 *    равшан мекунанд.
 */
export interface Country {
  /** ISO-3166 alpha-2 — ҷойгузинии ягона (KZ ва RU ҳар ду +7) */
  code: string;
  /** Коди даъват БЕ "+" */
  dial: string;
  /** Парчам — emoji */
  flag: string;
  /** Номи кишвар ба 4 забон */
  names: Record<Lang, string>;
}

export const COUNTRIES: Country[] = [
  { code: "TJ", dial: "992", flag: "🇹🇯", names: { tj: "Тоҷикистон", ru: "Таджикистан", en: "Tajikistan", uz: "Tojikiston" } },
  { code: "UZ", dial: "998", flag: "🇺🇿", names: { tj: "Узбекистон", ru: "Узбекистан", en: "Uzbekistan", uz: "O‘zbekiston" } },
  { code: "KZ", dial: "7", flag: "🇰🇿", names: { tj: "Қазоқистон", ru: "Казахстан", en: "Kazakhstan", uz: "Qozog‘iston" } },
  { code: "KG", dial: "996", flag: "🇰🇬", names: { tj: "Қирғизистон", ru: "Киргизия", en: "Kyrgyzstan", uz: "Qirg‘iziston" } },
  { code: "RU", dial: "7", flag: "🇷🇺", names: { tj: "Русия", ru: "Россия", en: "Russia", uz: "Rossiya" } },
  { code: "CN", dial: "86", flag: "🇨🇳", names: { tj: "Чин", ru: "Китай", en: "China", uz: "Xitoy" } },
  { code: "KR", dial: "82", flag: "🇰🇷", names: { tj: "Кореяи Ҷанубӣ", ru: "Южная Корея", en: "South Korea", uz: "Janubiy Koreya" } },
  { code: "GB", dial: "44", flag: "🇬🇧", names: { tj: "Бритонияи Кабир", ru: "Великобритания", en: "United Kingdom", uz: "Buyuk Britaniya" } },
  { code: "US", dial: "1", flag: "🇺🇸", names: { tj: "Амрико", ru: "США", en: "United States", uz: "AQSH" } },
  { code: "AE", dial: "971", flag: "🇦🇪", names: { tj: "Эмороти Муттаҳида", ru: "ОАЭ", en: "United Arab Emirates", uz: "BAA" } },
  { code: "TR", dial: "90", flag: "🇹🇷", names: { tj: "Туркия", ru: "Турция", en: "Turkey", uz: "Turkiya" } },
  { code: "IR", dial: "98", flag: "🇮🇷", names: { tj: "Эрон", ru: "Иран", en: "Iran", uz: "Eron" } },
  { code: "IN", dial: "91", flag: "🇮🇳", names: { tj: "Ҳиндустон", ru: "Индия", en: "India", uz: "Hindiston" } },
  { code: "PK", dial: "92", flag: "🇵🇰", names: { tj: "Покистон", ru: "Пакистан", en: "Pakistan", uz: "Pokiston" } },
  { code: "SA", dial: "966", flag: "🇸🇦", names: { tj: "Арабистони Саудӣ", ru: "Саудовская Аравия", en: "Saudi Arabia", uz: "Saudiya Arabistoni" } },
  { code: "JP", dial: "81", flag: "🇯🇵", names: { tj: "Ҷопон", ru: "Япония", en: "Japan", uz: "Yaponiya" } },
  { code: "ID", dial: "62", flag: "🇮🇩", names: { tj: "Индонезия", ru: "Индонезия", en: "Indonesia", uz: "Indoneziya" } },
  { code: "MY", dial: "60", flag: "🇲🇾", names: { tj: "Малайзия", ru: "Малайзия", en: "Malaysia", uz: "Malayziya" } },
  { code: "TH", dial: "66", flag: "🇹🇭", names: { tj: "Тайланд", ru: "Таиланд", en: "Thailand", uz: "Tayland" } },
  { code: "VN", dial: "84", flag: "🇻🇳", names: { tj: "Ветнам", ru: "Вьетнам", en: "Vietnam", uz: "Vetnam" } },
  { code: "SG", dial: "65", flag: "🇸🇬", names: { tj: "Сингапур", ru: "Сингапур", en: "Singapore", uz: "Singapur" } },
  { code: "DE", dial: "49", flag: "🇩🇪", names: { tj: "Олмон", ru: "Германия", en: "Germany", uz: "Germaniya" } },
  { code: "FR", dial: "33", flag: "🇫🇷", names: { tj: "Фаронса", ru: "Франция", en: "France", uz: "Fransiya" } },
  { code: "IT", dial: "39", flag: "🇮🇹", names: { tj: "Италия", ru: "Италия", en: "Italy", uz: "Italiya" } },
  { code: "ES", dial: "34", flag: "🇪🇸", names: { tj: "Испания", ru: "Испания", en: "Spain", uz: "Ispaniya" } },
  { code: "CA", dial: "1", flag: "🇨🇦", names: { tj: "Канада", ru: "Канада", en: "Canada", uz: "Kanada" } },
  { code: "MX", dial: "52", flag: "🇲🇽", names: { tj: "Мексика", ru: "Мексика", en: "Mexico", uz: "Meksika" } },
  { code: "BR", dial: "55", flag: "🇧🇷", names: { tj: "Бразилия", ru: "Бразилия", en: "Brazil", uz: "Braziliya" } },
  { code: "AR", dial: "54", flag: "🇦🇷", names: { tj: "Аргентина", ru: "Аргентина", en: "Argentina", uz: "Argentina" } },
  { code: "EG", dial: "20", flag: "🇪🇬", names: { tj: "Миср", ru: "Египет", en: "Egypt", uz: "Misr" } },
  { code: "MA", dial: "212", flag: "🇲🇦", names: { tj: "Марокаш", ru: "Марокко", en: "Morocco", uz: "Marokash" } },
  { code: "DZ", dial: "213", flag: "🇩🇿", names: { tj: "Алҷазоир", ru: "Алжир", en: "Algeria", uz: "Jazoir" } },
  { code: "NG", dial: "234", flag: "🇳🇬", names: { tj: "Нигерия", ru: "Нигерия", en: "Nigeria", uz: "Nigeriya" } },
  { code: "ZA", dial: "27", flag: "🇿🇦", names: { tj: "Африқои Ҷанубӣ", ru: "ЮАР", en: "South Africa", uz: "Janubiy Afrika" } },
  { code: "AU", dial: "61", flag: "🇦🇺", names: { tj: "Австралия", ru: "Австралия", en: "Australia", uz: "Avstraliya" } },
  { code: "NZ", dial: "64", flag: "🇳🇿", names: { tj: "Зеландияи Нав", ru: "Новая Зеландия", en: "New Zealand", uz: "Yangi Zelandiya" } },
  { code: "UA", dial: "380", flag: "🇺🇦", names: { tj: "Украина", ru: "Украина", en: "Ukraine", uz: "Ukraina" } },
  { code: "BY", dial: "375", flag: "🇧🇾", names: { tj: "Белорус", ru: "Беларусь", en: "Belarus", uz: "Belarus" } },
  { code: "PL", dial: "48", flag: "🇵🇱", names: { tj: "Лаҳистон", ru: "Польша", en: "Poland", uz: "Polsha" } },
  { code: "NL", dial: "31", flag: "🇳🇱", names: { tj: "Нидерландия", ru: "Нидерланды", en: "Netherlands", uz: "Niderlandiya" } },
  { code: "BE", dial: "32", flag: "🇧🇪", names: { tj: "Белгия", ru: "Бельгия", en: "Belgium", uz: "Belgiya" } },
  { code: "CH", dial: "41", flag: "🇨🇭", names: { tj: "Швейтсария", ru: "Швейцария", en: "Switzerland", uz: "Shvetsariya" } },
  { code: "AT", dial: "43", flag: "🇦🇹", names: { tj: "Австрия", ru: "Австрия", en: "Austria", uz: "Avstriya" } },
  { code: "SE", dial: "46", flag: "🇸🇪", names: { tj: "Шветсия", ru: "Швеция", en: "Sweden", uz: "Shvetsiya" } },
  { code: "NO", dial: "47", flag: "🇳🇴", names: { tj: "Норвегия", ru: "Норвегия", en: "Norway", uz: "Norvegiya" } },
  { code: "DK", dial: "45", flag: "🇩🇰", names: { tj: "Дания", ru: "Дания", en: "Denmark", uz: "Daniya" } },
  { code: "GR", dial: "30", flag: "🇬🇷", names: { tj: "Юнон", ru: "Греция", en: "Greece", uz: "Yunoniston" } },
  { code: "PT", dial: "351", flag: "🇵🇹", names: { tj: "Португалия", ru: "Португалия", en: "Portugal", uz: "Portugaliya" } },
  { code: "PH", dial: "63", flag: "🇵🇭", names: { tj: "Филиппин", ru: "Филиппины", en: "Philippines", uz: "Filippin" } },
];

/**
 * 🧮 Рақами пурраи байналмилалӣ БЕ "+".
 *
 *  Қоида: агар рақами навишта бо коди интихобшуда оғоз шуда бошад
 *  (масалан «992900019150» бо Тоҷикистон) → ҳамон рақам; вагарна
 *  код + рақам. Ҳамин тавр одати кӯҳна (навиштани «+992…» ё «992…»)
 *  ва интихоби нав (танҳо рақами миллӣ) ҳар ду дуруст кор мекунанд.
 */
export function fullPhone(dial: string, national: string): string {
  const d = (national || "").replace(/\D/g, "");
  return d.startsWith(dial) ? d : dial + d;
}
