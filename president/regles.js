// Le Président : règles (sans affichage) et bots.
// 52 cartes distribuées à tous ; ordre 3 < 4 < … < Roi < As < 2. On pose une carte, une paire, un brelan ou un carré ;
// les suivants posent autant de cartes, de valeur égale ou plus forte, ou passent. Le premier qui n'a plus de cartes
// devient Président, le dernier Trou du cul. À la manche suivante, le Trou du cul donne ses meilleures cartes au Président.

export const VALEURS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
export const COULEURS = ['♠', '♥', '♦', '♣'];
export const NOMS_VALEURS = { J: 'Valet', Q: 'Dame', K: 'Roi', A: 'As' };
export const ROLES = {
  president: { nom: 'Président', ico: '👑' },
  vice: { nom: 'Vice-président', ico: '🎩' },
  neutre: { nom: 'Neutre', ico: '🙂' },
  vicetrou: { nom: 'Vice-trou du cul', ico: '🧹' },
  trou: { nom: 'Trou du cul', ico: '💩' },
};

const melanger = (t) => { for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } return t; };
export const valeurDe = (id) => id.slice(0, -1);
export const couleurDe = (id) => id.slice(-1);
// force d'une valeur (la révolution inverse l'ordre)
export const force = (v, revolution) => (revolution ? 12 - VALEURS.indexOf(v) : VALEURS.indexOf(v));
export const plusForte = (revolution) => (revolution ? '3' : '2');
export const nomValeur = (v, n = 1) => {
  const nom = NOMS_VALEURS[v] || v;
  return n > 1 && NOMS_VALEURS[v] && v !== 'A' ? `${nom}s` : nom;
};
export const nomCombo = (n) => ['', 'carte', 'paire', 'brelan', 'carré'][n];

export function trierMain(main, revolution = false) {
  return [...main].sort((a, b) => force(valeurDe(a), revolution) - force(valeurDe(b), revolution) || COULEURS.indexOf(couleurDe(a)) - COULEURS.indexOf(couleurDe(b)));
}

export function normaliser(s) {
  s.players = s.players || [];
  s.players.forEach((p) => {
    p.main = p.main || [];
    p.score = p.score || 0;
    p.rangs = p.rangs || [];
    p.recu = p.recu || [];
    p.donne = p.donne || [];
  });
  s.tas = s.tas || [];
  s.tas.forEach((t) => { t.cartes = t.cartes || []; });
  s.classement = s.classement || [];
  s.dons = s.dons || [];
  s.options = s.options || { revolution: true, revolutionTrou: true, ouRien: false, manches: 0 };
  if (s.dernierPli) s.dernierPli.cartes = s.dernierPli.cartes || [];
  return s;
}

// ---------- Déroulement ----------
export function nouvellePartie(s) {
  normaliser(s);
  s.players.forEach((p) => Object.assign(p, { score: 0, rangs: [], role: null }));
  s.manche = 0;
  s.partie = (s.partie || 0) + 1;
  nouvelleManche(s);
}

const avecCartes = (s) => s.players.map((_, i) => i).filter((i) => s.players[i].main.length > 0);
// joueur suivant (après i) qui a encore des cartes
function suivant(s, i) {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const j = (i + k) % n;
    if (s.players[j].main.length) return j;
  }
  return -1;
}

export function nouvelleManche(s) {
  const n = s.players.length;
  s.manche = (s.manche || 0) + 1;
  const paquet = melanger(VALEURS.flatMap((v) => COULEURS.map((c) => v + c)));
  s.players.forEach((p) => Object.assign(p, { main: [], fini: 0, recu: [], donne: [], aPasse: false }));
  // distribution de toutes les cartes, en commençant après le donneur
  s.donneur = s.donneur === undefined ? Math.floor(Math.random() * n) : (s.donneur + 1) % n;
  paquet.forEach((c, k) => s.players[(s.donneur + 1 + k) % n].main.push(c));
  s.tas = [];
  s.passes = 0;
  s.dernierJoueur = -1;
  s.ouRien = null;
  s.revolution = false;
  s.classement = [];
  s.dernierPli = null;
  s.evenement = null;
  s.bilan = null;
  s.coup = (s.coup || 0) + 1;
  // échange des cartes (dès la 2e manche) : les « perdants » donnent d'office leurs meilleures cartes
  s.dons = [];
  const qui = (role) => s.players.findIndex((p) => p.role === role);
  // « Révolution » du Trou du cul : s'il vient de devenir Président, l'échange se fait à 4 cartes
  const double = !!s.revolutionTrou;
  s.echangeDouble = double;
  s.revolutionTrou = false;
  const echanges = [['trou', 'president', double ? 4 : 2], ['vicetrou', 'vice', 1]];
  echanges.forEach(([perdant, gagnant, nb]) => {
    const a = qui(perdant); const b = qui(gagnant);
    if (a < 0 || b < 0) return;
    const meilleures = trierMain(s.players[a].main).slice(-nb);
    s.players[a].main = s.players[a].main.filter((c) => !meilleures.includes(c));
    s.players[b].main.push(...meilleures);
    s.players[b].recu = meilleures;
    s.players[a].donne = meilleures;
    s.dons.push({ de: b, a, nb, fait: false }); // le gagnant rend nb cartes de son choix
  });
  if (s.dons.length) { s.status = 'echange'; return; }
  commencerJeu(s);
}

