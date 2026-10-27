import { $, el, toast, initSalon, initRegles, de } from '../commun/salon.js';
import * as R from './regles.js';

const NOMS_BOTS = ['Gégé', 'Josiane', 'Le Baron', 'Mamie Lulu', 'Bébert', 'La Comtesse', 'Tonton Raoul'];
const MAX_JOUEURS = 8;

let etat = null;
let maPlace = 0;
let selection = [];   // cartes choisies dans ma main

const melanger = (t) => { const a = [...t]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const salon = initSalon({
  jeu: 'president',
  etatInitial: (nom, nb, { local }) => {
    const joueur = (name, joined, bot = false) => ({ name, joined, bot, score: 0 });
    const joueurs = Array.from({ length: nb }, (_, i) => joueur(i === 0 ? nom : 'En attente', i === 0));
    const bots = parseInt($(local ? 'local-bots' : 'ligne-bots').value, 10) || 0;
    melanger(NOMS_BOTS).slice(0, bots).forEach((n) => joueurs.push(joueur(n, true, true)));
    // variantes choisies par celui qui crée la partie
    const options = {
      revolution: false, // (l'ancienne variante « carré qui inverse l'ordre » n'est plus proposée)
      revolutionTrou: $('opt-revolution-trou').checked,
      ouRien: $('opt-ourien').checked,
      carre: $('opt-carre').checked,
      rapidite: $('opt-carre').checked && $('opt-rapidite').checked,
      manches: parseInt($('opt-manches').value, 10) || 0,
    };
    return { players: joueurs, options };
  },
  validerLocal: () => {
    const total = parseInt($('local-nb').value, 10) + parseInt($('local-bots').value, 10);
    if (total < 3) return 'Il faut au moins 3 joueurs : ajoute des bots ou des joueurs.';
    if (total > MAX_JOUEURS) return `${MAX_JOUEURS} places maximum autour de la table.`;
    return '';
  },
  validerEnLigne: () => {
    const total = parseInt($('nb-joueurs').value, 10) + parseInt($('ligne-bots').value, 10);
    if (total < 3) return 'Il faut au moins 3 joueurs : ajoute un bot.';
    if (total > MAX_JOUEURS) return `${MAX_JOUEURS} places maximum : enlève des bots.`;
    return '';
  },
  demarrer: (s) => R.nouvellePartie(s),
  afficher: (s, place) => {
    if (place !== maPlace) selection = [];
    // quelqu'un a joué entre-temps (rapidité, pli ramassé…) : la sélection en cours n'a plus de sens
    if (etat && s.status === 'jeu' && (s.coup !== etat.coup || s.active !== etat.active)) selection = [];
    etat = R.normaliser(s);
    maPlace = place;
    noterChangement();
    rendre();
    planifierBot();
    planifierRapide();
  },
  // Sur un seul téléphone : on le passe au joueur humain qui doit jouer (ou rendre ses cartes)
  quiDoitJouer: (s) => {
    const joueurs = s.players || [];
    if (joueurs.filter((p) => !p.bot).length <= 1) return -1;
    if (s.status === 'echange') {
      const d = (s.dons || []).find((x) => !x.fait && joueurs[x.de] && !joueurs[x.de].bot);
      return d ? d.de : -1;
    }
    if (s.status === 'jeu' && joueurs[s.active] && !joueurs[s.active].bot) return s.active;
    return -1;
  },
  secret: true,
});
initRegles();
// la rapidité sert à finir un carré : sans la règle du carré, elle n'a pas de sens
function majOptionsCarre() {
  const r = $('opt-rapidite');
  r.disabled = !$('opt-carre').checked;
  if (r.disabled) r.checked = false;
  r.closest('.option').classList.toggle('desactivee', r.disabled);
}
$('opt-carre').addEventListener('change', majOptionsCarre);
majOptionsCarre();
const agir = (fn) => salon.agir((s) => fn(R.normaliser(s)));

// ---------- Bots ----------
let botPrevu = '';
function botAttendu(s) {
  if (s.status === 'echange') {
    const d = s.dons.find((x) => !x.fait && s.players[x.de].bot);
    return d ? d.de : -1;
  }
  if (s.status === 'jeu' && s.players[s.active] && s.players[s.active].bot) return s.active;
  return -1;
}
function planifierBot() {
  if (!etat || botAttendu(etat) < 0) return;
  const cle = `${etat.partie}-${etat.manche}-${etat.coup}`;
  if (botPrevu === cle) return;
  botPrevu = cle;
  const coup = etat.coup;
  let delai = 800 + Math.random() * 600;
  if (etat.status === 'jeu' && !etat.tas.length && etat.dernierPli) delai = 1700 + Math.random() * 400; // on laisse voir le pli
  if (etat.evenement && etat.evenement.type === 'revolution') delai += 1200;
  setTimeout(() => {
    agir((s) => {
      if (s.coup !== coup) return false;
      const i = botAttendu(s);
      if (i < 0) return false;
      if (s.status === 'echange') return R.donner(s, i, R.donBot(s, i));
      let ok = false;
      try {
        const c = R.coupBot(s, i);
        ok = c.type === 'jouer' ? R.jouer(s, i, c.ids) : R.passer(s, i);
      } catch (err) { console.error('Bot : erreur', err); }
      // en dernier recours : passer, ou poser sa plus petite carte (la partie ne bloque jamais)
      return ok || R.passer(s, i) || R.jouer(s, i, [R.trierMain(s.players[i].main, s.revolution)[0]]);
    });
  }, delai);
}
// Rapidité : un bot qui peut compléter le carré le fait hors de son tour, s'il est assez rapide
let rapidePrevu = '';
function planifierRapide() {
  if (!etat || !etat.options.rapidite || etat.status !== 'jeu') return;
  const cle = `${etat.partie}-${etat.manche}-${etat.coup}`;
  if (rapidePrevu === cle) return;
  rapidePrevu = cle;
  const coup = etat.coup;
  etat.players.forEach((p, i) => {
    if (!p.bot || i === etat.active || !R.rapideBot(etat, i) || Math.random() < 0.3) return;
    setTimeout(() => agir((s) => {
      if (s.coup !== coup) return false;
      const ids = R.rapideBot(s, i);
      return ids ? R.jouer(s, i, ids) : false;
    }), 1100 + Math.random() * 1500);
  });
}
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
const moi = () => etat.players[maPlace];
const monTour = () => etat && etat.status === 'jeu' && etat.active === maPlace && !pliAffiche;
const monDon = () => etat && etat.status === 'echange' && etat.dons.find((d) => d.de === maPlace && !d.fait);

function clicCarte(c) {
  if (pliAffiche) return;
  const don = monDon();
  if (don) {
    // choix des cartes à rendre : n'importe lesquelles
    if (selection.includes(c)) selection = selection.filter((x) => x !== c);
    else if (selection.length < don.nb) selection = [...selection, c];
    else selection = [...selection.slice(1), c];
    rendreMain(); rendreBoutons();
    return;
  }
  // rapidité : une des cartes qui peuvent finir le carré
  const rapide = rapideHumain();
  if (rapide && R.valeurDe(c) === R.valeurDe(rapide[0])) { jouerRapide(); return; }
  if (!monTour()) {
    toast(etat.status === 'echange' ? 'Attends la fin de l\'échange des cartes.' : 'Ce n\'est pas ton tour.');
    return;
  }
  const v = R.valeurDe(c);
  const memes = R.trierMain(moi().main.filter((x) => R.valeurDe(x) === v));
  const b = R.aBattre(etat);
  // si ces cartes peuvent finir le carré, c'est ce qui est proposé d'abord
  const m = b && R.manquePourCarre(etat);
  const nbVoulu = b ? (m && m.v === v && memes.length >= m.nb ? m.nb : b.nb) : 0;
  const nbMax = b ? Math.max(b.nb, nbVoulu) : 4;
  if (selection.includes(c)) {
    selection = selection.filter((x) => x !== c);
  } else if (selection.length && R.valeurDe(selection[0]) === v) {
    selection = [...selection, c];
  } else {
    // on touche une valeur : la combinaison demandée est choisie d'un coup (ou toutes ces cartes, si on ouvre)
    selection = b ? [c, ...memes.filter((x) => x !== c)].slice(0, nbVoulu) : memes;
  }
  if (selection.length > nbMax) selection = selection.slice(-nbMax);
  rendreMain(); rendreBoutons();
}
$('btn-jouer').addEventListener('click', () => {
  const don = monDon();
  const ids = [...selection];
  if (don) {
    if (ids.length !== don.nb) return;
    selection = [];
    agir((s) => R.donner(s, maPlace, ids));
    return;
  }
  if (!monTour() || !R.coupValide(etat, maPlace, ids)) return;
  selection = [];
  agir((s) => R.jouer(s, maPlace, ids));
});
// Rapidité : compléter le carré sans attendre son tour
function rapideHumain() {
  if (!etat || !etat.options.rapidite || etat.status !== 'jeu' || etat.active === maPlace || pliAffiche) return null;
  const m = R.manquePourCarre(etat);
  if (!m) return null;
  const cartes = moi().main.filter((c) => R.valeurDe(c) === m.v);
  return cartes.length >= m.nb ? cartes.slice(0, m.nb) : null;
}
// on touche une des cartes qui brillent : elles partent tout de suite (il faut être le plus rapide)
function jouerRapide() {
  const ids = rapideHumain();
  if (!ids) return;
  selection = [];
  let ok = false;
  agir((s) => { ok = R.jouer(s, maPlace, ids); return ok; }).then(() => { if (!ok) toast('Trop tard ! Quelqu\'un a joué avant toi.'); });
}
$('btn-passer').addEventListener('click', () => {
  if (!monTour() || (selection.length && R.coupValide(etat, maPlace, selection))) return;
  selection = [];
  agir((s) => R.passer(s, maPlace));
});
$('btn-manche-suivante').addEventListener('click', () => agir((s) => R.mancheSuivante(s)));
$('btn-nouvelle-partie').addEventListener('click', () => agir((s) => {
  if (s.status !== 'termine') return false;
  R.nouvellePartie(s);
  return true;
}));
$('btn-scores').addEventListener('click', () => { rendreScores(); $('dialog-scores').showModal(); });
$('fermer-scores').addEventListener('click', () => $('dialog-scores').close());

function majHauteurBarre() {
  const b = document.querySelector('.barre');
  if (b) document.documentElement.style.setProperty('--h-barre', `${b.offsetHeight}px`);
}
window.addEventListener('resize', () => { majHauteurBarre(); if (etat) serrerMain(); });
majHauteurBarre();

// ---------- Cartes ----------
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
function carteEl(id) {
  const e = el('div', 'carte-pr');
  const v = R.valeurDe(id); const s = R.couleurDe(id);
  e.dataset.id = id;
  if (s === '♥' || s === '♦') e.classList.add('rouge');
  const nom = FIGURES[v] || v;
  const indice = (bas) => {
    const i = el('span', 'indice' + (bas ? ' bas' : ''));
    i.append(el('b', '', nom), el('i', '', s));
    return i;
  };
  const face = el('span', 'face');
  if (FIGURES[v]) {
    e.classList.add('figure');
    const cadre = el('span', 'cadre');
    cadre.append(el('b', '', nom), el('i', '', s));
    face.appendChild(cadre);
  } else if (v === 'A') {
    e.classList.add('as');
    face.appendChild(el('i', 'pip', s));
  } else {
    PIPS[v].forEach(([x, y]) => {
      const p = el('i', 'pip' + (y > 50 ? ' renverse' : ''), s);
      p.style.left = `${x}%`;
      p.style.top = `${y}%`;
      face.appendChild(p);
    });
  }
  e.append(indice(false), face, indice(true));
  e.setAttribute('aria-label', `${R.nomValeur(v)} ${s}`);
  return e;
}
const decrireCoup = (ids) => {
  const v = R.valeurDe(ids[0]);
  if (ids.length === 1) return `un ${R.nomValeur(v)}`.replace('un As', 'un As').replace('un Dame', 'une Dame');
  return `${['', '', 'une paire', 'un brelan', 'un carré'][ids.length]} de ${R.nomValeur(v, 2)}`;
};

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
  const e = 2 / 4;
  return { x: 50 + 50 * r * Math.sign(c) * Math.abs(c) ** e, y: 50 + 50 * r * Math.sign(s) * Math.abs(s) ** e };
}
const ROLE_FINI = (n, r) => {
  if (r === 1) return 'president';
  if (r === n) return 'trou';
  if (n >= 4 && r === 2) return 'vice';
  if (n >= 4 && r === n - 1) return 'vicetrou';
  return 'neutre';
};
function bulle(p, i) {
  const n = etat.players.length;
  if (etat.status === 'echange') {
    const d = etat.dons.find((x) => x.de === i);
    if (d) return { t: d.fait ? '✓ a rendu ses cartes' : 'choisit les cartes à rendre…', c: d.fait ? 'ok' : 'attente' };
    const r = etat.dons.find((x) => x.a === i);
    if (r) return { t: `a donné ${r.nb} carte${r.nb > 1 ? 's' : ''}`, c: 'trop' };
    return null;
  }
  if (etat.status === 'jeu' || etat.status === 'fin') {
    if (p.fini) { const role = R.ROLES[ROLE_FINI(n, p.fini)]; return { t: `${role.ico} ${role.nom}`, c: p.fini === 1 ? 'juste' : p.fini === n ? 'trop' : 'ok' }; }
    if (p.aPasse && etat.status === 'jeu') return { t: 'passe', c: 'attente' };
    if (etat.status === 'jeu' && etat.active === i && p.bot && !pliAffiche) return { t: 'réfléchit…', c: 'attente' };
  }
  return null;
}
const scoresAffiches = [];
const pts = (n) => `${n} pt${Math.abs(n) > 1 ? 's' : ''}`;
function plaqueEl(p, i, avecMain) {
  const plaque = el('div', 'plaque-pr');
  const avatar = el('span', 'avatar', p.bot ? '🤖' : (p.name || '?').trim().charAt(0).toUpperCase());
  avatar.style.setProperty('--teinte', String((i * 67 + 120) % 360));
  if (p.role) {
    const r = R.ROLES[p.role];
    const badge = el('span', 'badge-role', r.ico);
    badge.title = r.nom;
    avatar.appendChild(badge);
  }
  const txt = el('span', 'plaque-txt');
  txt.appendChild(el('strong', 'nom', p.name + (i === maPlace && !salon.estLocal() ? ' (toi)' : '')));
  const score = el('span', 'score-total', pts(p.score));
  txt.appendChild(score);
  plaque.append(avatar, txt);
  if (avecMain) {
    const mini = el('span', 'mini-main');
    for (let k = 0; k < Math.min(p.main.length, 4); k++) mini.appendChild(el('i', 'mini-dos'));
    mini.appendChild(el('b', 'mini-nb', String(p.main.length)));
    plaque.appendChild(mini);
  }
  if (scoresAffiches[i] !== undefined && scoresAffiches[i] !== p.score) A.scores.push({ e: score, de: scoresAffiches[i], a: p.score });
  scoresAffiches[i] = p.score;
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
    const siege = el('div', 'siege-pr');
    siege.dataset.i = String(i);
    if (pos.y < 30) siege.classList.add('haut');
    if (pos.x < 16) siege.classList.add('bord-g');
    if (pos.x > 84) siege.classList.add('bord-d');
    if ((etat.status === 'jeu' && etat.active === i && !pliAffiche) || (etat.status === 'echange' && etat.dons.some((d) => d.de === i && !d.fait))) siege.classList.add('actif');
    if (p.fini) siege.classList.add('fini');
    siege.style.left = `${pos.x}%`;
    siege.style.top = `${pos.y}%`;
    siege.appendChild(plaqueEl(p, i, true));
    const b = bulle(p, i);
    if (b) siege.appendChild(el('span', `bulle ${b.c}`, b.t));
    zone.appendChild(siege);
  }
  const p = moi();
  const zm = $('moi');
  zm.innerHTML = '';
  zm.dataset.i = String(maPlace);
  zm.classList.toggle('actif', monTour() || !!monDon());
  zm.appendChild(plaqueEl(p, maPlace, false));
  const b = bulle(p, maPlace);
  if (b) zm.appendChild(el('span', `bulle ${b.c}`, b.t));
}

