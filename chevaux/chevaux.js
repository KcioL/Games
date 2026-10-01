import { $, el, toast, initSalon, initRegles, de } from '../commun/salon.js';

// =====================================================================
// Plateau : grille de 15 × 15, parcours de 56 cases en forme de croix
// =====================================================================
function construireParcours() {
  const c = [];
  for (let r = 6; r >= 0; r--) c.push([r, 6]);     // montée à gauche du bras du haut
  c.push([0, 7]);                                  // bout du bras du haut
  for (let r = 0; r <= 6; r++) c.push([r, 8]);     // descente à droite
  for (let k = 9; k <= 14; k++) c.push([6, k]);    // vers la droite
  c.push([7, 14]);                                 // bout du bras de droite
  for (let k = 14; k >= 8; k--) c.push([8, k]);    // retour vers le centre
  for (let r = 9; r <= 14; r++) c.push([r, 8]);    // descente
  c.push([14, 7]);                                 // bout du bras du bas
  for (let r = 14; r >= 8; r--) c.push([r, 6]);    // remontée
  for (let k = 5; k >= 0; k--) c.push([8, k]);     // vers la gauche
  c.push([7, 0]);                                  // bout du bras de gauche
  for (let k = 0; k <= 5; k++) c.push([6, k]);     // retour vers le centre
  return c;
}
const PARCOURS = construireParcours();          // 56 cases
const TOUR = PARCOURS.length;
const ENTREE = 55;                              // case devant l'escalier (position relative)
const CENTRE = 62;                              // 56 à 61 = marches 1 à 6, 62 = arrivé
const ECURIE = -1;

// Les 4 couleurs, dans le sens des aiguilles d'une montre
const COULEURS = [
  { nom: 'Rouge', cle: 'rouge', depart: 50, ecurie: [0, 0], escalier: (m) => [7, m] },        // en haut à gauche
  { nom: 'Vert', cle: 'vert', depart: 8, ecurie: [0, 9], escalier: (m) => [m, 7] },            // en haut à droite
  { nom: 'Jaune', cle: 'jaune', depart: 22, ecurie: [9, 9], escalier: (m) => [7, 14 - m] },   // en bas à droite
  { nom: 'Bleu', cle: 'bleu', depart: 36, ecurie: [9, 0], escalier: (m) => [14 - m, 7] },     // en bas à gauche
];
// Couleurs attribuées selon le nombre de joueurs (à deux : couleurs opposées)
const COULEURS_PAR_NB = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

const caseAbsolue = (couleur, pos) => (COULEURS[couleur].depart + pos) % TOUR;

// =====================================================================
// Règles
// =====================================================================
function normaliser(s) {
  s.players = s.players || [];
  s.players.forEach((p) => { p.chevaux = p.chevaux || []; });
  return s;
}

// Cheval présent sur une case du parcours (hors écurie et escaliers)
function occupant(s, abs, sauf) {
  for (let i = 0; i < s.players.length; i++) {
    const p = s.players[i];
    for (let h = 0; h < p.chevaux.length; h++) {
      if (sauf && sauf[0] === i && sauf[1] === h) continue;
      const pos = p.chevaux[h];
      if (pos >= 0 && pos <= ENTREE && caseAbsolue(p.couleur, pos) === abs) return [i, h];
    }
  }
  return null;
}

// Déplacement du cheval h du joueur i avec le dé d : { pos, prise } ou null si impossible
function mouvement(s, i, h, d) {
  const p = s.players[i];
  const pos = p.chevaux[h];
  const coul = p.couleur;
  const abs = (rel) => caseAbsolue(coul, rel);
  const propreMarche = (m) => p.chevaux.some((x, k) => k !== h && x === m);

  if (pos === CENTRE) return null;

  if (pos === ECURIE) {
    if (d !== 6) return null;
    const occ = occupant(s, abs(0));
    if (occ && occ[0] === i) return null;
    return { pos: 0, prise: occ };
  }

  if (pos === ENTREE) {
    if (d !== 1 || propreMarche(56)) return null;
    return { pos: 56 };
  }

  if (pos > ENTREE) {
    // Dans l'escalier : marche m (1 à 6), il faut faire m + 1 ; de la marche 6, un 6 pour le centre
    const marche = pos - ENTREE;
    if (marche === 6) return d === 6 ? { pos: CENTRE } : null;
    if (d !== marche + 1 || propreMarche(pos + 1)) return null;
    return { pos: pos + 1 };
  }

  // Sur le parcours : interdiction de doubler un cheval
  const cible = pos + d;
  const jusque = Math.min(cible, ENTREE);
  for (let k = pos + 1; k <= jusque; k++) {
    if (k === cible) break; // la case d'arrivée est traitée plus bas
    if (occupant(s, abs(k), [i, h])) return null;
  }
  // Points en trop avant l'escalier : on recule d'autant
  const arrivee = cible > ENTREE ? 2 * ENTREE - cible : cible;
  if (arrivee === pos) return null;
  const occ = occupant(s, abs(arrivee), [i, h]);
  if (occ && occ[0] === i) return null;
  return { pos: arrivee, prise: occ };
}

