import { $, el, initSalon, initRegles, de } from '../commun/salon.js';
import { nouveauPaquet } from '../commun/cartes.js';

const MISE_MIN = 10;
const JETONS_DEPART = 1000;
const RECHARGE = 1000;
const MAX_MAINS = 4;

// ---------- Règles ----------
function valeur(cartes) {
  let total = 0;
  let as = 0;
  (cartes || []).forEach((c) => {
    if (c.v === 'A') { total += 11; as++; }
    else if (['J', 'Q', 'K'].includes(c.v)) total += 10;
    else total += parseInt(c.v, 10);
  });
  while (total > 21 && as > 0) { total -= 10; as--; }
  return total;
}
const dixOuFigure = (v) => ['10', 'J', 'Q', 'K'].includes(v);
const memeValeur = (a, b) => a.v === b.v || (dixOuFigure(a.v) && dixOuFigure(b.v));
const estBlackjackCroupier = (c) => c.length === 2 && valeur(c) === 21;

// Firebase supprime les tableaux vides : on les recrée
function normaliser(s) {
  s.players = s.players || [];
  s.sabot = s.sabot || [];
  s.croupier = s.croupier || [];
  s.players.forEach((p) => {
    p.mains = p.mains || [];
    p.mains.forEach((m) => { m.cartes = m.cartes || []; });
    p.chips = p.chips || 0;
    p.reloads = p.reloads || 0;
    p.mainActive = p.mainActive || 0;
  });
  return s;
}

function tirerCarte(s) {
  if (s.sabot.length === 0) s.sabot = nouveauPaquet(2);
  return s.sabot.pop();
}

function nouvelleManche(s) {
  s.status = 'mises';
  s.active = 0;
  s.croupier = [];
  s.players.forEach((p) => { p.mains = []; p.mainActive = 0; });
  // Nouveau sabot (2 paquets mélangés) quand il en reste peu
  if (!s.sabot || s.sabot.length < 40) s.sabot = nouveauPaquet(2);
}

function distribuer(s) {
  for (let tour = 0; tour < 2; tour++) {
    s.players.forEach((p) => p.mains[0].cartes.push(tirerCarte(s)));
    s.croupier.push(tirerCarte(s));
  }
  s.players.forEach((p) => {
    if (valeur(p.mains[0].cartes) === 21) p.mains[0].etat = 'bj';
  });
  s.status = 'jeu';
  const premier = prochainAJouer(s, 0);
  if (premier < 0) tourDuCroupier(s);
  else s.active = premier;
}

// Premier joueur (à partir de `depuis`) qui a encore une main à jouer
function prochainAJouer(s, depuis) {
  for (let i = depuis; i < s.players.length; i++) {
    const idx = s.players[i].mains.findIndex((m) => m.etat === 'jeu');
    if (idx >= 0) { s.players[i].mainActive = idx; return i; }
  }
  return -1;
}

function mainSuivante(s) {
  const p = s.players[s.active];
  const idx = p.mains.findIndex((m, k) => k > p.mainActive && m.etat === 'jeu');
  if (idx >= 0) { p.mainActive = idx; return; }
  const suivant = prochainAJouer(s, s.active + 1);
  if (suivant < 0) tourDuCroupier(s);
  else s.active = suivant;
}

function tourDuCroupier(s) {
  const toutSaute = s.players.every((p) => p.mains.every((m) => m.etat === 'saute'));
  if (!toutSaute) {
    while (valeur(s.croupier) < 17) s.croupier.push(tirerCarte(s));
  }
  const d = valeur(s.croupier);
  const dBJ = estBlackjackCroupier(s.croupier);

  s.players.forEach((p) => {
    p.mains.forEach((m) => {
      const v = valeur(m.cartes);
      let retour = 0;
      if (m.etat === 'saute') { m.resultat = 'Sauté'; }
      else if (m.etat === 'bj') {
        if (dBJ) { retour = m.mise; m.resultat = 'Égalité'; }
        else { retour = Math.floor(m.mise * 2.5); m.resultat = 'Blackjack !'; }
      } else if (dBJ) { m.resultat = 'Perdu'; }
      else if (d > 21 || v > d) { retour = m.mise * 2; m.resultat = 'Gagné'; }
      else if (v === d) { retour = m.mise; m.resultat = 'Égalité'; }
      else { m.resultat = 'Perdu'; }
      m.gain = retour - m.mise;
      p.chips += retour;
    });
  });
  s.status = 'fin';
  s.lastEvent = { ts: Date.now(), type: 'fin' };
}