// ---------- Le tas au centre ----------
let pliAffiche = null;   // le pli qui vient d'être ramassé reste visible un instant
let dernierPliVu = null;
function rendreTas() {
  const zone = $('tas');
  zone.innerHTML = '';
  let coups = etat.tas.slice(-3);
  if (pliAffiche && etat.dernierPli && !etat.tas.length) coups = [{ j: etat.dernierPli.j, cartes: etat.dernierPli.cartes, ferme: true }];
  coups.forEach((t, k) => {
    const g = el('div', 'coup' + (k === coups.length - 1 ? ' dernier' : '') + (t.ferme ? ' ferme' : ''));
    g.dataset.j = String(t.j);
    g.dataset.cle = t.cartes.join(',');
    g.style.setProperty('--k', String(coups.length - 1 - k));
    g.style.setProperty('--rot', `${((t.j * 29 + k * 13) % 15) - 7}deg`);
    t.cartes.forEach((c) => g.appendChild(carteEl(c)));
    if (k === coups.length - 1) g.appendChild(el('span', 'qui', etat.players[t.j].name));
    zone.appendChild(g);
  });
  if (!coups.length) zone.appendChild(el('div', 'tas-vide', ''));
}

// ---------- Ma main ----------
function rendreMain() {
  const zone = $('main');
  zone.innerHTML = '';
  const p = moi();
  selection = selection.filter((c) => p.main.includes(c));
  const tour = monTour();
  const don = monDon();
  const b = tour ? R.aBattre(etat) : null;
  const rapideMain = rapideHumain();
  const rapideVal = rapideMain ? R.valeurDe(rapideMain[0]) : null;
  const jouables = new Set();
  if (tour) {
    const parValeur = {};
    p.main.forEach((c) => { (parValeur[R.valeurDe(c)] = parValeur[R.valeurDe(c)] || []).push(c); });
    Object.entries(parValeur).forEach(([v, cs]) => {
      const m = b && R.manquePourCarre(etat);
      const ok = !b || (m && m.v === v && cs.length >= m.nb) || (cs.length >= b.nb && (b.ouRien ? v === b.ouRien : R.force(v, etat.revolution) >= R.force(b.v, etat.revolution)));
      if (ok) cs.forEach((c) => jouables.add(c));
    });
    // une carte choisie qui n'est plus jouable (le pli a changé) est reposée
    selection = selection.filter((c) => jouables.has(c));
  }
  R.trierMain(p.main, etat.revolution).forEach((c) => {
    const e = carteEl(c);
    if (tour) e.classList.add(jouables.has(c) ? 'jouable' : 'interdite');
    // rapidité : les cartes qui peuvent finir le carré brillent ; il suffit de toucher l'une d'elles
    if (rapideVal && R.valeurDe(c) === rapideVal) { e.classList.add('rapide'); e.title = 'Touche vite pour finir le carré !'; }
    if (don) e.classList.add('jouable');
    if ((p.recu || []).includes(c) && etat.status === 'echange') e.classList.add('recue');
    if (selection.includes(c)) e.classList.add('choisie');
    e.addEventListener('click', () => { if (tour && !jouables.has(c)) { toast(texteABattre(b)); return; } clicCarte(c); });
    zone.appendChild(e);
  });
  serrerMain();
}
function texteABattre(b) {
  if (!b) return '';
  const quoi = ['', 'une carte', 'une paire', 'un brelan', 'un carré'][b.nb];
  if (b.ouRien) return `${R.nomValeur(b.ouRien)} ou rien : il faut poser ${quoi} de ${R.nomValeur(b.ouRien, b.nb)}, ou passer.`;
  return `Il faut poser ${quoi} de ${R.nomValeur(b.v, b.nb)} ou plus fort, ou passer.`;
}
function serrerMain() {
  const zone = $('main');
  // on remet toutes les cartes sur une seule rangée pour mesurer
  const cartes = [...zone.querySelectorAll('.carte-pr')];
  cartes.forEach((c) => { c.style.marginLeft = ''; zone.appendChild(c); });
  zone.querySelectorAll('.rang').forEach((r) => r.remove());
  zone.classList.remove('deux-rangs');
  if (cartes.length < 2) return;
  const largeur = cartes[0].offsetWidth;
  const dispo = zone.clientWidth - 12;
  if (!largeur || !dispo) { if (zone.offsetParent) requestAnimationFrame(serrerMain); return; }
  let rangs = [cartes];
  // téléphone debout et beaucoup de cartes : deux rangées, pour que chaque carte soit facile à toucher
  const visible = (dispo - largeur) / (cartes.length - 1);
  if (window.matchMedia('(orientation: portrait)').matches && cartes.length >= 8 && visible < largeur * 0.5) {
    // on coupe entre deux valeurs, le plus près possible du milieu
    const milieu = cartes.length / 2;
    let coupe = Math.ceil(milieu);
    let meilleur = Infinity;
    for (let k = 1; k < cartes.length; k++) {
      if (R.valeurDe(cartes[k].dataset.id) === R.valeurDe(cartes[k - 1].dataset.id)) continue;
      if (Math.abs(k - milieu) < meilleur) { meilleur = Math.abs(k - milieu); coupe = k; }
    }
    rangs = [cartes.slice(0, coupe), cartes.slice(coupe)];
    zone.classList.add('deux-rangs');
    rangs.forEach((r) => {
      const d = el('div', 'rang');
      r.forEach((c) => d.appendChild(c));
      zone.appendChild(d);
    });
  }
  rangs.forEach((r) => {
    if (r.length < 2) return;
    const ecart = Math.min(largeur * 0.08, (dispo - largeur) / (r.length - 1) - largeur);
    r.slice(1).forEach((c) => { c.style.marginLeft = `${ecart}px`; });
    const milieu = (r.length - 1) / 2;
    r.forEach((c, k) => {
      // léger éventail : l'écart vertical reste petit pour que les cartes du bord restent entières
      c.style.setProperty('--angle', `${(k - milieu) * Math.min(2.2, 24 / r.length)}deg`);
      c.style.setProperty('--creux', `${Math.min(12, Math.abs(k - milieu) ** 2 * Math.min(1.4, 14 / r.length ** 1.4))}px`);
    });
  });
}

