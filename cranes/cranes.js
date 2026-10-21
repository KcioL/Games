import { $, el, toast, initSalon, initRegles, de } from '../commun/salon.js';
import * as R from './regles.js';

const NOMS_BOTS = ['Barbe-Grise', 'Anne la Rousse', 'Œil-de-Lynx', 'Jack Sabre', 'Mamie Tempête', 'Le Borgne', 'Capitaine Crochu'];
const MAX_JOUEURS = 8;

let etat = null;
let maPlace = 0;
let selection = null;        // carte choisie dans ma main (on la touche une 2e fois pour la jouer)
let annonceChoisie = null;   // annonce en cours de choix
let tigresseEnAttente = null;

const melanger = (t) => { const a = [...t]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const salon = initSalon({
  jeu: 'cranes',
  etatInitial: (nom, nb, { local }) => {
    const joueur = (name, joined, bot = false) => ({ name, joined, bot, score: 0 });
    const joueurs = Array.from({ length: nb }, (_, i) => joueur(i === 0 ? nom : 'En attente', i === 0));
    const bots = parseInt($(local ? 'local-bots' : 'ligne-bots').value, 10) || 0;
    melanger(NOMS_BOTS).slice(0, bots).forEach((n) => joueurs.push(joueur(n, true, true)));
    // variante choisie par celui qui crée la partie (les autres la voient, sans pouvoir la changer)
    return { players: joueurs, atoutLibre: $('reglage-atout').checked };
  },
  validerLocal: () => {
    const total = parseInt($('local-nb').value, 10) + parseInt($('local-bots').value, 10);
    if (total < 2) return 'Il faut au moins 2 joueurs : ajoute un bot ou un joueur.';
    if (total > MAX_JOUEURS) return `${MAX_JOUEURS} places maximum autour de la table.`;
    return '';
  },
  validerEnLigne: () => {
    const total = parseInt($('nb-joueurs').value, 10) + parseInt($('ligne-bots').value, 10);
    if (total > MAX_JOUEURS) return `${MAX_JOUEURS} places maximum : enlève des bots.`;
    return '';
  },
  demarrer: (s) => R.nouvellePartie(s),
  afficher: (s, place) => {
    if (place !== maPlace) { selection = null; annonceChoisie = null; tigresseEnAttente = null; }
    etat = R.normaliser(s);
    maPlace = place;
    noterChangement();
    rendre();
    planifierBot();
  },
  // Sur un seul téléphone : on le passe au joueur humain qui doit annoncer ou jouer
  quiDoitJouer: (s) => {
    const joueurs = s.players || [];
    if (joueurs.filter((p) => !p.bot).length <= 1) return -1;
    if (s.status === 'annonces') return joueurs.findIndex((p) => !p.bot && (p.annonce === undefined || p.annonce === null || p.annonce < 0));
    if (s.status === 'jeu' && joueurs[s.active] && !joueurs[s.active].bot) return s.active;
    return -1;
  },
  secret: true,
});
initRegles();
const agir = (fn) => salon.agir((s) => fn(R.normaliser(s)));

// ---------- Bots ----------
let botPrevu = '';
function botAttendu(s) {
  if (s.status === 'annonces') return s.players.findIndex((p) => p.bot && p.annonce < 0);
  if (s.status === 'jeu' && s.players[s.active] && s.players[s.active].bot) return s.active;
  return -1;
}
function planifierBot() {
  if (!etat || botAttendu(etat) < 0) return;
  const cle = `${etat.partie}-${etat.manche}-${etat.coup}`;
  if (botPrevu === cle) return;
  botPrevu = cle;
  const coup = etat.coup;
  let delai = 700 + Math.random() * 700;
  if (etat.status === 'jeu') {
    if (!etat.pli.length && etat.dernierPli) delai = 2300 + Math.random() * 500;       // on laisse voir le pli remporté
    else if (!etat.pli.length && etat.numPli === 0) delai = 1600 + Math.random() * 500; // on laisse voir les annonces
    else delai = 850 + Math.random() * 650;
  }
  setTimeout(() => {
    agir((s) => {
      if (s.coup !== coup) return false;
      const i = botAttendu(s);
      if (i < 0) return false;
      if (s.status === 'annonces') return R.annoncer(s, i, R.annonceBot(s, i));
      let ok = false;
      try {
        const c = R.coupBot(s, i);
        ok = R.jouer(s, i, c.id, c.choix);
      } catch (err) { console.error('Bot : erreur', err); }
      if (ok) return true;
      // en dernier recours : la première carte jouable (la partie ne bloque jamais)
      const p = s.players[i];
      const c = p.main.find((x) => R.jouable(p.main, x, s.pli, !!s.atoutLibre));
      return c ? R.jouer(s, i, c.id, 'pirate') : false;
    });
  }, delai);
}
// Surveillant : si un bot doit jouer et que rien ne bouge (coup perdu, veille…), on reprogramme
let dernierChangement = Date.now();
let dernierCoupConnu = null;
function noterChangement() {
  const cle = `${etat.partie}-${etat.manche}-${etat.coup}-${etat.status}`;
  if (cle !== dernierCoupConnu) { dernierCoupConnu = cle; dernierChangement = Date.now(); }
}
setInterval(() => {
  if (!etat || botAttendu(etat) < 0 || Date.now() - dernierChangement < 4500) return;
  dernierChangement = Date.now();
  botPrevu = '';
  planifierBot();
}, 1500);

// ---------- Actions ----------
const monTour = () => etat && etat.status === 'jeu' && etat.active === maPlace;
const moi = () => etat.players[maPlace];

function jouerCarte(c, choix) {
  if (!monTour()) return;
  if (c.t === 'tigresse' && !choix) {
    tigresseEnAttente = c.id;
    rendrePanneaux();
    return;
  }
  selection = null;
  tigresseEnAttente = null;
  agir((s) => R.jouer(s, maPlace, c.id, choix));
}
function clicCarte(c) {
  if (pliFini) return;
  if (!monTour()) { toast(etat.status === 'annonces' ? 'Annonce d\'abord tes plis.' : 'Ce n\'est pas ton tour.'); return; }
  if (!R.jouable(moi().main, c, etat.pli, !!etat.atoutLibre)) {
    toast(`Tu dois suivre la couleur demandée (${R.NOMS_COULEURS[R.couleurDemandee(etat.pli)]}).`);
    return;
  }
  if (selection === c.id) { jouerCarte(c); return; }
  selection = c.id;
  rendreMain();
}
$('btn-jouer').addEventListener('click', () => {
  const c = moi().main.find((x) => x.id === selection);
  if (c) jouerCarte(c);
});
$('btn-tigresse-pirate').addEventListener('click', () => {
  const c = moi().main.find((x) => x.id === tigresseEnAttente);
  if (c) jouerCarte(c, 'pirate');
});
$('btn-tigresse-fuite').addEventListener('click', () => {
  const c = moi().main.find((x) => x.id === tigresseEnAttente);
  if (c) jouerCarte(c, 'fuite');
});
$('btn-tigresse-annuler').addEventListener('click', () => { tigresseEnAttente = null; rendrePanneaux(); });
$('btn-annoncer').addEventListener('click', () => {
  if (annonceChoisie === null) return;
  const x = annonceChoisie;
  annonceChoisie = null;
  agir((s) => R.annoncer(s, maPlace, x));
});
$('btn-manche-suivante').addEventListener('click', () => agir((s) => R.mancheSuivante(s)));
$('btn-nouvelle-partie').addEventListener('click', () => agir((s) => {
  if (s.status !== 'termine') return false;
  R.nouvellePartie(s);
  return true;
}));
$('btn-scores').addEventListener('click', () => { rendreScores(); $('dialog-scores').showModal(); });
$('fermer-scores').addEventListener('click', () => $('dialog-scores').close());
$('loupe').addEventListener('click', () => { $('loupe').hidden = true; });

// hauteur de la barre du haut : la salle prend tout le reste de l'écran
function majHauteurBarre() {
  const b = document.querySelector('.barre');
  if (b) document.documentElement.style.setProperty('--h-barre', `${b.offsetHeight}px`);
}
window.addEventListener('resize', () => { majHauteurBarre(); if (etat) serrerMain(); });
majHauteurBarre();

// ---------- Illustrations des cartes spéciales (dossier cartes/) ----------
// Une image déposée dans cranes/cartes/ (jpg, png ou webp) remplace le dessin par défaut de la carte.
const EXTENSIONS = ['jpg', 'png', 'webp'];
const images = new Map(); // nom → url (ou null si absente)
function chargerImages() {
  const noms = new Set(['dos']);
  Object.entries(R.SPECIALES).forEach(([, d]) => { for (let k = 1; k <= d.n; k++) noms.add(d.image(k)); });
  noms.forEach((nom) => {
    const essayer = (k) => {
      if (k >= EXTENSIONS.length) { images.set(nom, null); return; }
      const url = `cartes/${nom}.${EXTENSIONS[k]}`;
      const img = new Image();
      img.onload = () => { images.set(nom, url); if (etat) redessinerBientot(); };
      img.onerror = () => essayer(k + 1);
      img.src = url;
    };
    essayer(0);
  });
}
let redessinPrevu = false;
function redessinerBientot() {
  if (redessinPrevu) return;
  redessinPrevu = true;
  setTimeout(() => { redessinPrevu = false; rendre(true); }, 120);
}
chargerImages();

// ---------- Cartes ----------
const EMOJIS = { fuite: '🏳️', pirate: '🏴‍☠️', tigresse: '🐯', sirene: '🧜‍♀️', roi: '👑', kraken: '🐙', baleine: '🐋', butin: '💰' };
const ORDRE = { perroquet: 0, coffre: 1, carte: 2, pavillon: 3, fuite: 4, butin: 5, sirene: 6, pirate: 7, tigresse: 8, roi: 9, kraken: 10, baleine: 11 };
const trier = (main) => [...main].sort((a, b) => {
  const oa = ORDRE[a.t === 'n' ? a.s : a.t]; const ob = ORDRE[b.t === 'n' ? b.s : b.t];
  return oa - ob || (a.v || a.k || 0) - (b.v || b.k || 0);
});
function nomCarte(c) {
  if (c.t === 'n') return `${c.v} ${R.NOMS_COULEURS[c.s]}`;
  return R.SPECIALES[c.t].nom;
}
function icone(couleur, classe) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', classe);
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#ico-${couleur}`);
  svg.appendChild(use);
  return svg;
}
function carteEl(c, { cachee = false, choix = null } = {}) {
  const e = el('div', 'carte-rc');
  if (!c || cachee) {
    e.classList.add('dos');
    const img = images.get('dos');
    if (img) { const i = el('img', 'illu'); i.src = img; i.alt = ''; e.appendChild(i); } else e.appendChild(el('span', 'dos-crane', '☠'));
    return e;
  }
  e.dataset.id = c.id;
  e.setAttribute('aria-label', nomCarte(c));
  if (c.t === 'n') {
    e.classList.add('num', c.s);
    const coin = (bas) => {
      const k = el('span', 'coin' + (bas ? ' bas' : ''));
      k.append(el('b', '', String(c.v)), icone(c.s, 'mini'));
      return k;
    };
    e.append(coin(false), icone(c.s, 'centre'), coin(true));
    return e;
  }
  e.classList.add('spec', c.t);
  const d = R.SPECIALES[c.t];
  const url = images.get(d.image(c.k));
  if (url) {
    const i = el('img', 'illu');
    i.src = url;
    i.alt = d.nom;
    i.draggable = false;
    e.appendChild(i);
  } else {
    e.append(el('span', 'spec-ico', EMOJIS[c.t]), el('span', 'spec-nom', d.nom));
  }
  if (c.t === 'tigresse' && choix) e.appendChild(el('span', 'choix-tigresse', choix === 'pirate' ? '☠ Pirate' : '⚐ Drapeau'));
  return e;
}
// appui long (ou clic droit) : la carte en grand
function appuiLong(e, fn) {
  let t = null;
  e.addEventListener('pointerdown', () => { t = setTimeout(() => { t = null; e.dataset.long = '1'; fn(); }, 480); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => e.addEventListener(ev, () => { if (t) clearTimeout(t); t = null; }));
  e.addEventListener('contextmenu', (ev) => { ev.preventDefault(); fn(); });
}
function loupe(c, choix) {
  const z = $('loupe');
  z.innerHTML = '';
  const carte = carteEl(c, { choix });
  carte.classList.add('zoom');
  z.append(carte, el('p', 'loupe-nom', nomCarte(c)), el('p', 'loupe-aide', 'Touche pour fermer'));
  z.hidden = false;
}

// ---------- Places autour de la table ----------
function anglePlace(k, n) {
  if (k === 0) return 90;
  const m = n - 1;
  if (m === 1) return 270;
  const ecart = Math.min(250, 62 * m);
  return 270 - ecart / 2 + (ecart * (k - 1)) / (m - 1);
}
function pointBord(angle, r = 1) {
  const a = (angle * Math.PI) / 180;
  const c = Math.cos(a); const s = Math.sin(a);
  const e = 2 / 5; // table rectangulaire aux coins arrondis
  return { x: 50 + 50 * r * Math.sign(c) * Math.abs(c) ** e, y: 50 + 50 * r * Math.sign(s) * Math.abs(s) ** e };
}
const angleDe = (i) => anglePlace((i - maPlace + etat.players.length) % etat.players.length, etat.players.length);

function texteBulle(p, i) {
  if (etat.status === 'annonces') {
    if (p.annonce < 0) return { t: p.bot ? 'réfléchit…' : 'annonce…', c: 'attente' };
    return { t: i === maPlace ? `Annonce : ${p.annonce}` : '✓ a annoncé', c: 'ok' };
  }
  if (etat.status === 'jeu' || (etat.status === 'bilan' && pliFini)) {
    const c = p.plis === p.annonce ? 'juste' : p.plis > p.annonce ? 'trop' : '';
    return { t: `${p.plis} / ${p.annonce} pli${p.annonce > 1 ? 's' : ''}`, c };
  }
  if (etat.status === 'bilan' && etat.bilan) {
    const l = etat.bilan.lignes[i];
    return { t: `${l.points > 0 ? '+' : l.points < 0 ? '−' : ''}${Math.abs(l.points)}`, c: l.points >= 0 ? 'juste' : 'trop' };
  }
  return null;
}

const soldes = [];
function plaqueEl(p, i, avecMain) {
  const plaque = el('div', 'plaque-rc');
  const avatar = el('span', 'avatar', p.bot ? '🤖' : (p.name || '?').trim().charAt(0).toUpperCase());
  avatar.style.setProperty('--teinte', String((i * 67 + 20) % 360));
  const txt = el('span', 'plaque-txt');
  txt.appendChild(el('strong', 'nom', p.name + (i === maPlace && !salon.estLocal() ? ' (toi)' : '')));
  const score = el('span', 'score-total', `${p.score} pts`);
  txt.appendChild(score);
  plaque.append(avatar, txt);
  if (avecMain && p.main.length) {
    const mini = el('span', 'mini-main');
    for (let k = 0; k < Math.min(p.main.length, 5); k++) mini.appendChild(el('i', 'mini-dos'));
    mini.appendChild(el('b', 'mini-nb', String(p.main.length)));
    plaque.appendChild(mini);
  }
  // score qui défile quand il change
  if (soldes[i] !== undefined && soldes[i] !== p.score) {
    A.scores.push({ e: score, de: soldes[i], a: p.score });
    score.textContent = `${soldes[i]} pts`;
  }
  soldes[i] = p.score;
  return plaque;
}

function rendrePlaces() {
  const zone = $('places');
  zone.innerHTML = '';
  const n = etat.players.length;
  for (let k = 1; k < n; k++) {
    const i = (maPlace + k) % n;
    const p = etat.players[i];
    const pos = pointBord(anglePlace(k, n));
    const siege = el('div', 'siege-rc');
    siege.dataset.i = String(i);
    if (pos.y < 30) siege.classList.add('haut');
    if (pos.x < 16) siege.classList.add('bord-g');
    if (pos.x > 84) siege.classList.add('bord-d');
    if ((etat.status === 'jeu' && etat.active === i && !pliFini) || (etat.status === 'annonces' && p.annonce < 0)) siege.classList.add('actif');
    siege.style.left = `${pos.x}%`;
    siege.style.top = `${pos.y}%`;
    siege.appendChild(plaqueEl(p, i, true));
    const b = texteBulle(p, i);
    if (b) {
      const bulle = el('span', `bulle ${b.c}`, b.t);
      siege.appendChild(bulle);
      if (A.revele) A.bulles.push(bulle);
    }
    zone.appendChild(siege);
  }
  // moi : devant ma main
  const p = moi();
  const zm = $('moi');
  zm.innerHTML = '';
  zm.dataset.i = String(maPlace);
  zm.classList.toggle('actif', monTour() && !pliFini);
  zm.appendChild(plaqueEl(p, maPlace, false));
  const b = texteBulle(p, maPlace);
  if (b) {
    const bulle = el('span', `bulle ${b.c}`, b.t);
    zm.appendChild(bulle);
    if (A.revele) A.bulles.push(bulle);
  }
}

// ---------- Le pli en cours (ou celui qui vient d'être remporté) ----------
let pliFini = null;          // { cle, depuis } : le pli complet reste visible un instant
let dernierPliVu = null;
function rendrePli() {
  const zone = $('pli');
  zone.innerHTML = '';
  const enCours = etat.pli.length > 0 || !pliFini || !etat.dernierPli;
  const cartes = enCours ? etat.pli : etat.dernierPli.cartes;
  cartes.forEach((e, k) => {
    const pos = pointBord(angleDe(e.j), 0.5);
    const c = carteEl(e.c, { choix: e.choix });
    c.classList.add('posee');
    c.dataset.j = String(e.j);
    c.style.left = `${pos.x}%`;
    c.style.top = `${pos.y}%`;
    c.style.setProperty('--rot', `${((e.j * 37 + k * 11) % 17) - 8}deg`);
    c.style.zIndex = String(k + 1);
    if (!enCours && etat.dernierPli.k === k) c.classList.add('gagnante');
    if (!enCours && etat.dernierPli.detruit) c.classList.add('englouti');
    appuiLong(c, () => loupe(e.c, e.choix));
    zone.appendChild(c);
  });
  $('feutre').classList.toggle('pli-fini', !enCours);
  const bandeau = $('bandeau-pli');
  if (!enCours) {
    const d = etat.dernierPli;
    let t = '';
    if (d.detruit && d.raison === 'kraken') t = '🐙 Le Kraken engloutit le pli !';
    else if (d.detruit) t = '🐋 La Baleine blanche avale le pli !';
    else {
      const g = etat.players[d.gagnant];
      t = `${g.name} remporte le pli`;
      if (d.raison === 'sirene-roi') t += ' : la Sirène capture le Roi !';
      else if (d.raison === 'roi' && d.bonus >= 30) t += ' : le Roi capture les pirates !';
      else if (d.raison === 'pirate' && d.bonus >= 20) t += ' : capture de sirène !';
      if (d.bonus > 0) t += ` (bonus +${d.bonus})`;
      if (d.allies && d.allies.length) t += ` · alliance du Butin avec ${d.allies.map((b) => etat.players[b].name).join(', ')}`;
    }
    bandeau.textContent = t;
    bandeau.hidden = false;
  } else bandeau.hidden = true;
}

// ---------- Ma main ----------
function rendreMain() {
  const zone = $('main');
  zone.innerHTML = '';
  const p = moi();
  const tour = monTour() && !pliFini;
  if (selection && !p.main.some((c) => c.id === selection)) selection = null;
  trier(p.main).forEach((c) => {
    const e = carteEl(c);
    const ok = R.jouable(p.main, c, etat.pli, !!etat.atoutLibre);
    if (tour) e.classList.add(ok ? 'jouable' : 'interdite');
    if (c.id === selection) e.classList.add('choisie');
    e.addEventListener('click', () => {
      if (e.dataset.long) { delete e.dataset.long; return; }
      clicCarte(c);
    });
    appuiLong(e, () => loupe(c));
    zone.appendChild(e);
  });
  const btn = $('btn-jouer');
  btn.hidden = !(tour && selection);
  serrerMain();
}
// éventail : les cartes se chevauchent si la main est plus large que l'écran
function serrerMain() {
  const zone = $('main');
  const cartes = [...zone.children];
  cartes.forEach((c) => { c.style.marginLeft = ''; });
  if (cartes.length < 2) return;
  const largeur = cartes[0].offsetWidth;
  const dispo = zone.clientWidth - 12;
  const ecart = Math.min(largeur * 0.12, (dispo - largeur) / (cartes.length - 1) - largeur);
  cartes.slice(1).forEach((c) => { c.style.marginLeft = `${ecart}px`; });
  const milieu = (cartes.length - 1) / 2;
  cartes.forEach((c, k) => {
    c.style.setProperty('--angle', `${(k - milieu) * Math.min(4, 26 / cartes.length)}deg`);
    c.style.setProperty('--creux', `${Math.abs(k - milieu) ** 2 * Math.min(2.2, 18 / cartes.length)}px`);
  });
}

// ---------- Panneaux ----------
let bilanApres = 0;
function rendrePanneaux() {
  const p = moi();
  // annonce
  const annonce = etat.status === 'annonces' && p.annonce < 0;
  montrer('panneau-annonce', annonce);
  if (annonce) {
    const zone = $('choix-annonce');
    zone.innerHTML = '';
    for (let x = 0; x <= etat.cartesManche; x++) {
      const b = el('button', 'btn-table nombre' + (annonceChoisie === x ? ' choisi' : ''), String(x));
      b.type = 'button';
      b.addEventListener('click', () => { annonceChoisie = x; rendrePanneaux(); });
      zone.appendChild(b);
    }
    $('btn-annoncer').disabled = annonceChoisie === null;
    $('btn-annoncer').textContent = annonceChoisie === null ? 'Annoncer' : `Annoncer ${annonceChoisie} pli${annonceChoisie > 1 ? 's' : ''}`;
  }
  // Tigresse
  montrer('panneau-tigresse', !!tigresseEnAttente && monTour());
  // bilan (après l'affichage du dernier pli)
  const bilan = etat.status === 'bilan' && !pliFini && Date.now() >= bilanApres;
  montrer('panneau-bilan', bilan);
  if (bilan) rendreBilan();
  // fin de partie
  montrer('panneau-fin', etat.status === 'termine');
  if (etat.status === 'termine') rendreFin();
}
function montrer(id, visible) {
  const e = $(id);
  if (e.hidden === visible) {
    e.hidden = !visible;
    if (visible && !sansAnimation()) e.animate([{ opacity: 0, transform: 'translate(-50%, -46%) scale(.94)' }, { opacity: 1, transform: 'translate(-50%, -50%)' }], { duration: 260, easing: 'ease-out' });
  }
}
function rendreBilan() {
  const b = etat.bilan;
  $('bilan-titre').textContent = `Fin de la manche ${b.manche}${b.manche >= R.NB_MANCHES ? ' (la dernière !)' : ''}`;
  const t = $('table-bilan');
  t.innerHTML = '';
  const tete = el('tr');
  const court = window.matchMedia('(max-width: 520px)').matches;
  (court ? ['', 'Ann.', 'Plis', 'Bonus', 'Pts', 'Total'] : ['', 'Annonce', 'Plis', 'Bonus', 'Points', 'Total']).forEach((h) => tete.appendChild(el('th', '', h)));
  t.appendChild(tete);
  b.lignes.forEach((l, i) => {
    const tr = el('tr', l.reussi ? 'reussi' : 'rate');
    tr.append(el('td', 'nom', etat.players[i].name), el('td', '', String(l.annonce)), el('td', '', String(l.plis)),
      el('td', '', l.bonus ? `+${l.bonus}` : '–'), el('td', 'points', `${l.points > 0 ? '+' : ''}${l.points}`), el('td', 'total', String(etat.players[i].score)));
    t.appendChild(tr);
  });
  $('btn-manche-suivante').textContent = b.manche >= R.NB_MANCHES ? 'Voir le classement' : `Manche ${b.manche + 1}`;
}
function rendreFin() {
  const cl = R.classement(etat);
  $('fin-titre').textContent = `${cl[0].nom} est le Roi des Crânes !`;
  const ol = $('podium');
  ol.innerHTML = '';
  cl.forEach((x, k) => {
    const li = el('li', k === 0 ? 'premier' : '');
    li.append(el('span', 'rang', ['🥇', '🥈', '🥉'][k] || `${k + 1}.`), el('span', 'nom', x.nom), el('b', '', `${x.score} pts`));
    ol.appendChild(li);
  });
}
function rendreScores() {
  const t = $('table-scores');
  t.innerHTML = '';
  const tete = el('tr');
  tete.appendChild(el('th', '', 'Manche'));
  etat.players.forEach((p) => tete.appendChild(el('th', '', p.name)));
  t.appendChild(tete);
  etat.scores.forEach((m) => {
    const tr = el('tr');
    tr.appendChild(el('td', 'manche', `${m.manche} (${m.cartes} c.)`));
    m.lignes.forEach((l) => {
      const td = el('td', l.reussi ? 'reussi' : 'rate');
      td.append(el('small', '', `${l.annonce}/${l.plis}`), el('b', '', `${l.points > 0 ? '+' : ''}${l.points}`));
      tr.appendChild(td);
    });
    t.appendChild(tr);
  });
  const tot = el('tr', 'totaux');
  tot.appendChild(el('td', 'manche', 'Total'));
  etat.players.forEach((p) => tot.appendChild(el('td', '', String(p.score))));
  t.appendChild(tot);
  if (!etat.scores.length) t.appendChild(el('tr')).appendChild(el('td', '', 'Aucune manche terminée pour l\'instant.'));
}

function rendreCentre() {
  $('manche-info').textContent = etat.status === 'termine' ? 'Partie terminée'
    : `Manche ${etat.manche} / ${R.NB_MANCHES} · ${etat.cartesManche} carte${etat.cartesManche > 1 ? 's' : ''}${etat.atoutLibre ? ' · atout libre' : ''}`;
  let texte = '';
  if (etat.status === 'annonces') {
    const attendus = etat.players.filter((p) => p.annonce < 0).map((p) => p.name);
    texte = moi().annonce < 0 ? 'Annonce tes plis' : `En attente : ${attendus.join(', ')}`;
  } else if (etat.status === 'jeu') {
    const couleur = R.couleurDemandee(etat.pli);
    const suite = couleur && !pliFini ? ` · couleur : ${R.NOMS_COULEURS[couleur]}` : '';
    if (pliFini) texte = '';
    else if (monTour()) texte = (etat.pli.length ? 'À toi de jouer' : 'À toi d\'ouvrir le pli') + suite;
    else texte = `Au tour ${de(etat.players[etat.active].name)}…${suite}`;
  } else if (etat.status === 'bilan') texte = pliFini ? '' : 'Fin de la manche';
  $('message').textContent = texte;
  $('message').classList.toggle('vide', !texte);
}

// ---------- Animations ----------
const sansAnimation = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const centre = (r) => [r.left + r.width / 2, r.top + r.height / 2];
let A = null;
let precedent = null;

function instantane() {
  const r = { main: {}, plaques: {} };
  document.querySelectorAll('#main .carte-rc').forEach((c) => { r.main[c.dataset.id] = c.getBoundingClientRect(); });
  document.querySelectorAll('#places .siege-rc, #moi').forEach((s) => {
    const p = s.querySelector('.plaque-rc');
    if (p) r.plaques[s.dataset.i] = p.getBoundingClientRect();
  });
  return r;
}
const plaqueDe = (i) => {
  const s = i === maPlace ? $('moi') : document.querySelector(`#places .siege-rc[data-i="${i}"]`);
  const p = s && s.querySelector('.plaque-rc');
  return (p || $('feutre')).getBoundingClientRect();
};
function arriver(e, depuis, delai, { rotation = 0, echelle = 0.6, duree = 420 } = {}) {
  const [cx, cy] = centre(e.getBoundingClientRect());
  const [dx, dy] = centre(depuis);
  const finale = getComputedStyle(e).transform;
  const debut = `translate(${dx - cx}px, ${dy - cy}px) rotate(${rotation}deg) scale(${echelle})`;
  e.animate([
    { transform: `${debut} ${finale === 'none' ? '' : finale}`, opacity: 0 },
    { transform: `${debut} ${finale === 'none' ? '' : finale}`, opacity: 1, offset: 0.02 },
    { transform: finale === 'none' ? 'none' : finale, opacity: 1 },
  ], { duration: duree, delay: delai, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
}
function compter(e, de, a, delai) {
  setTimeout(() => {
    const t0 = performance.now();
    const pas = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      e.textContent = `${Math.round(de + (a - de) * (1 - (1 - k) ** 3))} pts`;
      if (k < 1 && e.isConnected) requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
    e.classList.add(a >= de ? 'monte' : 'baisse');
    setTimeout(() => e.classList.remove('monte', 'baisse'), 1300);
  }, delai);
}
// le pli remporté part chez son gagnant (ou coule, s'il est englouti)
function ramasserPli() {
  const d = etat.dernierPli;
  if (!d || sansAnimation()) return;
  const cible = d.detruit ? $('feutre').getBoundingClientRect() : plaqueDe(d.gagnant);
  const [tx, ty] = centre(cible);
  document.querySelectorAll('#pli .carte-rc').forEach((c, k) => {
    const [cx, cy] = centre(c.getBoundingClientRect());
    const t0 = getComputedStyle(c).transform;
    const fin = d.detruit
      ? `translate(${(tx - cx) * 0.3}px, ${(ty - cy) * 0.3}px) rotate(${k % 2 ? 160 : -160}deg) scale(.15)`
      : `translate(${tx - cx}px, ${ty - cy}px) scale(.35)`;
    c.animate([{ transform: t0 === 'none' ? 'none' : t0, opacity: 1 }, { transform: fin, opacity: 0 }],
      { duration: 520, delay: k * 50, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' });
  });
  $('bandeau-pli').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 200, fill: 'forwards' });
}

function animer(prev, avant) {
  const finImmediate = () => A.scores.forEach(({ e, a }) => { e.textContent = `${a} pts`; });
  if (sansAnimation() || !prev || prev.place !== maPlace) { finImmediate(); return; }
  const centreTable = $('feutre').getBoundingClientRect();
  const nouvelleManche = prev.manche !== etat.manche || prev.partie !== etat.partie;
  if (nouvelleManche && etat.status === 'annonces') {
    // la donne : mes cartes arrivent du centre de la table, une à une
    document.querySelectorAll('#main .carte-rc').forEach((c, k) => arriver(c, centreTable, 120 + k * 90, { rotation: -30, echelle: 0.4, duree: 460 }));
    document.querySelectorAll('#places .mini-main').forEach((m) => m.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 200, fill: 'backwards' }));
  }
  // cartes posées depuis le dernier dessin
  const cartesPli = [...document.querySelectorAll('#pli .carte-rc')];
  const dejaVues = prev.numPli === etat.numPli && prev.manche === etat.manche ? prev.pli : (prev.manche === etat.manche && prev.numPli === etat.numPli - 1 ? prev.pli : 0);
  cartesPli.slice(dejaVues).forEach((c, k) => {
    const j = c.dataset.j;
    const depuis = (Number(j) === maPlace && avant.main[c.dataset.id]) || avant.plaques[j] || plaqueDe(Number(j));
    arriver(c, depuis, k * 120, { rotation: Number(j) === maPlace ? 0 : -25, echelle: Number(j) === maPlace ? 1 : 0.5 });
  });
  // révélation des annonces
  A.bulles.forEach((b, k) => b.animate([{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1.15)', offset: 0.7 }, { opacity: 1, transform: 'none' }], { duration: 380, delay: k * 120, fill: 'backwards' }));
  const delaiScores = etat.status === 'bilan' ? Math.max(0, bilanApres - Date.now()) + 300 : 0;
  A.scores.forEach(({ e, de, a }) => compter(e, de, a, delaiScores));
}

const etatLogique = () => ({
  place: maPlace, partie: etat.partie, manche: etat.manche, status: etat.status,
  numPli: etat.numPli, pli: etat.pli.length,
});

function rendre(sansAnim = false) {
  if (!etat) return;
  const prev = precedent;
  const avant = instantane();
  // un pli vient d'être complété : il reste affiché un instant avant de partir chez son gagnant
  const d = etat.dernierPli;
  const cle = d ? `${etat.partie}-${etat.manche}-${d.num}` : null;
  if (cle && cle !== dernierPliVu) {
    const premierDessin = !prev;
    dernierPliVu = cle;
    if (!premierDessin && !sansAnimation()) {
      pliFini = { cle };
      if (etat.status === 'bilan') bilanApres = Date.now() + 1900;
      setTimeout(() => { if (pliFini && pliFini.cle === cle && !etat.pli.length) ramasserPli(); }, 1350);
      setTimeout(() => { if (pliFini && pliFini.cle === cle) { pliFini = null; rendre(true); } }, 1900);
    }
  }
  if (pliFini && etat.pli.length) pliFini = null; // la suite a déjà commencé
  A = {
    scores: [], bulles: [],
    revele: !!prev && prev.status === 'annonces' && etat.status === 'jeu',
  };
  rendrePlaces();
  rendrePli();
  rendreMain();
  rendreCentre();
  rendrePanneaux();
  if (!sansAnim) animer(prev, avant);
  else A.scores.forEach(({ e, de, a }) => compter(e, de, a, 200));
  precedent = etatLogique();
}
