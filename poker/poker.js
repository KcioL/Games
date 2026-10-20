import { $, el, toast, initSalon, initRegles, de } from '../commun/salon.js';
import { nouveauPaquet } from '../commun/cartes.js';

const PETITE_BLINDE = 10;
const GROSSE_BLINDE = 20;
const JETONS_DEPART = 1000;
const RECAVE = 1000;

// espace insécable : le « € » ne passe jamais seul à la ligne
const euros = (n) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const arrondi10 = (n) => Math.round(n / 10) * 10;

// =====================================================================
// Évaluation des mains
// =====================================================================
const RANGS = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13, A: 14 };

// Score d'une main de 5 cartes : [catégorie, départages...], comparable élément par élément
function evaluer5(cartes) {
  const r = cartes.map((c) => RANGS[c.v]).sort((a, b) => b - a);
  const couleur = cartes.every((c) => c.s === cartes[0].s);
  let hauteurQuinte = 0;
  if (new Set(r).size === 5) {
    if (r[0] - r[4] === 4) hauteurQuinte = r[0];
    else if (r.join(',') === '14,5,4,3,2') hauteurQuinte = 5; // quinte As-2-3-4-5
  }
  const comptes = {};
  r.forEach((x) => { comptes[x] = (comptes[x] || 0) + 1; });
  const groupes = Object.entries(comptes)
    .map(([v, n]) => [n, Number(v)])
    .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const ordre = groupes.map((g) => g[1]);

  if (hauteurQuinte && couleur) return [8, hauteurQuinte];
  if (groupes[0][0] === 4) return [7, ...ordre];
  if (groupes[0][0] === 3 && groupes[1][0] === 2) return [6, ...ordre];
  if (couleur) return [5, ...r];
  if (hauteurQuinte) return [4, hauteurQuinte];
  if (groupes[0][0] === 3) return [3, ...ordre];
  if (groupes[0][0] === 2 && groupes[1][0] === 2) return [2, ...ordre];
  if (groupes[0][0] === 2) return [1, ...ordre];
  return [0, ...r];
}

function comparer(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Meilleure main de 5 cartes parmi 5 à 7
function meilleureMain(cartes) {
  let meilleur = null;
  const n = cartes.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++)
    for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const sc = evaluer5([cartes[a], cartes[b], cartes[c], cartes[d], cartes[e]]);
      if (!meilleur || comparer(sc, meilleur) > 0) meilleur = sc;
    }
  return meilleur;
}

const NOMS = { 14: 'As', 13: 'Roi', 12: 'Dame', 11: 'Valet' };
const nomRang = (r) => NOMS[r] || String(r);
const pluriel = (r) => (r === 14 ? 'As' : (NOMS[r] ? NOMS[r] + 's' : String(r)));
const deRang = (r) => (r === 14 ? "d'As" : `de ${pluriel(r)}`);
const auRang = (r) => (r === 14 ? "à l'As" : `au ${nomRang(r)}`);

function nomMain(sc) {
  const [cat, a, b] = sc;
  switch (cat) {
    case 8: return a === 14 ? 'Quinte flush royale' : `Quinte flush ${auRang(a)}`;
    case 7: return `Carré ${deRang(a)}`;
    case 6: return `Full aux ${pluriel(a)} par les ${pluriel(b)}`;
    case 5: return `Couleur ${auRang(a)}`;
    case 4: return `Quinte ${auRang(a)}`;
    case 3: return `Brelan ${deRang(a)}`;
    case 2: return `Double paire ${pluriel(a)} et ${pluriel(b)}`;
    case 1: return `Paire ${deRang(a)}`;
    default: return `Hauteur ${nomRang(a)}`;
  }
}

// Paires/brelans sur un nombre quelconque de cartes (pour les bots)
function categorieSimple(cartes) {
  const comptes = {};
  cartes.forEach((c) => { comptes[c.v] = (comptes[c.v] || 0) + 1; });
  const n = Object.values(comptes).sort((x, y) => y - x);
  if (n[0] >= 4) return 7;
  if (n[0] === 3 && n[1] >= 2) return 6;
  if (n[0] === 3) return 3;
  if (n[0] === 2 && n[1] === 2) return 2;
  if (n[0] === 2) return 1;
  return 0;
}

// =====================================================================
// Déroulement d'une main
// =====================================================================
function normaliser(s) {
  s.players = s.players || [];
  s.deck = s.deck || [];
  s.board = s.board || [];
  s.players.forEach((p) => {
    p.cartes = p.cartes || [];
    p.chips = p.chips || 0;
    p.mise = p.mise || 0;
    p.engage = p.engage || 0;
    p.reloads = p.reloads || 0;
    p.gain = p.gain || 0;
  });
  s.miseMax = s.miseMax || 0;
  return s;
}

const potTotal = (s) => s.players.reduce((a, p) => a + p.engage, 0);

function poser(p, montant) {
  const m = Math.min(montant, p.chips);
  p.chips -= m;
  p.mise += m;
  p.engage += m;
  if (p.chips === 0 && p.etat === 'actif') p.etat = 'tapis';
  return m;
}

function nouvelleMain(s) {
  const n = s.players.length;
  s.mainNo = (s.mainNo || 0) + 1;
  s.donneur = s.mainNo === 1 ? Math.floor(Math.random() * n) : (s.donneur + 1) % n;
  const recaves = [];
  s.players.forEach((p) => {
    if (p.chips < GROSSE_BLINDE) {
      p.chips += RECAVE;
      p.reloads += 1;
      recaves.push(p.name);
    }
    Object.assign(p, { cartes: [], etat: 'actif', mise: 0, engage: 0, aAgi: false, derniere: '', main: '', gain: 0 });
  });
  s.deck = nouveauPaquet(1);
  s.board = [];
  s.street = 0;
  s.montrer = false;
  s.resultat = null;
  s.coup = 0;
  s.status = 'jeu';
  for (let tour = 0; tour < 2; tour++) s.players.forEach((p) => p.cartes.push(s.deck.pop()));

  // Blindes (à deux, le donneur pose la petite blinde)
  const pb = n === 2 ? s.donneur : (s.donneur + 1) % n;
  const gb = (pb + 1) % n;
  poser(s.players[pb], PETITE_BLINDE);
  s.players[pb].derniere = 'Petite blinde';
  poser(s.players[gb], GROSSE_BLINDE);
  s.players[gb].derniere = 'Grosse blinde';
  s.miseMax = Math.max(...s.players.map((p) => p.mise));
  s.relanceMin = GROSSE_BLINDE;
  s.lastEvent = recaves.length
    ? { ts: Date.now(), textes: recaves.map((nom) => `${nom} est recavé de ${euros(RECAVE)}.`) }
    : null;
  continuer(s, gb);
}

