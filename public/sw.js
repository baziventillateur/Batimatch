// Service worker minimal de Batimatch.
// Son rôle : permettre l'installation de l'appli (Chrome exige un worker avec un
// gestionnaire fetch). Les requêtes passent par le réseau ; seule la page d'accueil
// est gardée en secours hors ligne. Les ressources versionnées (assets) ne sont
// jamais mises en cache, pour éviter une version périmée après un déploiement.

const SHELL_CACHE = 'batimatch-shell-v1'
const SHELL_URL = './index.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add(SHELL_URL)).catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put(SHELL_URL, copy)).catch(() => {})
          return response
        })
        .catch(() => caches.match(SHELL_URL).then((r) => r || Response.error())),
    )
    return
  }

  event.respondWith(fetch(request))
})
