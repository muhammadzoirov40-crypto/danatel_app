import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * ⚠️ `?b=`-и cache-bust ба скрипти entry НАМЕКУНЕМ:
 * chunk-ҳои lazy entry-ро бе query импорт мекунанд → браузер онро ҳамчун
 * модули ДУЮМ меҳисобад → entry дубора иҷро мешавад (Home cache тоза,
 * дубора createRoot). Барои навсозӣ index.html no-cache + hash-и файл кофӣ аст.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