const doitAgir = (s, p) => p.etat === 'actif' && (!p.aAgi || p.mise < s.miseMax);

// Passe la main au prochain joueur qui doit parler, ou clôt le tour d'enchères
function continuer(s, depuis) {
  const n = s.players.length;
  const vivants = s.players.filter((p) => p.etat !== 'couche');
  if (vivants.length === 1) { gagnerSansAbattage(s, vivants[0]); return; }
  const actifs = s.players.filter((p) => p.etat === 'actif');
  // Un seul joueur peut encore miser et il a suivi : plus rien à décider
  if (actifs.length === 0 || (actifs.length === 1 && actifs[0].mise >= s.miseMax)) { fermerTour(s); return; }
  for (let k = 1; k <= n; k++) {
    const i = (depuis + k) % n;
    if (doitAgir(s, s.players[i])) { s.active = i; return; }
  }
  fermerTour(s);
}

function fermerTour(s) {
  s.players.forEach((p) => {
    p.mise = 0;
    p.aAgi = false;
    if (p.etat === 'actif') p.derniere = '';
  });
  s.miseMax = 0;
  s.relanceMin = GROSSE_BLINDE;
  const actifs = s.players.filter((p) => p.etat === 'actif');
  if (s.street >= 3 || actifs.length <= 1) {
    // Plus d'enchères possibles : on pose les cartes restantes et on abat
    while (s.board.length < 5) s.board.push(s.deck.pop());
    abattage(s);
    return;
  }
  s.street += 1;
  if (s.street === 1) s.board.push(s.deck.pop(), s.deck.pop(), s.deck.pop());
  else s.board.push(s.deck.pop());
  continuer(s, s.donneur);
}

function gagnerSansAbattage(s, gagnant) {
  const total = potTotal(s);
  gagnant.chips += total;
  gagnant.gain = total;
  s.players.forEach((p) => { p.mise = 0; });
  s.montrer = false;
  s.status = 'fin';
  s.resultat = { texte: `${gagnant.name} remporte ${euros(total)}, tous les autres se sont couchés.` };
}

function abattage(s) {
  const n = s.players.length;
  const vivants = [];
  s.players.forEach((p, i) => {
    if (p.etat !== 'couche') {
      p.score = meilleureMain([...p.cartes, ...s.board]);
      p.main = nomMain(p.score);
      vivants.push(i);
    }
  });

  // Pots successifs selon ce que chacun a pu engager (pots secondaires)
  const gains = new Array(n).fill(0);
  const niveaux = [...new Set(vivants.map((i) => s.players[i].engage))].sort((a, b) => a - b);
  let precedent = 0;
  let distribue = 0;
  let derniersGagnants = [];
  niveaux.forEach((niveau) => {
    let montant = 0;
    s.players.forEach((p) => { montant += Math.max(0, Math.min(p.engage, niveau) - Math.min(p.engage, precedent)); });
    const eligibles = vivants.filter((i) => s.players[i].engage >= niveau);
    let meilleurs = [];
    eligibles.forEach((i) => {
      if (!meilleurs.length) meilleurs = [i];
      else {
        const c = comparer(s.players[i].score, s.players[meilleurs[0]].score);
        if (c > 0) meilleurs = [i];
        else if (c === 0) meilleurs.push(i);
      }
    });
    partager(s, gains, meilleurs, montant);
    distribue += montant;
    derniersGagnants = meilleurs;
    precedent = niveau;
  });
  // Mises de joueurs couchés au-delà du plus gros tapis restant
  const reste = potTotal(s) - distribue;
  if (reste > 0) partager(s, gains, derniersGagnants, reste);

  s.players.forEach((p, i) => { p.chips += gains[i]; p.gain = gains[i]; delete p.score; });
  s.montrer = true;
  s.status = 'fin';

  const gagnants = gains.map((g, i) => [g, i]).filter(([g]) => g > 0).sort((a, b) => b[0] - a[0]);
  if (gagnants.length === 1) {
    const [g, i] = gagnants[0];
    s.resultat = { texte: `${s.players[i].name} gagne ${euros(g)} avec : ${s.players[i].main}.` };
  } else {
    s.resultat = {
      texte: gagnants.map(([g, i]) => `${s.players[i].name} gagne ${euros(g)} (${s.players[i].main})`).join(' ; ') + '.',
    };
  }
}

// Partage équitable ; les jetons indivisibles vont au premier gagnant après le donneur
function partager(s, gains, gagnants, montant) {
  if (!gagnants.length || montant <= 0) return;
  const part = Math.floor(montant / gagnants.length);
  let reste = montant - part * gagnants.length;
  const n = s.players.length;
  const ordre = [...gagnants].sort((a, b) => ((a - s.donneur - 1 + n) % n) - ((b - s.donneur - 1 + n) % n));
  ordre.forEach((i) => {
    gains[i] += part + (reste > 0 ? 1 : 0);
    if (reste > 0) reste -= 1;
  });
}

