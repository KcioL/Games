import { $, el, toast, initSalon, initRegles, de } from '../commun/salon.js';
import { nouveauPaquet, afficherCartes } from '../commun/cartes.js';

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
const cartesVues = { tableau: 0, moi: 0, main: 0 };

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
    if (place !== maPlace) { relanceCible = 0; cartesVues.moi = 0; }
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

// Relance ouverte : les boutons « Se coucher » et « Parole/Suivre » sont masqués (pas de clic par erreur)
// et le panneau est fixé en bas de l'écran, bouton de confirmation toujours visible.
function ouvrirRelance(ouvert) {
  $('relance').hidden = !ouvert;
  $('panneau-actions').classList.toggle('relance-ouverte', ouvert);
  document.body.classList.toggle('relance-ouverte', ouvert);
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
  // mes cartes restent visibles juste au-dessus du panneau de relance
  requestAnimationFrame(() => {
    const cartes = $('moi').getBoundingClientRect();
    const haut = window.innerHeight - $('relance').offsetHeight; // position finale (le panneau est encore en train de monter)
    if (cartes.bottom > haut - 8) window.scrollBy({ top: cartes.bottom - haut + 12, behavior: 'smooth' });
  });
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

function badgeDonneur(i) {
  return i === etat.donneur ? el('span', 'donneur', 'D') : null;
}

function rendreAdversaires() {
  const zone = $('adversaires');
  zone.innerHTML = '';
  const n = etat.players.length;
  for (let k = 1; k < n; k++) {
    const i = (maPlace + k) % n;
    const p = etat.players[i];
    const siege = el('div', 'siege');
    if (etat.status === 'jeu' && etat.active === i) siege.classList.add('actif');
    if (p.etat === 'couche') siege.classList.add('couche');
    if (etat.status === 'fin' && p.gain > 0) siege.classList.add('gagnant');

    const tete = el('div', 'siege-tete');
    tete.appendChild(el('strong', '', p.name));
    const d = badgeDonneur(i);
    if (d) tete.appendChild(d);
    siege.appendChild(tete);
    const argent = el('div', 'siege-argent');
    argent.appendChild(el('span', 'jetons', euros(p.chips)));
    if (p.reloads) argent.appendChild(el('span', 'recharges', `♻ ${p.reloads}`));
    siege.appendChild(argent);

    const cartes = el('div', 'main-cartes');
    const devoiler = etat.montrer && p.etat !== 'couche';
    if (p.etat !== 'couche') afficherCartes(cartes, p.cartes, { taille: 'petite', cachee: !devoiler }, p.cartes.length);
    siege.appendChild(cartes);

    let info = p.derniere;
    if (etat.status === 'fin') info = p.gain > 0 ? `+${euros(p.gain)}` : (devoiler ? p.main : p.derniere);
    else if (etat.status === 'jeu' && etat.active === i && p.bot) info = 'Réfléchit…';
    if (etat.status === 'fin' && p.gain > 0 && devoiler) info = `${p.main}, +${euros(p.gain)}`;
    siege.appendChild(el('span', 'siege-info', info || ' '));
    if (p.mise > 0 && etat.status === 'jeu') siege.appendChild(el('span', 'mise-tour', euros(p.mise)));
    zone.appendChild(siege);
  }
}

function rendreTableau() {
  const zone = $('tableau');
  const avant = cartesVues.tableau;
  zone.innerHTML = '';
  for (let k = 0; k < 5; k++) {
    const c = etat.board[k];
    if (c) {
      const tmp = el('div');
      afficherCartes(tmp, [c], { taille: 'grande' }, k < avant ? 1 : 0);
      const carte = tmp.firstChild;
      if (k >= avant) carte.style.animationDelay = `${(k - avant) * 120}ms`;
      zone.appendChild(carte);
    } else {
      zone.appendChild(el('div', 'emplacement'));
    }
  }
  cartesVues.tableau = etat.board.length;
  $('pot').textContent = euros(potTotal(etat));
}

function rendreMoi() {
  const p = etat.players[maPlace];
  const zone = $('moi');
  zone.classList.toggle('actif', monTour());
  zone.classList.toggle('couche', p.etat === 'couche');
  zone.classList.toggle('gagnant', etat.status === 'fin' && p.gain > 0);
  const nom = $('moi-nom');
  nom.textContent = salon.estLocal() ? p.name : `${p.name} (toi)`;
  const d = badgeDonneur(maPlace);
  if (d) nom.appendChild(d);
  $('moi-jetons').textContent = euros(p.chips);
  $('moi-recharges').textContent = p.reloads ? `♻ ${p.reloads}` : '';
  const cle = `${etat.mainNo}-${maPlace}`;
  afficherCartes($('mes-cartes'), p.cartes, { taille: 'grande' }, cartesVues.main === cle ? p.cartes.length : 0);
  cartesVues.main = cle;
  $('moi-mise').textContent = p.mise > 0 && etat.status === 'jeu' ? `Mise : ${euros(p.mise)}` : '';
  let info = p.derniere;
  if (etat.status === 'fin') {
    if (p.gain > 0) info = etat.montrer ? `${p.main}, +${euros(p.gain)}` : `+${euros(p.gain)}`;
    else info = etat.montrer && p.etat !== 'couche' ? p.main : p.derniere;
  } else if (etat.board.length >= 3 && p.etat !== 'couche') {
    // Aide : la combinaison actuelle du joueur
    info = [p.derniere, meilleureMainNom(p)].filter(Boolean).join(', ');
  }
  $('moi-derniere').textContent = info || '';
}

function meilleureMainNom(p) {
  const cartes = [...p.cartes, ...etat.board];
  return cartes.length >= 5 ? nomMain(meilleureMain(cartes)) : '';
}

function rendreMessage() {
  const msg = $('message');
  if (etat.status === 'fin') { msg.textContent = (etat.resultat && etat.resultat.texte) || ''; return; }
  const actif = etat.players[etat.active];
  const etapes = ['Avant le flop', 'Flop', 'Turn', 'River'];
  if (monTour()) {
    const p = etat.players[maPlace];
    const aSuivre = etat.miseMax - p.mise;
    msg.textContent = aSuivre > 0 ? `À toi : ${euros(aSuivre)} pour suivre` : 'À toi de parler';
  } else if (actif) {
    msg.textContent = actif.bot ? `${actif.name} réfléchit…` : `Au tour ${de(actif.name)}`;
  }
  msg.dataset.etape = etapes[etat.street] || '';
}

function rendreCommandes() {
  const tour = monTour();
  $('panneau-actions').hidden = !tour;
  $('panneau-fin').hidden = etat.status !== 'fin';
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
  if (etat.board.length < cartesVues.tableau) cartesVues.tableau = 0;
  rendreAdversaires();
  rendreTableau();
  rendreMoi();
  rendreMessage();
  rendreCommandes();
}

