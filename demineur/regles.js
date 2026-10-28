// ==========================================================================
// Démineur : règles (sans affichage), utilisables aussi dans Node pour les tests
//   solo   : la grille est créée au premier clic (le premier clic ne tombe jamais sur une mine)
//   course : tout le monde a la même grille, une case de départ sans mine est déjà ouverte ;
//            le premier à tout déminer gagne (classement au temps, puis aux cases ouvertes)
// Vue d'un joueur : une chaîne d'un caractère par case  '.' cachée, 'o' ouverte, 'f' drapeau
// ==========================================================================

export const NIVEAUX = {
  debutant: { nom: 'Débutant', l: 9, h: 9, mines: 10 },
  intermediaire: { nom: 'Intermédiaire', l: 16, h: 16, mines: 40 },
  expert: { nom: 'Expert', l: 30, h: 16, mines: 99 },
};

export const niveau = (s) => NIVEAUX[s.options && s.options.niveau] || NIVEAUX.debutant;

export function voisins(idx, l, h) {
  const x = idx % l; const y = Math.floor(idx / l);
  const res = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < l && ny < h) res.push(ny * l + nx);
    }
  }
  return res;
}

// mines au hasard, sauf autour de la case « sure » (elle et ses voisines)
export function placerMines(l, h, n, sure) {
  const interdites = new Set(sure >= 0 ? [sure, ...voisins(sure, l, h)] : []);
  const libres = [];
  for (let k = 0; k < l * h; k++) if (!interdites.has(k)) libres.push(k);
  for (let i = libres.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [libres[i], libres[j]] = [libres[j], libres[i]]; }
  return libres.slice(0, Math.min(n, libres.length)).sort((a, b) => a - b);
}

// nombre de mines autour de chaque case (-1 : une mine)
export function chiffres(g) {
  const m = new Set(g.mines);
  return Array.from({ length: g.l * g.h }, (_, k) => (m.has(k) ? -1 : voisins(k, g.l, g.h).filter((v) => m.has(v)).length));
}

export function normaliser(s) {
  s.players = s.players || [];
  s.options = s.options || {};
  if (s.grille) s.grille.mines = s.grille.mines || [];
  const n = s.grille ? s.grille.l * s.grille.h : 0;
  s.players.forEach((p) => {
    if (typeof p.vue !== 'string' || p.vue.length !== n) p.vue = '.'.repeat(n);
    p.etat = p.etat || 'jeu';
    p.victoires = p.victoires || 0;
  });
  return s;
}

export function nouvellePartie(s, maintenant = Date.now()) {
  const nv = niveau(s);
  s.partie = (s.partie || 0) + 1;
  s.coup = (s.coup || 0) + 1;
  s.status = 'jeu';
  s.classement = null;
  s.gagnant = -1;
  s.grille = { l: nv.l, h: nv.h, n: nv.mines, mines: [], pret: false };
  s.depart = -1;
  if (s.mode === 'course') {
    // même grille pour tous, avec une case de départ sans mine autour, déjà ouverte
    const depart = Math.floor(nv.h / 2) * nv.l + Math.floor(nv.l / 2);
    s.grille.mines = placerMines(nv.l, nv.h, nv.mines, depart);
    s.grille.pret = true;
    s.depart = depart;
  }
  s.players.forEach((p) => {
    p.vue = '.'.repeat(nv.l * nv.h);
    p.etat = 'jeu';
    p.debut = null;
    p.temps = null;
    p.boom = -1;
    p.victoires = p.victoires || 0;
  });
  normaliser(s);
  if (s.mode === 'course') s.players.forEach((p, i) => ouvrirZone(s, i, s.depart));
  s.debut = maintenant;
  return true;
}

// ouvre une case (et tout le voisinage des cases à 0) ; renvoie false si c'est une mine
function ouvrirZone(s, i, idx) {
  const g = s.grille;
  const p = s.players[i];
  const ch = chiffres(g);
  const vue = p.vue.split('');
  if (ch[idx] === -1) { vue[idx] = 'o'; p.vue = vue.join(''); return false; }
  const pile = [idx];
  while (pile.length) {
    const k = pile.pop();
    if (vue[k] === 'o') continue;
    vue[k] = 'o';
    if (ch[k] === 0) voisins(k, g.l, g.h).forEach((v) => { if (vue[v] !== 'o' && ch[v] !== -1) pile.push(v); });
  }
  p.vue = vue.join('');
  return true;
}

const enJeu = (s, i) => s.status === 'jeu' && s.players[i] && s.players[i].etat === 'jeu';

