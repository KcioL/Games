// ==========================================================================
// Sens des mots (pour Cémantix et Pédantix)
// vocabulaire.txt : les 65 000 mots français les plus courants (un par ligne)
// vocabulaire-plus.txt / vecteurs-plus.bin : 30 000 mots de plus (plus rares ou récents : halloween, smartphone…)
// vecteurs.bin    : pour chaque mot, 64 nombres (−127…127) qui résument son sens : les 64 « directions »
//                   principales du vrai modèle (300 nombres par mot). Le produit des deux listes de nombres
//                   de deux mots redonne, à 1 ou 2 °C près, leur vraie proximité de sens (similarité cosinus).
// Ces vecteurs sont une version allégée d'un vrai modèle de langue (spaCy fr_core_news_lg) :
// assez précis pour dire si deux mots sont proches, mais Cémantix utilise en plus les vraies valeurs
// (au demi-degré) pour les 30 000 mots courants face à chaque mot à trouver.
// ==========================================================================

const D = 64;
const ECHELLE = 4.754654678314483e-05; // (valeur maximale / 127)² : ramène le produit des nombres à une similarité
let promesse = null;

export const sansAccents = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
export const nettoyer = (t) => String(t || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');

// vecteurs prêts au calcul : la similarité devient un simple produit scalaire
function normaliserVecteurs(brut, n) {
  const vec = new Float32Array(n * D);
  const f = Math.sqrt(ECHELLE);
  for (let i = 0; i < n * D; i++) vec[i] = brut[i] * f;
  return vec;
}
const lireTexte = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.text(); });
const lireBinaire = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); });

export function chargerSemantique(base = '../commun/mots/') {
  if (promesse) return promesse;
  promesse = Promise.all([lireTexte(`${base}vocabulaire.txt`), lireBinaire(`${base}vecteurs.bin`)]).then(([texte, buf]) => {
    const mots = texte.split('\n').map((m) => m.trim()).filter(Boolean);
    let vec = normaliserVecteurs(new Int8Array(buf), mots.length);
    const index = new Map();
    // sans accents : le mot le plus courant (les mots sont rangés du plus courant au plus rare)
    const indexSansAccents = new Map();
    const ajouterMots = (liste, debut) => liste.forEach((m, k) => {
      if (!index.has(m)) index.set(m, debut + k);
      const s = sansAccents(m);
      if (!indexSansAccents.has(s)) indexSansAccents.set(s, debut + k);
    });
    ajouterMots(mots, 0);
    let plus = null;
    const sem = {
      mots,
      // numéro d'un mot (-1 s'il est inconnu) ; on accepte un mot écrit sans ses accents
      trouver(t) {
        const m = nettoyer(t);
        if (index.has(m)) return index.get(m);
        const k = sansAccents(m);
        return indexSansAccents.has(k) ? indexSansAccents.get(k) : -1;
      },
      // Mots en plus (30 000 mots plus rares ou récents : halloween, smartphone…), chargés seulement
      // quand on en a besoin pour ne pas alourdir le premier chargement
      chargerPlus() {
        if (!plus) {
          plus = Promise.all([lireTexte(`${base}vocabulaire-plus.txt`), lireBinaire(`${base}vecteurs-plus.bin`)]).then(([t, b]) => {
            const nouveaux = t.split('\n').map((m) => m.trim()).filter(Boolean);
            const v2 = normaliserVecteurs(new Int8Array(b), nouveaux.length);
            const tout = new Float32Array(vec.length + v2.length);
            tout.set(vec); tout.set(v2, vec.length);
            const debut = mots.length;
            nouveaux.forEach((m) => mots.push(m));
            vec = tout;
            ajouterMots(nouveaux, debut);
            sem.plusCharge = true;
          }).catch(() => { plus = null; });
        }
        return plus;
      },
      plusCharge: false,
      // comme trouver(), en allant chercher dans les mots en plus si besoin
      async trouverPartout(t) {
        const i = sem.trouver(t);
        if (i >= 0 || sem.plusCharge) return i;
        await sem.chargerPlus();
        return sem.trouver(t);
      },
      // Mot mal orthographié : le mot connu le plus ressemblant (1 ou 2 lettres de différence), ou ''
      suggerer(t) {
        const cible = sansAccents(nettoyer(t));
        if (cible.length < 3) return '';
        const max = cible.length <= 5 ? 1 : 2;
        let meilleur = ''; let dMin = max + 1;
        for (let i = 0; i < mots.length && dMin > 1; i++) {
          const m = sansAccents(mots[i]);
          if (Math.abs(m.length - cible.length) > max) continue;
          const d = distance(cible, m, dMin - 1);
          if (d < dMin) { dMin = d; meilleur = mots[i]; } // les mots sont rangés du plus courant au plus rare
        }
        return meilleur;
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
    return sem;
  });
  return promesse;
}

// Nombre de fautes (lettre en trop, en moins, changée, ou deux lettres inversées) entre deux mots ;
// s'arrête dès que ça dépasse « max » (renvoie alors max + 1)
function distance(a, b, max) {
  if (a === b) return 0;
  let avant2 = null;
  let avant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const ligne = [i];
    let minLigne = i;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(avant[j] + 1, ligne[j - 1] + 1, avant[j - 1] + c);
      if (avant2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, avant2[j - 2] + 1);
      ligne.push(v);
      if (v < minLigne) minLigne = v;
    }
    if (minLigne > max) return max + 1;
    avant2 = avant;
    avant = ligne;
  }
  return avant[b.length];
}

// numéro du jour (1 = 1er janvier 2026), d'après la date du téléphone : le même mot pour tout le monde
export function numeroDuJour(d = new Date()) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 1)) / 86400000) + 1;
}
