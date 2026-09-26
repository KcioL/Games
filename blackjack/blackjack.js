import { $, el, initSalon, initRegles, de } from '../commun/salon.js';
import { nouveauPaquet, afficherCartes } from '../commun/cartes.js';

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
let statutPrecedent = null;
// Nombre de cartes déjà montrées par main : seules les nouvelles cartes sont animées
const cartesVues = new Map();

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
    if (changement) miseChoisie = 0;
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

document.querySelectorAll('.jeton').forEach((b) => b.addEventListener('click', () => {
  const p = etat && etat.players[maPlace];
  if (!p) return;
  miseChoisie = Math.min(p.chips, miseChoisie + parseInt(b.dataset.ajout, 10));
  rendreCommandes();
}));
$('btn-effacer').addEventListener('click', () => { miseChoisie = 0; rendreCommandes(); });
$('btn-miser').addEventListener('click', miser);
$('btn-recharger').addEventListener('click', recharger);
$('btn-tirer').addEventListener('click', tirer);
$('btn-rester').addEventListener('click', rester);
$('btn-doubler').addEventListener('click', doubler);
$('btn-separer').addEventListener('click', separer);
$('btn-suivante').addEventListener('click', mainSuivanteBouton);

// ---------- Affichage ----------
// espace insécable : le « € » ne passe jamais seul à la ligne
const euros = (n) => `${Math.round(n).toLocaleString('fr-FR')} €`;

function texteScore(m, finie) {
  if (!m.cartes.length) return '';
  if (m.double && !finie) return `${valeur(m.cartes.slice(0, 2))} + ?`;
  return String(valeur(m.cartes));
}

function texteGain(m) {
  if (m.gain > 0) return `${m.resultat} +${euros(m.gain)}`;
  if (m.gain < 0) return `${m.resultat} −${euros(-m.gain)}`;
  return `${m.resultat} (mise rendue)`;
}

function blocMain(m, { finie, active, petite, cle }) {
  const bloc = el('div', 'main-bj');
  if (active) bloc.classList.add('active');
  if (finie && m.resultat) bloc.classList.add(m.gain > 0 ? 'gagne' : (m.gain < 0 ? 'perdu' : 'egal'));
  const cartes = el('div', 'main-cartes');
  const cacherDerniere = m.double && !finie;
  afficherCartes(cartes, m.cartes, (c, i) => ({
    taille: petite ? 'petite' : 'grande',
    cachee: cacherDerniere && i === m.cartes.length - 1,
  }), cartesVues.get(cle) || 0);
  cartesVues.set(cle, m.cartes.length);
  const info = el('div', 'main-info');
  const score = texteScore(m, finie);
  if (score) info.appendChild(el('span', 'score' + (valeur(m.cartes) > 21 ? ' trop' : ''), score));
  info.appendChild(el('span', 'jetons', euros(m.mise)));
  bloc.append(cartes, info);
  if (m.etat === 'bj' && !finie) bloc.appendChild(el('span', 'badge', 'Blackjack !'));
  if (finie && m.resultat) bloc.appendChild(el('span', 'badge', texteGain(m)));
  return bloc;
}

function rendreCroupier() {
  const cacher = etat.status === 'jeu';
  const conteneur = $('cartes-croupier');
  afficherCartes(conteneur, etat.croupier, (c, i) => ({ taille: 'grande', cachee: cacher && i === 1 }));
  const sc = $('score-croupier');
  if (!etat.croupier.length) sc.textContent = '';
  else if (cacher) sc.textContent = String(valeur([etat.croupier[0]]));
  else sc.textContent = String(valeur(etat.croupier));
  sc.classList.toggle('trop', !cacher && valeur(etat.croupier) > 21);
}

function rendreAutres() {
  const zone = $('autres');
  zone.innerHTML = '';
  const finie = etat.status === 'fin';
  etat.players.forEach((p, i) => {
    if (i === maPlace) return;
    const bloc = el('div', 'siege');
    const actif = (etat.status === 'mises' || etat.status === 'jeu') && etat.active === i;
    if (actif) bloc.classList.add('actif');
    const tete = el('div', 'siege-tete');
    tete.appendChild(el('strong', '', p.name));
    const argent = el('span', 'jetons', euros(p.chips));
    tete.appendChild(argent);
    bloc.appendChild(tete);
    if (p.reloads) bloc.appendChild(el('span', 'recharges', `♻ ${p.reloads}`));
    if (!p.mains.length) {
      bloc.appendChild(el('span', 'attente', etat.status === 'mises' ? (actif ? 'Mise en cours…' : 'Pas encore misé') : ''));
    }
    p.mains.forEach((m, k) => bloc.appendChild(blocMain(m, {
      finie, petite: true, active: actif && etat.status === 'jeu' && k === p.mainActive, cle: `${i}-${k}`,
    })));
    zone.appendChild(bloc);
  });
  zone.hidden = etat.players.length < 2;
}