// Quand on ouvre avec plusieurs cartes de la même valeur : choisir d'un geste 1 carte, une paire, un brelan ou un carré
function rendreChoixCombo() {
  const zone = $('choix-combo');
  zone.innerHTML = '';
  $('message').classList.remove('sous-combo'); // le message du centre se cache derrière le choix
  const tour = monTour();
  const b = tour ? R.aBattre(etat) : null;
  if (!tour || !selection.length) { zone.hidden = true; return; }
  const v = R.valeurDe(selection[0]);
  const memes = R.trierMain(moi().main.filter((c) => R.valeurDe(c) === v));
  // les nombres de cartes permis : tout quand on ouvre ; sinon celui du coup précédent, ou de quoi compléter le carré
  const nombres = [];
  for (let n = 1; n <= memes.length; n++) if (R.coupValide(etat, maPlace, memes.slice(0, n))) nombres.push(n);
  if (nombres.length < 2) { zone.hidden = true; return; }
  zone.hidden = false;
  $('message').classList.add('sous-combo');
  const m = b && R.manquePourCarre(etat);
  const nomV = FIGURES[v] || v;
  zone.appendChild(el('p', 'combo-titre', `Combien de ${R.nomValeur(v, 2)} ?`));
  const rangee = el('div', 'combo-rangee');
  for (const n of nombres) {
    const bt = el('button', `combo${selection.length === n ? ' actif' : ''}`);
    bt.type = 'button';
    bt.setAttribute('aria-pressed', String(selection.length === n));
    // un petit éventail de n cartes
    const pile = el('span', 'combo-pile');
    memes.slice(0, n).forEach((c, k) => {
      const mc = el('span', 'mini-carte' + (['♥', '♦'].includes(R.couleurDe(c)) ? ' rouge' : ''));
      mc.style.setProperty('--k', String(k - (n - 1) / 2));
      mc.append(el('b', '', nomV), el('i', '', R.couleurDe(c)));
      pile.appendChild(mc);
    });
    bt.appendChild(pile);
    bt.appendChild(el('span', 'combo-nom', ['', '1 carte', 'Paire', 'Brelan', 'Carré'][n]));
    if (m && m.v === v && m.nb === n && n !== b.nb) bt.appendChild(el('span', 'combo-plus', 'finit le carré'));
    bt.addEventListener('click', () => {
      selection = [...selection.filter((c) => memes.includes(c)), ...memes.filter((c) => !selection.includes(c))].slice(0, n);
      rendreMain(); rendreBoutons();
    });
    rangee.appendChild(bt);
  }
  zone.appendChild(rangee);
}