// Joue une action pour le joueur i. Renvoie false si l'action n'est pas permise.
function jouer(s, i, action) {
  if (s.status !== 'jeu' || s.active !== i) return false;
  const p = s.players[i];
  if (p.etat !== 'actif') return false;
  const aSuivre = s.miseMax - p.mise;
  const maxPossible = p.mise + p.chips;

  if (action.type === 'coucher') {
    p.etat = 'couche';
    p.derniere = 'Couché';
  } else if (action.type === 'suivre') {
    if (aSuivre <= 0) p.derniere = 'Parole';
    else {
      poser(p, aSuivre);
      p.derniere = p.chips === 0 ? 'Tapis !' : `Suit ${euros(aSuivre)}`;
    }
  } else if (action.type === 'relancer' || action.type === 'tapis') {
    const cible = action.type === 'tapis' ? maxPossible : Math.min(action.cible, maxPossible);
    if (cible <= s.miseMax) {
      // Pas de quoi relancer : c'est un simple suivi (éventuellement à tapis)
      return jouer(s, i, { type: 'suivre' });
    }
    const minimum = s.miseMax + s.relanceMin;
    if (cible < minimum && cible < maxPossible) return false;
    const avant = s.miseMax;
    poser(p, cible - p.mise);
    const hausse = cible - avant;
    if (hausse >= s.relanceMin) {
      // Relance complète : tout le monde doit reparler
      s.relanceMin = hausse;
      s.players.forEach((q, k) => { if (k !== i && q.etat === 'actif') q.aAgi = false; });
    }
    s.miseMax = cible;
    if (p.chips === 0) p.derniere = 'Tapis !';
    else p.derniere = avant === 0 ? `Mise ${euros(cible)}` : `Relance à ${euros(cible)}`;
  } else {
    return false;
  }
  p.aAgi = true;
  s.coup = (s.coup || 0) + 1;
  continuer(s, i);
  return true;
}

// =====================================================================
// Bots
// =====================================================================
function decisionBot(s, i) {
  const p = s.players[i];
  const aSuivre = s.miseMax - p.mise;
  const pot = Math.max(potTotal(s), GROSSE_BLINDE * 2);
  const bluff = Math.random() < 0.12;
  let tolerance;
  let fort = false;

  if (s.board.length === 0) {
    // Avant le flop : on juge les deux cartes
    const [a, b] = p.cartes.map((c) => RANGS[c.v]);
    const paire = a === b;
    const hautes = [a, b].filter((r) => r >= 10).length;
    const assorties = p.cartes[0].s === p.cartes[1].s;
    if (paire && a >= 10) { tolerance = 600; fort = true; }
    else if (paire) tolerance = 160;
    else if (hautes === 2) { tolerance = 140; fort = Math.max(a, b) === 14; }
    else if (Math.max(a, b) === 14 || (assorties && Math.abs(a - b) === 1)) tolerance = 60;
    else tolerance = 25;
  } else {
    // Après le flop : la main compte seulement si elle fait mieux que les cartes communes seules
    const sc = meilleureMain([...p.cartes, ...s.board]);
    const surTable = s.board.length >= 5 ? meilleureMain(s.board)[0] : categorieSimple(s.board);
    const effectif = sc[0] > surTable ? sc[0] : 0;
    if (effectif >= 3) { tolerance = Infinity; fort = true; }
    else if (effectif === 2) tolerance = pot * 1.5 + 200;
    else if (effectif === 1) tolerance = pot * 0.6 + 60;
    else tolerance = 15;
  }

  const offensif = fort || (bluff && s.board.length > 0);
  const maxPossible = p.mise + p.chips;
  const relance = () => {
    const cible = arrondi10(s.miseMax + Math.max(s.relanceMin, pot * 0.6));
    if (cible >= maxPossible) return fort ? { type: 'tapis' } : { type: 'suivre' };
    return { type: 'relancer', cible };
  };

  if (aSuivre <= 0) {
    return offensif && Math.random() < 0.7 ? relance() : { type: 'suivre' };
  }
  if (offensif && Math.random() < 0.5) return relance();
  if (aSuivre <= tolerance || bluff) return { type: 'suivre' };
  return { type: 'coucher' };
}

// =====================================================================
// Salon
// =====================================================================
let etat = null;
let maPlace = 0;
let relanceCible = 0;
let botPrevu = '';
let dernierTs = null;
let premiereSynchro = true;

const salon = initSalon({
  jeu: 'poker',
  etatInitial: (nom, nb, { local }) => {
    const joueur = (name, joined, bot = false) => ({ name, joined, bot, chips: JETONS_DEPART, reloads: 0 });
    const joueurs = Array.from({ length: nb }, (_, i) => joueur(i === 0 ? nom : 'En attente', i === 0));
    if (local) {
      const bots = parseInt($('local-bots').value, 10) || 0;
      for (let k = 1; k <= bots; k++) joueurs.push(joueur(`Bot ${k}`, true, true));
    }
    return { players: joueurs };
  },
  validerLocal: () => {
    const total = parseInt($('local-nb').value, 10) + parseInt($('local-bots').value, 10);
    if (total < 2) return 'Il faut au moins 2 joueurs : ajoute un bot ou un joueur.';
    if (total > 6) return '6 places maximum autour de la table.';
    return '';
  },
  demarrer: (s) => { normaliser(s); nouvelleMain(s); },
  afficher: (s, place) => {
    if (place !== maPlace) relanceCible = 0;
    etat = normaliser(s);
    maPlace = place;
    noterChangement();
    rendre();
    planifierBot();
  },
  // Mode un seul téléphone : on passe le téléphone seulement entre joueurs humains
  quiDoitJouer: (s) => {
    const humains = (s.players || []).filter((p) => !p.bot);
    if (humains.length <= 1) return -1;
    if (s.status === 'jeu' && s.players[s.active] && !s.players[s.active].bot) return s.active;
    return -1;
  },
  secret: true,
});
initRegles();

function agir(fn) {
  return salon.agir((s) => fn(normaliser(s)));
}

