// ==============================================================================
// PUNK RECORDS — Production Service Worker (v3)
// Offline-first caching with stale-while-revalidate and network-first navigation
// ==============================================================================

const CACHE_NAME = 'punk-records-v3'

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/images/punk-records-logo.png',
  '/fonts/NeueHaasDisplay-Roman.woff2',
  '/fonts/PPEditorialNew-Ultralight.woff2',
  '/fonts/MartianMono-Light.woff2',
  '/fonts/FamiljenGrotesk-Regular.woff2',
  '/review',
  '/random',
  '/settings',
  '/editor/new',
]

// 1. INSTALL — Precache shell and critical static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use individual caching so missing optional assets don't fail installation
      await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          fetch(url)
            .then((res) => {
              if (res.ok) return cache.put(url, res)
            })
            .catch((err) => {
              console.warn(`[SW] Precache failed for ${url}:`, err)
            })
        )
      )
    })
  )
  self.skipWaiting()
})

// 2. ACTIVATE — Clean up previous cache versions & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// 3. FETCH — Differentiated routing strategies
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Security & Dev: Never cache Supabase Auth endpoints, upload APIs, or dev HMR sockets
  if (
    url.pathname.includes('/auth/v1') ||
    url.pathname.startsWith('/api/upload') ||
    url.pathname.startsWith('/auth/callback') ||
    url.pathname.includes('webpack-hmr') ||
    url.pathname.includes('__turbopack__')
  ) {
    return
  }

  // A. Navigation requests (HTML page loads) — Network first, fallback to cached page or App Shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          }
          return networkResponse
        })
        .catch(async () => {
          const cachedPage = await caches.match(event.request, { ignoreSearch: true })
          if (cachedPage) return cachedPage

          // Fallback to cached root app shell
          const appShell = await caches.match('/', { ignoreSearch: true })
          if (appShell) return appShell

          return new Response('Offline — Punk Records', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          })
        })
    )
    return
  }

  // B. Next.js Static Assets, Fonts & Media (including Next Image & Supabase storage images)
  const isNextImage = url.pathname.startsWith('/_next/image')
  const isStaticOrMedia =
    url.pathname.startsWith('/_next/static/') ||
    isNextImage ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.includes('/storage/v1/object/public/') ||
    (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/')) ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')

  if (isStaticOrMedia) {
    // For Next.js images, query parameters distinguish different images (?url=...&w=...&q=...). NEVER ignore search!
    const matchOptions = isNextImage ? {} : { ignoreSearch: true }

    event.respondWith(
      caches.match(event.request, matchOptions).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const copy = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          }
          return networkResponse
        })
      })
    )
    return
  }

  // C. Next.js React Server Component (RSC) requests — Network first, fallback to cache
  const isRsc = url.searchParams.has('_rsc') || event.request.headers.get('RSC') === '1'
  if (isRsc) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          }
          return networkResponse
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    )
    return
  }

  // D. General GET requests (runtime caching)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache same-origin valid responses
        if (url.origin === self.location.origin && networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        }
        return networkResponse
      })
      .catch(() => caches.match(event.request))
  )
})

// 4. BACKGROUND SYNC — Wake up and signal clients when internet is restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGER' })
        })
      })
    )
  }
})

// 5. MESSAGE — Handle explicit skipWaiting instructions
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
