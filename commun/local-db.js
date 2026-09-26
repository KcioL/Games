// Base de données locale, pour jouer sur un seul téléphone sans internet.
// Même interface que Firebase (ref, onValue, set, update, get, runTransaction),
// ce qui permet aux jeux de fonctionner sans rien changer à leur logique.
// Les données sont gardées dans le téléphone : une partie survit à un rechargement.

const CLE = 'jeux-vol:local-db';
let donnees = {};
try { donnees = JSON.parse(localStorage.getItem(CLE)) || {}; } catch (e) { donnees = {}; }

const ecouteurs = [];

function sauver() {
  try { localStorage.setItem(CLE, JSON.stringify(donnees)); } catch (e) { /* stockage plein ou indisponible */ }
}

// Comme Firebase : les valeurs null et les tableaux ou objets vides disparaissent
function nettoyer(v) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) {
    const a = v.map(nettoyer);
    return a.every((x) => x === null) ? null : a;
  }
  if (typeof v === 'object') {
    const o = {};
    Object.keys(v).forEach((k) => { const c = nettoyer(v[k]); if (c !== null) o[k] = c; });
    return Object.keys(o).length ? o : null;
  }
  return v;
}

function lire(chemin) {
  let d = donnees;
  for (const k of chemin.split('/')) {
    if (d === null || d === undefined) return null;
    d = d[k];
  }
  return d === undefined ? null : JSON.parse(JSON.stringify(d));
}

function ecrire(chemin, valeur) {
  const cles = chemin.split('/');
  let o = donnees;
  for (let i = 0; i < cles.length - 1; i++) {
    if (typeof o[cles[i]] !== 'object' || o[cles[i]] === null) o[cles[i]] = {};
    o = o[cles[i]];
  }
  const propre = nettoyer(JSON.parse(JSON.stringify(valeur === undefined ? null : valeur)));
  const derniere = cles[cles.length - 1];
  if (propre === null) delete o[derniere];
  else o[derniere] = propre;
  sauver();
  ecouteurs.forEach((e) => {
    if (chemin.startsWith(e.chemin) || e.chemin.startsWith(chemin)) prevenir(e);
  });
}

function instantane(chemin) {
  const v = lire(chemin);
  return { val: () => v, exists: () => v !== null };
}

function prevenir(e) {
  setTimeout(() => { if (ecouteurs.includes(e)) e.cb(instantane(e.chemin)); }, 0);
}

export const db = { local: true };

export function ref(_db, chemin) { return { chemin }; }

export function onValue(r, cb, erreurOuOptions, options) {
  const opts = (erreurOuOptions && typeof erreurOuOptions === 'object') ? erreurOuOptions : options;
  if (opts && opts.onlyOnce) {
    setTimeout(() => cb(instantane(r.chemin)), 0);
    return () => {};
  }
  const e = { chemin: r.chemin, cb };
  ecouteurs.push(e);
  prevenir(e);
  return () => { const i = ecouteurs.indexOf(e); if (i >= 0) ecouteurs.splice(i, 1); };
}

export async function set(r, valeur) { ecrire(r.chemin, valeur); }

export async function update(r, valeurs) {
  const actuel = lire(r.chemin) || {};
  Object.assign(actuel, valeurs);
  ecrire(r.chemin, actuel);
}

export async function get(r) { return instantane(r.chemin); }

export async function runTransaction(r, fn) {
  const resultat = fn(lire(r.chemin));
  if (resultat === undefined) return { committed: false, snapshot: instantane(r.chemin) };
  ecrire(r.chemin, resultat);
  return { committed: true, snapshot: instantane(r.chemin) };
}

// Lecture immédiate (sans attendre), pour savoir s'il y a une partie à reprendre
export function lireMaintenant(chemin) { return lire(chemin); }

export const localDb = { db, ref, onValue, set, update, get, runTransaction, lireMaintenant };