function planifierBot() {
  if (!etat || etat.status !== 'jeu') return;
  const actif = etat.players[etat.active];
  if (!actif || !actif.bot) return;
  const cle = `${etat.mainNo}-${etat.coup}`;
  if (botPrevu === cle) return;
  botPrevu = cle;
  const coup = etat.coup;
  const mainNo = etat.mainNo;
  setTimeout(() => {
    agir((s) => {
      if (s.status !== 'jeu' || s.mainNo !== mainNo || s.coup !== coup) return false;
      const b = s.players[s.active];
      if (!b || !b.bot) return false;
      let ok = false;
      try {
        ok = jouer(s, s.active, decisionBot(s, s.active));
      } catch (err) {
        console.error('Bot : erreur dans sa décision', err);
      }
      // décision refusée : il suit, et en dernier recours il se couche (la partie ne bloque jamais)
      return ok || jouer(s, s.active, { type: 'suivre' }) || jouer(s, s.active, { type: 'coucher' });
    });
  }, 900 + Math.random() * 900);
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
  if (occupe || Date.now() - dernierChangement < 3500) return;
  dernierChangement = Date.now();
  botPrevu = '';
  planifierBot();
}, 1500);


// ---------- Actions du joueur ----------
const monTour = () => etat && etat.status === 'jeu' && etat.active === maPlace && etat.players[maPlace].etat === 'actif';

// Relance ouverte : un panneau posé sur le tapis, au-dessus des boutons (« Se coucher » et « Suivre » masqués :
// pas de clic par erreur)
function ouvrirRelance(ouvert) {
  $('relance').hidden = !ouvert;
  $('panneau-actions').classList.toggle('relance-ouverte', ouvert);
}

function action(a) {
  ouvrirRelance(false);
  agir((s) => jouer(s, maPlace, a));
}

$('btn-coucher').addEventListener('click', () => action({ type: 'coucher' }));
$('btn-suivre').addEventListener('click', () => action({ type: 'suivre' }));
$('btn-ouvrir-relance').addEventListener('click', () => {
  relanceCible = bornesRelance().min;
  ouvrirRelance(true);
  rendreRelance();
});
$('btn-annuler-relance').addEventListener('click', () => ouvrirRelance(false));
$('btn-relancer').addEventListener('click', () => {
  const { max } = bornesRelance();
  action(relanceCible >= max ? { type: 'tapis' } : { type: 'relancer', cible: relanceCible });
});
$('btn-moins').addEventListener('click', () => { relanceCible -= 10; rendreRelance(); });
$('btn-plus').addEventListener('click', () => { relanceCible += 10; rendreRelance(); });
$('relance-curseur').addEventListener('input', (e) => { relanceCible = parseInt(e.target.value, 10); rendreRelance(true); });
document.querySelectorAll('.raccourci').forEach((b) => b.addEventListener('click', () => {
  const { min, max } = bornesRelance();
  const p = etat.players[maPlace];
  const aSuivre = etat.miseMax - p.mise;
  const pot = potTotal(etat) + aSuivre;
  const cibles = { min, demi: etat.miseMax + pot / 2, pot: etat.miseMax + pot, tapis: max };
  relanceCible = arrondi10(cibles[b.dataset.rel]);
  if (b.dataset.rel === 'tapis') relanceCible = max;
  rendreRelance();
}));
$('btn-suivante').addEventListener('click', () => {
  agir((s) => { if (s.status !== 'fin') return false; nouvelleMain(s); });
});

function bornesRelance() {
  const p = etat.players[maPlace];
  const max = p.mise + p.chips;
  const min = Math.min(etat.miseMax + (etat.relanceMin || GROSSE_BLINDE), max);
  return { min, max };
}

// ---------- Affichage ----------
function rendreRelance(depuisCurseur = false) {
  const { min, max } = bornesRelance();
  relanceCible = Math.max(min, Math.min(max, relanceCible || min));
  $('relance-valeur').textContent = relanceCible >= max ? `Tapis (${euros(max)})` : euros(relanceCible);
  const curseur = $('relance-curseur');
  curseur.min = String(min);
  curseur.max = String(max);
  curseur.step = '10';
  if (!depuisCurseur) curseur.value = String(relanceCible);
  $('btn-moins').disabled = relanceCible <= min;
  $('btn-plus').disabled = relanceCible >= max;
  const verbe = etat.miseMax === 0 ? 'Miser' : 'Relancer à';
  $('btn-relancer').textContent = relanceCible >= max ? `Tapis (${euros(max)})` : `${verbe} ${euros(relanceCible)}`;
}


// hauteur de la barre du haut : la salle prend tout le reste de l'écran
function majHauteurBarre() {
  const b = document.querySelector('.barre');
  if (b) document.documentElement.style.setProperty('--h-barre', `${b.offsetHeight}px`);
}
window.addEventListener('resize', majHauteurBarre);
majHauteurBarre();

const sansAnimation = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ETAPES = ['Pré-flop', 'Flop', 'Turn', 'River'];

