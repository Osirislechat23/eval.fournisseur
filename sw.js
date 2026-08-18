// Service worker de RF — Espace Perso & Pro.
// But : rendre l'app réellement utilisable hors-ligne (une fois visitée au moins une fois en ligne),
// sans jamais bloquer l'utilisateur sur une version périmée quand il est connecté.
const CACHE_VERSION = 'rf-shell-v1';

// Note : "./" n'est pas dans la liste — selon l'hébergement, l'URL racine ne redirige pas
// forcément vers index_1.html. Le gestionnaire fetch ci-dessous sert index_1.html en cache
// pour TOUTE navigation hors-ligne (y compris la racine), donc ce n'est pas nécessaire ici.
const APP_SHELL = [
  './index_1.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  './fonts/fraunces-var.woff2',
  './fonts/ibmplexsans-var.woff2',
  './fonts/ibmplexmono-400.woff2',
  './fonts/ibmplexmono-500.woff2',
  './js/01-cloud-sync-photos.js',
  './js/02-suppliers-debit-mfg.js',
  './js/03-folders-trips-spacings-notes.js',
  './js/04-recipes-hours-arcade-meals.js',
  './js/05-gifts-surveys-fuel.js',
  './js/06-vehicles-gallery-editlock-trash-ocr.js',
  './js/07-budget-shopping-stats-rpg.js',
  './js/08-home-search-settings-switchview.js',
  './js/09-import-export-auth-bootstrap.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      // Chaque fichier est mis en cache indépendamment : l'échec d'un seul (ex. hébergement
      // sans un des fichiers) n'empêche pas l'installation du service worker pour le reste.
      Promise.all(APP_SHELL.map(url =>
        fetch(url).then(res => { if(res.ok) return cache.put(url, res); }).catch(() => {})
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return; // ne jamais intercepter les appels API/POST (Supabase, etc.)

  const url = new URL(req.url);
  const isNavigation = req.mode === 'navigate';
  const isAppShellFile = url.origin === self.location.origin
    && APP_SHELL.some(p => url.pathname.endsWith(p.slice(1)));

  if(isNavigation || isAppShellFile){
    // Page principale et fichiers du shell : toujours essayer le réseau d'abord pour avoir
    // la dernière version, mais retomber sur le cache si hors-ligne ou serveur injoignable.
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(isNavigation ? './index_1.html' : req, copy));
        return res;
      }).catch(() => caches.match(isNavigation ? './index_1.html' : req))
    );
    return;
  }

  // Tout le reste (scripts CDN, etc.) : cache d'abord, réseau en secours,
  // et on met à jour le cache en arrière-plan pour la prochaine fois.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
