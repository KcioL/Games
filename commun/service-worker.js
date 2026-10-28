// Garde le site en mémoire sur l'appareil pour qu'il s'ouvre sans internet (voir sw.js).
// Le chemin de sw.js est calculé à partir de ce fichier, pour marcher depuis n'importe quelle page.
if ('serviceWorker' in navigator) {
  const adresse = new URL('../sw.js', document.currentScript.src);
  navigator.serviceWorker.register(adresse).catch(() => {});
}

// Comptage des visites pour le tableau de bord (voir suivi.js à la racine du site)
(() => {
  const s = document.createElement('script');
  s.src = new URL('../suivi.js', document.currentScript.src).href;
  s.dataset.site = 'jeux';
  s.dataset.base = 'https://games-12f19-default-rtdb.europe-west1.firebasedatabase.app';
  document.head.appendChild(s);
})();
