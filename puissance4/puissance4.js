import { $, el, initSalon, initRegles, de } from '../commun/salon.js';

const COLONNES = 7;
const LIGNES = 6;
const VIDE = 0;
// Case (ligne l, colonne c), ligne 0 en haut
const idx = (l, c) => l * COLONNES + c;

// =====================================================================
// Règles
// =====================================================================
const grilleVide = () => new Array(COLONNES * LIGNES).fill(VIDE);

// Ligne où tombe un jeton dans la colonne c (-1 si la colonne est pleine)
function ligneLibre(g, c) {
  for (let l = LIGNES - 1; l >= 0; l--) if (g[idx(l, c)] === VIDE) return l;
  return -1;
}

const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

// Cases de l'alignement de 4 (ou plus) passant par (l, c), sinon null
function alignement(g, l, c) {
  const jeton = g[idx(l, c)];
  if (jeton === VIDE) return null;
  for (const [dl, dc] of DIRECTIONS) {
    const cases = [idx(l, c)];
    for (const sens of [1, -1]) {
      let ll = l + dl * sens;
      let cc = c + dc * sens;
      while (ll >= 0 && ll < LIGNES && cc >= 0 && cc < COLONNES && g[idx(ll, cc)] === jeton) {
        cases.push(idx(ll, cc));
        ll += dl * sens;
        cc += dc * sens;
      }
    }
    if (cases.length >= 4) return cases;
  }
  return null;
}

function normaliser(s) {
  s.players = s.players || [];
  if (!Array.isArray(s.grille) || s.grille.length !== COLONNES * LIGNES) s.grille = grilleVide();
  s.players.forEach((p) => { p.victoires = p.victoires || 0; });
  return s;
}

function nouvelleManche(s) {
  s.grille = grilleVide();
  s.premier = s.premier === undefined ? Math.floor(Math.random() * 2) : 1 - s.premier;
  s.active = s.premier;
  s.status = 'jeu';
  s.gagnant = -1;
  s.ligne = null;
  s.dernier = null;
  s.coup = (s.coup || 0) + 1;
  s.manche = (s.manche || 0) + 1;
}

// Le joueur i fait tomber un jeton dans la colonne c
function jouer(s, i, c) {
  if (s.status !== 'jeu' || s.active !== i) return false;
  const l = ligneLibre(s.grille, c);
  if (l < 0) return false;
  s.grille[idx(l, c)] = i + 1;
  s.dernier = { l, c };
  s.coup = (s.coup || 0) + 1;
  const ligne = alignement(s.grille, l, c);
  if (ligne) {
    s.status = 'fin';
    s.gagnant = i;
    s.ligne = ligne;
    s.players[i].victoires += 1;
  } else if (s.grille.every((x) => x !== VIDE)) {
    s.status = 'fin';
    s.gagnant = -1;
  } else {
    s.active = 1 - i;
  }
  return true;
}

// =====================================================================
// Bot : minimax avec élagage alpha-bêta
// =====================================================================
const ORDRE = [3, 2, 4, 1, 5, 0, 6]; // le centre d'abord : meilleur élagage

function scoreFenetre(f, moi, lui) {
  const m = f.filter((x) => x === moi).length;
  const a = f.filter((x) => x === lui).length;
  const v = f.filter((x) => x === VIDE).length;
  if (m === 4) return 1000;
  if (m === 3 && v === 1) return 6;
  if (m === 2 && v === 2) return 2;
  if (a === 3 && v === 1) return -8;
  if (a === 2 && v === 2) return -1;
  return 0;
}

function evaluer(g, moi) {
  const lui = moi === 1 ? 2 : 1;
  let score = 0;
  for (let l = 0; l < LIGNES; l++) if (g[idx(l, 3)] === moi) score += 3; // la colonne centrale compte
  for (let l = 0; l < LIGNES; l++) {
    for (let c = 0; c < COLONNES; c++) {
      for (const [dl, dc] of DIRECTIONS) {
        const lf = l + 3 * dl;
        const cf = c + 3 * dc;
        if (lf < 0 || lf >= LIGNES || cf < 0 || cf >= COLONNES) continue;
        const f = [0, 1, 2, 3].map((k) => g[idx(l + k * dl, c + k * dc)]);
        score += scoreFenetre(f, moi, lui);
      }
    }
  }
  return score;
}

function minimax(g, profondeur, alpha, beta, maximiser, moi) {
  const lui = moi === 1 ? 2 : 1;
  const coups = ORDRE.filter((c) => ligneLibre(g, c) >= 0);
  if (coups.length === 0) return 0;
  if (profondeur === 0) return evaluer(g, moi);
  let meilleur = maximiser ? -Infinity : Infinity;
  for (const c of coups) {
    const l = ligneLibre(g, c);
    g[idx(l, c)] = maximiser ? moi : lui;
    let v;
    if (alignement(g, l, c)) v = maximiser ? 100000 + profondeur : -100000 - profondeur; // gagner vite, perdre tard
    else v = minimax(g, profondeur - 1, alpha, beta, !maximiser, moi);
    g[idx(l, c)] = VIDE;
    if (maximiser) { meilleur = Math.max(meilleur, v); alpha = Math.max(alpha, v); }
    else { meilleur = Math.min(meilleur, v); beta = Math.min(beta, v); }
    if (alpha >= beta) break;
  }
  return meilleur;
}