// ---------- Cartes et jetons dessinés comme au casino ----------
const FIGURES = { J: 'V', Q: 'D', K: 'R' };
const PIPS = {
  2: [[50, 0], [50, 100]],
  3: [[50, 0], [50, 50], [50, 100]],
  4: [[15, 0], [85, 0], [15, 100], [85, 100]],
  5: [[15, 0], [85, 0], [50, 50], [15, 100], [85, 100]],
  6: [[15, 0], [85, 0], [15, 50], [85, 50], [15, 100], [85, 100]],
  7: [[15, 0], [85, 0], [50, 25], [15, 50], [85, 50], [15, 100], [85, 100]],
  8: [[15, 0], [85, 0], [50, 25], [15, 50], [85, 50], [50, 75], [15, 100], [85, 100]],
  9: [[15, 0], [85, 0], [15, 33.3], [85, 33.3], [50, 50], [15, 66.7], [85, 66.7], [15, 100], [85, 100]],
  10: [[15, 0], [85, 0], [50, 16.7], [15, 33.3], [85, 33.3], [15, 66.7], [85, 66.7], [50, 83.3], [15, 100], [85, 100]],
};
function carteEl(c, { cachee = false } = {}) {
  const e = el('div', 'carte-pk');
  if (!c || cachee) {
    e.classList.add('dos');
    e.setAttribute('aria-label', 'Carte cachée');
    return e;
  }
  if (c.s === '♥' || c.s === '♦') e.classList.add('rouge');
  const v = FIGURES[c.v] || c.v;
  const indice = (bas) => {
    const i = el('span', 'indice' + (bas ? ' bas' : ''));
    i.append(el('b', '', v), el('i', '', c.s));
    return i;
  };
  const face = el('span', 'face');
  if (FIGURES[c.v]) {
    e.classList.add('figure');
    const cadre = el('span', 'cadre');
    cadre.append(el('b', '', v), el('i', '', c.s));
    face.appendChild(cadre);
  } else if (c.v === 'A') {
    e.classList.add('as');
    face.appendChild(el('i', 'pip', c.s));
  } else {
    PIPS[c.v].forEach(([x, y]) => {
      const p = el('i', 'pip' + (y > 50 ? ' renverse' : ''), c.s);
      p.style.left = `${x}%`;
      p.style.top = `${y}%`;
      face.appendChild(p);
    });
  }
  e.append(indice(false), face, indice(true));
  e.setAttribute('aria-label', `${v} ${c.s}`);
  return e;
}
const VALEURS_JETONS = [1000, 500, 100, 50, 10, 5];
function pileEl(montant) {
  const pile = el('div', 'pile');
  let reste = Math.round(montant);
  VALEURS_JETONS.forEach((d) => {
    const n = Math.floor(reste / d);
    reste -= n * d;
    if (!n) return;
    const col = el('span', 'colonne');
    for (let k = 0; k < Math.min(n, 9); k++) col.appendChild(el('i', `j j${d}`));
    pile.appendChild(col);
  });
  return pile;
}

// ---------- Places autour de la table ----------
// moi en bas au centre ; les autres répartis le long du bord, dans l'ordre du jeu (sens des aiguilles d'une montre)
function anglePlace(k, n) {
  if (k === 0) return 90;
  const m = n - 1;
  if (m === 1) return 270;
  const ecart = Math.min(240, 60 * m);
  return 270 - ecart / 2 + (ecart * (k - 1)) / (m - 1);
}
// point du bord de la table (forme de pilule : super-ellipse), en % de la table
function pointBord(angle, r = 1) {
  const a = (angle * Math.PI) / 180;
  const c = Math.cos(a); const s = Math.sin(a);
  const e = 2 / 2.7;
  return { x: 50 + 50 * r * Math.sign(c) * Math.abs(c) ** e, y: 50 + 50 * r * Math.sign(s) * Math.abs(s) ** e };
}

const soldesAffiches = [];
let potEmporte = null;     // main dont le pot est déjà parti chez le gagnant
let precedent = null;
let A = null;
let minuteries = [];
function plusTard(fn, t) { minuteries.push(setTimeout(fn, t)); }
function annulerMinuteries() { minuteries.forEach(clearTimeout); minuteries = []; }

function texteBulle(p, i) {
  const fin = etat.status === 'fin';
  const devoile = etat.montrer && p.etat !== 'couche';
  if (fin) {
    if (p.gain > 0) return devoile ? `${p.main} · +${euros(p.gain)}` : `+${euros(p.gain)}`;
    return devoile ? p.main : p.derniere;
  }
  if (etat.status === 'jeu' && etat.active === i && p.bot) return 'Réfléchit…';
  if (i === maPlace && etat.board.length >= 3 && p.etat !== 'couche') {
    return [p.derniere, meilleureMainNom(p)].filter(Boolean).join(' · ');
  }
  return p.derniere;
}
function meilleureMainNom(p) {
  const cartes = [...p.cartes, ...etat.board];
  return cartes.length >= 5 ? nomMain(meilleureMain(cartes)) : '';
}

function rendrePlaces() {
  const zone = $('places');
  zone.innerHTML = '';
  const n = etat.players.length;
  const fin = etat.status === 'fin';
  for (let k = 0; k < n; k++) {
    const i = (maPlace + k) % n;
    const p = etat.players[i];
    const moi = k === 0;
    const angle = anglePlace(k, n);
    const pos = pointBord(angle);
    const actif = etat.status === 'jeu' && etat.active === i;
    const siege = el('div', 'siege-pk');
    if (moi) siege.classList.add('moi');
    if (pos.y < 32 && !moi) siege.classList.add('haut');
    if (pos.x < 18) siege.classList.add('bord-g');
    if (pos.x > 82) siege.classList.add('bord-d');
    if (actif) siege.classList.add('actif');
    if (p.etat === 'couche') siege.classList.add('couche');
    if (fin && p.gain > 0) siege.classList.add('gagnant');
    siege.dataset.i = String(i);
    siege.style.left = `${pos.x}%`;
    siege.style.top = `${pos.y}%`;

    // ses deux cartes (les miennes face visible ; celles des autres à l'abattage)
    const cartes = el('div', 'siege-cartes');
    if (p.cartes.length && (moi || p.etat !== 'couche')) {
      const devoiler = moi || (etat.montrer && p.etat !== 'couche');
      p.cartes.forEach((c, j) => {
        const e = carteEl(c, { cachee: !devoiler });
        e.dataset.j = String(j);
        cartes.appendChild(e);
      });
    }
    siege.appendChild(cartes);

    // plaque : avatar, nom, argent
    const plaque = el('div', 'plaque-pk');
    const avatar = el('span', 'avatar', p.bot ? '🤖' : (p.name || '?').trim().charAt(0).toUpperCase());
    avatar.style.setProperty('--teinte', String((i * 67 + 200) % 360));
    const txt = el('span', 'plaque-txt');
    txt.appendChild(el('strong', 'nom', p.name + (moi && !salon.estLocal() ? ' (toi)' : '')));
    const solde = el('span', 'jetons solde', euros(p.chips));
    const ligne = el('span', 'plaque-ligne');
    ligne.appendChild(solde);
    if (p.reloads) ligne.appendChild(el('span', 'recharges', `♻ ${p.reloads}`));
    txt.appendChild(ligne);
    plaque.append(avatar, txt);
    siege.appendChild(plaque);
    const avant = soldesAffiches[i];
    if (avant !== undefined && avant !== p.chips) {
      solde.textContent = euros(avant);
      A.soldes.push({ e: solde, de: avant, a: p.chips, gain: p.chips > avant });
    }
    soldesAffiches[i] = p.chips;

    const info = texteBulle(p, i);
    if (info) {
      const b = el('span', 'bulle' + (fin && p.gain > 0 ? ' gain' : ''), info);
      siege.appendChild(b);
      if (A.fin && fin && (p.gain > 0 || etat.montrer)) A.retardes.push(b);
    }
    zone.appendChild(siege);

    // sa mise du tour, posée devant lui
    if (etat.status === 'jeu' && p.mise > 0) {
      const m = el('div', 'mise-pk' + (moi ? ' moi' : ''));
      m.dataset.i = String(i);
      const pm = pointBord(angle, 0.56);
      if (pos.y < 32 && !moi) pm.x += 8;   // place du haut : à côté de ses cartes, pas sur le pot
      m.style.left = `${pm.x}%`;
      m.style.top = `${pm.y}%`;
      m.append(pileEl(p.mise), el('span', 'montant', euros(p.mise)));
      zone.appendChild(m);
    }
    // bouton du donneur, un peu à côté de sa place
    if (i === etat.donneur) {
      const pd = pointBord(angle + (moi ? 16 : 13), moi ? 0.8 : 0.82);
      const d = el('div', 'bouton-d' + (moi ? ' moi' : ''), 'D');
      d.style.left = `${pd.x}%`;
      d.style.top = `${pd.y}%`;
      zone.appendChild(d);
    }
  }
}