function rendreBoutons() {
  rendreChoixCombo();
  const jouer = $('btn-jouer');
  const passer = $('btn-passer');
  const don = monDon();
  if (don) {
    jouer.hidden = false;
    passer.hidden = true;
    jouer.disabled = selection.length !== don.nb;
    jouer.textContent = selection.length === don.nb ? `Donner ${selection.length > 1 ? 'ces cartes' : 'cette carte'}` : `Choisis ${don.nb} carte${don.nb > 1 ? 's' : ''} à rendre`;
    return;
  }
  const tour = monTour();
  jouer.hidden = !tour;
  passer.hidden = !tour || !etat.tas.length;
  // des cartes sont choisies : on ne peut pas passer par erreur (il faut d'abord les reposer)
  // on ne peut pas passer par erreur avec une combinaison jouable sélectionnée (une sélection impossible ne bloque jamais)
  passer.disabled = selection.length > 0 && R.coupValide(etat, maPlace, selection);
  passer.title = passer.disabled ? 'Retouche tes cartes choisies pour les reposer, puis tu pourras passer' : '';
  if (!tour) return;
  const ok = selection.length > 0 && R.coupValide(etat, maPlace, selection);
  jouer.disabled = !ok;
  jouer.textContent = ok ? `Jouer ${decrireCoup(selection)}` : 'Jouer';
}