// course : le chrono de chacun part quand la grille s'affiche sur son téléphone (mesuré avec sa propre horloge)
export function commencer(s, i, maintenant = Date.now()) {
  const p = s.players[i];
  if (!enJeu(s, i) || p.debut) return false;
  p.debut = maintenant;
  return true;
}

// le joueur ouvre une case
export function ouvrir(s, i, idx, maintenant = Date.now()) {
  if (!enJeu(s, i)) return false;
  const g = s.grille;
  const p = s.players[i];
  if (idx < 0 || idx >= g.l * g.h || p.vue[idx] !== '.') return false;
  if (!g.pret) { g.mines = placerMines(g.l, g.h, g.n, idx); g.pret = true; } // solo : premier clic sans danger
  if (!p.debut) p.debut = maintenant;
  const ok = ouvrirZone(s, i, idx);
  s.coup = (s.coup || 0) + 1;
  if (!ok) perdre(s, i, idx, maintenant); else verifier(s, i, maintenant);
  return true;
}

// accord : sur un chiffre entouré d'autant de drapeaux, on ouvre toutes les autres voisines d'un coup
export function accord(s, i, idx, maintenant = Date.now()) {
  if (!enJeu(s, i)) return false;
  const g = s.grille;
  const p = s.players[i];
  if (p.vue[idx] !== 'o' || !g.pret) return false;
  const ch = chiffres(g);
  const vs = voisins(idx, g.l, g.h);
  const drapeaux = vs.filter((v) => p.vue[v] === 'f').length;
  if (ch[idx] <= 0 || drapeaux !== ch[idx]) return false;
  const aOuvrir = vs.filter((v) => p.vue[v] === '.');
  if (!aOuvrir.length) return false;
  let boom = -1;
  aOuvrir.forEach((v) => { if (!ouvrirZone(s, i, v) && boom < 0) boom = v; });
  s.coup = (s.coup || 0) + 1;
  if (boom >= 0) perdre(s, i, boom, maintenant); else verifier(s, i, maintenant);
  return true;
}

export function drapeau(s, i, idx) {
  if (!enJeu(s, i)) return false;
  const p = s.players[i];
  const c = p.vue[idx];
  if (c !== '.' && c !== 'f') return false;
  p.vue = p.vue.slice(0, idx) + (c === 'f' ? '.' : 'f') + p.vue.slice(idx + 1);
  s.coup = (s.coup || 0) + 1;
  return true;
}

export const nbOuvertes = (p) => (p.vue.match(/o/g) || []).length;
export const nbDrapeaux = (p) => (p.vue.match(/f/g) || []).length;

function verifier(s, i, maintenant) {
  const g = s.grille;
  const p = s.players[i];
  if (nbOuvertes(p) === g.l * g.h - g.mines.length) {
    p.etat = 'gagne';
    p.temps = maintenant - (p.debut || maintenant);
    // toutes les mines reçoivent un drapeau
    const m = new Set(g.mines);
    p.vue = p.vue.split('').map((c, k) => (m.has(k) ? 'f' : c)).join('');
    finSiPossible(s);
  }
}
function perdre(s, i, idx, maintenant) {
  const p = s.players[i];
  p.etat = 'perdu';
  p.boom = idx;
  p.temps = maintenant - (p.debut || maintenant);
  finSiPossible(s);
}

// course : on s'arrête dès que quelqu'un a tout déminé et que les autres ont fini, ou dès que tous ont fini
function finSiPossible(s) {
  if (!s.players.every((p) => p.etat !== 'jeu')) return;
  s.classement = classer(s);
  const premier = s.players[s.classement[0]];
  s.gagnant = premier && (premier.etat === 'gagne' || s.players.length > 1) ? s.classement[0] : -1;
  if (s.players.length > 1 && s.gagnant >= 0) s.players[s.gagnant].victoires = (s.players[s.gagnant].victoires || 0) + 1;
  s.status = 'fin';
}

// gagnants d'abord (au temps), puis les autres (au nombre de cases ouvertes)
export function classer(s) {
  return s.players.map((p, i) => ({ i, g: p.etat === 'gagne' ? 1 : 0, t: p.temps || 0, o: nbOuvertes(p) }))
    .sort((a, b) => b.g - a.g || (a.g ? a.t - b.t : b.o - a.o) || a.t - b.t)
    .map((x) => x.i);
}

// abandonner (course) : le joueur arrête là
export function abandonner(s, i, maintenant = Date.now()) {
  if (!enJeu(s, i)) return false;
  const p = s.players[i];
  p.etat = 'perdu';
  p.abandon = true;
  p.temps = maintenant - (p.debut || maintenant);
  s.coup = (s.coup || 0) + 1;
  finSiPossible(s);
  return true;
}