function rendreCentre() {
  const zone = $('tableau');
  zone.innerHTML = '';
  for (let k = 0; k < 5; k++) {
    const c = etat.board[k];
    zone.appendChild(c ? carteEl(c) : el('div', 'emplacement'));
  }
  const total = potTotal(etat);
  const auCentre = total - etat.players.reduce((a, p) => a + (etat.status === 'jeu' ? p.mise : 0), 0);
  $('pot').textContent = euros(total);
  const tas = $('pot-tas');
  tas.innerHTML = '';
  tas.classList.toggle('emporte', etat.status === 'fin' && potEmporte === etat.mainNo);
  if (auCentre > 0) tas.appendChild(pileEl(auCentre));
  $('pot-zone').classList.toggle('vide', total <= 0);
  $('etape').textContent = etat.status === 'fin' ? (etat.montrer ? 'Abattage' : '') : (ETAPES[etat.street] || '');
}

function rendreMessage() {
  const msg = $('message');
  let texte = '';
  if (etat.status === 'fin') texte = (etat.resultat && etat.resultat.texte) || '';
  else {
    const actif = etat.players[etat.active];
    if (monTour()) {
      const p = etat.players[maPlace];
      const aSuivre = etat.miseMax - p.mise;
      texte = aSuivre > 0 ? `À toi : ${euros(aSuivre)} pour suivre` : 'À toi de parler';
      if (salon.estLocal() && etat.players.filter((q) => !q.bot).length > 1) texte = `${p.name}, ${texte.charAt(0).toLowerCase()}${texte.slice(1)}`;
    } else if (actif) {
      texte = actif.bot ? `${actif.name} réfléchit…` : `Au tour ${de(actif.name)}`;
    }
  }
  if (A.fin) {
    msg.textContent = etat.montrer ? 'Abattage…' : '';
    A.fins.push(() => { msg.textContent = texte; pop(msg); });
  } else if (msg.textContent !== texte) {
    msg.textContent = texte;
    if (texte) pop(msg);
  }
  msg.classList.toggle('vide', !msg.textContent);
}

function rendreCommandes() {
  const tour = monTour();
  const montrer = (id, visible) => {
    const e = $(id);
    if (e.hidden === visible) {
      e.hidden = !visible;
      if (visible && !sansAnimation()) e.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
    }
  };
  montrer('panneau-actions', tour);
  montrer('panneau-fin', etat.status === 'fin');
  if (!tour) { ouvrirRelance(false); return; }
  const p = etat.players[maPlace];
  const aSuivre = etat.miseMax - p.mise;
  const suivre = $('btn-suivre');
  if (aSuivre <= 0) suivre.textContent = 'Parole';
  else if (aSuivre >= p.chips) suivre.textContent = `Tapis (${euros(p.chips)})`;
  else suivre.textContent = `Suivre ${euros(aSuivre)}`;
  const peutRelancer = p.chips > aSuivre;
  const ouvrir = $('btn-ouvrir-relance');
  ouvrir.disabled = !peutRelancer;
  ouvrir.textContent = etat.miseMax === 0 ? 'Miser' : 'Relancer';
  if (!peutRelancer) ouvrirRelance(false);
  if (!$('relance').hidden) rendreRelance();
}

