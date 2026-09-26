// Garde le site en mémoire sur l'appareil pour qu'il s'ouvre sans internet (voir sw.js).
// Le chemin de sw.js est calculé à partir de ce fichier, pour marcher depuis n'importe quelle page.
if ('serviceWorker' in navigator) {
  const adresse = new URL('../sw.js', document.currentScript.src);
  navigator.serviceWorker.register(adresse).catch(() => {});
}
