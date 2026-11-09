import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Ҳар борборсозӣ URL-и нави JS-и асосӣ (`?b=…`) → кэши браузери кӯҳна ё
 * вайрон (сабаби «экран мемонад»09.11.2026) убур мешавад; UpdateToast
 * суолишро ҳам мебинад → такрори худкори саҳифа кор мекунад.
 */
function entryCacheBust(): Plugin {
  return {
    name: "entry-cache-bust",
    apply: "build",
    enforce: "post",
    transformIndexHtml(html) {
      const b = Date.now().toString(36);
      return html.replace(/(\/assets\/index-[^"']+\.js)/g, `$1?b=${b}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), entryCacheBust()],
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