// ---------- Salon ----------
let etat = null;
let maPlace = 0;
let miseChoisie = 0;
let miseInit = false;          // mise proposée (la dernière) déjà posée pour ce tour de mise
let statutPrecedent = null;

const salon = initSalon({
  jeu: 'blackjack',
  etatInitial: (nom, nb) => ({
    players: Array.from({ length: nb }, (_, i) => ({
      name: i === 0 ? nom : 'En attente', joined: i === 0,
      chips: JETONS_DEPART, reloads: 0, derniereMise: 100,
    })),
  }),
  demarrer: (s) => {
    s.manche = 1;
    normaliser(s);
    nouvelleManche(s);
  },
  afficher: (s, place) => {
    const changement = place !== maPlace;
    etat = normaliser(s);
    maPlace = place;
    if (changement) { miseChoisie = 0; miseInit = false; }
    rendre();
  },
  // Mode un seul téléphone : rien de secret au Blackjack, l'écran suit le joueur dont c'est le tour
  quiDoitJouer: (s) => ((s.status === 'mises' || s.status === 'jeu') ? s.active : -1),
  secret: false,
});
initRegles();

// ---------- Actions ----------
const monTour = (s, statut) => s.status === statut && s.active === maPlace;

function agir(fn) {
  return salon.agir((s) => fn(normaliser(s)));
}

function miser() {
  const montant = miseChoisie;
  agir((s) => {
    if (!monTour(s, 'mises')) return false;
    const p = s.players[maPlace];
    if (montant < MISE_MIN || montant > p.chips) return false;
    p.chips -= montant;
    p.derniereMise = montant;
    p.mains = [{ mise: montant, cartes: [], etat: 'jeu', double: false }];
    p.mainActive = 0;
    if (s.active + 1 < s.players.length) s.active += 1;
    else distribuer(s);
  });
  miseChoisie = 0;
}

function recharger() {
  agir((s) => {
    const p = s.players[maPlace];
    if (p.chips >= MISE_MIN) return false;
    p.chips += RECHARGE;
    p.reloads += 1;
  });
}

function actionMain(fn) {
  agir((s) => {
    if (!monTour(s, 'jeu')) return false;
    const p = s.players[maPlace];
    const m = p.mains[p.mainActive];
    if (!m || m.etat !== 'jeu') return false;
    return fn(s, p, m);
  });
}

function tirer() {
  actionMain((s, p, m) => {
    m.cartes.push(tirerCarte(s));
    const v = valeur(m.cartes);
    if (v > 21) { m.etat = 'saute'; mainSuivante(s); }
    else if (v === 21) { m.etat = 'reste'; mainSuivante(s); }
  });
}

function rester() {
  actionMain((s, p, m) => { m.etat = 'reste'; mainSuivante(s); });
}

function doubler() {
  actionMain((s, p, m) => {
    if (m.cartes.length !== 2 || p.chips < m.mise) return false;
    p.chips -= m.mise;
    m.mise *= 2;
    m.double = true;
    m.cartes.push(tirerCarte(s));
    m.etat = valeur(m.cartes) > 21 ? 'saute' : 'reste';
    mainSuivante(s);
  });
}

function separer() {
  actionMain((s, p, m) => {
    if (m.cartes.length !== 2 || !memeValeur(m.cartes[0], m.cartes[1])) return false;
    if (p.chips < m.mise || p.mains.length >= MAX_MAINS) return false;
    p.chips -= m.mise;
    const [c1, c2] = m.cartes;
    m.cartes = [c1, tirerCarte(s)];
    const nouvelle = { mise: m.mise, cartes: [c2, tirerCarte(s)], etat: 'jeu', double: false };
    p.mains.splice(p.mainActive + 1, 0, nouvelle);
    // Après une séparation, 21 n'est pas un blackjack : la main s'arrête simplement
    [m, nouvelle].forEach((h) => { if (valeur(h.cartes) === 21) h.etat = 'reste'; });
    if (m.etat !== 'jeu') mainSuivante(s);
  });
}

function mainSuivanteBouton() {
  agir((s) => {
    if (s.status !== 'fin') return false;
    s.manche = (s.manche || 1) + 1;
    nouvelleManche(s);
  });
}


