/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // 🔵 Рангҳои асосӣ — ҳамон persshop.com (--primary / --primary-hover)
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          200: "#bcdcff",
          300: "#8fc4ff",
          400: "#5aa3ff",
          500: "#2563eb", // --primary
          600: "#1d4ed8", // --primary-hover
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#172554",
        },
        // 🔘 Хокистарии кабуд-тоб — ҳамон neutrals-и persshop
        //   (foreground #0f1e3d, muted #55648a, border #dbe4fb, bg #f4f7ff)
        slate: {
          50: "#f4f7ff",
          100: "#eaeffb",
          200: "#dbe4fb", // --border (сабук)
          300: "#c3d1f2",
          400: "#9aa3b8", // --muted (сабук)
          500: "#55648a", // --muted
          600: "#3f4d73",
          700: "#2b3a63",
          800: "#1c2b4d",
          900: "#0f1e3d", // --foreground
          950: "#0a0d14", // заминаи торик
        },
        // 🩵 Аксенти firӯза — --accent-и persshop
        accent: {
          DEFAULT: "#0891b2",
          light: "#22d3ee",
          pale: "#a5f3fc",
        },
      },
      fontFamily: {
        // Фонти Onest — ҳамон fonts-и persshop
        sans: ["Onest", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  /**
   * 🌙 Мавзӯи торик ТАНОБО аз `.dark`-и <html> (устувории `?theme=dark|light`).
   *    `media` (пешфарзи Tailwind) бад мебурд: системаи оператсионии торик бо
   *    сайти РАВШАН → рангҳои торик дар заминаи равшан (контрасти паст).
   */
  darkMode: "class",
  plugins: [],
};
