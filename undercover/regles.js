// Règles de l'Undercover (sans affichage) : composition, mots, tours d'indices, votes, Mister White, fin de partie.
import { THEMES, simplifier } from './mots.js';

export const NOMS_ROLES = { civil: 'Civil', undercover: 'Undercover', mrwhite: 'Mister White' };
export const POINTS = { civil: 2, undercover: 10, mrwhite: 6 };

function melanger(tab) {
  for (let i = tab.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tab[i], tab[j]] = [tab[j], tab[i]];
  }
  return tab;
}

export function normaliser(s) {
  s.players = s.players || [];
  s.players.forEach((p) => {
    p.score = p.score || 0;
    if (p.vote === undefined || p.vote === null) p.vote = -1;
    if (p.vivant === undefined) p.vivant = true;
  });
  s.indices = s.indices || [];
  s.ordre = s.ordre || [];
  s.candidats = s.candidats || null;
  s.historique = s.historique || [];
  s.reglages = s.reglages || { theme: 'general', undercover: 'auto', mrwhite: 'auto' };
  s.utilises = s.utilises || {};
  return s;
}

// Nombre d'Undercover (u), de Mister White (w) et de civils (c) pour n joueurs
export function compositionDemandee(n, r) {
  const w = r.mrwhite === 'oui' ? 1 : r.mrwhite === 'non' ? 0 : (n >= 5 ? 1 : 0);
  const u = r.undercover === 'auto' ? (n <= 6 ? 1 : n <= 8 ? 2 : n <= 11 ? 3 : 4) : parseInt(r.undercover, 10);
  return { u, w, c: n - u - w };
}
export function erreurComposition(n, r) {
  if (n < 3) return 'Il faut au moins 3 joueurs.';
  const { u, w, c } = compositionDemandee(n, r);
  if (c <= u + w) return `Avec ${n} joueurs, il faut plus de civils que d'imposteurs : enlève un Undercover ou Mister White.`;
  return '';
}
// Composition jouable (au cas où : on réduit les imposteurs jusqu'à ce que les civils soient majoritaires)
export function composition(n, r) {
  let { u, w } = compositionDemandee(n, r);
  while (n - u - w <= u + w && u + w > 1) { if (w && u <= 1) w = 0; else u--; }
  if (u + w === 0) u = 1;
  return { u, w, c: n - u - w };
}

// Tire une paire de mots pas encore jouée dans ce salon
function choisirPaire(s) {
  let theme = s.reglages.theme;
  if (!THEMES[theme]) theme = Math.random() < 0.5 ? 'general' : 'anime';
  const paires = THEMES[theme].paires;
  let deja = s.utilises[theme] || [];
  if (deja.length >= paires.length) deja = [];
  const libres = paires.map((_, k) => k).filter((k) => !deja.includes(k));
  const k = libres[Math.floor(Math.random() * libres.length)];
  s.utilises[theme] = [...deja, k];
  const paire = Math.random() < 0.5 ? paires[k] : [paires[k][1], paires[k][0]];
  return { civil: paire[0], undercover: paire[1], theme };
}

export function nouvellePartie(s) {
  normaliser(s);
  const n = s.players.length;
  const { u, w, c } = composition(n, s.reglages);
  const paire = choisirPaire(s);
  const roles = melanger([...Array(u).fill('undercover'), ...Array(w).fill('mrwhite'), ...Array(c).fill('civil')]);
  s.players.forEach((p, i) => {
    p.role = roles[i];
    p.mot = roles[i] === 'civil' ? paire.civil : roles[i] === 'undercover' ? paire.undercover : '';
    p.vivant = true;
    p.vu = false;
    p.vote = -1;
    p.gain = 0;
  });
  s.motCivil = paire.civil;
  s.motUndercover = paire.undercover;
  s.themeJoue = paire.theme;
  s.compo = { u, w, c };
  s.status = 'jeu';
  s.phase = 'mots';
  s.tour = 1;
  s.indices = [];
  s.historique = [];
  s.candidats = null;
  s.egalite = null;
  s.elimine = null;
  s.devinette = null;
  s.resultat = null;
  s.partie = (s.partie || 0) + 1;
  s.coup = (s.coup || 0) + 1;
}

function commencerTour(s) {
  const vivants = s.players.map((_, i) => i).filter((i) => s.players[i].vivant);
  // ordre de parole tiré au sort : n'importe qui peut commencer, Mister White compris
  s.ordre = melanger(vivants);
  s.parle = 0;
  s.phase = 'indices';
  s.candidats = null;
  s.egalite = null;
  s.elimine = null;
  s.devinette = null;
  s.players.forEach((p) => { p.vote = -1; });
}

export const vivants = (s) => s.players.map((_, i) => i).filter((i) => s.players[i].vivant);

