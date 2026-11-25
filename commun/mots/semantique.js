// ==========================================================================
// Sens des mots (pour Cémantix et Pédantix)
// Modèle de langue : frWac2Vec de Jean-Philippe Fauconnier (word2vec entraîné sur 1,6 milliard de mots
// du web français), le même genre de modèle que le vrai Cémantix. Les mots sont regroupés par LEMME :
// « retient », « retenu »… comptent comme « retenir », « chats » comme « chat ».
// vocabulaire.txt : 40 000 lemmes, du plus courant au plus rare (un par ligne)
// vecteurs.bin    : pour chaque lemme, 64 nombres (−127…127) qui résument son sens : les 64 « directions »
//                   principales du vrai modèle (200 nombres par mot). Le produit des deux listes de nombres
//                   de deux mots redonne, à 2 °C près, leur vraie proximité de sens (similarité cosinus).
// formes.txt      : les autres formes des mots (« forme numéro_du_lemme »), chargées seulement si besoin
// Cémantix utilise en plus les vraies valeurs (au demi-degré) des 30 000 lemmes courants face à chaque mot à trouver.
// ==========================================================================

const D = 64;
const ECHELLE = 3.5914149637850615e-05; // (valeur maximale / 127)² : ramène le produit des nombres à une similarité
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
    const vec = normaliserVecteurs(new Int8Array(buf), mots.length);
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
      // Les autres formes des mots (pluriels, féminins, conjugaisons…), chargées seulement quand on en a besoin
      // pour ne pas alourdir le premier chargement : chacune renvoie au numéro de son lemme
      formes: [],
      chargerPlus() {
        if (!plus) {
          plus = lireTexte(`${base}formes.txt`).then((t) => {
            t.split('\n').forEach((ligne) => {
              const k = ligne.lastIndexOf(' ');
              if (k < 1) return;
              const f = ligne.slice(0, k); const i = parseInt(ligne.slice(k + 1), 10);
              if (!(i >= 0 && i < mots.length)) return;
              sem.formes.push([f, i]);
              if (!index.has(f)) index.set(f, i);
              const s = sansAccents(f);
              if (!indexSansAccents.has(s)) indexSansAccents.set(s, i);
            });
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
        const essayer = (mot) => {
          const m = sansAccents(mot);
          if (Math.abs(m.length - cible.length) > max) return;
          const d = distance(cible, m, dMin - 1);
          if (d < dMin) { dMin = d; meilleur = mot; } // les mots sont rangés du plus courant au plus rare
        };
        for (let i = 0; i < mots.length && dMin > 1; i++) essayer(mots[i]);
        for (let k = 0; k < sem.formes.length && dMin > 1; k++) essayer(sem.formes[k][0]);
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
