/* Service worker for complaint.website
 *
 * Goal: make the site open instantly and survive a flaky connection, without
 * ever showing someone stale or wrong information. The rules follow from that:
 *
 *   /api/*        never cached. Sessions, OTPs and admin data must be live.
 *   navigations   network-first, cache as fallback. A deploy is visible on the
 *                 next load; losing signal shows the last good page instead of
 *                 the browser's error screen.
 *   static assets stale-while-revalidate. CSS/JS carry a ?v= string, so a new
 *                 build is a new URL and can never collide with an old entry.
 *   fonts         cache-first. They are immutable and hosted elsewhere.
 *
 * Bump CACHE_VERSION whenever the precache list changes; activate() then drops
 * every older cache in one pass.
 */
const CACHE_VERSION = 'v1';
const SHELL = `shell-${CACHE_VERSION}`;
const RUNTIME = `runtime-${CACHE_VERSION}`;
const FONTS = `fonts-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline.html';

// Kept deliberately small — just enough to render something useful offline.
// Everything else arrives through the runtime cache as it is used.
const PRECACHE = [
  '/',
  OFFLINE_URL,
  '/assets/brand/icon-192.png',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      // addAll is all-or-nothing: one 404 would abort the whole install and
      // leave the site with no worker at all. Failures are per-URL instead.
      .then((cache) => Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL, RUNTIME, FONTS]);
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => (keep.has(n) ? null : caches.delete(n)))))
      .then(() => self.clients.claim())
  );
});

// Lets the page trigger an immediate update instead of waiting for all tabs
// to close (see assets/pwa.js).
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

const isFont = (url) =>
  url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

const isStatic = (url) =>
  /\.(css|js|png|jpe?g|svg|ico|webp|woff2?)$/i.test(url.pathname);

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    // Try this exact page, then the homepage, then the offline notice.
    return (await cache.match(request))
        || (await caches.match('/'))
        || (await caches.match(OFFLINE_URL))
        || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      // Opaque cross-origin responses (status 0) are still worth storing —
      // that is how fonts.gstatic.com comes back.
      if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Live data only, and never touch another origin's API.
  if (url.pathname.startsWith('/api/')) return;

  // The admin panel is small, private, and useless offline.
  if (url.pathname.startsWith('/admin')) return;

  if (isFont(url)) {
    event.respondWith(staleWhileRevalidate(request, FONTS));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStatic(url)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
  }
});