function rendreCentre() {
  const n = etat.players.length;
  const morceaux = [];
  if (etat.status === 'termine') morceaux.push('Partie terminée');
  else {
    morceaux.push(`Manche ${etat.manche}${etat.options.manches ? ` / ${etat.options.manches}` : ''}`);
    if (etat.revolution) morceaux.push('⟲ Révolution');
  }
  $('manche-info').textContent = morceaux.join(' · ');
  $('tapis').classList.toggle('revolution', !!etat.revolution);
  let texte = '';
  const p = moi();
  if (etat.status === 'echange') {
    const don = monDon();
    const recu = (p.recu || []).map((c) => `${R.nomValeur(R.valeurDe(c))} ${R.couleurDe(c)}`).join(', ').replace(/, ([^,]*)$/, ' et $1');
    const r = etat.dons.find((x) => x.a === maPlace);
    if (don) texte = `${recu ? `Tu reçois ${recu}. ` : ''}Choisis ${don.nb} carte${don.nb > 1 ? 's' : ''} à rendre.`;
    else if (r) texte = `Tu donnes ${(p.donne || []).map((c) => `${R.nomValeur(R.valeurDe(c))} ${R.couleurDe(c)}`).join(', ').replace(/, ([^,]*)$/, ' et $1')}. En attente…`;
    else texte = 'Échange des cartes entre le Président et le Trou du cul…';
    if (etat.echangeDouble) texte = `✊ Révolution : échange à 4 cartes ! ${texte}`;
  } else if (etat.status === 'jeu') {
    if (pliAffiche) texte = '';
    else if (monTour()) texte = etat.tas.length ? texteABattre(R.aBattre(etat)).replace(' ou rien : il faut poser', ' ou rien ! À toi : pose').replace('Il faut poser', 'À toi : pose').replace(', ou passer.', ', ou passe.') : 'À toi d\'ouvrir : pose ce que tu veux';
    else texte = `Au tour ${de(etat.players[etat.active].name)}…`;
  } else if (etat.status === 'fin') texte = '';
  if (n && etat.status === 'jeu' && p.fini) texte = `Tu as fini : ${R.ROLES[ROLE_FINI(n, p.fini)].nom} ! ${texte}`;
  $('message').textContent = texte;
  $('message').classList.toggle('vide', !texte);
}

