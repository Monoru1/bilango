/* GoBilan — service worker. Pas de mise en cache de l'API ni de données financières. */
const CACHE = 'gobilan-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/v1/')) return; // API : jamais en cache
  if (req.mode === 'navigate') {
    // Réseau d'abord, coque en secours hors-ligne.
    e.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

/**
 * Web Push (CDC §9.2) : le texte ne contient JAMAIS de montant (écran verrouillé).
 * Charge utile attendue : { type: 'report_sent'|'report_edited'|'reminder'|'expiring'|'new_device'|'payment_confirmed', businessName?: string, badge?: boolean }
 */
const TEXTS = {
  report_sent: (b) => ['Nouveau bilan reçu', b],
  report_edited: (b) => ['Bilan modifié', b],
  reminder: (b) => ['Pensez à faire le bilan du jour', b],
  expiring: (b) => ['Votre abonnement approche de la fin', b],
  new_device: () => ['Connexion sur un nouvel appareil', 'Si ce n’était pas vous, contactez le support.'],
  payment_confirmed: (b) => ['Paiement reçu', b],
};

self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = {};
  }
  const make = TEXTS[data.type];
  if (!make) return;
  const [title, body] = make(data.businessName || 'GoBilan');
  e.waitUntil(
    (async () => {
      await self.registration.showNotification(title, { body: body || '', icon: '/icons/icon-192.png', badge: '/icons/notif-96.png', tag: data.type });
      if (data.type === 'report_sent' && 'setAppBadge' in self.navigator) {
        try {
          await self.navigator.setAppBadge();
        } catch {
          /* API Badge non disponible */
        }
      }
    })(),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const c = list.find((w) => 'focus' in w);
      return c ? c.focus() : self.clients.openWindow('/');
    }),
  );
});
