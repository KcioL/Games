// ==========================================================================
// Petit bac : règles (sans affichage), utilisables aussi dans Node pour les tests
// Une lettre est tirée ; chacun trouve un mot qui commence par cette lettre dans chaque catégorie.
// Le premier qui a tout rempli dit STOP : les autres ont encore quelques secondes.
// Puis tout le monde vérifie les réponses et peut contester un mot ; la majorité décide.
// Points : réponse valable 10 ; même réponse qu'un autre joueur 5 ; vide, fausse ou refusée 0.
// ==========================================================================

export const LETTRES_FACILES = 'ABCDEFGHIJLMNOPRSTUV'.split('');
export const LETTRES_DIFFICILES = 'KQWXYZ'.split('');

// ---------- Le fichier des catégories ----------
//   == identifiant | Nom affiché | description   → un nouveau thème
//   une ligne                                    → une catégorie
//   # commentaire, ligne vide                    → ignorés
export function lireCategories(texte) {
  const themes = {};
  let courant = null;
  String(texte || '').split(/\r?\n/).forEach((brute) => {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith('#')) return;
    if (ligne.startsWith('==')) {
      const [id, nom, desc] = ligne.slice(2).split('|').map((x) => x.trim());
      const cle = (id || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_-]/g, '');
      if (!cle) { courant = null; return; }
      courant = themes[cle] = themes[cle] || { nom: nom || id, desc: desc || '', categories: [] };
      return;
    }
    if (courant && !courant.categories.includes(ligne)) courant.categories.push(ligne.slice(0, 60));
  });
  Object.keys(themes).forEach((k) => { if (!themes[k].categories.length) delete themes[k]; });
  return themes;
}