// Le dé dépasse la case devant l'escalier : le cheval y va puis recule du surplus
function estRebond(avant, d, apres) {
  return avant >= 0 && avant <= ENTREE && avant + d > ENTREE && apres <= ENTREE;
}

function coupsPossibles(s, i, d) {
  const coups = [];
  s.players[i].chevaux.forEach((_, h) => {
    const m = mouvement(s, i, h, d);
    if (m) coups.push({ h, ...m });
  });
  return coups;
}

function joueurSuivant(s) {
  s.active = (s.active + 1) % s.players.length;
  s.phase = 'lancer';
}

function nouvellePartie(s) {
  const n = s.players.length;
  const couleurs = COULEURS_PAR_NB[n];
  s.players.forEach((p, i) => {
    p.couleur = couleurs[i];
    p.chevaux = new Array(s.nbChevaux).fill(ECURIE);
  });
  s.status = 'jeu';
  s.active = Math.floor(Math.random() * n);
  s.phase = 'lancer';
  s.de = 0;
  s.coup = 0;
  s.dernier = `${s.players[s.active].name} commence.`;
  s.bouge = null;
  s.gagnant = null;
}

// Lancer du dé par le joueur i
function lancer(s, i) {
  if (s.status !== 'jeu' || s.active !== i || s.phase !== 'lancer') return false;
  const d = 1 + Math.floor(Math.random() * 6);
  const p = s.players[i];
  s.de = d;
  s.lancers = (s.lancers || 0) + 1;
  s.coup = (s.coup || 0) + 1;
  s.bouge = null;
  const coups = coupsPossibles(s, i, d);
  if (coups.length === 0) {
    if (d === 6) {
      s.dernier = `${p.name} fait 6, mais aucun cheval ne peut bouger. Il rejoue.`;
      s.phase = 'lancer';
    } else {
      s.dernier = `${p.name} fait ${d} : aucun cheval ne peut bouger.`;
      joueurSuivant(s);
    }
    return true;
  }
  s.phase = 'choisir';
  s.dernier = `${p.name} fait ${d}.`;
  return true;
}

// Le joueur i déplace son cheval h
function deplacer(s, i, h) {
  if (s.status !== 'jeu' || s.active !== i || s.phase !== 'choisir') return false;
  const m = mouvement(s, i, h, s.de);
  if (!m) return false;
  const p = s.players[i];
  const avant = p.chevaux[h];
  p.chevaux[h] = m.pos;
  s.coup = (s.coup || 0) + 1;
  s.bouge = { i, h, de: avant, a: m.pos };
  let texte;
  if (avant === ECURIE) texte = `${p.name} sort un cheval.`;
  else if (m.pos === CENTRE) texte = `${p.name} amène un cheval au centre !`;
  else if (m.pos > ENTREE) texte = `${p.name} monte à la marche ${m.pos - ENTREE}.`;
  else if (m.pos === ENTREE) texte = `${p.name} arrive devant son escalier.`;
  else if (estRebond(avant, s.de, m.pos)) {
    const recul = avant + s.de - ENTREE;
    texte = `${p.name} va jusqu'à son escalier puis recule de ${recul} (${recul > 1 ? 'points' : 'point'} en trop).`;
  } else texte = `${p.name} avance de ${s.de}.`;
  if (m.prise) {
    const [j, k] = m.prise;
    s.players[j].chevaux[k] = ECURIE;
    texte = `${p.name} renvoie un cheval ${de(s.players[j].name)} à l'écurie !`;
    s.lastEvent = { ts: Date.now(), texte };
  }
  if (p.chevaux.every((x) => x === CENTRE)) {
    s.status = 'fin';
    s.gagnant = i;
    s.dernier = `${p.name} a amené tous ses chevaux au centre !`;
    return true;
  }
  if (s.de === 6) {
    s.phase = 'lancer';
    texte += ' Il a fait 6 : il rejoue.';
  } else {
    joueurSuivant(s);
  }
  s.dernier = texte;
  return true;
}