// ---------- Boutons (tous posés sur le tapis) ----------
document.querySelectorAll('.jeton').forEach((b) => b.addEventListener('click', () => {
  const p = etat && etat.players[maPlace];
  if (!p || !monTour(etat, 'mises')) return;
  const ajout = parseInt(b.dataset.ajout, 10);
  if (miseChoisie + ajout > p.chips) return;
  miseChoisie += ajout;
  rendreCommandes(false);
  lancerJeton(b, ajout, () => majApercuMise());   // le jeton glisse jusqu'au cercle de mise
}));
$('btn-effacer').addEventListener('click', () => {
  miseChoisie = 0;
  rendreCommandes();
});
$('btn-miser').addEventListener('click', miser);
$('btn-recharger').addEventListener('click', recharger);
$('btn-tirer').addEventListener('click', tirer);
$('btn-rester').addEventListener('click', rester);
$('btn-doubler').addEventListener('click', doubler);
$('btn-separer').addEventListener('click', separer);
$('btn-suivante').addEventListener('click', mainSuivanteBouton);

// hauteur de la barre du haut : la salle prend tout le reste de l'écran
function majHauteurBarre() {
  const b = document.querySelector('.barre');
  if (b) document.documentElement.style.setProperty('--h-barre', `${b.offsetHeight}px`);
}
window.addEventListener('resize', majHauteurBarre);
majHauteurBarre();

// ---------- Affichage ----------
// espace insécable : le « € » ne passe jamais seul à la ligne
const euros = (n) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const sansAnimation = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const PAS_DONNE = 230;        // ms entre deux cartes distribuées