function commencerJeu(s) {
  s.status = 'jeu';
  // 1re manche : la Dame de cœur commence ; ensuite, le Trou du cul
  const trou = s.players.findIndex((p) => p.role === 'trou');
  s.active = trou >= 0 ? trou : s.players.findIndex((p) => p.main.includes('Q♥'));
  if (s.active < 0) s.active = 0;
  s.entame = s.active;
}

// Le gagnant de l'échange rend ses cartes (au choix)
export function donner(s, i, ids) {
  if (s.status !== 'echange') return false;
  const d = s.dons.find((x) => x.de === i && !x.fait);
  if (!d || !Array.isArray(ids) || ids.length !== d.nb || new Set(ids).size !== ids.length) return false;
  const p = s.players[i];
  if (!ids.every((c) => p.main.includes(c))) return false;
  p.main = p.main.filter((c) => !ids.includes(c));
  s.players[d.a].main.push(...ids);
  s.players[d.a].recu = ids;
  p.donne = ids;
  d.fait = true;
  s.coup = (s.coup || 0) + 1;
  if (s.dons.every((x) => x.fait)) commencerJeu(s);
  return true;
}

// Ce qu'il faut poser pour suivre (null : on ouvre le pli)
export function aBattre(s) {
  if (!s.tas.length) return null;
  const t = s.tas[s.tas.length - 1];
  return { nb: t.cartes.length, v: valeurDe(t.cartes[0]), ouRien: s.ouRien };
}

export function coupValide(s, i, ids) {
  if (s.status !== 'jeu' || s.active !== i) return false;
  const p = s.players[i];
  if (!Array.isArray(ids) || !ids.length || ids.length > 4 || new Set(ids).size !== ids.length) return false;
  if (!ids.every((c) => p.main.includes(c))) return false;
  const v = valeurDe(ids[0]);
  if (!ids.every((c) => valeurDe(c) === v)) return false;
  const b = aBattre(s);
  if (!b) return true;
  if (ids.length !== b.nb) return false;
  if (b.ouRien) return v === b.ouRien;
  return force(v, s.revolution) >= force(b.v, s.revolution);
}

export function jouer(s, i, ids) {
  if (!coupValide(s, i, ids)) return false;
  const p = s.players[i];
  const v = valeurDe(ids[0]);
  const precedent = aBattre(s);
  p.main = p.main.filter((c) => !ids.includes(c));
  s.tas.push({ j: i, cartes: ids });
  s.dernierJoueur = i;
  s.passes = 0;
  p.aPasse = false;
  s.coup = (s.coup || 0) + 1;
  s.evenement = null;
  // « … ou rien » : après une valeur égale, le suivant doit poser la même valeur ou passer
  s.ouRien = s.options.ouRien && precedent && precedent.v === v ? v : null;
  if (!p.main.length) {
    p.fini = s.classement.length + 1;
    s.classement.push(i);
  }
  // carré avec la révolution : l'ordre des cartes s'inverse
  let ferme = false;
  if (ids.length === 4) {
    ferme = true;
    if (s.options.revolution) { s.revolution = !s.revolution; s.evenement = { type: 'revolution', j: i, actif: s.revolution }; }
  }
  if (v === plusForte(s.revolution) && !(ids.length === 4 && s.options.revolution)) ferme = true;
  if (finSiPossible(s)) return true;
  if (ferme) { fermerPli(s, i); return true; }
  s.active = suivant(s, i);
  // plus personne ne peut répondre (tous les autres ont fini) : le pli se ferme
  if (s.active === i) fermerPli(s, i);
  return true;
}

export function passer(s, i) {
  if (s.status !== 'jeu' || s.active !== i || !s.tas.length) return false; // on ne passe pas quand on ouvre
  s.passes += 1;
  s.ouRien = null;
  s.players[i].aPasse = true;
  s.coup = (s.coup || 0) + 1;
  s.evenement = null;
  const d = s.dernierJoueur;
  const encore = avecCartes(s).length - (s.players[d] && s.players[d].main.length ? 1 : 0);
  if (s.passes >= encore) { fermerPli(s, d); return true; }
  s.active = suivant(s, i);
  return true;
}

