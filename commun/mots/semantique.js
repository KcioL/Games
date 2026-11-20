// ==========================================================================
// Sens des mots (pour Cémantix et Pédantix)
// vocabulaire.txt : les 65 000 mots français les plus courants (un par ligne)
// vecteurs.bin    : pour chaque mot, 64 nombres (−127…127) qui résument son sens ; deux mots de sens
//                   proche ont des vecteurs qui « pointent dans la même direction » (similarité cosinus).
// Ces vecteurs sont une version allégée d'un vrai modèle de langue (spaCy fr_core_news_lg) :
// assez précis pour dire si deux mots sont proches, mais Cémantix utilise en plus les vraies valeurs
// pour les 3000 mots les plus proches de chaque mot à trouver.
// ==========================================================================

const D = 64;
let promesse = null;

export const sansAccents = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
export const nettoyer = (t) => String(t || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');

export function chargerSemantique(base = '../commun/mots/') {
  if (promesse) return promesse;
  promesse = Promise.all([
    fetch(`${base}vocabulaire.txt`).then((r) => { if (!r.ok) throw new Error('vocabulaire'); return r.text(); }),
    fetch(`${base}vecteurs.bin`).then((r) => { if (!r.ok) throw new Error('vecteurs'); return r.arrayBuffer(); }),
  ]).then(([texte, buf]) => {
    const mots = texte.split('\n').map((m) => m.trim()).filter(Boolean);
    const brut = new Int8Array(buf);
    // vecteurs normalisés (longueur 1) : la similarité devient un simple produit scalaire
    const vec = new Float32Array(mots.length * D);
    for (let i = 0; i < mots.length; i++) {
      let n = 0;
      for (let k = 0; k < D; k++) { const v = brut[i * D + k]; n += v * v; }
      n = Math.sqrt(n) || 1;
      for (let k = 0; k < D; k++) vec[i * D + k] = brut[i * D + k] / n;
    }
    const index = new Map(mots.map((m, i) => [m, i]));
    // sans accents : le mot le plus courant (les mots sont rangés du plus courant au plus rare)
    const indexSansAccents = new Map();
    mots.forEach((m, i) => { const k = sansAccents(m); if (!indexSansAccents.has(k)) indexSansAccents.set(k, i); });
    return {
      mots,
      // numéro d'un mot (-1 s'il est inconnu) ; on accepte un mot écrit sans ses accents
      trouver(t) {
        const m = nettoyer(t);
        if (index.has(m)) return index.get(m);
        const k = sansAccents(m);
        return indexSansAccents.has(k) ? indexSansAccents.get(k) : -1;
      },
      // similarité approchée (−1…1) entre deux mots
      similarite(i, j) {
        if (i < 0 || j < 0) return 0;
        let s = 0;
        const a = i * D; const b = j * D;
        for (let k = 0; k < D; k++) s += vec[a + k] * vec[b + k];
        return s;
      },
    };
  });
  return promesse;
}

// numéro du jour (1 = 1er janvier 2026), d'après la date du téléphone : le même mot pour tout le monde
export function numeroDuJour(d = new Date()) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 1)) / 86400000) + 1;
}