function rendreMoi() {
  const p = etat.players[maPlace];
  $('moi-nom').textContent = salon.estLocal() ? p.name : `${p.name} (toi)`;
  $('moi-jetons').textContent = euros(p.chips);
  $('moi-recharges').textContent = p.reloads ? `♻ ${p.reloads}` : '';
  const zone = $('mes-mains');
  zone.innerHTML = '';
  const finie = etat.status === 'fin';
  const monTourJeu = monTour(etat, 'jeu');
  p.mains.forEach((m, k) => zone.appendChild(blocMain(m, {
    finie, petite: p.mains.length > 2, active: monTourJeu && p.mains.length > 1 && k === p.mainActive, cle: `${maPlace}-${k}`,
  })));
  $('moi').classList.toggle('actif', monTour(etat, 'mises') || monTourJeu);
}

function rendreMessage() {
  const msg = $('message');
  const p = etat.players[maPlace];
  const actif = etat.players[etat.active];
  if (etat.status === 'mises') {
    msg.textContent = monTour(etat, 'mises')
      ? (salon.estLocal() && etat.players.length > 1 ? `${p.name}, à toi de miser` : 'À toi de miser')
      : `${actif.name} choisit sa mise…`;
  } else if (etat.status === 'jeu') {
    if (monTour(etat, 'jeu')) {
      const plusieurs = p.mains.length > 1 ? ` (main ${p.mainActive + 1})` : '';
      msg.textContent = `À toi : tirer ou rester ?${plusieurs}`;
    } else {
      msg.textContent = `Au tour ${de(actif.name)}…`;
    }
  } else if (etat.status === 'fin') {
    const total = p.mains.reduce((a, m) => a + (m.gain || 0), 0);
    const qui = salon.estLocal() && etat.players.length > 1 ? `${p.name} : ` : '';
    let texte = 'Égalité, mise rendue.';
    if (total > 0) texte = `Gagné, +${euros(total)} !`;
    else if (total < 0) texte = `Perdu, −${euros(-total)}.`;
    msg.textContent = p.mains.length ? qui + (qui ? texte.charAt(0).toLowerCase() + texte.slice(1) : texte) : 'Main terminée.';
  } else {
    msg.textContent = '';
  }
}

function rendreCommandes() {
  const p = etat.players[maPlace];
  const miseTour = monTour(etat, 'mises');
  const jeuTour = monTour(etat, 'jeu');
  $('panneau-mise').hidden = !miseTour;
  $('panneau-actions').hidden = !jeuTour;
  $('panneau-fin').hidden = etat.status !== 'fin';

  if (miseTour) {
    const fauche = p.chips < MISE_MIN;
    $('btn-recharger').hidden = !fauche;
    document.querySelectorAll('#panneau-mise .jetons-boutons, #panneau-mise .rangee, #panneau-mise .mise-montant')
      .forEach((e) => { e.hidden = fauche; });
    if (miseChoisie === 0 && !fauche) miseChoisie = Math.min(p.derniereMise || 100, p.chips);
    miseChoisie = Math.min(miseChoisie, p.chips);
    $('mise-choisie').textContent = euros(miseChoisie);
    document.querySelectorAll('.jeton').forEach((b) => {
      b.disabled = miseChoisie + parseInt(b.dataset.ajout, 10) > p.chips;
    });
    const btn = $('btn-miser');
    btn.disabled = miseChoisie < MISE_MIN;
    btn.textContent = `Miser ${euros(miseChoisie)}`;
  }

  if (jeuTour) {
    const m = p.mains[p.mainActive];
    const deux = m && m.cartes.length === 2;
    $('btn-doubler').disabled = !(deux && p.chips >= m.mise);
    $('btn-separer').disabled = !(deux && memeValeur(m.cartes[0], m.cartes[1]) && p.chips >= m.mise && p.mains.length < MAX_MAINS);
  }
}

function rendre() {
  if (!etat) return;
  if (statutPrecedent !== etat.status) {
    if (etat.status === 'mises') { miseChoisie = 0; cartesVues.clear(); }
    statutPrecedent = etat.status;
  }
  rendreCroupier();
  rendreAutres();
  rendreMoi();
  rendreMessage();
  rendreCommandes();
}
