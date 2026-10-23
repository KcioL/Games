// ==========================================================================
// Cluedo : le moteur du jeu (sans affichage), utilisable aussi dans Node pour les tests
// ==========================================================================
import { SUSPECTS, ARMES, PIECES, PORTES, COULOIRS, DEPARTS } from './donnees.js';

export { SUSPECTS, ARMES, PIECES };

// ---------- Les cartes ----------
export const CARTES = {};
SUSPECTS.forEach((x) => { CARTES[x.id] = { ...x, cat: 'suspect' }; });
ARMES.forEach((x) => { CARTES[x.id] = { ...x, cat: 'arme' }; });
PIECES.forEach((x) => { CARTES[x.id] = { ...x, cat: 'piece' }; });
export const CATS = { suspect: SUSPECTS.map((x) => x.id), arme: ARMES.map((x) => x.id), piece: PIECES.map((x) => x.id) };
export const TOUTES = [...CATS.suspect, ...CATS.arme, ...CATS.piece];
export const nomCarte = (id) => (CARTES[id] ? CARTES[id].nom : id);
export const piece = (id) => PIECES.find((p) => p.id === id);

// ---------- Les couloirs ----------
const cle = (c, r) => `${c},${r}`;
export const CASES = new Set();
Object.entries(COULOIRS).forEach(([r, cs]) => cs.forEach((c) => CASES.add(cle(c, +r))));
export const estCase = (c, r) => CASES.has(cle(c, r));
const VOISINS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function aleatoire(n) { return Math.floor(Math.random() * n); }
function melanger(t) {
  const a = [...t];
  for (let i = a.length - 1; i > 0; i--) { const j = aleatoire(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- Mise en place ----------
// Firebase supprime les tableaux et objets vides : on les recrée à chaque lecture.
export function normaliser(s) {
  s.players = s.players || [];
  s.players.forEach((p) => {
    p.main = p.main || [];
    p.vues = p.vues || [];
    p.notes = p.notes || {};
  });
  s.journal = s.journal || [];
  s.historique = s.historique || [];
  s.historique.forEach((h) => { h.passes = h.passes || []; });
  s.pions = s.pions || {};
  s.armes = s.armes || {};
  s.options = s.options || {};
  if (s.suggestion) s.suggestion.passes = s.suggestion.passes || [];
  if (s.des) s.des = [...s.des];
  return s;
}

export function nouvellePartie(s) {
  normaliser(s);
  const n = s.players.length;
  s.partie = (s.partie || 0) + 1;
  s.coup = 0;
  s.status = 'jeu';
  // chacun reçoit un personnage au hasard
  const persos = melanger(CATS.suspect).slice(0, n);
  s.players.forEach((p, i) => {
    p.suspect = persos[i];
    p.main = [];
    p.vues = [];
    p.notes = {};
    p.elimine = false;
    p.deplacePar = false;
  });
  // l'enveloppe
  s.solution = {
    suspect: CATS.suspect[aleatoire(CATS.suspect.length)],
    arme: CATS.arme[aleatoire(CATS.arme.length)],
    piece: CATS.piece[aleatoire(CATS.piece.length)],
  };
  const reste = melanger(TOUTES.filter((c) => c !== s.solution.suspect && c !== s.solution.arme && c !== s.solution.piece));
  // le premier à jouer : le premier personnage de la liste parmi ceux qui sont en jeu (comme Mlle Rose)
  const premier = CATS.suspect.map((id) => s.players.findIndex((p) => p.suspect === id)).find((i) => i >= 0);
  reste.forEach((c, k) => { s.players[(premier + k) % n].main.push(c); });
  // les pions sur leur case de départ, les armes au hasard dans les pièces
  s.pions = {};
  CATS.suspect.forEach((id, k) => { s.pions[id] = { c: DEPARTS[k].c, r: DEPARTS[k].r }; });
  s.armes = {};
  const pieces = melanger(CATS.piece);
  CATS.arme.forEach((id, k) => { s.armes[id] = pieces[k % pieces.length]; });
  s.journal = [];
  s.historique = [];
  s.suggestion = null;
  s.gagnant = null;
  s.parDefaut = false;
  s.accusation = null;
  s.anim = null;
  s.active = premier;
  debutTour(s);
  noter(s, `La partie commence ! ${s.players[premier].name} joue en premier.`);
  return true;
}

function noter(s, t) {
  s.journal.push({ t, n: s.coup });
  if (s.journal.length > 120) s.journal.splice(0, s.journal.length - 120);
}

function debutTour(s) {
  s.phase = 'debut';
  s.des = null;
  s.suggestion = null;
  s.depuis = null; // pièce quittée pendant ce tour (on ne peut pas y revenir tout de suite)
  const p = s.players[s.active];
  // déplacé par une suggestion depuis son dernier tour : il peut suggérer sur place
  s.suggererIci = !!(p.deplacePar && pieceDe(s, p.suspect));
  p.deplacePar = false;
}

// ---------- Positions ----------
export const pieceDe = (s, suspect) => (s.pions[suspect] && s.pions[suspect].piece) || null;
export function occupees(s, sauf) {
  const o = new Set();
  // les personnages que personne ne joue restent hors du plateau tant qu'une suggestion ne les amène pas dans une pièce :
  // ils ne bloquent donc pas les couloirs
  const joues = new Set((s.players || []).map((p) => p.suspect));
  Object.entries(s.pions).forEach(([id, p]) => { if (id !== sauf && joues.has(id) && p && p.piece == null) o.add(cle(p.c, p.r)); });
  return o;
}
export const portesDe = (idPiece) => PORTES.filter((d) => d.piece === idPiece);

// Toutes les destinations atteignables avec `pas` déplacements (au plus) depuis la position du personnage.
// Renvoie { cases: Map(cle → chemin), pieces: Map(idPiece → chemin) } ; un chemin est une liste de positions.
export function destinations(s, suspect, pas) {
  const pos = s.pions[suspect];
  const occ = occupees(s, suspect);
  const cases = new Map();
  const pieces = new Map();
  const vus = new Map(); // cle → { d, chemin }
  const file = [];
  const depart = pos.piece ? { piece: pos.piece } : { c: pos.c, r: pos.r };
  if (pos.piece) {
    // sortir par une des portes (la case devant la porte doit être libre)
    portesDe(pos.piece).forEach((d) => {
      const k = cle(d.c, d.r);
      if (occ.has(k) || vus.has(k)) return;
      const e = { d: 1, chemin: [depart, { c: d.c, r: d.r }] };
      vus.set(k, e); file.push([d.c, d.r]);
    });
  } else {
    vus.set(cle(pos.c, pos.r), { d: 0, chemin: [depart] });
    file.push([pos.c, pos.r]);
  }
  while (file.length) {
    const [c, r] = file.shift();
    const e = vus.get(cle(c, r));
    if (e.d >= 1) cases.set(cle(c, r), e.chemin);
    if (e.d >= pas) continue;
    // entrer dans une pièce par la porte (ça compte un pas, pas besoin du compte exact)
    PORTES.filter((d) => d.c === c && d.r === r).forEach((d) => {
      if (d.piece === pos.piece || d.piece === s.depuis) return;
      if (!pieces.has(d.piece) || pieces.get(d.piece).length > e.chemin.length + 1) {
        pieces.set(d.piece, [...e.chemin, { piece: d.piece }]);
      }
    });
    VOISINS.forEach(([dc, dr]) => {
      const nc = c + dc; const nr = r + dr; const k = cle(nc, nr);
      if (!CASES.has(k) || occ.has(k) || vus.has(k)) return;
      vus.set(k, { d: e.d + 1, chemin: [...e.chemin, { c: nc, r: nr }] });
      file.push([nc, nr]);
    });
  }
  return { cases, pieces };
}

// distance (en pas) entre une position et une pièce, en ignorant les autres pions (pour les bots)
export function distanceVers(s, suspect, idPiece) {
  const pos = s.pions[suspect];
  if (pos.piece === idPiece) return 0;
  const cibles = new Set(portesDe(idPiece).map((d) => cle(d.c, d.r)));
  const vus = new Map();
  const file = [];
  if (pos.piece) portesDe(pos.piece).forEach((d) => { const k = cle(d.c, d.r); if (!vus.has(k)) { vus.set(k, 1); file.push([d.c, d.r]); } });
  else { vus.set(cle(pos.c, pos.r), 0); file.push([pos.c, pos.r]); }
  while (file.length) {
    const [c, r] = file.shift();
    const d = vus.get(cle(c, r));
    if (cibles.has(cle(c, r))) return d + 1;
    VOISINS.forEach(([dc, dr]) => {
      const k = cle(c + dc, r + dr);
      if (CASES.has(k) && !vus.has(k)) { vus.set(k, d + 1); file.push([c + dc, r + dr]); }
    });
  }
  return 99;
}
// distance d'une case de couloir à une pièce (pour choisir où s'arrêter)
export function distanceCase(c, r, idPiece) {
  const cibles = new Set(portesDe(idPiece).map((d) => cle(d.c, d.r)));
  const vus = new Map([[cle(c, r), 0]]);
  const file = [[c, r]];
  while (file.length) {
    const [x, y] = file.shift();
    const d = vus.get(cle(x, y));
    if (cibles.has(cle(x, y))) return d + 1;
    VOISINS.forEach(([dc, dr]) => {
      const k = cle(x + dc, y + dr);
      if (CASES.has(k) && !vus.has(k)) { vus.set(k, d + 1); file.push([x + dc, y + dr]); }
    });
  }
  return 99;
}

// ---------- Un tour de jeu ----------
const monTour = (s, i) => s.status === 'jeu' && s.active === i && !s.players[i].elimine;
export const nbDes = (s) => (s.options && s.options.des === 2 ? 2 : 1);

export function lancer(s, i, valeurs) {
  if (!monTour(s, i) || s.phase !== 'debut') return false;
  s.des = valeurs || Array.from({ length: nbDes(s) }, () => 1 + aleatoire(6));
  s.coup++;
  const total = s.des.reduce((a, b) => a + b, 0);
  const dest = destinations(s, s.players[i].suspect, total);
  if (!dest.cases.size && !dest.pieces.size) {
    // bloqué (toutes les portes sont occupées) : le tour se termine
    noter(s, `${s.players[i].name} fait ${total} mais ne peut pas bouger.`);
    s.phase = 'finir';
    return true;
  }
  s.phase = 'deplacer';
  return true;
}

// cible : { c, r } ou { piece }
export function deplacer(s, i, cible) {
  if (!monTour(s, i) || s.phase !== 'deplacer') return false;
  const suspect = s.players[i].suspect;
  const total = s.des.reduce((a, b) => a + b, 0);
  const dest = destinations(s, suspect, total);
  const chemin = cible.piece ? dest.pieces.get(cible.piece) : dest.cases.get(cle(cible.c, cible.r));
  if (!chemin) return false;
  const avant = s.pions[suspect];
  if (avant.piece) s.depuis = avant.piece;
  s.pions[suspect] = cible.piece ? { piece: cible.piece } : { c: cible.c, r: cible.r };
  s.coup++;
  s.anim = { id: s.coup, suspect, chemin };
  if (cible.piece) {
    s.phase = 'suggerer';
    noter(s, `${s.players[i].name} entre dans : ${nomCarte(cible.piece)}.`);
  } else {
    s.phase = 'finir';
  }
  return true;
}

export function passageSecret(s, i) {
  if (!monTour(s, i) || s.phase !== 'debut') return false;
  const suspect = s.players[i].suspect;
  const ici = pieceDe(s, suspect);
  const p = ici && piece(ici);
  if (!p || !p.passage) return false;
  s.depuis = ici;
  s.pions[suspect] = { piece: p.passage };
  s.coup++;
  s.anim = { id: s.coup, suspect, chemin: [{ piece: ici }, { piece: p.passage }], passage: true };
  s.phase = 'suggerer';
  noter(s, `${s.players[i].name} prend le passage secret vers : ${nomCarte(p.passage)}.`);
  return true;
}

export function rester(s, i) {
  // déplacé ici par une suggestion : on peut suggérer sans bouger
  if (!monTour(s, i) || s.phase !== 'debut' || !s.suggererIci) return false;
  s.phase = 'suggerer';
  s.coup++;
  return true;
}

// ordre des joueurs à interroger après le suggérant
function ordreApres(s, i) {
  const n = s.players.length;
  return Array.from({ length: n - 1 }, (_, k) => (i + 1 + k) % n);
}

export function suggerer(s, i, suspect, arme) {
  if (!monTour(s, i) || s.phase !== 'suggerer') return false;
  if (CARTES[suspect]?.cat !== 'suspect' || CARTES[arme]?.cat !== 'arme') return false;
  const ici = pieceDe(s, s.players[i].suspect);
  if (!ici) return false;
  // le suspect et l'arme sont amenés dans la pièce
  const avantPion = s.pions[suspect];
  if (avantPion.piece !== ici) {
    s.pions[suspect] = { piece: ici };
    const j = s.players.findIndex((p) => p.suspect === suspect);
    if (j >= 0 && j !== i) s.players[j].deplacePar = true;
  }
  s.armes[arme] = ici;
  s.coup++;
  s.anim = { id: s.coup, convoque: { suspect, depuis: avantPion, arme } };
  s.suggestion = { par: i, suspect, arme, piece: ici, passes: [], refuteur: -1, carte: null, attente: -1, depuis: Date.now() };
  noter(s, `${s.players[i].name} suggère : ${nomCarte(suspect)}, avec ${nomCarte(arme)}, dans : ${nomCarte(ici)}.`);
  // on interroge les joueurs dans l'ordre
  const trio = [suspect, arme, ici];
  for (const j of ordreApres(s, i)) {
    const possibles = s.players[j].main.filter((c) => trio.includes(c));
    if (!possibles.length) { s.suggestion.passes.push(j); continue; }
    s.suggestion.refuteur = j;
    if (possibles.length === 1) { montrerCarte(s, j, possibles[0]); return true; }
    s.suggestion.attente = j;
    s.phase = 'refuter';
    return true;
  }
  // personne ne peut répondre
  noter(s, 'Personne ne peut réfuter cette suggestion !');
  s.historique.push({ par: i, suspect, arme, piece: ici, passes: [...s.suggestion.passes], refuteur: -1 });
  s.phase = 'apres';
  return true;
}

function montrerCarte(s, j, carte) {
  const sg = s.suggestion;
  sg.carte = carte;
  sg.attente = -1;
  s.players[sg.par].vues.push({ carte, par: j });
  s.historique.push({ par: sg.par, suspect: sg.suspect, arme: sg.arme, piece: sg.piece, passes: [...sg.passes], refuteur: j });
  noter(s, `${s.players[j].name} montre une carte à ${s.players[sg.par].name}.`);
  s.phase = 'apres';
  s.coup++;
}

// le joueur qui doit réfuter choisit la carte à montrer
export function montrer(s, j, carte) {
  const sg = s.suggestion;
  if (s.status !== 'jeu' || s.phase !== 'refuter' || !sg || sg.attente !== j) return false;
  if (![sg.suspect, sg.arme, sg.piece].includes(carte) || !s.players[j].main.includes(carte)) return false;
  montrerCarte(s, j, carte);
  return true;
}
export function cartesPourRefuter(s, j) {
  const sg = s.suggestion;
  if (!sg) return [];
  return s.players[j].main.filter((c) => [sg.suspect, sg.arme, sg.piece].includes(c));
}

export function accuser(s, i, suspect, arme, idPiece) {
  if (!monTour(s, i) || s.phase === 'refuter' || s.phase === 'deplacer') return false;
  const ok = s.solution.suspect === suspect && s.solution.arme === arme && s.solution.piece === idPiece;
  s.coup++;
  s.accusation = { par: i, suspect, arme, piece: idPiece, juste: ok, n: s.coup };
  noter(s, `${s.players[i].name} accuse : ${nomCarte(suspect)}, avec ${nomCarte(arme)}, dans : ${nomCarte(idPiece)}…`);
  if (ok) {
    noter(s, `… et c'est juste ! ${s.players[i].name} a résolu l'affaire.`);
    s.status = 'fin';
    s.gagnant = i;
    return true;
  }
  s.players[i].elimine = true;
  noter(s, `… c'est faux ! ${s.players[i].name} est éliminé de l'enquête (mais montre encore ses cartes).`);
  const restants = s.players.map((p, k) => k).filter((k) => !s.players[k].elimine);
  if (restants.length <= 1) {
    s.status = 'fin';
    s.gagnant = restants.length ? restants[0] : -1;
    s.parDefaut = true;
    if (restants.length) noter(s, `${s.players[restants[0]].name} est le dernier enquêteur en lice : il remporte la partie !`);
    return true;
  }
  tourSuivant(s);
  return true;
}

export function finirTour(s, i) {
  if (!monTour(s, i) || !['finir', 'suggerer', 'apres', 'debut'].includes(s.phase)) return false;
  if (s.phase === 'debut') return false;
  tourSuivant(s);
  return true;
}

function tourSuivant(s) {
  const n = s.players.length;
  let k = s.active;
  for (let t = 0; t < n; t++) {
    k = (k + 1) % n;
    if (!s.players[k].elimine) break;
  }
  s.active = k;
  s.coup++;
  debutTour(s);
}

// Le joueur qui doit réfuter ne répond pas (en ligne) : on montre une carte au hasard à sa place.
export function forcerRefutation(s) {
  const sg = s.suggestion;
  if (s.phase !== 'refuter' || !sg || sg.attente < 0) return false;
  const c = cartesPourRefuter(s, sg.attente);
  if (!c.length) return false;
  montrerCarte(s, sg.attente, c[aleatoire(c.length)]);
  return true;
}

// ---------- Les déductions (pour la fiche et pour les bots) ----------
// Ce que le joueur i sait, d'après sa main, les cartes qu'on lui a montrées et ce qui s'est passé à la table.
export function connaissances(s, i) {
  const n = s.players.length;
  const proprio = {}; // carte → joueur qui l'a
  const pasA = Array.from({ length: n }, () => new Set());
  s.players[i].main.forEach((c) => { proprio[c] = i; });
  TOUTES.forEach((c) => { if (proprio[c] !== i) pasA[i].add(c); });
  s.players[i].vues.forEach((v) => { proprio[v.carte] = v.par; });
  const clauses = [];
  s.historique.forEach((h) => {
    const trio = [h.suspect, h.arme, h.piece];
    h.passes.forEach((j) => trio.forEach((c) => pasA[j].add(c)));
    if (h.refuteur >= 0 && h.par !== i && h.refuteur !== i) clauses.push({ j: h.refuteur, cartes: trio });
  });
  const taille = s.players.map((p) => p.main.length);
  let change = true;
  let tours = 0;
  while (change && tours++ < 30) {
    change = false;
    // une carte détenue par quelqu'un n'est pas chez les autres
    Object.entries(proprio).forEach(([c, j]) => {
      for (let k = 0; k < n; k++) if (k !== j && !pasA[k].has(c)) { pasA[k].add(c); change = true; }
    });
    // une clause dont il ne reste qu'une carte possible
    clauses.forEach((cl) => {
      if (cl.cartes.some((c) => proprio[c] === cl.j)) return;
      const restent = cl.cartes.filter((c) => !pasA[cl.j].has(c) && proprio[c] === undefined);
      if (restent.length === 1) { proprio[restent[0]] = cl.j; change = true; }
    });
    // un joueur dont on connaît toutes les cartes n'en a pas d'autres
    for (let k = 0; k < n; k++) {
      const connues = TOUTES.filter((c) => proprio[c] === k);
      if (connues.length === taille[k]) {
        TOUTES.forEach((c) => { if (proprio[c] !== k && !pasA[k].has(c)) { pasA[k].add(c); change = true; } });
      }
    }
  }
  // dans chaque catégorie : les cartes possibles pour l'enveloppe
  const solution = {};
  const candidats = {};
  Object.entries(CATS).forEach(([cat, ids]) => {
    const libres = ids.filter((c) => proprio[c] === undefined);
    // une carte que personne ne peut avoir est forcément dans l'enveloppe
    const sure = libres.find((c) => s.players.every((p, k) => pasA[k].has(c)));
    candidats[cat] = sure ? [sure] : libres;
    solution[cat] = candidats[cat].length === 1 ? candidats[cat][0] : null;
  });
  return { proprio, pasA, candidats, solution };
}

// ---------- Les bots ----------
const hasard = (t) => t[aleatoire(t.length)];

export function coupBot(s, i) {
  const p = s.players[i];
  const k = connaissances(s, i);
  const resolu = k.solution.suspect && k.solution.arme && k.solution.piece;
  if (s.phase === 'refuter') return null;
  if (resolu && s.phase !== 'deplacer') {
    return { type: 'accuser', suspect: k.solution.suspect, arme: k.solution.arme, piece: k.solution.piece };
  }
  const ici = pieceDe(s, p.suspect);
  // pièces intéressantes : celles qui peuvent encore être dans l'enveloppe
  let cibles = k.candidats.piece.length > 1 ? k.candidats.piece : CATS.piece;
  if (s.phase === 'debut') {
    if (s.suggererIci && ici && cibles.includes(ici)) return { type: 'rester' };
    const pc = ici && piece(ici);
    if (pc && pc.passage && cibles.includes(pc.passage) && Math.random() < 0.8) return { type: 'passage' };
    return { type: 'lancer' };
  }
  if (s.phase === 'deplacer') {
    const total = s.des.reduce((a, b) => a + b, 0);
    const dest = destinations(s, p.suspect, total);
    const accessibles = cibles.filter((c) => dest.pieces.has(c) && c !== ici);
    if (accessibles.length) return { type: 'deplacer', cible: { piece: hasard(accessibles) } };
    if (dest.pieces.size && Math.random() < 0.35) return { type: 'deplacer', cible: { piece: hasard([...dest.pieces.keys()]) } };
    // sinon : se rapprocher de la pièce intéressante la plus proche
    cibles = cibles.filter((c) => c !== ici && c !== s.depuis);
    if (!cibles.length) cibles = CATS.piece.filter((c) => c !== ici);
    let meilleure = null; let dMin = 1e9;
    dest.cases.forEach((chemin, kc) => {
      const [c, r] = kc.split(',').map(Number);
      const d = Math.min(...cibles.map((x) => distanceCase(c, r, x))) - chemin.length * 0.01;
      if (d < dMin) { dMin = d; meilleure = { c, r }; }
    });
    if (meilleure) return { type: 'deplacer', cible: meilleure };
    if (dest.pieces.size) return { type: 'deplacer', cible: { piece: [...dest.pieces.keys()][0] } };
    return { type: 'finir' };
  }
  if (s.phase === 'suggerer') {
    const sus = k.candidats.suspect.length ? k.candidats.suspect : CATS.suspect;
    const arm = k.candidats.arme.length ? k.candidats.arme : CATS.arme;
    return { type: 'suggerer', suspect: hasard(sus), arme: hasard(arm) };
  }
  return { type: 'finir' };
}

// carte que montre un bot : de préférence une carte que ce joueur a déjà vue
export function refutationBot(s, j) {
  const c = cartesPourRefuter(s, j);
  if (!c.length) return null;
  const par = s.suggestion.par;
  const dejaVue = c.find((x) => s.players[par].vues.some((v) => v.carte === x && v.par === j));
  return dejaVue || hasard(c);
}

export function jouerBot(s, i) {
  const c = coupBot(s, i);
  if (!c) return false;
  switch (c.type) {
    case 'accuser': return accuser(s, i, c.suspect, c.arme, c.piece);
    case 'rester': return rester(s, i);
    case 'passage': return passageSecret(s, i);
    case 'lancer': return lancer(s, i);
    case 'deplacer': return deplacer(s, i, c.cible);
    case 'suggerer': return suggerer(s, i, c.suspect, c.arme);
    default: return finirTour(s, i);
  }
}