// ---------- Animations ----------
const centre = (r) => [r.left + r.width / 2, r.top + r.height / 2];
function pop(e) {
  if (sansAnimation()) return;
  e.animate([{ transform: 'scale(.8)', opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'ease-out' });
}
function apparaitre(e, delai) {
  e.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.1)', offset: 0.7 }, { opacity: 1, transform: 'none' }], { duration: 380, delay: delai, fill: 'backwards', easing: 'ease-out' });
}
// un élément du nouveau dessin arrive depuis un point (paquet, plaque…)
function arriver(e, depuis, delai, { rotation = 0, echelle = 0.55, duree = 460 } = {}) {
  const [cx, cy] = centre(e.getBoundingClientRect());
  const [dx, dy] = centre(depuis);
  const finale = getComputedStyle(e).transform;
  const debut = `translate(${dx - cx}px, ${dy - cy}px) rotate(${rotation}deg) scale(${echelle})`;
  e.animate([
    { transform: debut, opacity: 0 },
    { transform: debut, opacity: 1, offset: 0.02 },
    { transform: finale === 'none' ? 'none' : finale, opacity: 1 },
  ], { duration: duree, delay: delai, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
}
// carte qui se retourne : le dos la cache jusqu'à mi-course
function retourner(e, delai) {
  const dos = el('span', 'dos-retourne');
  e.appendChild(dos);
  e.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)', offset: 0.5 }, { transform: 'rotateY(0)' }], { duration: 480, delay: delai, easing: 'ease-in-out' });
  dos.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], { duration: 480, delay: delai, fill: 'forwards' })
    .finished.then(() => dos.remove()).catch(() => {});
}
// copie figée d'un élément (avant qu'il soit redessiné), pour le faire partir quelque part
function figer(e) {
  const r = e.getBoundingClientRect();
  const w = e.offsetWidth; const h = e.offsetHeight;
  const j = e.querySelector('.j');
  return { node: e.cloneNode(true), r, w, h, l: w, jt: j ? j.offsetWidth : 0, transform: getComputedStyle(e).transform };
}
function envoyer(f, cible, delai, { duree = 520, disparaitre = true, echelle = 0.6 } = {}) {
  const c = f.node.cloneNode(true);
  const [cx, cy] = centre(f.r);
  Object.assign(c.style, { left: `${cx - f.w / 2}px`, top: `${cy - f.h / 2}px`, width: `${f.w}px`, height: `${f.h}px` });
  c.classList.add('volant');
  if (c.classList.contains('carte-pk')) c.style.setProperty('--l', `${f.l}px`);
  if (f.jt) c.style.setProperty('--jt', `${f.jt}px`);
  document.body.appendChild(c);
  const [tx, ty] = centre(cible);
  const t0 = f.transform && f.transform !== 'none' ? f.transform : 'none';
  c.animate([
    { transform: t0, opacity: 1 },
    { transform: `translate(${tx - cx}px, ${ty - cy}px) scale(${echelle})`, opacity: disparaitre ? 0.15 : 1 },
  ], { duration: duree, delay: delai, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both' })
    .finished.then(() => c.remove()).catch(() => c.remove());
}
// jetons tout neufs qui partent d'une plaque (mise qui clôt le tour : ils filent directement au pot)
function jetonsVolants(montant, depuis, cible, delai) {
  const pile = pileEl(montant);
  pile.classList.add('volant');
  const ref = document.querySelector('#places .j, #pot-tas .j');
  pile.style.setProperty('--jt', `${ref ? ref.offsetWidth : 24}px`);
  document.body.appendChild(pile);
  const [dx, dy] = centre(depuis);
  const r = pile.getBoundingClientRect();
  Object.assign(pile.style, { left: `${dx - r.width / 2}px`, top: `${dy - r.height / 2}px` });
  const [tx, ty] = centre(cible);
  pile.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1, offset: 0.25 }, { transform: `translate(${tx - dx}px, ${ty - dy}px) scale(.7)`, opacity: 0.2 }],
    { duration: 650, delay: delai, easing: 'ease-in-out', fill: 'both' })
    .finished.then(() => pile.remove()).catch(() => pile.remove());
}
function compter(e, de, a, delai) {
  if (sansAnimation()) { e.textContent = euros(a); return; }
  plusTard(() => {
    const t0 = performance.now();
    const pas = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      e.textContent = euros(de + (a - de) * (1 - (1 - k) ** 3));
      if (k < 1 && e.isConnected) requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
    e.classList.add(a > de ? 'monte' : 'baisse');
    setTimeout(() => e.classList.remove('monte', 'baisse'), 1200);
  }, delai);
}

// ce qui est à l'écran juste avant de redessiner
function instantane() {
  const r = { plaques: {}, cartes: {}, mises: {}, pot: null, bouton: null };
  document.querySelectorAll('#places .siege-pk').forEach((s) => {
    const i = Number(s.dataset.i);
    r.cartes[i] = [...s.querySelectorAll('.siege-cartes .carte-pk')].map(figer);
  });
  document.querySelectorAll('#places .mise-pk').forEach((m) => {
    const pile = m.querySelector('.pile');
    if (pile) r.mises[Number(m.dataset.i)] = figer(pile);
  });
  const potPile = document.querySelector('#pot-tas .pile');
  if (potPile && !$('pot-tas').classList.contains('emporte')) r.pot = figer(potPile);
  const b = document.querySelector('#places .bouton-d');
  if (b) r.bouton = b.getBoundingClientRect();
  return r;
}
const etatLogique = () => ({
  place: maPlace,
  n: etat.players.length,
  mainNo: etat.mainNo,
  board: etat.board.length,
  status: etat.status,
  montrer: !!etat.montrer,
  mises: etat.players.map((p) => p.mise),
  engages: etat.players.map((p) => p.engage),
  etats: etat.players.map((p) => p.etat),
});
const plaqueDe = (i) => {
  const s = document.querySelector(`#places .siege-pk[data-i="${i}"] .plaque-pk`);
  return s ? s.getBoundingClientRect() : $('pot-zone').getBoundingClientRect();
};