// ---------- Panneaux ----------
function montrer(id, visible) {
  const e = $(id);
  if (e.hidden === visible) {
    e.hidden = !visible;
    if (visible && !sansAnimation()) e.animate([{ opacity: 0, transform: 'translate(-50%, -46%) scale(.94)' }, { opacity: 1, transform: 'translate(-50%, -50%)' }], { duration: 260, easing: 'ease-out' });
  }
}
function rendrePanneaux() {
  const bilan = etat.status === 'fin' && !pliAffiche;
  montrer('panneau-bilan', bilan);
  if (bilan) {
    $('bilan-titre').textContent = `Fin de la manche ${etat.bilan.manche}`;
    const ol = $('bilan-liste');
    ol.innerHTML = '';
    etat.bilan.lignes.forEach((l) => {
      const r = R.ROLES[l.role];
      const li = el('li', l.rang === 1 ? 'premier' : l.role === 'trou' ? 'dernier' : '');
      li.append(el('span', 'rang', r.ico), el('span', 'nom', `${etat.players[l.j].name}`), el('small', 'role', r.nom), el('b', '', `+${l.points}`));
      ol.appendChild(li);
    });
    if (etat.bilan.revolutionTrou) {
      const li = el('li', 'revolution-trou', '');
      li.append(el('span', 'rang', '✊'), el('span', 'nom', 'Révolution ! Le Trou du cul est devenu Président : à la prochaine manche, l\'échange se fait à 4 cartes.'));
      ol.appendChild(li);
    }
    const fin = etat.options.manches && etat.bilan.manche >= etat.options.manches;
    $('btn-manche-suivante').textContent = fin ? 'Voir le classement' : 'Manche suivante';
  }
  montrer('panneau-fin', etat.status === 'termine');
  if (etat.status === 'termine') {
    const cl = R.classementGeneral(etat);
    $('fin-titre').textContent = `${cl[0].nom} remporte la partie !`;
    const ol = $('fin-liste');
    ol.innerHTML = '';
    cl.forEach((x, k) => {
      const li = el('li', k === 0 ? 'premier' : '');
      li.append(el('span', 'rang', ['🥇', '🥈', '🥉'][k] || `${k + 1}.`), el('span', 'nom', x.nom),
        el('small', 'role', `${x.presidences} fois Président`), el('b', '', pts(x.score)));
      ol.appendChild(li);
    });
  }
}
function rendreScores() {
  const t = $('table-scores');
  t.innerHTML = '';
  const tete = el('tr');
  tete.appendChild(el('th', '', 'Manche'));
  etat.players.forEach((p) => tete.appendChild(el('th', '', p.name)));
  t.appendChild(tete);
  const nb = Math.max(0, ...etat.players.map((p) => p.rangs.length));
  const n = etat.players.length;
  for (let m = 0; m < nb; m++) {
    const tr = el('tr');
    tr.appendChild(el('td', 'manche', String(m + 1)));
    etat.players.forEach((p) => {
      const r = p.rangs[m];
      const role = r ? R.ROLES[ROLE_FINI(n, r)] : null;
      const td = el('td', r === 1 ? 'reussi' : r === n ? 'rate' : '');
      td.textContent = role ? `${role.ico} +${n - r}` : '–';
      td.title = role ? role.nom : '';
      tr.appendChild(td);
    });
    t.appendChild(tr);
  }
  const tot = el('tr', 'totaux');
  tot.appendChild(el('td', 'manche', 'Total'));
  etat.players.forEach((p) => tot.appendChild(el('td', '', String(p.score))));
  t.appendChild(tot);
}