// =====================================================================
// Bots
// =====================================================================
function choixBot(s, i) {
  const coups = coupsPossibles(s, i, s.de);
  let meilleur = null;
  let meilleurScore = -Infinity;
  coups.forEach((c) => {
    const avant = s.players[i].chevaux[c.h];
    let score = Math.random() * 8;
    if (c.prise) score += 100;
    if (avant === ECURIE) score += 70;
    if (c.pos === CENTRE) score += 90;
    else if (c.pos > ENTREE) score += 60;
    else if (c.pos === ENTREE) score += 55;
    if (c.pos < avant && avant !== ECURIE && c.pos <= ENTREE) score -= 40; // éviter de reculer
    score += Math.max(0, c.pos) * 0.4; // faire avancer le cheval le plus avancé
    if (score > meilleurScore) { meilleurScore = score; meilleur = c; }
  });
  return meilleur ? meilleur.h : -1;
}

// =====================================================================
// Salon
// =====================================================================
let etat = null;
let maPlace = 0;
let botPrevu = '';
let dernierTs = null;
let premiereSynchro = true;
let animationDe = null;

const lireNombre = (id) => parseInt($(id).value, 10) || 0;

const salon = initSalon({
  jeu: 'chevaux',
  etatInitial: (nom, nb, { local }) => {
    const bots = lireNombre(local ? 'local-bots' : 'nb-bots');
    const nbChevaux = lireNombre(local ? 'local-chevaux' : 'nb-chevaux') || 4;
    const joueurs = Array.from({ length: nb }, (_, i) => ({ name: i === 0 ? nom : 'En attente', joined: i === 0, bot: false }));
    for (let k = 1; k <= bots; k++) joueurs.push({ name: `Bot ${k}`, joined: true, bot: true });
    return { players: joueurs, nbChevaux };
  },
  validerLocal: () => {
    const total = lireNombre('local-nb') + lireNombre('local-bots');
    if (total < 2) return 'Il faut au moins 2 joueurs : ajoute un bot ou un joueur.';
    if (total > 4) return '4 places maximum autour du plateau.';
    return '';
  },
  validerEnLigne: () => {
    const total = lireNombre('nb-joueurs') + lireNombre('nb-bots');
    if (total > 4) return '4 places maximum : enlève un bot ou un joueur.';
    return '';
  },
  demarrer: (s) => { normaliser(s); nouvellePartie(s); },
  afficher: (s, place) => {
    etat = normaliser(s);
    maPlace = place;
    noterChangement();
    rendre();
    planifierBot();
  },
  // Sur un seul téléphone : rien à cacher, l'écran suit le joueur humain dont c'est le tour
  quiDoitJouer: (s) => {
    const humains = (s.players || []).filter((p) => !p.bot);
    if (humains.length <= 1) return -1;
    if (s.status === 'jeu' && s.players[s.active] && !s.players[s.active].bot) return s.active;
    return -1;
  },
  secret: false,
});
initRegles();

function agir(fn) {
  return salon.agir((s) => fn(normaliser(s)));
}

// Les bots sont joués par l'appareil du premier joueur ; les autres prennent le relais
// après un délai si jamais il est déconnecté. Le compteur `coup` évite tout double coup.
function planifierBot() {
  if (!etat || etat.status !== 'jeu') return;
  const actif = etat.players[etat.active];
  if (!actif || !actif.bot) return;
  const moi = etat.players[maPlace];
  if (!moi || moi.bot) return;
  const cle = `${etat.coup}-${etat.active}-${etat.phase}`;
  if (botPrevu === cle) return;
  botPrevu = cle;
  const coup = etat.coup;
  const delai = (salon.estLocal() || maPlace === 0) ? 800 + Math.random() * 500 : 4000 + maPlace * 1500;
  setTimeout(() => {
    agir((s) => {
      if (s.status !== 'jeu' || s.coup !== coup) return false;
      const b = s.players[s.active];
      if (!b || !b.bot) return false;
      try {
        if (s.phase === 'lancer') return lancer(s, s.active);
        const h = choixBot(s, s.active);
        if (h >= 0 && deplacer(s, s.active, h)) return true;
      } catch (err) {
        console.error('Bot : erreur dans sa décision', err);
      }
      // secours : n'importe quel coup permis
      if (s.phase === 'choisir') return coupsPossibles(s, s.active, s.de).some((c) => deplacer(s, s.active, c.h));
      return false;
    });
  }, delai);
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
  const occupe = !!animationDe;
  if (occupe || Date.now() - dernierChangement < 3500) return;
  dernierChangement = Date.now();
  botPrevu = '';
  planifierBot();
}, 1500);