// Cartes à la française, dessinées comme de vraies cartes : index dans les coins, enseignes disposées comme sur un jeu réel
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
function carteBJ(c, { cachee = false } = {}) {
  const e = el('div', 'carte-bj');
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

// Pile de jetons de casino : décomposée en valeurs, une colonne par valeur
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

// Animations à lancer une fois le tapis dessiné
let A = null;
const vus = new Map();          // clé de main → nombre de cartes déjà montrées
let trouCacheAvant = false;     // la 2e carte du croupier était-elle face cachée ?
const soldesAffiches = [];      // dernier solde affiché par joueur (pour le faire défiler)
let minuterieFin = null;

function texteScore(m, finie) {
  if (!m.cartes.length) return '';
  if (m.double && !finie) return `${valeur(m.cartes.slice(0, 2))} + ?`;
  return String(valeur(m.cartes));
}
function texteGain(m) {
  if (m.gain > 0) return `${m.resultat} +${euros(m.gain)}`;
  if (m.gain < 0) return m.resultat;
  return 'Égalité';
}

// Cercle de mise, avec les jetons misés (et le gain payé par la banque à côté)
function zoneMise(montant, { id = null, perdue = false, gain = 0 } = {}) {
  const z = el('div', 'zone-mise');
  if (id) z.id = id;
  z.appendChild(el('span', 'cercle'));
  const tas = el('div', 'tas');
  const pile = pileEl(montant);
  tas.appendChild(pile);
  if (perdue) {
    pile.classList.add('perdue');
    if (A.fin) A.pertes.push(pile); else pile.classList.add('partie');
  }
  if (gain > 0) {
    const g = pileEl(gain);
    g.classList.add('gain');
    tas.appendChild(g);
    if (A.fin) A.gains.push(g);
  }
  z.appendChild(tas);
  const m = el('span', 'montant', montant ? euros(montant) : '');
  z.appendChild(m);
  return z;
}

function blocMain(m, i, k, { active }) {
  const fin = etat.status === 'fin';
  const bloc = el('div', 'main-bj');
  if (active) bloc.classList.add('active');
  const cle = `${i}-${k}`;
  const cartes = el('div', 'main-cartes');
  const deja = vus.get(cle) || 0;
  const cacherDerniere = m.double && !fin;
  m.cartes.forEach((c, j) => {
    const e = carteBJ(c, { cachee: cacherDerniere && j === m.cartes.length - 1 });
    if (m.double && j === 2) e.classList.add('couchee'); // carte du doublé posée en travers, comme au casino
    cartes.appendChild(e);
    if (j >= deja) A.cartes.push({ e, ordre: A.donne && j < 2 && k === 0 ? [j, 0, i] : [5, i, k, j] });
  });
  vus.set(cle, m.cartes.length);
  const sc = texteScore(m, fin);
  if (sc) {
    const s = el('span', 'score' + (valeur(m.cartes) > 21 ? ' trop' : '') + (m.etat === 'bj' ? ' bj' : ''), m.etat === 'bj' ? 'BJ' : sc);
    cartes.appendChild(s);
  }
  bloc.appendChild(cartes);
  if (fin && m.resultat) {
    const r = el('span', 'resultat ' + (m.etat === 'bj' && m.gain > 0 ? 'bj' : m.gain > 0 ? 'gagne' : m.gain < 0 ? 'perdu' : 'egal'), texteGain(m));
    cartes.appendChild(r);
    if (A.fin) A.retardes.push(r);
  }
  bloc.appendChild(zoneMise(m.mise, { perdue: fin && m.gain < 0, gain: fin && m.gain > 0 ? m.gain + (m.resultat === 'Égalité' ? 0 : 0) : 0 }));
  return bloc;
}

function rendreCroupier() {
  const cacher = etat.status === 'jeu';
  const zone = $('cartes-croupier');
  zone.innerHTML = '';
  const deja = vus.get('croupier') || 0;
  etat.croupier.forEach((c, j) => {
    const cache = cacher && j === 1;
    const e = carteBJ(c, { cachee: cache });
    zone.appendChild(e);
    if (j >= deja) A.cartes.push({ e, ordre: A.donne && j < 2 ? [j, 1, 0] : [20, j] });
    else if (j === 1 && trouCacheAvant && !cache) A.trou = e;   // la carte cachée se retourne
  });
  vus.set('croupier', etat.croupier.length);
  trouCacheAvant = cacher && etat.croupier.length > 1;
  const sc = $('score-croupier');
  let texte = '';
  if (etat.croupier.length) texte = cacher ? String(valeur([etat.croupier[0]])) : String(valeur(etat.croupier));
  const trop = !cacher && valeur(etat.croupier) > 21;
  if (A.fin && etat.croupier.length) {
    // le score final s'affiche quand le croupier a fini de jouer
    sc.textContent = String(valeur([etat.croupier[0]]));
    sc.classList.remove('trop');
    A.fins.push(() => { sc.textContent = texte; sc.classList.toggle('trop', trop); pop(sc); });
  } else {
    sc.textContent = texte;
    sc.classList.toggle('trop', trop);
  }
}

function rendreSieges() {
  const zone = $('sieges');
  zone.innerHTML = '';
  const n = etat.players.length;
  zone.dataset.nb = String(n);
  const fin = etat.status === 'fin';
  etat.players.forEach((p, i) => {
    const moi = i === maPlace;
    const actif = (etat.status === 'mises' || etat.status === 'jeu') && etat.active === i;
    const siege = el('div', 'siege' + (moi ? ' moi' : '') + (actif ? ' actif' : ''));
    // position le long de l'arc de la table : -1 (à gauche) … 1 (à droite)
    const d = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;
    siege.style.setProperty('--d', d.toFixed(3));
    siege.style.setProperty('--d2', Math.abs(d).toFixed(3));
    const mains = el('div', 'mains' + (p.mains.length > 2 ? ' serrees' : ''));
    if (!p.mains.length) {
      const attente = el('div', 'main-bj attente');
      const apercu = moi && monTour(etat, 'mises');
      attente.appendChild(zoneMise(apercu ? miseChoisie : 0, { id: apercu ? 'apercu-mise' : null }));
      mains.appendChild(attente);
    }
    p.mains.forEach((m, k) => mains.appendChild(blocMain(m, i, k, {
      active: actif && etat.status === 'jeu' && p.mains.length > 1 && k === p.mainActive,
    })));
    siege.appendChild(mains);
    const plaque = el('div', 'plaque');
    plaque.appendChild(el('strong', 'nom', p.name + (moi && !salon.estLocal() && n > 1 ? ' (toi)' : '')));
    const solde = el('span', 'jetons solde', euros(p.chips));
    plaque.appendChild(solde);
    if (p.reloads) plaque.appendChild(el('span', 'recharges', `♻ ${p.reloads}`));
    // solde qui défile quand il change (après les résultats en fin de main)
    const avant = soldesAffiches[i];
    if (avant !== undefined && avant !== p.chips) {
      solde.textContent = euros(avant);
      A.soldes.push({ e: solde, de: avant, a: p.chips });
    }
    soldesAffiches[i] = p.chips;
    if (!fin && !p.mains.length && etat.status === 'mises' && !moi) plaque.appendChild(el('span', 'attente', actif ? 'mise…' : 'pas encore misé'));
    siege.appendChild(plaque);
    zone.appendChild(siege);
  });
}

function rendreMessage() {
  const msg = $('message');
  const p = etat.players[maPlace];
  const actif = etat.players[etat.active];
  let texte = '';
  if (etat.status === 'mises') {
    texte = monTour(etat, 'mises')
      ? (salon.estLocal() && etat.players.length > 1 ? `${p.name}, à toi de miser` : 'Faites vos jeux')
      : `${actif.name} choisit sa mise…`;
  } else if (etat.status === 'jeu') {
    if (monTour(etat, 'jeu')) {
      const plusieurs = p.mains.length > 1 ? ` (main ${p.mainActive + 1})` : '';
      texte = `${salon.estLocal() && etat.players.length > 1 ? `${p.name} : t` : 'T'}irer ou rester ?${plusieurs}`;
    } else {
      texte = `Au tour ${de(actif.name)}…`;
    }
  } else if (etat.status === 'fin') {
    const total = p.mains.reduce((a, m) => a + (m.gain || 0), 0);
    const qui = salon.estLocal() && etat.players.length > 1 ? `${p.name} : ` : '';
    let t = 'Égalité, mise rendue.';
    if (total > 0) t = `Gagné, +${euros(total)} !`;
    else if (total < 0) t = `Perdu, −${euros(-total)}.`;
    texte = p.mains.length ? qui + (qui ? t.charAt(0).toLowerCase() + t.slice(1) : t) : 'Main terminée.';
  }
  msg.classList.toggle('vide', !texte);
  if (A.fin) {
    msg.textContent = 'Le croupier joue…';
    A.fins.push(() => { msg.textContent = texte; pop(msg); });
  } else if (msg.textContent !== texte) {
    msg.textContent = texte;
    if (texte) pop(msg);
  }
}

function initMise() {
  const p = etat.players[maPlace];
  if (!monTour(etat, 'mises')) { miseInit = false; return; }
  if (!miseInit) {
    miseChoisie = p.chips >= MISE_MIN ? Math.min(p.derniereMise || 100, p.chips) : 0;
    miseInit = true;
  }
  miseChoisie = Math.min(miseChoisie, p.chips);
}

// Mise en préparation : les jetons dans mon cercle (sans tout redessiner)
function majApercuMise() {
  const z = document.getElementById('apercu-mise');
  if (!z) return;
  const tas = z.querySelector('.tas');
  tas.innerHTML = '';
  tas.appendChild(pileEl(miseChoisie));
  z.querySelector('.montant').textContent = miseChoisie ? euros(miseChoisie) : '';
}

function rendreCommandes(apercu = true) {
  const p = etat.players[maPlace];
  const miseTour = monTour(etat, 'mises');
  const jeuTour = monTour(etat, 'jeu');
  const panneaux = { 'panneau-mise': miseTour, 'panneau-actions': jeuTour, 'panneau-fin': etat.status === 'fin' };
  Object.entries(panneaux).forEach(([id, visible]) => {
    const e = $(id);
    if (e.hidden === visible) {
      e.hidden = !visible;
      if (visible && !sansAnimation()) e.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
    }
  });

  if (miseTour) {
    const fauche = p.chips < MISE_MIN;
    $('btn-recharger').hidden = !fauche;
    document.querySelectorAll('#panneau-mise .jetons-boutons, #panneau-mise .rangee').forEach((e) => { e.hidden = fauche; });
    document.querySelectorAll('.jeton').forEach((b) => {
      b.disabled = miseChoisie + parseInt(b.dataset.ajout, 10) > p.chips;
    });
    const btn = $('btn-miser');
    btn.disabled = miseChoisie < MISE_MIN;
    btn.textContent = miseChoisie ? `Miser ${euros(miseChoisie)}` : 'Miser';
    $('btn-effacer').disabled = !miseChoisie;
    if (apercu) majApercuMise();
  }

  if (jeuTour) {
    const m = p.mains[p.mainActive];
    const deux = m && m.cartes.length === 2;
    $('btn-doubler').disabled = !(deux && p.chips >= m.mise);
    $('btn-separer').disabled = !(deux && memeValeur(m.cartes[0], m.cartes[1]) && p.chips >= m.mise && p.mains.length < MAX_MAINS);
  }
}

// ---------- Animations ----------
const centre = (r) => [r.left + r.width / 2, r.top + r.height / 2];
function pop(e) {
  if (sansAnimation()) return;
  e.animate([{ transform: 'scale(.7)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'ease-out' });
}
// une carte part du sabot et glisse jusqu'à sa place
function distribuerCarte(e, depart, delai) {
  const r = e.getBoundingClientRect();
  const [cx, cy] = centre(r);
  const dx = depart[0] - cx; const dy = depart[1] - cy;
  const finale = getComputedStyle(e).transform;
  const debut = `translate(${dx}px, ${dy}px) rotate(-70deg) scale(.55)`;
  e.animate([
    { transform: debut, opacity: 0 },
    { transform: debut, opacity: 1, offset: 0.02 },
    { transform: finale === 'none' ? 'none' : finale, opacity: 1 },
  ], { duration: 520, delay: delai, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
}
// la carte cachée du croupier se retourne
function retourner(e, delai) {
  const dos = el('span', 'dos-retourne');
  e.appendChild(dos);
  e.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)', offset: 0.5 }, { transform: 'rotateY(0)' }], { duration: 560, delay: delai, easing: 'ease-in-out' });
  dos.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], { duration: 560, delay: delai, fill: 'forwards' })
    .finished.then(() => dos.remove()).catch(() => {});
}
function apparaitre(e, delai) {
  e.animate([{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1.12)', offset: 0.7 }, { opacity: 1, transform: 'none' }], { duration: 400, delay: delai, fill: 'backwards', easing: 'ease-out' });
}
// les jetons perdus partent vers la banque ; les gains en arrivent
function versBanque(pile, delai) {
  const [bx, by] = centre($('plateau').getBoundingClientRect());
  const [px, py] = centre(pile.getBoundingClientRect());
  pile.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${bx - px}px, ${by - py}px) scale(.5)`, opacity: 0 }], { duration: 700, delay: delai, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' });
}
function depuisBanque(pile, delai) {
  const [bx, by] = centre($('plateau').getBoundingClientRect());
  const [px, py] = centre(pile.getBoundingClientRect());
  const debut = `translate(${bx - px}px, ${by - py}px) scale(.5)`;
  pile.animate([{ transform: debut, opacity: 0 }, { transform: debut, opacity: 1, offset: 0.1 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: delai, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' });
}
function compter(e, de, a, delai) {
  if (sansAnimation()) { e.textContent = euros(a); return; }
  setTimeout(() => {
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
// un jeton lancé de la main du joueur jusqu'à son cercle de mise
function lancerJeton(bouton, valeurJeton, ensuite) {
  const cible = document.querySelector('#apercu-mise .cercle');
  if (!cible || sansAnimation()) { ensuite(); return; }
  const r = bouton.getBoundingClientRect();
  const [cx, cy] = centre(cible.getBoundingClientRect());
  const j = el('span', 'jeton-vol');
  j.dataset.ajout = String(valeurJeton);
  Object.assign(j.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  document.body.appendChild(j);
  const [bx, by] = centre(r);
  j.animate([
    { transform: 'none' },
    { transform: `translate(${(cx - bx) * 0.5}px, ${(cy - by) * 0.5 - 40}px) scale(.85) rotate(160deg)`, offset: 0.5 },
    { transform: `translate(${cx - bx}px, ${cy - by}px) scale(.55, .42) rotate(320deg)` },
  ], { duration: 420, easing: 'ease-in-out' }).finished.then(() => { j.remove(); ensuite(); }).catch(() => { j.remove(); ensuite(); });
}
// main suivante : les cartes sont ramassées vers la défausse, les jetons gagnés vers leur joueur
function balayer() {
  if (sansAnimation()) return;
  const [dx0, dy0] = centre($('defausse').getBoundingClientRect());
  const cartes = [...document.querySelectorAll('#feutre .carte-bj')];
  cartes.forEach((c, k) => {
    const r = c.getBoundingClientRect();
    if (!r.width) return;
    const w = c.offsetWidth; const h = c.offsetHeight;
    const [cx, cy] = centre(r);
    const clone = c.cloneNode(true);
    clone.classList.add('balayee');
    const transformInitial = getComputedStyle(c).transform;
    Object.assign(clone.style, { left: `${cx - w / 2}px`, top: `${cy - h / 2}px`, width: `${w}px`, height: `${h}px` });
    clone.style.setProperty('--l', `${w}px`);
    document.body.appendChild(clone);
    const t0 = transformInitial === 'none' ? '' : transformInitial;
    clone.animate([
      { transform: t0 || 'none', opacity: 1 },
      { transform: `translate(${dx0 - cx}px, ${dy0 - cy}px) rotate(${(k % 2 ? 1 : -1) * (8 + k * 3)}deg) scale(.45)`, opacity: 0.2 },
    ], { duration: 560, delay: k * 40, easing: 'cubic-bezier(.5,0,.7,.4)', fill: 'forwards' })
      .finished.then(() => clone.remove()).catch(() => clone.remove());
  });
  document.querySelectorAll('#sieges .pile:not(.partie)').forEach((pile) => {
    const r = pile.getBoundingClientRect();
    if (!r.width || !pile.children.length) return;
    const plaque = pile.closest('.siege').querySelector('.plaque');
    const [px, py] = centre(plaque.getBoundingClientRect());
    const clone = pile.cloneNode(true);
    clone.classList.add('balayee');
    Object.assign(clone.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    clone.style.setProperty('--j', getComputedStyle(pile).getPropertyValue('--j'));
    document.body.appendChild(clone);
    const [cx, cy] = centre(r);
    clone.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${px - cx}px, ${py - cy}px) scale(.5)`, opacity: 0 }], { duration: 600, easing: 'ease-in', fill: 'forwards' })
      .finished.then(() => clone.remove()).catch(() => clone.remove());
  });
}

