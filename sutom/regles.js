// ==========================================================================
// Sutom : règles (sans affichage), utilisables aussi dans Node pour les tests
// Un mot de 6 à 9 lettres dont la première est donnée ; 6 essais. Chaque essai doit être un mot
// du dictionnaire, de la bonne longueur, qui commence par la bonne lettre.
//   rouge (bien placée) · jaune (présente ailleurs) · bleu (absente, ou déjà toutes trouvées)
// Modes : 'jour' (mot du jour, le même pour tout le monde), 'libre', 'course' (en ligne, même mot pour tous)
// ==========================================================================

export const ESSAIS = 6;
export const BIEN = 2, MAL = 1, ABSENT = 0;

// Couleurs d'un essai (gère les lettres en double comme le vrai jeu)
export function evaluer(essai, mot) {
  const res = Array(mot.length).fill(ABSENT);
  const reste = {};
  for (let i = 0; i < mot.length; i++) {
    if (essai[i] === mot[i]) res[i] = BIEN;
    else reste[mot[i]] = (reste[mot[i]] || 0) + 1;
  }
  for (let i = 0; i < mot.length; i++) {
    if (res[i] === BIEN) continue;
    if (reste[essai[i]]) { res[i] = MAL; reste[essai[i]] -= 1; }
  }
  return res;
}

export const normaliserMot = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/Œ/gi, 'OE').replace(/Æ/gi, 'AE').toUpperCase().replace(/[^A-Z]/g, '');

// Pourquoi un essai est refusé ('' : il est accepté)
export function refus(essai, mot, dico) {
  if (essai.length !== mot.length) return `Le mot fait ${mot.length} lettres.`;
  if (essai[0] !== mot[0]) return `Le mot commence par ${mot[0]}.`;
  if (dico && !dico.has(essai) && essai !== mot) return `« ${essai} » n'est pas dans le dictionnaire.`;
  return '';
}

// ---------- Mot du jour ----------
// numéro du jour (1 = 1er janvier 2026), d'après la date du téléphone
export function numeroDuJour(d = new Date()) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 1)) / 86400000) + 1;
}
export const motDuJour = (solutions, n) => solutions[((n - 1) % solutions.length + solutions.length) % solutions.length];

// ---------- Partie (état partagé) ----------
export function normaliser(s) {
  s.players = s.players || [];
  s.players.forEach((p) => {
    p.essais = p.essais || [];
    p.victoires = p.victoires || 0;
  });
  return s;
}

export function nouvellePartie(s, mot, maintenant = Date.now()) {
  normaliser(s);
  s.mot = mot;
  s.status = 'jeu';
  s.partie = (s.partie || 0) + 1;
  s.coup = (s.coup || 0) + 1;
  s.debut = maintenant;
  s.classement = null;
  s.gagnants = null;
  s.players.forEach((p) => { p.essais = []; p.trouve = false; p.fini = false; p.temps = null; });
  return true;
}

const enJeu = (s, i) => s.status === 'jeu' && s.players[i] && !s.players[i].fini;

export function proposer(s, i, essai, maintenant = Date.now()) {
  if (!enJeu(s, i)) return false;
  const p = s.players[i];
  essai = normaliserMot(essai);
  if (refus(essai, s.mot, null)) return false;
  p.essais.push(essai);
  if (essai === s.mot) { p.trouve = true; p.fini = true; p.temps = maintenant - (s.debut || maintenant); } else if (p.essais.length >= ESSAIS) { p.fini = true; p.temps = maintenant - (s.debut || maintenant); }
  s.coup = (s.coup || 0) + 1;
  if (s.players.every((q) => q.fini)) terminer(s);
  return true;
}

export function abandonner(s, i, maintenant = Date.now()) {
  if (!enJeu(s, i)) return false;
  const p = s.players[i];
  p.fini = true;
  p.abandon = true;
  p.temps = maintenant - (s.debut || maintenant);
  s.coup = (s.coup || 0) + 1;
  if (s.players.every((q) => q.fini)) terminer(s);
  return true;
}

// classement : ceux qui ont trouvé (moins d'essais d'abord, puis le plus rapide), puis les autres
export function classer(s) {
  return s.players.map((p, i) => ({ i, t: p.trouve ? 1 : 0, n: p.essais.length, d: p.temps || 0 }))
    .sort((a, b) => b.t - a.t || (a.t ? a.n - b.n : 0) || a.d - b.d)
    .map((x) => x.i);
}

function terminer(s) {
  s.status = 'fin';
  s.classement = classer(s);
  const premier = s.players[s.classement[0]];
  s.gagnants = premier && premier.trouve
    ? s.classement.filter((k) => s.players[k].trouve && s.players[k].essais.length === premier.essais.length) : [];
  if (s.players.length > 1) s.gagnants.forEach((k) => { s.players[k].victoires = (s.players[k].victoires || 0) + 1; });
  s.coup = (s.coup || 0) + 1;
}

// Lettres déjà sûres (pour aider à écrire la ligne suivante) : la première, et les bien placées trouvées
export function lettresSures(mot, essais) {
  const sures = Array(mot.length).fill('');
  sures[0] = mot[0];
  essais.forEach((e) => evaluer(e, mot).forEach((c, k) => { if (c === BIEN) sures[k] = mot[k]; }));
  return sures;
}

// État du clavier : la meilleure couleur connue de chaque lettre
export function etatClavier(mot, essais) {
  const t = {};
  essais.forEach((e) => evaluer(e, mot).forEach((c, k) => {
    const l = e[k];
    t[l] = Math.max(t[l] === undefined ? -1 : t[l], c);
  }));
  return t;
}

// Résultat à partager (comme le vrai Sutom) : 🟥 bien placée, 🟡 mal placée, 🟦 absente
export function partage(mot, essais, titre) {
  const lignes = essais.map((e) => evaluer(e, mot).map((c) => (c === BIEN ? '🟥' : c === MAL ? '🟡' : '🟦')).join(''));
  const trouve = essais[essais.length - 1] === mot;
  return `${titre} ${trouve ? essais.length : '-'}/${ESSAIS}\n\n${lignes.join('\n')}`;
}