const PROFONDEUR = { facile: 1, moyen: 3, difficile: 6 };

function choixBot(s, i, niveau) {
  const g = s.grille.slice();
  const moi = i + 1;
  const coups = ORDRE.filter((c) => ligneLibre(g, c) >= 0);
  // Facile : un coup au hasard de temps en temps
  if (niveau === 'facile' && Math.random() < 0.35) return coups[Math.floor(Math.random() * coups.length)];
  const prof = PROFONDEUR[niveau] || 3;
  let meilleurs = [];
  let meilleurScore = -Infinity;
  for (const c of coups) {
    const l = ligneLibre(g, c);
    g[idx(l, c)] = moi;
    const v = alignement(g, l, c) ? 1000000 : minimax(g, prof - 1, -Infinity, Infinity, false, moi);
    g[idx(l, c)] = VIDE;
    if (v > meilleurScore) { meilleurScore = v; meilleurs = [c]; }
    else if (v === meilleurScore) meilleurs.push(c);
  }
  return meilleurs[Math.floor(Math.random() * meilleurs.length)];
}

// =====================================================================
// Salon
// =====================================================================
let etat = null;
let maPlace = 0;
let botPrevu = '';
let dernierCoupVu = null;

// Le niveau du bot n'a de sens que contre un bot
function majChoixNiveau() {
  $('choix-niveau').hidden = $('local-nb').value !== '1';
}
$('local-nb').addEventListener('change', majChoixNiveau);
majChoixNiveau();

const salon = initSalon({
  jeu: 'puissance4',
  etatInitial: (nom, nb, { local }) => {
    const joueurs = [
      { name: nom, joined: true, bot: false },
      { name: 'En attente', joined: false, bot: false },
    ];
    if (local && nb === 1) {
      const niveau = $('local-niveau').value;
      const noms = { facile: 'Bot facile', moyen: 'Bot moyen', difficile: 'Bot difficile' };
      joueurs[1] = { name: noms[niveau], joined: true, bot: true, niveau };
    }
    return { players: joueurs };
  },
  demarrer: (s) => { normaliser(s); nouvelleManche(s); },
  afficher: (s, place) => {
    etat = normaliser(s);
    maPlace = place;
    noterChangement();
    rendre();
    planifierBot();
  },
  // Sur un seul téléphone : rien de caché, l'écran suit le joueur humain dont c'est le tour
  quiDoitJouer: (s) => {
    const humains = (s.players || []).filter((p) => !p.bot);
    if (humains.length <= 1) return -1;
    return s.status === 'jeu' ? s.active : -1;
  },
  secret: false,
});
initRegles();

function agir(fn) {
  return salon.agir((s) => fn(normaliser(s)));
}

function planifierBot() {
  if (!etat || etat.status !== 'jeu') return;
  const b = etat.players[etat.active];
  if (!b || !b.bot) return;
  const cle = `${etat.coup}`;
  if (botPrevu === cle) return;
  botPrevu = cle;
  const coup = etat.coup;
  // Un petit temps de réflexion, pour voir le coup arriver
  setTimeout(() => {
    agir((s) => {
      if (s.status !== 'jeu' || s.coup !== coup) return false;
      const bot = s.players[s.active];
      if (!bot || !bot.bot) return false;
      try {
        if (jouer(s, s.active, choixBot(s, s.active, bot.niveau))) return true;
      } catch (err) {
        console.error('Bot : erreur dans sa décision', err);
      }
      // secours : la première colonne encore libre
      return [3, 2, 4, 1, 5, 0, 6].some((c) => jouer(s, s.active, c));
    });
  }, 600 + Math.random() * 400);
}

const botDoitJouer = () => { const a = etat.players[etat.active]; return !!a && !!a.bot; };

// Surveillant : si un bot doit jouer et que rien n'a bougé depuis un moment (coup perdu, mise en veille,
// coupure réseau…), on reprogramme son coup. Un coup en double est sans risque : le compteur `coup` l'empêche.
let dernierChangement = Date.now();
let dernierCoupConnu = null;
function noterChangement() {
  const cle = `${etat && etat.mainNo}-${etat && etat.coup}-${etat && etat.status}`;
  if (cle !== dernierCoupConnu) { dernierCoupConnu = cle; dernierChangement = Date.now(); }
}
setInterval(() => {
  if (!etat || etat.status !== 'jeu' || !botDoitJouer()) return;
  const occupe = false;
  if (occupe || Date.now() - dernierChangement < 3000) return;
  dernierChangement = Date.now();
  botPrevu = '';
  planifierBot();
}, 1500);