function animer(prev, avant) {
  const finImmediate = () => {
    A.fins.forEach((f) => f());
    A.soldes.forEach(({ e, a }) => { e.textContent = euros(a); });
    if (etat.status === 'fin') { potEmporte = etat.mainNo; $('pot-tas').classList.add('emporte'); }
  };
  if (sansAnimation() || !prev || prev.place !== maPlace || prev.n !== etat.players.length) { finImmediate(); return; }
  const paquet = $('paquet').getBoundingClientRect();
  const pot = $('pot-zone').getBoundingClientRect();
  const n = etat.players.length;
  let t = 0;

  // dealer : le bouton glisse jusqu'à sa nouvelle place
  const bouton = document.querySelector('#places .bouton-d');
  if (bouton && avant.bouton && prev.mainNo !== etat.mainNo) {
    const [nx, ny] = centre(bouton.getBoundingClientRect());
    const [ox, oy] = centre(avant.bouton);
    if (Math.hypot(nx - ox, ny - oy) > 4) bouton.animate([{ transform: `translate(${ox - nx}px, ${oy - ny}px)` }, { transform: 'none' }], { duration: 600, easing: 'ease-in-out' });
  }

  // nouvelle main : les cartes partent du paquet, une par une, en commençant après le donneur
  if (prev.mainNo !== etat.mainNo) {
    let k = 0;
    for (let tour = 0; tour < 2; tour++) {
      for (let o = 1; o <= n; o++) {
        const i = (etat.donneur + o) % n;
        const c = document.querySelector(`#places .siege-pk[data-i="${i}"] .carte-pk[data-j="${tour}"]`);
        if (c) { arriver(c, paquet, 250 + k * 120, { rotation: -60 }); k++; }
      }
    }
    t = 250 + k * 120 + 250;
    document.querySelectorAll('#places .mise-pk').forEach((m) => {
      const pile = m.querySelector('.pile');
      arriver(pile, plaqueDe(Number(m.dataset.i)), 0, { echelle: 0.7, duree: 420 });
    });
    A.soldes.forEach(({ e, de, a }) => compter(e, de, a, 0));
    return;
  }

  // un joueur se couche : ses cartes partent vers le paquet
  etat.players.forEach((p, i) => {
    if (i !== maPlace && prev.etats[i] !== 'couche' && p.etat === 'couche' && avant.cartes[i]) {
      avant.cartes[i].forEach((f, j) => envoyer(f, paquet, j * 70, { duree: 480, echelle: 0.5 }));
    }
  });

  const memeTour = etat.board.length === prev.board && etat.status === 'jeu' && prev.status === 'jeu';
  if (memeTour) {
    // nouvelle mise : les jetons glissent de la plaque jusque devant le joueur
    etat.players.forEach((p, i) => {
      if (p.mise > prev.mises[i]) {
        const pile = document.querySelector(`#places .mise-pk[data-i="${i}"] .pile`);
        if (pile) arriver(pile, plaqueDe(i), 0, { echelle: 0.7, duree: 420 });
      }
    });
  } else {
    // fin du tour d'enchères : toutes les mises rejoignent le pot
    let mouvement = false;
    Object.values(avant.mises).forEach((f) => { envoyer(f, pot, 0, { duree: 480, echelle: 0.8, disparaitre: true }); mouvement = true; });
    etat.players.forEach((p, i) => {
      const ajout = (p.engage || 0) - (prev.engages[i] || 0);
      if (ajout > 0 && etat.mainNo === prev.mainNo) { jetonsVolants(ajout, plaqueDe(i), pot, 0); mouvement = true; }
    });
    if (mouvement) {
      t = 520;
      const tas = $('pot-tas');
      tas.animate([{ opacity: 0 }, { opacity: 0, offset: 0.99 }, { opacity: 1 }], { duration: t, fill: 'backwards' });
    }
  }

  // cartes communes : elles glissent du paquet puis se retournent
  const nouvelles = [...document.querySelectorAll('#tableau .carte-pk')].slice(prev.board);
  nouvelles.forEach((c, k) => {
    const d = t + k * 160;
    arriver(c, paquet, d, { rotation: -20, echelle: 0.7, duree: 380 });
    retourner(c, d + 330);
  });
  if (nouvelles.length) t += (nouvelles.length - 1) * 160 + 330 + 520;

  // abattage : les cartes des autres se retournent
  if (etat.montrer && !prev.montrer) {
    let k = 0;
    etat.players.forEach((p, i) => {
      if (i === maPlace || p.etat === 'couche') return;
      document.querySelectorAll(`#places .siege-pk[data-i="${i}"] .carte-pk`).forEach((c) => { retourner(c, t + k * 110); k++; });
    });
    t += k * 110 + 500;
  }

  // fin de la main : le pot part chez le (ou les) gagnant(s)
  if (A.fin) {
    const potPile = document.querySelector('#pot-tas .pile');
    const gagnants = etat.players.map((p, i) => [p, i]).filter(([p]) => p.gain > 0).map(([, i]) => i);
    if (potPile && gagnants.length) {
      const f = figer(potPile);
      const tas = $('pot-tas');
      potEmporte = etat.mainNo;
      plusTard(() => tas.classList.add('emporte'), t);
      gagnants.forEach((i, k) => envoyer(f, plaqueDe(i), t + k * 80, { duree: 700, echelle: 0.7 }));
    }
    const tFin = t + 350;
    const fins = A.fins;
    plusTard(() => fins.forEach((fn) => fn()), tFin);
    A.retardes.forEach((e) => apparaitre(e, tFin));
    A.soldes.forEach(({ e, de, a }) => compter(e, de, a, a > de ? t + 600 : 0));
    return;
  }
  A.soldes.forEach(({ e, de, a }) => compter(e, de, a, 0));
}

function rendre() {
  if (!etat) return;
  const ev = etat.lastEvent || null;
  if (premiereSynchro) {
    premiereSynchro = false;
    dernierTs = ev ? ev.ts : null;
  } else if (ev && ev.ts !== dernierTs) {
    dernierTs = ev.ts;
    (ev.textes || []).forEach((t, k) => setTimeout(() => toast(t), k * 1800));
  }
  const prev = precedent;
  const avant = instantane();
  if (prev && prev.mainNo !== etat.mainNo) annulerMinuteries();
  A = {
    soldes: [], retardes: [], fins: [],
    fin: !!prev && prev.place === maPlace && prev.status !== 'fin' && etat.status === 'fin',
  };
  rendrePlaces();
  rendreCentre();
  rendreMessage();
  rendreCommandes();
  animer(prev, avant);
  precedent = etatLogique();
}