// ---------- Actions du joueur ----------
const monTour = () => etat && etat.status === 'jeu' && etat.active === maPlace && !etat.players[maPlace].bot;

$('btn-lancer').addEventListener('click', () => {
  if (!monTour() || etat.phase !== 'lancer') return;
  agir((s) => lancer(s, maPlace));
});
$('btn-rejouer').addEventListener('click', () => {
  agir((s) => { if (s.status !== 'fin') return false; nouvellePartie(s); });
});

function choisirCheval(h) {
  if (!monTour() || etat.phase !== 'choisir') return;
  agir((s) => deplacer(s, maPlace, h));
}

// =====================================================================
// Affichage
// =====================================================================
const plateau = $('plateau');
let caseEls = null;

function placer(e, r, c, hauteur = 1, largeur = 1) {
  e.style.gridRow = `${r + 1} / span ${hauteur}`;
  e.style.gridColumn = `${c + 1} / span ${largeur}`;
}

// Le décor du plateau ne change jamais : on le dessine une seule fois
function dessinerPlateau() {
  plateau.innerHTML = '';
  COULEURS.forEach((col) => {
    const e = el('div', `ecurie ${col.cle}`);
    placer(e, col.ecurie[0], col.ecurie[1], 6, 6);
    plateau.appendChild(e);
  });
  caseEls = PARCOURS.map(([r, c], k) => {
    const e = el('div', 'case');
    const couleurDepart = COULEURS.find((col) => col.depart === k);
    if (couleurDepart) { e.classList.add('depart', couleurDepart.cle); e.title = `Départ ${couleurDepart.nom}`; }
    const couleurEntree = COULEURS.find((col) => (col.depart + ENTREE) % TOUR === k);
    if (couleurEntree) e.classList.add('entree', couleurEntree.cle);
    placer(e, r, c);
    plateau.appendChild(e);
    return e;
  });
  COULEURS.forEach((col) => {
    for (let m = 1; m <= 6; m++) {
      const [r, c] = col.escalier(m);
      const e = el('div', `marche ${col.cle}`, String(m));
      placer(e, r, c);
      plateau.appendChild(e);
    }
  });
  const centre = el('div', 'centre-plateau');
  placer(centre, 7, 7);
  plateau.appendChild(centre);
  plateau.addEventListener('click', toucherPlateau);
}

// Position d'un cheval sur la grille
function coordonnees(p, h) {
  const col = COULEURS[p.couleur];
  const pos = p.chevaux[h];
  if (pos === ECURIE || pos === CENTRE) return null;
  if (pos <= ENTREE) return PARCOURS[caseAbsolue(p.couleur, pos)];
  return col.escalier(pos - ENTREE);
}

// Cases de la grille pour une position donnée d'un cheval (null : écurie)
function coordPosition(couleur, pos) {
  if (pos === ECURIE) return null;
  if (pos === CENTRE) return [7, 7];
  if (pos <= ENTREE) return PARCOURS[caseAbsolue(couleur, pos)];
  return COULEURS[couleur].escalier(pos - ENTREE);
}

// Chevaux jouables et leur case d'arrivée, pour retrouver ce que le doigt a touché
let cibles = [];

