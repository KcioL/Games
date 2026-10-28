// ==========================================================================
// Mastermind : règles (sans affichage) et bot, utilisables aussi dans Node pour les tests
//   mode 'course' : tout le monde cherche le même code, caché par l'ordinateur
//   mode 'duel'   : deux joueurs, chacun cherche le code caché par l'autre
//   mode 'solo'   : un joueur seul contre le code de l'ordinateur (c'est une course à un)
// Classement : celui qui trouve en moins d'essais gagne (égalité possible) ; le temps ne sert qu'à départager l'ordre.
// ==========================================================================

export const COULEURS = ['rouge', 'bleu', 'vert', 'jaune', 'orange', 'violet', 'rose', 'blanc'];
export const NOMS_COULEURS = { rouge: 'Rouge', bleu: 'Bleu', vert: 'Vert', jaune: 'Jaune', orange: 'Orange', violet: 'Violet', rose: 'Rose', blanc: 'Blanc' };

const aleatoire = (n) => Math.floor(Math.random() * n);

export function normaliser(s) {
  s.players = s.players || [];
  s.players.forEach((p) => {
    p.essais = p.essais || [];
    p.essais.forEach((e) => { e.c = e.c || []; });
    p.code = p.code || null;
  });
  s.options = s.options || {};
  s.code = s.code || null;
  return s;
}

export const reglages = (s) => ({
  couleurs: s.options.couleurs === 8 ? 8 : 6,
  longueur: s.options.longueur === 5 ? 5 : 4,
  doublons: s.options.doublons !== false,
  essais: [8, 10, 12].includes(s.options.essais) ? s.options.essais : 10,
});
export const palette = (s) => COULEURS.slice(0, reglages(s).couleurs);

export function codeAuHasard(r) {
  const pal = COULEURS.slice(0, r.couleurs);
  const code = [];
  while (code.length < r.longueur) {
    const c = pal[aleatoire(pal.length)];
    if (!r.doublons && code.includes(c)) continue;
    code.push(c);
  }
  return code;
}

export function codeValide(s, code) {
  const r = reglages(s);
  const pal = palette(s);
  if (!Array.isArray(code) || code.length !== r.longueur || !code.every((c) => pal.includes(c))) return false;
  if (!r.doublons && new Set(code).size !== code.length) return false;
  return true;
}

// Réponse à un essai : noirs = bonne couleur bien placée, blancs = bonne couleur mal placée
export function evaluer(code, essai) {
  let noirs = 0;
  const restCode = {};
  const restEssai = {};
  code.forEach((c, k) => {
    if (essai[k] === c) noirs++;
    else {
      restCode[c] = (restCode[c] || 0) + 1;
      restEssai[essai[k]] = (restEssai[essai[k]] || 0) + 1;
    }
  });
  let blancs = 0;
  Object.keys(restEssai).forEach((c) => { blancs += Math.min(restEssai[c], restCode[c] || 0); });
  return { noirs, blancs };
}

// le code que le joueur i doit trouver
export function cible(s, i) {
  if (s.mode === 'duel') {
    const autre = s.players.findIndex((_, k) => k !== i);
    return s.players[autre] ? s.players[autre].code : null;
  }
  return s.code;
}
export const adversaire = (s, i) => s.players.findIndex((_, k) => k !== i);

export function nouvellePartie(s) {
  normaliser(s);
  const r = reglages(s);
  s.partie = (s.partie || 0) + 1;
  s.coup = (s.coup || 0) + 1;
  s.players.forEach((p) => {
    p.essais = [];
    p.trouve = false;
    p.fini = false;
    p.temps = null;
    p.code = null;
    p.victoires = p.victoires || 0;
  });
  s.classement = null;
  if (s.mode === 'duel') {
    // chacun choisit le code que l'autre devra trouver (les bots en tirent un au hasard)
    s.players.forEach((p) => { if (p.bot) p.code = codeAuHasard(r); });
    s.code = null;
    s.status = 'codes';
    if (s.players.every((p) => p.code)) commencer(s);
  } else {
    s.code = codeAuHasard(r);
    commencer(s);
  }
  return true;
}

function commencer(s) {
  s.status = 'jeu';
  s.debut = Date.now();
}

export function choisirCode(s, i, code) {
  const p = s.players[i];
  if (s.status !== 'codes' || !p || p.code || !codeValide(s, code)) return false;
  p.code = [...code];
  s.coup = (s.coup || 0) + 1;
  if (s.players.every((q) => q.code)) commencer(s);
  return true;
}

