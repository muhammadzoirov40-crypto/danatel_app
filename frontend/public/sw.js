/* 📦 PWA Service Worker — donatshop
 *
  * Ҳадаф: барнома насбшаванда (installable) + кор дар шабакаи заъиф.
 * Қоидаҳо:
 *   • /api/* + WS + ғайри-GET → ҲЕҶ cache (маълумот ҳамеша зинда);
 *   • navigation (саҳифа) → NETWORK-FIRST: ҳамеша HTML-и тоза (UpdateToast
 *     ва авто-навсозӣ кор мекунанд); танҳо офлайн → cache-и охирин;
 *   • /assets/* (hash-дор) + /face-models/* + /icon-*.png → CACHE-FIRST
 *     (номҳо беназир → бехатар, офлайн низ кор мекунад);
 *   • ҳамаи дигар GET → network, офлайн → cache.
 * ⚠️ cache-и HTML ҳамеша ПАС аз кӯшиши network навишта мешавад →
 *    ҳеҷ гоҳ версияи куҳна ҳангоми пайвастагӣ намерасад.
 */
const CACHE = "donatshop-v3"; // v3 (20.11.2026): iOS/WebKit `waitUntil`-и баъди
// await-ро рад мекунад → SW меафтад → саҳифа «Боргирӣ қатъ шуд» мемонад.
// v1/v2 пок мешаванд (activate: ҳамаи калидҳои ғайри CACHE).
const STATIC = [/^\/assets\//, /^\/face-models\//, /^\/icon-.*\.png$/];

self.addEventListener("install", () => {
  self.skipWaiting(); // фаъол шудан бе бастани табҳои кушода
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // network only

  if (req.mode === "navigate") {
    e.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) {
            const c = await caches.open(CACHE);
            // 20.11.2026: `await` дар дохили respondWith — SW то тамом шудани
            // навишт зинда мемонад. `waitUntil`-и баъди await дар iOS меафтад!
            await c.put(req, res.clone()).catch(() => {});
          }
          return res;
        } catch {
          const c = await caches.open(CACHE);
          return (
            (await c.match(req)) ||
            (await c.match("/")) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  if (STATIC.some((re) => re.test(url.pathname))) {
    e.respondWith(
      (async () => {
        const c = await caches.open(CACHE);
        const hit = await c.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          // ҳамон қоида (20.11.2026): навишт то охир — бе waitUntil (iOS!)
          if (res.ok) {
            const c = await caches.open(CACHE);
            await c.put(req, res.clone()).catch(() => {});
          }
          return res;
        } catch {
          return Response.error();
        }
      })(),
    );
    return;
  }

  e.respondWith(
    fetch(req).catch(() =>
      caches.match(req).then((r) => r || Response.error()),
    ),
  );
});