function rendrePlateau() {
  if (!caseEls) dessinerPlateau();
  plateau.querySelectorAll('.pion, .pion-ecurie, .arrives, .destination').forEach((e) => e.remove());
  const choisir = monTour() && etat.phase === 'choisir';
  const coups = choisir ? coupsPossibles(etat, maPlace, etat.de) : [];
  const jouables = new Set(coups.map((c) => c.h));
  cibles = [];

  etat.players.forEach((p, i) => {
    const col = COULEURS[p.couleur];
    if (!col) return;
    let enEcurie = 0;
    let arrives = 0;
    p.chevaux.forEach((pos, h) => {
      const jouable = i === maPlace && jouables.has(h);
      const pion = el(jouable ? 'button' : 'div', `pion ${col.cle}`);
      pion.dataset.joueur = String(i);
      pion.dataset.cheval = String(h);
      if (jouable) {
        pion.type = 'button';
        pion.classList.add('jouable');
        pion.setAttribute('aria-label', `Déplacer ce cheval ${col.nom.toLowerCase()}`);
      }
      if (etat.bouge && etat.bouge.i === i && etat.bouge.h === h) pion.classList.add('vient-de-bouger');
      if (jouable) cibles.push({ h, pion });
      if (pos === ECURIE) {
        // 4 emplacements dans l'écurie, en carré
        const [r0, c0] = col.ecurie;
        const dr = enEcurie < 2 ? 1 : 3;
        const dc = enEcurie % 2 === 0 ? 1 : 3;
        enEcurie++;
        pion.classList.add('dans-ecurie');
        placer(pion, r0 + dr, c0 + dc, 2, 2);
        plateau.appendChild(pion);
      } else if (pos === CENTRE) {
        arrives++;
      } else {
        const [r, c] = coordonnees(p, h);
        placer(pion, r, c);
        plateau.appendChild(pion);
      }
    });
    if (arrives) {
      // Chevaux arrivés : affichés dans un coin de l'écurie
      const [r0, c0] = col.ecurie;
      const badge = el('div', `arrives ${col.cle}`, `${arrives} au centre`);
      placer(badge, r0 + 5, c0, 1, 6);
      plateau.appendChild(badge);
    }
  });

  // Case d'arrivée de chaque coup possible ; anneau rouge si un adversaire y sera éjecté
  const couleur = etat.players[maPlace] && etat.players[maPlace].couleur;
  const dejaMarquees = new Set();
  coups.forEach((c) => {
    const rc = coordPosition(couleur, c.pos);
    if (!rc) return;
    const cle = rc.join(',');
    const cible = cibles.find((x) => x.h === c.h);
    if (dejaMarquees.has(cle)) return; // deux chevaux, même arrivée : on touche alors le cheval
    dejaMarquees.add(cle);
    const avant = etat.players[maPlace].chevaux[c.h];
    const rebond = estRebond(avant, etat.de, c.pos);
    const d = el('div', `destination ${COULEURS[couleur].cle}` + (c.prise ? ' prise' : '') + (rebond ? ' rebond' : ''), rebond ? '↩' : undefined);
    if (rebond) d.title = 'Points en trop : le cheval va jusqu\'à l\'escalier puis recule';
    placer(d, rc[0], rc[1]);
    plateau.appendChild(d);
    if (cible) cible.dest = d;
  });
}

// Le cheval qui vient de bouger parcourt son chemin case par case (y compris le rebond)
let dernierCoupAnime = null;
let jetonAnimation = 0;
const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function cheminDe(avant, apres, d) {
  if (avant < 0 || apres === ECURIE) return [];
  const chemin = [];
  if (estRebond(avant, d, apres)) {
    for (let k = avant + 1; k <= ENTREE; k++) chemin.push(k);
    for (let k = ENTREE - 1; k >= apres; k--) chemin.push(k);
  } else {
    for (let k = avant + 1; k <= apres; k++) chemin.push(k);
  }
  return chemin;
}

function animerDeplacement() {
  const b = etat.bouge;
  const cle = `${etat.coup}`;
  const premiere = dernierCoupAnime === null;
  if (dernierCoupAnime === cle) return;
  dernierCoupAnime = cle;
  if (premiere || mouvementReduit || !b || b.de === undefined) return;
  const p = etat.players[b.i];
  const chemin = cheminDe(b.de, b.a, etat.de);
  if (chemin.length < 2) return;
  const pion = plateau.querySelector(`.pion[data-joueur="${b.i}"][data-cheval="${b.h}"]`);
  if (!pion) return;
  const jeton = ++jetonAnimation;
  const depart = coordPosition(p.couleur, b.de);
  if (depart) placer(pion, depart[0], depart[1]);
  pion.classList.add('en-route');
  chemin.forEach((pos, k) => {
    setTimeout(() => {
      if (jeton !== jetonAnimation || !pion.isConnected) return;
      const rc = coordPosition(p.couleur, pos);
      if (rc) placer(pion, rc[0], rc[1]);
      if (k === chemin.length - 1) pion.classList.remove('en-route');
    }, (k + 1) * 95);
  });
}