function lancerAnimations() {
  if (sansAnimation()) {
    A.fins.forEach((f) => f());
    A.pertes.forEach((p) => p.classList.add('partie'));
    A.soldes.forEach(({ e, a }) => { e.textContent = euros(a); });
    return;
  }
  const sabot = $('sabot').getBoundingClientRect();
  const depart = [sabot.left + sabot.width * 0.35, sabot.top + sabot.height * 0.55];
  const comparer = (a, b) => {
    for (let k = 0; k < Math.max(a.length, b.length); k++) {
      const x = a[k] ?? -1; const y = b[k] ?? -1;
      if (x !== y) return x - y;
    }
    return 0;
  };
  A.cartes.sort((a, b) => comparer(a.ordre, b.ordre));
  let t = 0;
  let retournee = !A.trou;
  A.cartes.forEach((c) => {
    if (!retournee && c.ordre[0] === 20) { retourner(A.trou, t + 150); t += 750; retournee = true; }
    distribuerCarte(c.e, depart, t);
    t += PAS_DONNE;
  });
  if (!retournee) { retourner(A.trou, t + 150); t += 750; }
  const tFin = A.fin ? t + 350 : 0;
  if (A.fin) {
    clearTimeout(minuterieFin);
    const fins = A.fins;
    minuterieFin = setTimeout(() => fins.forEach((f) => f()), tFin);
    A.retardes.forEach((e) => apparaitre(e, tFin));
    A.pertes.forEach((p, k) => versBanque(p, tFin + 300 + k * 120));
    A.gains.forEach((g, k) => depuisBanque(g, tFin + 300 + k * 120));
  }
  A.soldes.forEach(({ e, de, a }) => compter(e, de, a, A.fin ? tFin + 900 : 0));
}

function rendre() {
  if (!etat) return;
  const avant = statutPrecedent;
  if (avant === 'fin' && etat.status === 'mises') balayer();
  if (avant !== etat.status) {
    if (etat.status === 'mises') { vus.clear(); trouCacheAvant = false; }
    statutPrecedent = etat.status;
  }
  A = {
    cartes: [], trou: null, retardes: [], pertes: [], gains: [], soldes: [], fins: [],
    donne: avant === 'mises' && etat.status !== 'mises',
    fin: (avant === 'jeu' || avant === 'mises') && etat.status === 'fin',
  };
  if (avant !== null && avant !== etat.status && etat.status !== 'fin') clearTimeout(minuterieFin);
  initMise();
  rendreCroupier();
  rendreSieges();
  rendreMessage();
  rendreCommandes();
  lancerAnimations();
}