function avancerParole(s) {
  s.parle += 1;
  if (s.parle >= s.ordre.length) {
    s.phase = 'vote';
    s.players.forEach((p) => { p.vote = -1; });
  }
}

// Le joueur i a vu son mot
export function actVu(s, i) {
  if (s.status !== 'jeu' || s.phase !== 'mots' || !s.players[i] || s.players[i].vu) return false;
  s.players[i].vu = true;
  if (s.players.every((p) => p.vu)) commencerTour(s);
  s.coup++;
  return true;
}

// Indice écrit (en ligne) ; texte vide = indice donné à voix haute (sur un seul téléphone)
export function actIndice(s, i, texte) {
  if (s.status !== 'jeu' || s.phase !== 'indices' || s.ordre[s.parle] !== i) return false;
  if (texte) s.indices.push({ tour: s.tour, joueur: i, texte: texte.slice(0, 40) });
  avancerParole(s);
  s.coup++;
  return true;
}

export function peutVoterPour(s, i, j) {
  if (i === j || !s.players[j] || !s.players[j].vivant) return false;
  return !s.candidats || s.candidats.includes(j);
}

export function actVote(s, i, j) {
  if (s.status !== 'jeu' || s.phase !== 'vote' || !s.players[i] || !s.players[i].vivant || !peutVoterPour(s, i, j)) return false;
  s.players[i].vote = j;
  if (vivants(s).every((k) => s.players[k].vote >= 0)) resoudreVote(s);
  s.coup++;
  return true;
}

function resoudreVote(s) {
  const compte = {};
  const votes = [];
  vivants(s).forEach((k) => {
    const v = s.players[k].vote;
    compte[v] = (compte[v] || 0) + 1;
    votes.push([k, v]);
  });
  const max = Math.max(...Object.values(compte));
  const ex = Object.keys(compte).filter((k) => compte[k] === max).map(Number);
  if (ex.length === 1) { eliminer(s, ex[0], { votes }); return; }
  if (!s.candidats) {
    // égalité : on revote entre les ex æquo
    s.candidats = ex;
    s.egalite = { votes, ts: Date.now() };
    s.players.forEach((p) => { p.vote = -1; });
    return;
  }
  // nouvelle égalité : le sort décide
  eliminer(s, ex[Math.floor(Math.random() * ex.length)], { votes, tirage: ex });
}

// Sur un seul téléphone : le groupe désigne directement le joueur éliminé
export function actEliminer(s, j) {
  if (s.status !== 'jeu' || s.phase !== 'vote' || !s.players[j] || !s.players[j].vivant) return false;
  eliminer(s, j, {});
  s.coup++;
  return true;
}

function eliminer(s, j, { votes = [], tirage = null }) {
  const p = s.players[j];
  p.vivant = false;
  s.elimine = { joueur: j, role: p.role, votes, tirage };
  s.historique.push({ tour: s.tour, joueur: j, role: p.role });
  s.candidats = null;
  if (p.role === 'mrwhite') { s.phase = 'mrwhite'; return; }
  apresElimination(s);
}

export function actDeviner(s, i, texte) {
  if (s.status !== 'jeu' || s.phase !== 'mrwhite' || !s.elimine || s.elimine.joueur !== i) return false;
  const juste = simplifier(texte) !== '' && simplifier(texte) === simplifier(s.motCivil);
  s.devinette = { texte: String(texte).slice(0, 40), juste };
  s.coup++;
  if (juste) { terminer(s, 'mrwhite'); return true; }
  apresElimination(s);
  return true;
}

function apresElimination(s) {
  const viv = vivants(s).map((i) => s.players[i].role);
  const civils = viv.filter((r) => r === 'civil').length;
  const imposteurs = viv.length - civils;
  if (imposteurs === 0) terminer(s, 'civils');
  else if (civils <= 1) terminer(s, 'imposteurs');
  else s.phase = 'revelation';
}

function terminer(s, camp) {
  s.status = 'fin';
  s.phase = 'fin';
  s.resultat = { camp };
  s.players.forEach((p, i) => {
    let gain = 0;
    if (camp === 'civils' && p.role === 'civil') gain = POINTS.civil;
    if (camp === 'imposteurs' && p.vivant && p.role !== 'civil') gain = POINTS[p.role];
    if (camp === 'mrwhite' && s.elimine && s.elimine.joueur === i) gain = POINTS.mrwhite;
    p.gain = gain;
    p.score += gain;
  });
}

export function actTourSuivant(s) {
  if (s.status !== 'jeu' || s.phase !== 'revelation') return false;
  s.tour += 1;
  commencerTour(s);
  s.coup++;
  return true;
}

export function actNouvellePartie(s, theme) {
  if (s.status !== 'fin') return false;
  if (theme) s.reglages.theme = theme;
  nouvellePartie(s);
  return true;
}

