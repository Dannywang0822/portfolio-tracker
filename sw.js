/* 持仓跟踪 H5 · Service Worker
 * - 壳资源（HTML/CSS/manifest/icons）：缓存优先，离线可打开界面
 * - 行情请求（Yahoo / 代理）：网络优先，绝不把过期报价当成唯一来源
 */
const CACHE_NAME = "portfolio-h5-shell-v16";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isQuoteRequest(url) {
  const u = url.href;
  const p = url.pathname || "";
  return (
    p.startsWith("/api/quote") ||
    p.startsWith("/api/quotes") ||
    u.includes("/api/quote") ||
    u.includes("finance.yahoo.com") ||
    u.includes("allorigins.win") ||
    u.includes("codetabs.com") ||
    u.includes("corsproxy") ||
    u.includes("isomorphic-git.org") ||
    u.includes("thingproxy") ||
    u.includes("query1.finance") ||
    u.includes("query2.finance")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Quote APIs: network-only (never serve stale prices from cache as sole source)
  if (isQuoteRequest(url)) {
    event.respondWith(
      fetch(req, { cache: "no-store" }).catch(() =>
        new Response(JSON.stringify({ error: "offline", message: "行情请求失败（离线或网络不可用）" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Same-origin shell: cache-first, then network
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