const monTour = () => etat && etat.status === 'jeu' && etat.active === maPlace && !etat.players[maPlace].bot;

function choisirColonne(c) {
  if (!monTour() || ligneLibre(etat.grille, c) < 0) return;
  agir((s) => jouer(s, maPlace, c));
}

$('btn-rejouer').addEventListener('click', () => {
  agir((s) => { if (s.status !== 'fin') return false; nouvelleManche(s); });
});

// =====================================================================
// Affichage
// =====================================================================
const COULEUR = ['rouge', 'jaune'];
const grilleEl = $('grille');
let casesEls = null;
let survolColonne = -1;

function construireGrille() {
  grilleEl.innerHTML = '';
  casesEls = [];
  for (let l = 0; l < LIGNES; l++) {
    for (let c = 0; c < COLONNES; c++) {
      const trou = el('div', 'trou');
      trou.dataset.c = String(c);
      trou.setAttribute('role', 'gridcell');
      trou.appendChild(el('span', 'jeton'));
      grilleEl.appendChild(trou);
      casesEls.push(trou);
    }
  }
  // Toucher n'importe quelle case d'une colonne y fait tomber le jeton
  grilleEl.addEventListener('click', (e) => {
    const t = e.target.closest('.trou');
    if (t) choisirColonne(Number(t.dataset.c));
  });
  grilleEl.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const t = e.target.closest('.trou');
    const c = t ? Number(t.dataset.c) : -1;
    if (c !== survolColonne) { survolColonne = c; rendreSurvol(); }
  });
  grilleEl.addEventListener('pointerleave', () => { survolColonne = -1; rendreSurvol(); });
}

function rendreSurvol() {
  if (!casesEls) return;
  const tour = monTour();
  casesEls.forEach((e, k) => {
    const c = k % COLONNES;
    e.classList.toggle('colonne-visee', tour && c === survolColonne && ligneLibre(etat.grille, c) >= 0);
  });
}

function rendreGrille() {
  if (!casesEls) construireGrille();
  const nouveau = etat.dernier && `${etat.coup}` !== dernierCoupVu && dernierCoupVu !== null;
  const gagnantes = new Set(etat.ligne || []);
  etat.grille.forEach((v, k) => {
    const trou = casesEls[k];
    const jeton = trou.firstChild;
    jeton.className = 'jeton' + (v ? ' ' + COULEUR[v - 1] : '');
    trou.classList.toggle('gagnante', gagnantes.has(k));
    trou.setAttribute('aria-label', v ? `Jeton ${COULEUR[v - 1]}` : 'Case vide');
  });
  // Le dernier jeton tombe depuis le haut de la colonne
  if (nouveau) {
    const { l, c } = etat.dernier;
    const jeton = casesEls[idx(l, c)].firstChild;
    jeton.style.setProperty('--chute', String(l + 1));
    jeton.classList.add('tombe');
  }
  dernierCoupVu = `${etat.coup}`;
  grilleEl.classList.toggle('a-moi', monTour());
  rendreSurvol();
}

function rendreScores() {
  const zone = $('scores');
  zone.innerHTML = '';
  etat.players.forEach((p, i) => {
    const bloc = el('div', 'score-joueur ' + COULEUR[i]);
    if (etat.status === 'jeu' && etat.active === i) bloc.classList.add('actif');
    bloc.appendChild(el('span', 'pastille-jeton ' + COULEUR[i]));
    const moi = !salon.estLocal() && i === maPlace ? ' (toi)' : '';
    bloc.appendChild(el('span', 'nom', p.name + moi));
    bloc.appendChild(el('strong', 'victoires', String(p.victoires)));
    zone.appendChild(bloc);
  });
}

function rendreStatut() {
  const st = $('statut');
  const actif = etat.players[etat.active];
  if (etat.status === 'fin') {
    if (etat.gagnant < 0) st.textContent = 'Grille pleine : match nul !';
    else {
      const g = etat.players[etat.gagnant];
      st.textContent = !salon.estLocal() && etat.gagnant === maPlace ? 'Tu as gagné la manche !' : `Victoire ${de(g.name)} !`;
    }
  } else if (monTour()) {
    st.textContent = salon.estLocal() ? `${actif.name}, à toi de jouer` : 'À toi de jouer';
  } else {
    st.textContent = actif.bot ? `${actif.name} réfléchit…` : `Au tour ${de(actif.name)}`;
  }
  st.className = 'statut ' + (etat.status === 'jeu' ? COULEUR[etat.active] : '');
  $('panneau-fin').hidden = etat.status !== 'fin';
}

function rendre() {
  if (!etat) return;
  rendreScores();
  rendreStatut();
  rendreGrille();
}