// ---------- Animations ----------
const sansAnimation = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const centre = (r) => [r.left + r.width / 2, r.top + r.height / 2];
let A = null;
let precedent = null;
const plaqueDe = (i) => {
  const s = i === maPlace ? $('moi') : document.querySelector(`#places .siege-pr[data-i="${i}"]`);
  const p = s && s.querySelector('.plaque-pr');
  return (p || $('tapis')).getBoundingClientRect();
};
function arriver(e, depuis, delai, { rotation = 0, echelle = 0.6, duree = 420 } = {}) {
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
function compter(e, de, a, delai) {
  setTimeout(() => {
    const t0 = performance.now();
    const pas = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      e.textContent = pts(Math.round(de + (a - de) * (1 - (1 - k) ** 3)));
      if (k < 1 && e.isConnected) requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
    e.classList.add('monte');
    setTimeout(() => e.classList.remove('monte'), 1300);
  }, delai);
}
function bandeau(texte, duree = 1800) {
  const b = $('bandeau');
  b.textContent = texte;
  b.hidden = false;
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(bandeau.t);
  bandeau.t = setTimeout(() => { b.hidden = true; }, duree);
}
// le pli ramassé glisse hors du tapis
function ramasser() {
  if (sansAnimation()) return;
  document.querySelectorAll('#tas .carte-pr').forEach((c, k) => {
    const t0 = getComputedStyle(c).transform;
    c.animate([{ transform: t0 === 'none' ? 'none' : t0, opacity: 1 }, { transform: `translate(${-140 - k * 6}px, -30px) rotate(-40deg) scale(.6)`, opacity: 0 }],
      { duration: 480, delay: k * 30, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' });
  });
}
function instantane() {
  const r = { main: {}, plaques: {} };
  document.querySelectorAll('#main .carte-pr').forEach((c) => { r.main[c.dataset.id] = c.getBoundingClientRect(); });
  return r;
}
function animer(prev, avant) {
  if (sansAnimation() || !prev || prev.place !== maPlace) { A.scores.forEach(({ e, a }) => { e.textContent = pts(a); }); return; }
  const tapis = $('tapis').getBoundingClientRect();
  // nouvelle manche : la donne
  if (prev.manche !== etat.manche || prev.partie !== etat.partie) {
    document.querySelectorAll('#main .carte-pr').forEach((c, k) => arriver(c, tapis, 80 + k * 45, { rotation: -25, echelle: 0.4, duree: 420 }));
  }
  // nouvelle combinaison posée : elle part de la main (ou de la plaque) du joueur
  const g = document.querySelector('#tas .coup.dernier');
  if (g && g.dataset.cle !== prev.dernierAffiche) {
    const j = Number(g.dataset.j);
    [...g.querySelectorAll('.carte-pr')].forEach((c, k) => {
      const depuis = (j === maPlace && avant.main[c.dataset.id]) || plaqueDe(j);
      arriver(c, depuis, k * 60, { rotation: j === maPlace ? 0 : -20, echelle: j === maPlace ? 1 : 0.45 });
    });
  }
  // échange : les cartes reçues arrivent de la plaque de celui qui donne
  const recues = document.querySelectorAll('#main .carte-pr.recue');
  if (recues.length && etat.status === 'echange' && prev.status !== 'echange') {
    const r = etat.dons.find((d) => d.de === maPlace) || etat.dons.find((d) => d.a === maPlace);
    const autre = r ? (r.de === maPlace ? r.a : r.de) : null;
    if (autre !== null) recues.forEach((c, k) => arriver(c, plaqueDe(autre), 500 + k * 120, { echelle: 0.5, duree: 600 }));
  }
  const delai = etat.status === 'fin' ? 1700 : 0;
  A.scores.forEach(({ e, de, a }) => compter(e, de, a, delai));
}

const etatLogique = () => ({
  place: maPlace, partie: etat.partie, manche: etat.manche, status: etat.status, coup: etat.coup,
  nbTas: etat.tas.length, dernierNum: etat.dernierPli ? etat.dernierPli.num : 0, dernierJ: etat.dernierPli ? etat.dernierPli.j : null,
  revolution: etat.revolution, fini: etat.players.map((p) => p.fini), ouRien: etat.ouRien,
  dernierAffiche: (document.querySelector('#tas .coup.dernier') || { dataset: {} }).dataset.cle,
});

function rendre(sansAnim = false) {
  if (!etat) return;
  const prev = precedent;
  const avant = instantane();
  // un pli vient d'être ramassé : on le laisse voir un instant
  const d = etat.dernierPli;
  const cle = d ? `${etat.partie}-${etat.manche}-${d.num}` : null;
  if (cle && cle !== dernierPliVu) {
    const premier = !prev;
    dernierPliVu = cle;
    if (!premier && !sansAnimation() && !etat.tas.length) {
      pliAffiche = cle;
      setTimeout(() => { if (pliAffiche === cle) ramasser(); }, 1050);
      setTimeout(() => { if (pliAffiche === cle) { pliAffiche = null; rendre(true); } }, 1500);
    }
  }
  if (pliAffiche && etat.tas.length) pliAffiche = null;
  // fin de manche : on laisse voir la dernière combinaison avant le bilan
  if (prev && prev.status === 'jeu' && etat.status === 'fin' && !sansAnimation()) {
    pliAffiche = 'fin';
    setTimeout(() => { if (pliAffiche === 'fin') { pliAffiche = null; rendre(true); } }, 1600);
  }
  A = { scores: [] };
  rendrePlaces();
  rendreTasOuFin();
  rendreMain();
  rendreBoutons();
  rendreCentre();
  rendrePanneaux();
  if (!sansAnim) animer(prev, avant);
  else A.scores.forEach(({ e, de, a }) => compter(e, de, a, 200));
  // événements : révolution, joueur qui finit
  if (prev && prev.place === maPlace && !sansAnim) {
    const ev = etat.evenement;
    if (ev && ev.type === 'carre' && ev.rapide && prev.coup !== etat.coup) {
      const qui = ev.j === maPlace ? 'Tu as' : `${etat.players[ev.j].name} a`;
      const coupe = ev.coupe >= 0 ? (ev.coupe === maPlace ? 'avant toi' : `avant ${etat.players[ev.coupe].name}`) : 'avant son tour';
      bandeau(`⚡ Rapidité ! ${qui} complété le carré de ${R.nomValeur(ev.v, 2)} ${coupe} : ${ev.j === maPlace ? 'tu ramasses le pli et tu rejoues' : 'il ramasse le pli et rejoue'}.`, 3000);
    } else if (ev && ev.type === 'carre' && prev.coup !== etat.coup) {
      bandeau(`Carré de ${R.nomValeur(ev.v, 2)} ! ${ev.j === maPlace ? 'Tu ramasses' : `${etat.players[ev.j].name} ramasse`} le pli et ${ev.j === maPlace ? 'rejoues' : 'rejoue'}.`, 2000);
    } else if (etat.ouRien && etat.ouRien !== prev.ouRien && etat.status === 'jeu') {
      bandeau(`${R.nomValeur(etat.ouRien)} ou rien !`, 1500);
    } else if (etat.revolution !== prev.revolution && etat.evenement && etat.evenement.type === 'revolution') {
      bandeau(etat.revolution ? '⟲ Révolution ! Le 3 devient la plus forte, le 2 la plus faible' : '⟳ Contre-révolution : retour à l\'ordre normal', 2200);
    } else {
      const n = etat.players.length;
      etat.players.forEach((p, i) => {
        if (p.fini && !prev.fini[i]) {
          const role = R.ROLES[ROLE_FINI(n, p.fini)];
          if (p.fini < n) bandeau(`${role.ico} ${p.name} ${i === maPlace ? '(toi) ' : ''}a fini : ${role.nom} !`, 1800);
        }
      });
    }
  }
  precedent = etatLogique();
}
function rendreTasOuFin() { rendreTas(); }