export function proposer(s, i, essai, maintenant = Date.now()) {
  const p = s.players[i];
  if (s.status !== 'jeu' || !p || p.fini || !codeValide(s, essai)) return false;
  const code = cible(s, i);
  if (!code) return false;
  const r = evaluer(code, essai);
  p.essais.push({ c: [...essai], noirs: r.noirs, blancs: r.blancs });
  const max = reglages(s).essais;
  if (r.noirs === code.length) { p.trouve = true; p.fini = true; p.temps = maintenant - (s.debut || maintenant); } else if (p.essais.length >= max) { p.fini = true; p.temps = maintenant - (s.debut || maintenant); }
  s.coup = (s.coup || 0) + 1;
  if (s.players.every((q) => q.fini)) terminer(s);
  return true;
}

// Abandonner (le joueur révèle le code et termine sa partie)
export function abandonner(s, i, maintenant = Date.now()) {
  const p = s.players[i];
  if (s.status !== 'jeu' || !p || p.fini) return false;
  p.fini = true;
  p.abandon = true;
  p.temps = maintenant - (s.debut || maintenant);
  s.coup = (s.coup || 0) + 1;
  if (s.players.every((q) => q.fini)) terminer(s);
  return true;
}

export function classer(s) {
  return s.players.map((p, i) => ({ i, trouve: !!p.trouve, essais: p.essais.length, temps: p.temps || 0 }))
    .sort((a, b) => (b.trouve - a.trouve) || (a.trouve ? a.essais - b.essais : 0) || a.temps - b.temps);
}

function terminer(s) {
  const cl = classer(s);
  s.classement = cl.map((x) => x.i);
  // vainqueur(s) : ceux qui ont trouvé avec le moins d'essais (à égalité d'essais : égalité, le temps ne sert qu'à l'ordre)
  const meilleur = cl[0];
  s.gagnants = [];
  if (meilleur && meilleur.trouve) {
    cl.forEach((x) => { if (x.trouve && x.essais === meilleur.essais) s.gagnants.push(x.i); });
    s.gagnants.forEach((g) => { s.players[g].victoires = (s.players[g].victoires || 0) + 1; });
  }
  s.status = 'fin';
}

// ---------- Le bot ----------
// Il garde un essai compatible avec toutes les réponses déjà reçues (en moyenne 5 essais avec 6 couleurs).
function tousLesCodes(r) {
  const pal = COULEURS.slice(0, r.couleurs);
  const res = [];
  const rec = (pref) => {
    if (pref.length === r.longueur) { res.push(pref); return; }
    pal.forEach((c) => { if (r.doublons || !pref.includes(c)) rec([...pref, c]); });
  };
  rec([]);
  return res;
}
const cacheCodes = new Map();
export function essaiBot(s, i) {
  const r = reglages(s);
  const cle = `${r.couleurs}-${r.longueur}-${r.doublons}`;
  if (!cacheCodes.has(cle)) cacheCodes.set(cle, tousLesCodes(r));
  const tous = cacheCodes.get(cle);
  const p = s.players[i];
  if (!p.essais.length) {
    // premier essai classique : deux paires (ou des couleurs différentes sans doublons)
    const pal = palette(s);
    const d = [...pal].sort(() => Math.random() - 0.5);
    if (!r.doublons) return d.slice(0, r.longueur);
    return Array.from({ length: r.longueur }, (_, k) => d[Math.floor(k / 2)]);
  }
  const possibles = tous.filter((code) => p.essais.every((e) => {
    const x = evaluer(code, e.c);
    return x.noirs === e.noirs && x.blancs === e.blancs;
  }));
  if (!possibles.length) return codeAuHasard(r);
  // niveau « facile » : il joue parfois un peu au hasard
  if (s.options.niveau === 'facile' && p.essais.length < r.essais - 2 && Math.random() < 0.45) return codeAuHasard(r);
  return possibles[aleatoire(possibles.length)];
}

// Le bot joue son essai suivant quand les humains encore en jeu ont au moins autant d'essais que lui
export function botDoitJouer(s, i) {
  const p = s.players[i];
  if (s.status !== 'jeu' || !p || !p.bot || p.fini) return false;
  const humains = s.players.filter((q) => !q.bot && !q.fini);
  if (!humains.length) return true;
  return humains.every((q) => q.essais.length > p.essais.length);
}
