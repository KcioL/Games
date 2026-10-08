// Garde le site en mémoire sur l'appareil pour qu'il s'ouvre sans internet.
// Pour forcer la mise à jour chez tout le monde après une modification, change VERSION.
const VERSION = 'jeux-vol-v45';

const FICHIERS = [
  './', 'index.html', 'menu.css', 'menu.js', 'firebase.js', 'manifest.webmanifest',
  'icones/favicon.ico', 'icones/favicon-32.png', 'icones/apple-touch-icon.png',
  'icones/icone-192.png', 'icones/icone-512.png', 'icones/icone-adaptative-512.png',
  'commun/commun.css', 'commun/salon.js', 'commun/local-db.js', 'commun/relais.js', 'commun/relais.css', 'commun/perso.js', 'commun/cartes.js', 'commun/cartes.css', 'commun/service-worker.js', 'commun/nettoyage.js',
  'uno/', 'uno/index.html', 'uno/script.js', 'uno/style.css', 'uno/uno-logo.png', 'uno/local.js',
  'bataille/', 'bataille/index.html', 'bataille/bataille.js', 'bataille/bataille.css',
  'skyjo/', 'skyjo/index.html', 'skyjo/skyjo.js', 'skyjo/skyjo.css',
  'blackjack/', 'blackjack/index.html', 'blackjack/blackjack.js', 'blackjack/blackjack.css',
  'poker/', 'poker/index.html', 'poker/poker.js', 'poker/poker.css',
  'chevaux/', 'chevaux/index.html', 'chevaux/chevaux.js', 'chevaux/chevaux.css',
  'puissance4/', 'puissance4/index.html', 'puissance4/puissance4.js', 'puissance4/puissance4.css',
  'kassen/', 'kassen/index.html', 'kassen/kassen.js', 'kassen/kassen.css', 'kassen/moteur.js', 'kassen/cartes.js', 'kassen/editions.js', 'kassen/kassen/jeu.js', 'kassen/gwynt/jeu.js',
  'tokyo/', 'tokyo/index.html', 'tokyo/tokyo.js', 'tokyo/tokyo.css', 'tokyo/moteur.js', 'tokyo/plateau.js',
];

// Fichiers externes utiles mais pas indispensables (le mode local s'en passe)
const EXTERNES = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js',
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Shippori+Mincho:wght@600;800&display=swap',
];
const HOTES_EXTERNES = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(FICHIERS);
    await Promise.all(EXTERNES.map((u) => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cles = await caches.keys();
    await Promise.all(cles.filter((c) => c.startsWith('jeux-vol-') && c !== VERSION).map((c) => caches.delete(c)));
    await self.clients.claim();
  })());
});

// Réseau d'abord (pour avoir la dernière version), avec un délai max de 4 s,
// puis la copie gardée en mémoire si le réseau ne répond pas.
async function reseauPuisCache(requete) {
  const cache = await caches.open(VERSION);
  try {
    const reponse = await Promise.race([
      fetch(requete),
      new Promise((_, refus) => setTimeout(() => refus(new Error('délai dépassé')), 4000)),
    ]);
    if (reponse && reponse.ok) cache.put(requete, reponse.clone());
    return reponse;
  } catch (e) {
    const copie = await cache.match(requete, { ignoreSearch: true });
    if (copie) return copie;
    throw e;
  }
}

// Mémoire d'abord pour les bibliothèques et polices (elles ne changent pas)
async function cachePuisReseau(requete) {
  const cache = await caches.open(VERSION);
  const copie = await cache.match(requete);
  if (copie) return copie;
  const reponse = await fetch(requete);
  if (reponse && (reponse.ok || reponse.type === 'opaque')) cache.put(requete, reponse.clone());
  return reponse;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(reseauPuisCache(req));
  } else if (HOTES_EXTERNES.includes(url.hostname)) {
    event.respondWith(cachePuisReseau(req));
  }
  // Tout le reste (la base Firebase en ligne) passe normalement.
});
