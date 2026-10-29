// ==========================================================================
// Yam's : règles (sans affichage) et bots, utilisables aussi dans Node pour les tests
// 5 dés, 3 lancers par tour (on garde les dés qu'on veut entre deux lancers), puis on inscrit
// son résultat dans une case libre de sa feuille (au besoin un 0). 13 tours, le plus gros total gagne.
// ==========================================================================

export const CASES = [
  { id: 'as', nom: 'As', court: '1', haut: 1, aide: 'Total des 1' },
  { id: 'deux', nom: 'Deux', court: '2', haut: 2, aide: 'Total des 2' },
  { id: 'trois', nom: 'Trois', court: '3', haut: 3, aide: 'Total des 3' },
  { id: 'quatre', nom: 'Quatre', court: '4', haut: 4, aide: 'Total des 4' },
  { id: 'cinq', nom: 'Cinq', court: '5', haut: 5, aide: 'Total des 5' },
  { id: 'six', nom: 'Six', court: '6', haut: 6, aide: 'Total des 6' },
  { id: 'brelan', nom: 'Brelan', aide: '3 dés identiques : total des 5 dés' },
  { id: 'carre', nom: 'Carré', aide: '4 dés identiques : total des 5 dés' },
  { id: 'full', nom: 'Full', aide: 'Un brelan et une paire : 25 points' },
  { id: 'petite', nom: 'Petite suite', aide: '4 dés qui se suivent : 30 points' },
  { id: 'grande', nom: 'Grande suite', aide: '5 dés qui se suivent : 40 points' },
  { id: 'yams', nom: "Yam's", aide: '5 dés identiques : 50 points' },
  { id: 'chance', nom: 'Chance', aide: 'Total des 5 dés, sans condition' },
];
export const IDS = CASES.map((c) => c.id);
export const HAUT = IDS.slice(0, 6);
export const SEUIL_BONUS = 63;
export const BONUS = 35;
export const BONUS_YAMS = 100; // option : chaque Yam's de plus, une fois la case Yam's à 50

const de = () => 1 + Math.floor(Math.random() * 6);
const somme = (d) => d.reduce((a, b) => a + b, 0);
const comptes = (d) => { const c = [0, 0, 0, 0, 0, 0, 0]; d.forEach((v) => { c[v]++; }); return c; };
const suite = (d, n) => {
  const u = new Set(d);
  for (let a = 1; a + n - 1 <= 6; a++) {
    let ok = true;
    for (let k = a; k < a + n; k++) if (!u.has(k)) { ok = false; break; }
    if (ok) return true;
  }
  return false;
};

// Points que vaudraient ces dés dans cette case
export function points(id, d) {
  const c = comptes(d);
  const max = Math.max(...c);
  const i = IDS.indexOf(id);
  if (i >= 0 && i < 6) return c[i + 1] * (i + 1);
  switch (id) {
    case 'brelan': return max >= 3 ? somme(d) : 0;
    case 'carre': return max >= 4 ? somme(d) : 0;
    case 'full': return c.includes(3) && c.includes(2) ? 25 : 0;
    case 'petite': return suite(d, 4) ? 30 : 0;
    case 'grande': return suite(d, 5) ? 40 : 0;
    case 'yams': return max === 5 ? 50 : 0;
    case 'chance': return somme(d);
    default: return 0;
  }
}

export function normaliser(s) {
  s.players = s.players || [];
  s.players.forEach((p) => {
    p.feuille = p.feuille || {};
    p.victoires = p.victoires || 0;
    p.bonusYams = p.bonusYams || 0;
  });
  s.des = Array.isArray(s.des) && s.des.length === 5 ? s.des : [1, 2, 3, 4, 5];
  s.gardes = Array.isArray(s.gardes) && s.gardes.length === 5 ? s.gardes.map(Boolean) : [false, false, false, false, false];
  s.options = s.options || {};
  return s;
}

export const sousTotalHaut = (p) => HAUT.reduce((a, id) => a + (p.feuille[id] || 0), 0);
export const bonusHaut = (p) => (sousTotalHaut(p) >= SEUIL_BONUS ? BONUS : 0);
export const total = (p) => IDS.reduce((a, id) => a + (p.feuille[id] || 0), 0) + bonusHaut(p) + (p.bonusYams || 0) * BONUS_YAMS;
export const libres = (p) => IDS.filter((id) => p.feuille[id] === undefined || p.feuille[id] === null);

export function nouvellePartie(s) {
  normaliser(s);
  s.partie = (s.partie || 0) + 1;
  s.coup = (s.coup || 0) + 1;
  s.status = 'jeu';
  s.players.forEach((p) => { p.feuille = {}; p.bonusYams = 0; });
  // le premier joueur change à chaque partie
  s.premier = s.partie === 1 ? Math.floor(Math.random() * s.players.length) : ((s.premier || 0) + 1) % s.players.length;
  s.active = s.premier;
  s.tour = 1;
  s.classement = null;
  s.gagnants = [];
  s.dernier = null;
  debutTour(s);
  return true;
}
function debutTour(s) {
  s.lancers = 0;
  s.gardes = [false, false, false, false, false];
}