// Un toucher sur le plateau choisit le cheval (ou la case d'arrivée) le plus proche du doigt
function toucherPlateau(e) {
  if (!cibles.length) return;
  if (e.detail === 0) {
    // Clavier (Entrée / Espace sur un cheval) : pas de coordonnées, on prend le cheval focalisé
    const b = e.target.closest && e.target.closest('.pion.jouable');
    if (b) choisirCheval(Number(b.dataset.cheval));
    return;
  }
  const taille = plateau.getBoundingClientRect().width / 15;
  let choix = null;
  let distanceMin = Infinity;
  cibles.forEach((c) => {
    [c.pion, c.dest].forEach((elt) => {
      if (!elt) return;
      const r = elt.getBoundingClientRect();
      const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      if (dist < distanceMin) { distanceMin = dist; choix = c; }
    });
  });
  if (choix && distanceMin <= taille * 1.2) choisirCheval(choix.h);
}

const POINTS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
function dessinerDe(valeur, couleur) {
  const d = $('de');
  d.className = 'de' + (couleur ? ' ' + couleur : '');
  d.innerHTML = '';
  for (let k = 1; k <= 9; k++) {
    const point = el('span');
    if (valeur && POINTS[valeur].includes(k)) point.className = 'point';
    d.appendChild(point);
  }
  d.setAttribute('aria-label', valeur ? `Dé : ${valeur}` : 'Dé pas encore lancé');
}

let dernierCoupDe = null;
function rendrePanneau() {
  const actif = etat.players[etat.active];
  const couleurActive = actif && COULEURS[actif.couleur] ? COULEURS[actif.couleur].cle : '';
  const statut = $('statut');
  statut.innerHTML = '';
  if (etat.status === 'jeu') {
    const pastille = el('span', `pastille ${couleurActive}`);
    statut.appendChild(pastille);
    if (monTour()) {
      const nom = salon.estLocal() ? `${actif.name}, ` : '';
      statut.append(etat.phase === 'lancer' ? `${nom}à toi de lancer le dé` : `${nom}touche un cheval ou sa case d'arrivée`);
    } else {
      statut.append(actif.bot ? `${actif.name} joue…` : `Au tour ${de(actif.name)}`);
    }
  }

  // Dé : il « roule » un instant à chaque nouveau lancer
  const lancers = etat.lancers || 0;
  if (dernierCoupDe !== null && lancers !== dernierCoupDe && etat.de) {
    clearInterval(animationDe);
    let n = 0;
    animationDe = setInterval(() => {
      dessinerDe(1 + Math.floor(Math.random() * 6), couleurActive);
      if (++n >= 6) { clearInterval(animationDe); animationDe = null; dessinerDe(etat.de, couleurActive); }
    }, 55);
  } else if (!animationDe) {
    dessinerDe(etat.de, couleurActive);
  }
  dernierCoupDe = lancers;

  const btn = $('btn-lancer');
  btn.disabled = !(monTour() && etat.phase === 'lancer');
  btn.textContent = monTour() && etat.phase === 'choisir' ? 'Touche un cheval' : 'Lancer le dé';
  $('dernier').textContent = etat.dernier || '';

  const liste = $('joueurs');
  liste.innerHTML = '';
  etat.players.forEach((p, i) => {
    const col = COULEURS[p.couleur];
    const li = el('li', col ? col.cle : '');
    if (etat.status === 'jeu' && i === etat.active) li.classList.add('actif');
    li.appendChild(el('span', `pastille ${col ? col.cle : ''}`));
    const nom = el('span', 'nom', p.name + (!salon.estLocal() && i === maPlace ? ' (toi)' : ''));
    li.appendChild(nom);
    const arrives = p.chevaux.filter((x) => x === CENTRE).length;
    li.appendChild(el('span', 'score', `${arrives}/${p.chevaux.length} au centre`));
    liste.appendChild(li);
  });

  const fin = $('fin');
  if (etat.status === 'fin') {
    const g = etat.players[etat.gagnant];
    $('fin-titre').textContent = !salon.estLocal() && etat.gagnant === maPlace ? 'Tu as gagné !' : `Victoire ${de(g.name)} !`;
    $('fin-texte').textContent = `${g.name} a amené tous ses chevaux au centre.`;
    fin.hidden = false;
  } else {
    fin.hidden = true;
  }
}

function rendre() {
  if (!etat || !etat.players.length || etat.players[0].couleur === undefined) return;
  const ev = etat.lastEvent || null;
  if (premiereSynchro) {
    premiereSynchro = false;
    dernierTs = ev ? ev.ts : null;
  } else if (ev && ev.ts !== dernierTs) {
    dernierTs = ev.ts;
    toast(ev.texte, true);
  }
  rendrePlateau();
  animerDeplacement();
  rendrePanneau();
}

