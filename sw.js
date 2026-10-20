/* 持仓跟踪 H5 · Service Worker
 * - 壳资源：HTML/JS 网络优先（避免旧壳卡住登录门控），其余缓存优先
 * - 行情请求：网络优先，绝不把过期报价当成唯一来源
 */
const CACHE_NAME = "portfolio-h5-shell-v42";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./firebase-config.js",
  "./auth.js",
  "./cloudbase-config.js",
  "./cloudbase-auth.js",
  "./market-hours.js",
  "./theme-cyberpunk.css",
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

function isAuthCritical(url) {
  const p = url.pathname || "";
  return (
    p.endsWith("/") ||
    p.endsWith("/index.html") ||
    p.endsWith("/auth.js") ||
    p.endsWith("/firebase-config.js") ||
    p.endsWith("/cloudbase-config.js") ||
    p.endsWith("/cloudbase-auth.js") ||
    p.endsWith("/sw.js")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

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

  // 跨域（GitHub 镜像 / jsDelivr / raw）不经 SW 缓存，直接走网络
  if (url.origin !== self.location.origin) return;

  // 同源 data/*.json：网络直连不缓存，失败才用旧缓存
  if (/\/data\/[^/]+\.json$/.test(url.pathname)) {
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }

  // Auth / shell HTML+JS: network-first so login-gate fixes reach phones quickly
  if (isAuthCritical(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // Other same-origin: cache-first, then network
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
});