export function lancer(s, i, valeurs) {
  if (s.status !== 'jeu' || s.active !== i || s.lancers >= 3) return false;
  s.des = s.des.map((v, k) => (s.lancers > 0 && s.gardes[k] ? v : (valeurs ? valeurs[k] : de())));
  s.lancers += 1;
  if (s.lancers >= 3) s.gardes = [false, false, false, false, false];
  s.coup = (s.coup || 0) + 1;
  return true;
}

export function garder(s, i, k) {
  if (s.status !== 'jeu' || s.active !== i || s.lancers < 1 || s.lancers >= 3 || k < 0 || k > 4) return false;
  s.gardes[k] = !s.gardes[k];
  s.coup = (s.coup || 0) + 1;
  return true;
}

// Option « bonus Yam's » : un Yam's de plus rapporte 100 si la case Yam's vaut déjà 50
export const yamsEnPlus = (s, p, d) => !!s.options.bonusYams && points('yams', d) === 50 && p.feuille.yams === 50;

export function inscrire(s, i, id) {
  const p = s.players[i];
  if (s.status !== 'jeu' || s.active !== i || s.lancers < 1 || !IDS.includes(id) || !libres(p).includes(id)) return false;
  const pts = points(id, s.des);
  const extra = yamsEnPlus(s, p, s.des);
  if (extra) p.bonusYams = (p.bonusYams || 0) + 1;
  p.feuille[id] = pts;
  s.dernier = { j: i, id, pts, des: [...s.des], extra, n: s.coup + 1 };
  s.coup = (s.coup || 0) + 1;
  // joueur suivant (et fin de partie quand toutes les feuilles sont pleines)
  if (s.players.every((q) => !libres(q).length)) { terminer(s); return true; }
  const n = s.players.length;
  s.active = (i + 1) % n;
  if (s.active === s.premier) s.tour += 1;
  debutTour(s);
  return true;
}

function terminer(s) {
  const cl = s.players.map((p, k) => ({ k, t: total(p) })).sort((a, b) => b.t - a.t);
  s.classement = cl.map((x) => x.k);
  s.gagnants = cl.filter((x) => x.t === cl[0].t).map((x) => x.k);
  if (s.players.length > 1) s.gagnants.forEach((k) => { s.players[k].victoires = (s.players[k].victoires || 0) + 1; });
  s.status = 'fin';
  s.active = -1;
}

// ---------- Les bots ----------
// moyenne espérée de chaque case pour un joueur moyen : sert à savoir si un résultat est « bon »
const MOYENNE = { as: 2, deux: 5, trois: 8.5, quatre: 12, cinq: 15, six: 18.5, brelan: 15, carre: 6, full: 14, petite: 19, grande: 13, yams: 7, chance: 22 };