// le pli est ramassé ; celui qui a posé en dernier rejoue (ou le suivant, s'il a fini)
function fermerPli(s, dernier) {
  const fin = s.tas[s.tas.length - 1];
  s.dernierPli = { cartes: fin ? fin.cartes : [], j: dernier, num: (s.dernierPli ? s.dernierPli.num : 0) + 1 };
  s.tas = [];
  s.players.forEach((q) => { q.aPasse = false; });
  s.passes = 0;
  s.ouRien = null;
  const p = s.players[dernier];
  s.active = p.main.length ? dernier : suivant(s, dernier);
  s.entame = s.active;
}

function finSiPossible(s) {
  const restants = avecCartes(s);
  if (restants.length > 1) return false;
  if (restants.length === 1) {
    const k = restants[0];
    s.players[k].fini = s.classement.length + 1;
    s.classement.push(k);
  }
  finManche(s);
  return true;
}

function finManche(s) {
  const n = s.players.length;
  // le Trou du cul de la manche précédente finit Président : c'est la révolution (variante)
  const premier = s.players[s.classement[0]];
  s.revolutionTrou = !!(s.options.revolutionTrou && premier && premier.role === 'trou');
  const roles = s.classement.map((_, r) => {
    if (r === 0) return 'president';
    if (r === n - 1) return 'trou';
    if (n >= 4 && r === 1) return 'vice';
    if (n >= 4 && r === n - 2) return 'vicetrou';
    return 'neutre';
  });
  const lignes = [];
  s.classement.forEach((k, r) => {
    const p = s.players[k];
    p.role = roles[r];
    const pts = n - 1 - r; // Président : n−1 points … Trou du cul : 0
    p.score += pts;
    p.rangs.push(r + 1);
    lignes.push({ j: k, rang: r + 1, role: roles[r], points: pts });
  });
  s.bilan = { manche: s.manche, lignes, revolutionTrou: s.revolutionTrou }; // le tas reste visible (dernière combinaison posée)
  s.status = 'fin';
  s.active = -1;
  s.coup = (s.coup || 0) + 1;
}

export function mancheSuivante(s) {
  if (s.status !== 'fin') return false;
  if (s.options.manches && s.manche >= s.options.manches) { s.status = 'termine'; s.coup = (s.coup || 0) + 1; return true; }
  nouvelleManche(s);
  return true;
}

export function classementGeneral(s) {
  return s.players.map((p, i) => ({ i, nom: p.name, score: p.score, presidences: p.rangs.filter((r) => r === 1).length }))
    .sort((a, b) => b.score - a.score || b.presidences - a.presidences);
}

// ---------- Bots ----------
function groupes(main, revolution) {
  const g = {};
  main.forEach((c) => { (g[valeurDe(c)] = g[valeurDe(c)] || []).push(c); });
  return Object.entries(g).map(([v, cartes]) => ({ v, cartes, f: force(v, revolution) })).sort((a, b) => a.f - b.f);
}
export function donBot(s, i) {
  const d = s.dons.find((x) => x.de === i && !x.fait);
  if (!d) return null;
  return trierMain(s.players[i].main).slice(0, d.nb); // les plus faibles
}
export function coupBot(s, i) {
  const p = s.players[i];
  const gs = groupes(p.main, s.revolution);
  const fort = plusForte(s.revolution);
  const b = aBattre(s);
  const peu = p.main.length <= 4;
  if (!b) {
    // on ouvre : la plus petite combinaison complète (on garde les 2 pour la fin)
    const normaux = gs.filter((g) => g.v !== fort);
    // fin de main : si tout part en deux coups, on garde le plus fort pour la fin
    const choix = (normaux.length ? normaux : gs)[0];
    return { type: 'jouer', ids: choix.cartes };
  }
  const ok = gs.filter((g) => g.cartes.length >= b.nb && (b.ouRien ? g.v === b.ouRien : g.f >= force(b.v, s.revolution)));
  if (!ok.length) return { type: 'passer' };
  // de préférence sans casser un groupe plus grand, et sans gaspiller les cartes fortes
  const exacts = ok.filter((g) => g.cartes.length === b.nb);
  let choix = (exacts.length ? exacts : ok)[0];
  const cher = choix.v === fort || choix.f >= 11; // As et 2 (ou 4 et 3 en révolution)
  if (cher && !peu && Math.random() < 0.6) return { type: 'passer' };
  if (choix.cartes.length > b.nb && !peu && Math.random() < 0.5 && choix.f < 9) {
    const autre = ok.find((g) => g.cartes.length === b.nb);
    if (!autre) return { type: 'passer' };
    choix = autre;
  }
  return { type: 'jouer', ids: choix.cartes.slice(0, b.nb) };
}