// ---------- Outils ----------
const melanger = (t) => { const a = [...t]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// mot ramené à sa plus simple forme : sans accents, sans majuscules, sans espaces ni ponctuation
export function simplifier(mot) {
  return String(mot || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]/g, '');
}
// le mot commence-t-il par la lettre ? (un article au début est toléré : « Le Havre » pour H)
export function commencePar(mot, lettre) {
  const brut = String(mot || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const l = lettre.toLowerCase();
  const premier = (x) => (x.match(/[a-z0-9]/) || [''])[0];
  if (premier(brut) === l) return true;
  const sans = brut.replace(/^(le|la|les|l'|l’|un|une|des|du|de|the)\s*/, '');
  return sans !== brut && premier(sans) === l;
}

export function normaliser(s) {
  s.players = s.players || [];
  const n = (s.categories || []).length;
  s.categories = s.categories || [];
  s.pool = s.pool || [];
  s.lettres = s.lettres || [];
  s.options = s.options || {};
  s.votes = s.votes || {};
  s.players.forEach((p) => {
    const r = p.reponses || [];
    p.reponses = Array.from({ length: n }, (_, k) => (typeof r[k] === 'string' ? r[k] : ''));
    p.score = p.score || 0;
    p.historique = p.historique || [];
    p.pret = !!p.pret;
  });
  if (s.resultats) {
    s.resultats.points = s.resultats.points || [];
    s.resultats.points = s.players.map((_, i) => {
      const l = s.resultats.points[i] || [];
      return Array.from({ length: n }, (_, k) => l[k] || 0);
    });
    s.resultats.statut = s.resultats.statut || [];
  }
  return s;
}

const nbCategories = (s) => {
  const x = s.options.nbCategories;
  return x === 0 ? s.pool.length : Math.min(s.pool.length, x || 8);
};

// pool : la liste des catégories du thème choisi
export function nouvellePartie(s, pool) {
  normaliser(s);
  if (Array.isArray(pool) && pool.length) s.pool = [...pool];
  s.partie = (s.partie || 0) + 1;
  s.manche = 0;
  s.lettres = [];
  s.players.forEach((p) => { p.score = 0; p.historique = []; });
  s.categories = melanger(s.pool).slice(0, nbCategories(s));
  nouvelleManche(s);
  return true;
}

export function nouvelleManche(s) {
  const possibles = [...LETTRES_FACILES, ...(s.options.difficiles ? LETTRES_DIFFICILES : [])].filter((l) => !s.lettres.includes(l));
  const liste = possibles.length ? possibles : LETTRES_FACILES;
  s.lettre = liste[Math.floor(Math.random() * liste.length)];
  s.lettres.push(s.lettre);
  s.manche = (s.manche || 0) + 1;
  if (s.options.changer && s.manche > 1) s.categories = melanger(s.pool).slice(0, nbCategories(s));
  s.players.forEach((p) => { p.reponses = s.categories.map(() => ''); p.pret = false; });
  s.stop = null;
  s.votes = {};
  s.resultats = null;
  s.status = 'jeu';
  s.coup = (s.coup || 0) + 1;
}

// le joueur enregistre ses réponses (tant que la manche n'est pas fermée)
export function ecrire(s, i, reponses) {
  const p = s.players[i];
  if (s.status !== 'jeu' || !p || !Array.isArray(reponses)) return false;
  p.reponses = s.categories.map((_, k) => String(reponses[k] || '').slice(0, 40));
  return true;
}
export const toutRempli = (s, i) => s.players[i].reponses.every((r) => String(r).trim());

// STOP ! (par = -1 : le temps maximum est écoulé)
export function stop(s, par) {
  if (s.status !== 'jeu' || s.stop) return false;
  if (par >= 0 && !toutRempli(s, par)) return false;
  s.coup = (s.coup || 0) + 1;
  s.stop = { par, n: s.coup };
  return true;
}

// fin du compte à rebours : place à la vérification
export function fermer(s) {
  if (s.status !== 'jeu' || !s.stop) return false;
  s.status = 'vote';
  s.votes = {};
  s.players.forEach((p) => { p.pret = false; });
  s.coup = (s.coup || 0) + 1;
  return true;
}

const cleVote = (k, auteur) => `${k}_${auteur}`;
export const contestations = (s, k, auteur) => Object.keys(s.votes[cleVote(k, auteur)] || {}).length;
export const aConteste = (s, k, auteur, votant) => !!(s.votes[cleVote(k, auteur)] || {})[votant];

// contester (ou ne plus contester) la réponse d'un autre joueur
export function contester(s, votant, k, auteur) {
  if (s.status !== 'vote' || votant === auteur || !s.players[votant] || !s.players[auteur]) return false;
  if (k < 0 || k >= s.categories.length) return false;
  const c = cleVote(k, auteur);
  const v = { ...(s.votes[c] || {}) };
  if (v[votant]) delete v[votant]; else v[votant] = true;
  if (Object.keys(v).length) s.votes[c] = v; else delete s.votes[c];
  s.coup = (s.coup || 0) + 1;
  return true;
}

// statut d'une réponse : 'vide', 'lettre' (ne commence pas par la lettre), 'refusee' (contestée par la majorité), 'ok'
export function statut(s, k, i) {
  const r = String(s.players[i].reponses[k] || '').trim();
  if (!r || !simplifier(r)) return 'vide';
  if (!commencePar(r, s.lettre)) return 'lettre';
  const votants = s.players.length - 1;
  if (votants > 0 && contestations(s, k, i) * 2 > votants) return 'refusee';
  return 'ok';
}

// points d'une manche (sans les enregistrer)
export function calculer(s) {
  const n = s.players.length;
  const points = Array.from({ length: n }, () => s.categories.map(() => 0));
  const etats = Array.from({ length: n }, () => s.categories.map(() => 'vide'));
  s.categories.forEach((_, k) => {
    const ok = [];
    for (let i = 0; i < n; i++) {
      etats[i][k] = statut(s, k, i);
      if (etats[i][k] === 'ok') ok.push(i);
    }
    ok.forEach((i) => {
      const m = simplifier(s.players[i].reponses[k]);
      const double = ok.some((j) => j !== i && simplifier(s.players[j].reponses[k]) === m);
      points[i][k] = double ? 5 : 10;
      if (double) etats[i][k] = 'double';
    });
  });
  return { points, statut: etats };
}

export function pret(s, i) {
  if (s.status !== 'vote' || !s.players[i]) return false;
  s.players[i].pret = !s.players[i].pret;
  s.coup = (s.coup || 0) + 1;
  if (s.players.every((p) => p.pret)) compter(s);
  return true;
}

// on compte les points (tout le monde est prêt, ou l'hôte décide)
export function compter(s) {
  if (s.status !== 'vote') return false;
  const r = calculer(s);
  s.resultats = { points: r.points, statut: r.statut };
  s.players.forEach((p, i) => {
    const total = r.points[i].reduce((a, b) => a + b, 0);
    p.score += total;
    p.historique.push(total);
  });
  const fin = s.options.manches && s.manche >= s.options.manches;
  s.status = fin ? 'fin' : 'bilan';
  s.coup = (s.coup || 0) + 1;
  return true;
}

export function mancheSuivante(s) {
  if (s.status !== 'bilan') return false;
  nouvelleManche(s);
  return true;
}

// partie sans nombre de manches fixé : l'hôte l'arrête au bilan
export function terminer(s) {
  if (s.status !== 'bilan') return false;
  s.status = 'fin';
  s.coup = (s.coup || 0) + 1;
  return true;
}

export function classement(s) {
  return s.players.map((p, i) => ({ i, nom: p.name, score: p.score })).sort((a, b) => b.score - a.score);
}