export const REGLAGE_BOT = { poids: 1, atteint: 30, chance: 3, zero: 0.25 };
// intérêt d'inscrire ces dés dans cette case (points moins ce qu'on y aurait eu en moyenne)
// bot facile : ne vise pas le bonus du haut et ne prévoit qu'une relance à l'avance
const REGLAGE_FACILE = { poids: 0, atteint: 0, chance: 0, zero: 0 };
function interet(p, id, d, tour, facile) {
  const pts = points(id, d);
  const B = facile ? REGLAGE_FACILE : REGLAGE_BOT;
  let v = pts - MOYENNE[id];
  const h = HAUT.indexOf(id);
  if (h >= 0) {
    // en haut : viser 3 dés par case pour décrocher le bonus de 35
    const st = sousTotalHaut(p);
    if (st < SEUIL_BONUS) {
      const reste = HAUT.filter((x, k) => k !== h && libres(p).includes(x)).reduce((a, x) => a + 5 * (HAUT.indexOf(x) + 1), 0);
      if (st + pts + reste >= SEUIL_BONUS) v += (pts - 3 * (h + 1)) * B.poids + (st + pts >= SEUIL_BONUS ? B.atteint : 0);
    }
  }
  if (id === 'chance' && tour < 10) v -= B.chance; // on garde la Chance pour plus tard
  if (pts === 0) v += MOYENNE[id] * B.zero; // barrer une case rare coûte moins cher
  return v;
}
const estFacile = (s) => s.options && s.options.niveau === 'facile';
export function choixBot(s, i, d = s.des) {
  const p = s.players[i];
  const facile = estFacile(s);
  let meilleure = null; let vMax = -Infinity;
  libres(p).forEach((id) => {
    const v = interet(p, id, d, s.tour, facile) + (yamsEnPlus(s, p, d) ? 100 : 0);
    if (v > vMax) { vMax = v; meilleure = id; }
  });
  return meilleure;
}
// valeur d'une main finale pour ce joueur : la meilleure case possible
function valeurFinale(p, d, tour, facile) {
  let m = -Infinity;
  libres(p).forEach((id) => { m = Math.max(m, interet(p, id, d, tour, facile)); });
  return m;
}
// quels dés garder ? on calcule la moyenne exacte de chaque façon de garder, en voyant jusqu'aux deux relances.
// Une main est codée par ses nombres de 1, de 2… de 6 (code additif : code(a ∪ b) = code(a) + code(b))
const PUIS = [0, 1, 6, 36, 216, 1296, 7776];
const code = (d) => d.reduce((a, v) => a + PUIS[v], 0);
const cacheTirages = {};
function tirages(n) { // résultats possibles de n dés (sans ordre) avec leur probabilité
  if (cacheTirages[n]) return cacheTirages[n];
  const groupes = new Map();
  const rec = (pref) => {
    if (pref.length === n) { const k = code(pref); const g = groupes.get(k) || { d: pref, n: 0 }; g.n++; groupes.set(k, g); return; }
    for (let v = 1; v <= 6; v++) rec([...pref, v]);
  };
  rec([]);
  const total = 6 ** n;
  const liste = [...groupes.entries()].map(([k, g]) => ({ k, d: g.d, p: g.n / total }));
  cacheTirages[n] = { k: Int32Array.from(liste.map((x) => x.k)), p: Float64Array.from(liste.map((x) => x.p)), d: liste.map((x) => x.d) };
  return cacheTirages[n];
}
const MAINS = tirages(5).d; // les 252 mains différentes
const cacheGardes = new Map();
function gardesPossibles(d) { // façons différentes de garder (sans doublon)
  const kd = d.join('');
  if (cacheGardes.has(kd)) return cacheGardes.get(kd);
  const vues = new Set(); const res = [];
  for (let masque = 0; masque < 32; masque++) {
    const fixes = d.filter((_, k) => masque & (1 << k));
    const k = code(fixes);
    if (!vues.has(k)) { vues.add(k); res.push({ masque, k, n: fixes.length }); }
  }
  cacheGardes.set(kd, res);
  return res;
}
function meilleureGarde(d, table) {
  let meilleur = null; let vMax = -Infinity;
  gardesPossibles(d).forEach((g) => {
    const t = tirages(5 - g.n);
    let e = 0;
    for (let j = 0; j < t.k.length; j++) e += t.p[j] * table[g.k + t.k[j]];
    if (e > vMax + 1e-9) { vMax = e; meilleur = g; }
  });
  return { masque: meilleur.masque, v: vMax };
}
export function gardeBot(s, i) {
  const p = s.players[i];
  const v0 = new Float64Array(46656);
  const facile = estFacile(s);
  MAINS.forEach((m) => { v0[code(m)] = valeurFinale(p, m, s.tour, facile); });
  let table = v0;
  if (s.lancers === 1 && !facile) { // encore deux relances : une main vaut ce qu'on en tirera avec la dernière relance
    const v1 = new Float64Array(46656);
    MAINS.forEach((m) => { v1[code(m)] = meilleureGarde(m, v0).v; });
    table = v1;
  }
  const g = meilleureGarde(s.des, table);
  const garde = [0, 1, 2, 3, 4].map((k) => !!(g.masque & (1 << k)));
  return { garde, arreter: g.masque === 31 || v0[code(s.des)] >= g.v - 0.3 };
}
// bot facile : garde la valeur la plus fréquente, s'arrête dès qu'il a une belle figure
function gardeFacile(s, i) {
  const p = s.players[i];
  const d = s.des;
  const belle = ['yams', 'grande', 'full', 'petite'].some((id) => libres(p).includes(id) && points(id, d) > 0);
  const c = comptes(d);
  let v = 6;
  for (let x = 6; x >= 1; x--) if (c[x] > c[v]) v = x;
  return { garde: d.map((x) => x === v && c[v] > 1), arreter: belle };
}
// le coup suivant d'un bot : lancer, garder des dés, ou inscrire
export function coupBot(s, i) {
  if (s.lancers === 0) return { type: 'lancer' };
  if (s.lancers < 3) {
    const g = estFacile(s) ? gardeFacile(s, i) : gardeBot(s, i);
    if (g.arreter) return { type: 'inscrire', id: choixBot(s, i) };
    const diff = g.garde.findIndex((x, k) => x !== s.gardes[k]);
    if (diff >= 0) return { type: 'garder', k: diff };
    return { type: 'lancer' };
  }
  return { type: 'inscrire', id: choixBot(s, i) };
}
