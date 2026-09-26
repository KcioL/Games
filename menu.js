// Menu : enregistre le service worker et indique si le site marche hors connexion
const indic = document.getElementById('hors-ligne');
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(async () => {
      const cles = await caches.keys();
      for (const c of cles) {
        if (c.startsWith('jeux-vol-') && await (await caches.open(c)).match('skyjo/skyjo.js')) {
          indic.textContent = 'Prêt : le site marche sans internet sur cet appareil.';
          indic.classList.add('pret');
          return;
        }
      }
      indic.textContent = 'Presque prêt : recharge la page dans quelques secondes.';
    })
    .catch(() => { indic.textContent = "Le mode hors connexion n'est pas disponible sur ce navigateur."; });
} else {
  indic.textContent = "Le mode hors connexion n'est pas disponible sur ce navigateur.";
}
