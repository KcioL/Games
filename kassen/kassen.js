import { $, el, initSalon, initRegles, de } from '../commun/salon.js';
import { EDITIONS } from './editions.js'; // à importer en premier : charge les cartes du Gwynt et de Kassen
import { CARTES, CLANS, CAPACITES, RANGEES, NOMS_RANGEES, KANJI_RANGEES, COLLECTIONS, DECKS_DEFAUT, DECK_MIN_UNITES, DECK_MAX_SPECIALES, aPlat, erreurDeck } from './cartes.js';
import * as M from './moteur.js';
import {
  initCompte, compteActuel, enregistrerDeck, connexionEmail, motDePasseOublie, deconnexion, messageErreur,
  NB_DECKS, deckSauve, emplacementActif, choisirEmplacement,
} from './compte.js';

// =====================================================================
// Salon
// =====================================================================
let etat = null;
let maPlace = 0;
let selection = null; // uid de la carte choisie dans la main

const salon = initSalon({
  jeu: 'kassen',
  etatInitial: (nom, nb, { local }) => ({
    edition: jeuPrefere(),
    players: [
      { name: nom, joined: true, bot: false },
      local && nb === 1 ? { name: 'Bot', joined: true, bot: true } : { name: 'En attente', joined: false, bot: false },
    ],
  }),
  demarrer: (s) => { M.normaliser(s); M.nouvellePartie(s); },
  afficher: (s, place) => {
    if (place !== maPlace) selection = null;
    // nouvelle carte jouée ? on note d'où elle part avant de redessiner (sa place dans la main)
    const coup = preparerAnimation(s, place);
    const chef = preparerChef(s, place);
    const pertes = preparerPertes(etat, s);   // cartes qui vont disparaître du plateau (détruites)
    etat = M.normaliser(s);
    maPlace = place;
    noterChangement();
    rendre();
    // ordre : annonce du chef, puis la carte jouée, puis les cartes détruites qui brûlent
    const delaiChef = chef ? annoncerChef(chef) : 0;
    if (coup) setTimeout(() => animerCoup(coup), delaiChef);
    if (pertes.length) setTimeout(() => brulerCartes(pertes), delaiChef + (coup && CARTES[coup.c] && CARTES[coup.c].type === 'brasier' ? 1100 : coup ? 650 : 250));
    planifierBot();
  },
  // Sur un seul téléphone : la main de chacun est secrète, on cache l'écran entre deux joueurs
  quiDoitJouer: (s) => {
    const joueurs = s.players || [];
    if (joueurs.filter((p) => !p.bot).length <= 1) return -1;
    const a = M.acteur(M.normaliser(s));
    return a >= 0 && !joueurs[a].bot ? a : -1;
  },
  secret: true,
});
initRegles();
remplirRegles();

// Jeu proposé au départ : le dernier choisi sur cet appareil, s'il est prêt
const CLE_JEU = 'jeux-vol:gwynt-jeu';
function jeuPrefere() {
  let j = 'kassen';
  try { j = localStorage.getItem(CLE_JEU) || 'kassen'; } catch (e) { /* stockage indisponible */ }
  return EDITIONS[j] && EDITIONS[j].pret ? j : 'kassen';
}

function agir(fn) { return salon.agir((s) => fn(M.normaliser(s))); }
// « Tu as gagné » a un sens en ligne ou contre le bot ; à deux sur un téléphone, on nomme le gagnant
const pointDeVueJoueur = () => !salon.estLocal() || etat.players.some((p) => p.bot);
const action = (a) => { selection = null; return agir((s) => M.jouerAction(s, maPlace, a)); };

// =====================================================================
// Bot (et surveillant anti-blocage)
// =====================================================================
function botAJouer(s) {
  if (s.status === 'clans') return s.players.every((p) => p.bot || p.clan) ? s.players.findIndex((p) => p.bot && !p.clan) : -1;
  if (s.status === 'echange') return s.players.findIndex((p) => p.bot && !p.pret);
  if (s.status === 'jeu' && s.attente) return s.players[s.attente.joueur].bot ? s.attente.joueur : -1;
  if (s.status === 'jeu' && s.players[s.active] && s.players[s.active].bot) return s.active;
  return -1;
}
let botPrevu = '';
let annonceAffichee = false;
let finAnnonce = 0;
function planifierBot() {
  if (!etat) return;
  const b = botAJouer(etat);
  if (b < 0) return;
  const moi = etat.players[maPlace];
  if (!moi || moi.bot) return;
  const cle = `${etat.coup}-${b}-${etat.status}`;
  if (botPrevu === cle) return;
  botPrevu = cle;
  const coup = etat.coup;
  const premierHumain = etat.players.findIndex((p) => !p.bot);
  const reflexion = etat.status === 'jeu' ? 1100 + Math.random() * 600 : 600;
  const attente = Math.max(0, finAnnonce - Date.now());
  const delai = attente + ((salon.estLocal() || maPlace === premierHumain) ? reflexion : 4000 + maPlace * 1500);
  setTimeout(() => {
    agir((s) => {
      if (s.coup !== coup) return false;
      const j = botAJouer(s);
      if (j < 0) return false;
      try {
        if (M.jouerAction(s, j, M.decisionBot(s, j))) return true;
      } catch (err) {
        console.error('Bot : erreur dans sa décision', err);
      }
      return M.jouerAction(s, j, { type: 'passer' }) || M.jouerAction(s, j, { type: 'pret' });
    });
  }, delai);
}
let dernierChangement = Date.now();
let dernierCoupConnu = null;
function noterChangement() {
  const cle = `${etat && etat.coup}-${etat && etat.status}`;
  if (cle !== dernierCoupConnu) { dernierCoupConnu = cle; dernierChangement = Date.now(); }
}
setInterval(() => {
  if (!etat || botAJouer(etat) < 0 || annonceAffichee) return;
  if (Date.now() - dernierChangement < 4500) return;
  dernierChangement = Date.now();
  botPrevu = '';
  planifierBot();
}, 1500);

// =====================================================================
// Animations : chaque carte jouée sort de la main, passe au centre de l'écran puis se pose.
// Légende : plus grande, et son contour s'enflamme quand elle se pose.
// Météo, éclaircie, Terre brûlée : un effet sur tout l'écran, le temps que la carte arrive.
// =====================================================================
const sansAnimation = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let dernierCoupVu; // undefined : premier affichage (on n'anime pas une partie qu'on rejoint)
function preparerAnimation(s, place) {
  const dc = s.dernierCoup;
  const ts = dc ? dc.ts : null;
  if (dernierCoupVu === undefined || ts === dernierCoupVu || !dc || !CARTES[dc.c] || sansAnimation || document.hidden) {
    dernierCoupVu = ts;
    return null;
  }
  dernierCoupVu = ts;
  // point de départ : la carte dans ma main, sinon le panneau du joueur
  const dansMain = dc.joueur === place && document.querySelector(`#main .carte[data-u="${dc.u}"]`);
  const panneau = dc.joueur === place ? $('info-moi') : $('info-adverse');
  const depart = (dansMain || (dc.joueur === place ? $('main') : panneau)).getBoundingClientRect();
  return { ...dc, depart };
}

// ---------- Chef utilisé : sa carte s'affiche en grand au centre, avec ce qu'il fait ----------
let dernierChefVu;
function preparerChef(s, place) {
  const dc = s.dernierChef;
  const ts = dc ? dc.ts : null;
  if (dernierChefVu === undefined || ts === dernierChefVu || !dc || sansAnimation) { dernierChefVu = ts; return null; }
  dernierChefVu = ts;
  const p = (s.players || [])[dc.joueur];
  const chef = p && ((CLANS[p.clan] || {}).chefs || []).find((c) => c.id === dc.chef);
  if (!chef) return null;
  const panneau = document.querySelector(dc.joueur === place ? '#info-moi .chef-panneau' : '#info-adverse .chef-panneau')
    || $(dc.joueur === place ? 'info-moi' : 'info-adverse');
  return { ...dc, chefDef: chef, couleur: (CLANS[p.clan] || {}).couleur, nom: p.name, moi: dc.joueur === place, depart: panneau ? panneau.getBoundingClientRect() : null };
}
// onglet en arrière-plan : l'annonce est gardée et montrée au retour
let annonceEnAttente = null;
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && annonceEnAttente) { const a = annonceEnAttente; annonceEnAttente = null; annoncerChef(a); }
});
function annoncerChef(a) {
  if (document.hidden) { annonceEnAttente = a; return 0; }
  bandeauChef(a);
  const duree = 2300;
  finAnnonce = Math.max(finAnnonce, Date.now() + duree + 400); // les bots attendent la fin de l'annonce
  const scene = el('div', 'annonce-chef');
  const carte = carteChefEl(a.chefDef, a.couleur, 'vol');
  const hauteur = Math.min(window.innerHeight * 0.5, 480);
  carte.style.setProperty('--l', `${hauteur * 0.75}px`);
  const texte = el('div', 'annonce-chef-texte');
  texte.append(el('span', 'annonce-chef-titre', a.moi && pointDeVueJoueur() ? 'Tu utilises ton chef' : `${a.nom} utilise son chef`),
    el('strong', '', a.chefDef.nom), el('span', 'annonce-chef-effet', a.chefDef.texte + (a.detail ? ` (${a.detail})` : '')));
  scene.append(el('div', 'annonce-chef-halo'), carte, texte);
  document.body.appendChild(scene);
  // la carte part du panneau du joueur, grandit au centre, puis y retourne
  const r = carte.getBoundingClientRect();
  const d = a.depart;
  const versPanneau = d ? `translate(${d.left + d.width / 2 - (r.left + r.width / 2)}px, ${d.top + d.height / 2 - (r.top + r.height / 2)}px) scale(${Math.max(0.08, d.width / r.width)})` : 'scale(.3)';
  carte.animate([
    { transform: versPanneau, opacity: .4 },
    { transform: 'scale(1.06)', opacity: 1, offset: 0.2 },
    { transform: 'scale(1)', opacity: 1, offset: 0.3 },
    { transform: 'scale(1)', opacity: 1, offset: 0.82 },
    { transform: versPanneau, opacity: 0 },
  ], { duration: duree, easing: 'ease-in-out', fill: 'forwards' });
  setTimeout(() => scene.remove(), duree + 50);
  return duree - 350;
}

// Bandeau qui reste quelques secondes au milieu du plateau : « Bot a utilisé son chef : … »
function bandeauChef(a) {
  const ancien = document.querySelector('.bandeau-chef');
  if (ancien) ancien.remove();
  const b = el('div', 'bandeau-chef');
  b.append(el('span', 'bandeau-chef-icone', '♛'),
    el('span', '', `${a.moi && pointDeVueJoueur() ? 'Tu as utilisé ton chef' : `${a.nom} a utilisé son chef`} : ${a.chefDef.nom}${a.detail ? ` (${a.detail})` : ''}`));
  // centré sur la ligne du milieu du plateau (là où s'affiche « à toi de jouer »)
  const st = $('statut').getBoundingClientRect();
  if (st.height) b.style.top = `${st.top + st.height / 2}px`;
  document.body.appendChild(b);
  setTimeout(() => b.classList.add('part'), 6500);
  setTimeout(() => b.remove(), 7200);
}

// ---------- Cartes détruites (brûlées) : elles s'embrasent à leur place avant de disparaître ----------
function preparerPertes(avant, apres) {
  if (!avant || !apres || sansAnimation || document.hidden || avant.status !== 'jeu' || apres.status !== 'jeu') return [];
  if ((avant.manche || 0) !== (apres.manche || 0)) return []; // fin de manche : le plateau est vidé, ce n'est pas une destruction
  const surPlateau = (s) => {
    const ids = new Set();
    (s.players || []).forEach((p) => RANGEES.forEach((r) => ((p.rangees || {})[r] || []).forEach((c) => ids.add(c.u))));
    return ids;
  };
  const restent = surPlateau(apres);
  const enDefausse = new Set();
  (apres.players || []).forEach((p) => (p.defausse || []).forEach((c) => enDefausse.add(c.u)));
  const pertes = [];
  surPlateau(avant).forEach((u) => {
    if (restent.has(u) || !enDefausse.has(u)) return; // reprise en main (leurre) : pas une destruction
    const e = document.querySelector(`.rangee-cartes .carte[data-u="${u}"]`);
    if (!e) return;
    const r = e.getBoundingClientRect();
    const fantome = e.cloneNode(true);
    pertes.push({ fantome, rect: r });
  });
  return pertes;
}
function brulerCartes(pertes) {
  finAnnonce = Math.max(finAnnonce, Date.now() + 1500);
  pertes.forEach(({ fantome, rect }) => {
    fantome.classList.add('carte-brulee');
    Object.assign(fantome.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    for (let k = 0; k < 10; k++) {
      const b = el('span', 'braise');
      b.style.left = `${Math.random() * 100}%`; b.style.bottom = `${Math.random() * 40}%`;
      b.style.animationDelay = `${(Math.random() * 0.5).toFixed(2)}s`;
      b.style.setProperty('--x', `${(Math.random() * 2 - 1) * 20}px`);
      fantome.appendChild(b);
    }
    document.body.appendChild(fantome);
    setTimeout(() => fantome.remove(), 1500);
  });
}

// Effet plein écran : 'pluie', 'neige', 'brouillard', 'soleil' ou 'feu'
function effetEcran(type, duree) {
  const voile = el('div', `effet-ecran effet-${type}`);
  const n = { pluie: 110, neige: 80, brouillard: 7, soleil: 0, feu: 40 }[type] || 0;
  for (let k = 0; k < n; k++) {
    const p = el('span', 'particule');
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDelay = `${(-Math.random() * (type === 'neige' ? 3 : 1)).toFixed(2)}s`;
    p.style.setProperty('--x', `${(Math.random() * 2 - 1) * 60}px`);
    p.style.setProperty('--t', (0.7 + Math.random() * 0.6).toFixed(2));
    if (type === 'brouillard') { p.style.top = `${10 + Math.random() * 70}%`; p.style.animationDelay = `${(-Math.random() * 6).toFixed(2)}s`; }
    voile.appendChild(p);
  }
  voile.style.setProperty('--duree', `${duree}ms`);
  document.body.appendChild(voile);
  setTimeout(() => voile.remove(), duree + 50);
}

// Contour qui s'enflamme autour d'une carte qui se pose (légende) :
// l'anneau de feu et les braises sont dans la carte elle-même, ils en épousent exactement la forme
function enflammer(carte) {
  carte.classList.add('en-flammes');
  // la rangée défile horizontalement et couperait les flammes : on la laisse déborder le temps de l'effet
  const rangee = carte.closest('.rangee-cartes');
  if (rangee) rangee.classList.add('deborde');
  const braises = [];
  for (let k = 0; k < 18; k++) {
    const b = el('span', 'braise');
    // les braises partent de tout le contour (haut, côtés, bas)
    const bord = k % 4;
    const pos = `${Math.random() * 100}%`;
    if (bord === 0) Object.assign(b.style, { left: pos, bottom: '0' });
    else if (bord === 1) Object.assign(b.style, { left: pos, top: '0' });
    else Object.assign(b.style, { [bord === 2 ? 'left' : 'right']: '0', top: pos });
    b.style.animationDelay = `${(Math.random() * 0.6).toFixed(2)}s`;
    b.style.setProperty('--x', `${(Math.random() * 2 - 1) * 22}px`);
    carte.appendChild(b);
    braises.push(b);
  }
  setTimeout(() => {
    carte.classList.remove('en-flammes');
    braises.forEach((b) => b.remove());
    if (rangee) rangee.classList.remove('deborde');
  }, 1700);
}

function rectCentre(r) { return [r.left + r.width / 2, r.top + r.height / 2]; }

function animerCoup(dc) {
  const d = CARTES[dc.c];
  const legende = d.type === 'unite' && d.legende;
  // carte arrivée sur le plateau (unité, y compris un espion chez l'adversaire)
  const arrivee = d.type === 'unite' ? document.querySelector(`.rangee-cartes .carte[data-u="${dc.u}"]`) : null;
  if (arrivee) arrivee.style.visibility = 'hidden';
  // la carte en grand, posée au centre de l'écran
  const vol = carteEl({ c: dc.c, u: dc.u }, { taille: 'vol' });
  const hauteur = Math.min(window.innerHeight * (legende ? 0.55 : 0.38), legende ? 560 : 400);
  vol.style.setProperty('--l', `${hauteur * 0.75}px`);
  vol.classList.toggle('vol-legende', legende);
  document.body.appendChild(vol);
  const taille = vol.getBoundingClientRect();
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.46;
  Object.assign(vol.style, { left: `${cx - taille.width / 2}px`, top: `${cy - taille.height / 2}px` });
  const vers = (r) => {
    const [x, y] = rectCentre(r);
    return `translate(${x - cx}px, ${y - cy}px) scale(${Math.max(0.05, r.width / taille.width)})`;
  };
  const depart = vers(dc.depart);
  // météo et sorts : effet plein écran pendant le passage au centre
  let effet = null;
  if (d.type === 'meteo') effet = { cac: 'neige', dist: 'brouillard', siege: 'pluie' }[String(d.meteo).split('+')[0]];
  if (d.type === 'eclaircie') effet = 'soleil';
  if (d.type === 'brasier') effet = 'feu';
  const tenue = legende ? 900 : effet ? 1500 : 380;
  const allerAuCentre = legende ? 650 : 420;
  const seposer = 420;
  const duree = allerAuCentre + tenue + seposer;
  // les bots attendent la fin de l'animation (et des flammes d'une légende)
  finAnnonce = Math.max(finAnnonce, Date.now() + duree + (legende ? 1800 : 300));
  if (effet) setTimeout(() => effetEcran(effet, tenue + seposer + 200), allerAuCentre * 0.6);
  const fin = arrivee ? vers(arrivee.getBoundingClientRect()) : `translate(0, -20px) scale(.85)`;
  const t1 = allerAuCentre / duree;
  const t2 = (allerAuCentre + tenue) / duree;
  const anim = vol.animate([
    { transform: depart, opacity: 0.6, offset: 0 },
    { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: t1, easing: 'ease-in-out' },
    { transform: 'translate(0, 0) scale(1.03)', opacity: 1, offset: t2, easing: 'cubic-bezier(.5, 0, .75, 0)' },
    { transform: fin, opacity: arrivee ? 1 : 0, offset: 1 },
  ], { duration: duree, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'forwards' });
  anim.onfinish = () => {
    vol.remove();
    // la carte a pu être redessinée entre-temps : on reprend celle du plateau
    const posee = d.type === 'unite' ? document.querySelector(`.rangee-cartes .carte[data-u="${dc.u}"]`) : null;
    if (arrivee) arrivee.style.visibility = '';
    if (posee) {
      posee.style.visibility = '';
      posee.classList.add('vient-de-poser');
      setTimeout(() => posee.classList.remove('vient-de-poser'), 500);
      if (legende) enflammer(posee);
    }
  };
}

// =====================================================================
// Cartes
// =====================================================================
const def = (carte) => CARTES[carte.c];

// Images des cartes : cartes/<identifiant>.jpg (voir cartes/LISTE-DES-CARTES.md).
// Une image est une carte complète (force, icônes, nom déjà dessinés) : elle remplace le dessin par défaut.
// Une image absente est simplement ignorée et la carte garde son dessin par défaut.
const imagesAbsentes = new Set();
const imagesChargees = new Set(); // déjà affichées une fois : on les montre tout de suite (pas de clignotement)
// Plusieurs illustrations pour une carte : chaque exemplaire de la partie garde toujours la même
const cheminImage = (id, u) => {
  const d = CARTES[id];
  if (!d) return `cartes/${id}.jpg`;
  return d.images && d.images.length > 1 && u !== undefined ? d.images[Math.abs(u) % d.images.length] : d.image;
};
// Format des images du jeu (ex. 170 × 324 pour le Gwynt) et position de son rond de force imprimé
function appliquerFormat(e, d) {
  if (d && d.format) {
    const [w, h] = d.format;
    e.style.aspectRatio = `${w} / ${h}`;
    // même hauteur qu'une carte 3:4 : la largeur s'adapte
    e.style.setProperty('--k', String(((w / h) / 0.75).toFixed(3)));
  }
  if (d && d.rond) {
    e.style.setProperty('--rond-x', `${d.rond.x}%`);
    e.style.setProperty('--rond-y', `${d.rond.y}%`);
    e.style.setProperty('--rond-d', `${d.rond.taille}%`);
  }
}
function ajouterImage(e, id, chemin) {
  chemin = chemin || cheminImage(id);
  id = chemin; // une image absente est retenue par son fichier
  if (imagesAbsentes.has(id)) return;
  const img = document.createElement('img');
  img.className = 'image-carte';
  img.alt = CARTES[id] ? CARTES[id].nom : '';
  img.decoding = 'async';
  img.draggable = false; // pas de « glisser l'image » du navigateur (il bloquerait le glisser-déposer des cartes)
  img.src = chemin;
  img.addEventListener('error', () => { imagesAbsentes.add(id); img.remove(); });
  img.addEventListener('load', () => { imagesChargees.add(id); e.classList.add('image-pleine'); });
  if (imagesChargees.has(id)) e.classList.add('image-pleine');
  e.prepend(img);
}

// Carte de chef : son image (<jeu>/cartes/<id>.jpg) ou, à défaut, un dessin avec son nom
function carteChefEl(chef, couleur, taille = 'atelier') {
  const e = el('div', `carte carte-chef ${taille}`);
  e.style.setProperty('--clan', couleur || '#3A3A3A');
  e.append(el('span', 'kanji-special', '将'), el('span', 'nom', chef.nom));
  if (survolPossible) brancherBulle(e, { chef });
  else e.title = `${chef.nom} : ${chef.texte}`;
  appliquerFormat(e, chef);
  ajouterImage(e, chef.id, chef.image);
  return e;
}

// Élément d'une carte ; `force` = force actuelle sur le plateau (sinon force imprimée)
function carteEl(carte, { force, taille = '' } = {}) {
  const d = def(carte);
  const e = el('div', `carte ${taille} type-${d.type}`);
  if (carte.u !== undefined) e.dataset.u = carte.u;
  // sur le plateau, la force actuelle reste affichée par-dessus l'image (elle change avec les effets)
  if (force !== undefined) e.classList.add('sur-plateau');
  appliquerFormat(e, d);
  ajouterImage(e, carte.c, cheminImage(carte.c, carte.u));
  const clan = d.clan ? CLANS[d.clan] : null;
  e.style.setProperty('--clan', clan ? clan.couleur : '#2E2A26');
  if (d.legende) e.classList.add('legende');
  if (d.type === 'unite') {
    const f = force === undefined ? d.force : force;
    const pastille = el('span', 'force', String(f));
    if (force !== undefined && !d.legende) {
      if (f > d.force) pastille.classList.add('hausse');
      if (f < d.force) pastille.classList.add('baisse');
    }
    e.appendChild(pastille);
    e.appendChild(el('span', 'rangee-icone', d.rangees.map((r) => KANJI_RANGEES[r]).join('')));
    if (d.capacite) e.appendChild(el('span', 'capacite', CAPACITES[d.capacite].kanji));
    if (d.legende) e.appendChild(el('span', 'capacite legende-icone', CAPACITES.legende.kanji));
  } else {
    e.appendChild(el('span', 'kanji-special', d.kanji));
  }
  if (taille !== 'mini') e.appendChild(el('span', 'nom', d.nom));
  if (survolPossible) brancherBulle(e, { d, carte }); // au survol de la souris : la bulle d'information
  else e.title = description(carte);
  return e;
}

// Les textes des capacités parlent de Kassen (taiko, Raijin…) : au Gwynt, on dit cor, Terre brûlée…
const MOTS_GWYNT = [[/la Colère de Raijin/g, 'la Terre brûlée'], [/au taiko/g, 'au cor'], [/le taiko/g, 'le cor'], [/kagemusha/g, 'leurre']];
const texteJeu = (d, texte) => (d.edition === 'gwynt' ? MOTS_GWYNT.reduce((t, [a, b]) => t.replace(a, b), texte) : texte);
// symboles proches des icônes de The Witcher 3 (Kassen garde ses kanji)
const SYMBOLES_GWYNT = { legende: '★', espion: '👁', medecin: '✚', lien: '🤝', moral: '+1', rassemblement: '⇶', agile: '⇄', cor: '📯', brasier_rangee: '☠' };
// règles du Gwynt différentes de Kassen
const TEXTES_GWYNT = { medecin: 'Choisis une unité de ta défausse (hors légendes) : elle revient en jeu et sa capacité s\'applique.' };
const nomCapacite = (d, cle) => (d.edition === 'gwynt' && cle === 'agile' ? 'Agile' : CAPACITES[cle].nom);

// Capacités d'une carte : [{ kanji, nom, texte }]
function capacitesDe(d) {
  const liste = [];
  if (d.legende) liste.push({ cle: 'legende', ...CAPACITES.legende });
  if (d.capacite && CAPACITES[d.capacite]) liste.push({ cle: d.capacite, ...CAPACITES[d.capacite] });
  return liste.map((c) => ({ kanji: (d.edition === 'gwynt' && SYMBOLES_GWYNT[c.cle]) || c.kanji, nom: nomCapacite(d, c.cle), texte: (d.edition === 'gwynt' && TEXTES_GWYNT[c.cle]) || texteJeu(d, c.texte) }));
}

function description(carte) {
  const d = def(carte);
  if (d.type !== 'unite') return `${d.nom} : ${texteJeu(d, d.texte)}`;
  const morceaux = [`${d.nom}, force ${d.force}, ${d.rangees.map((r) => NOMS_RANGEES[r].toLowerCase()).join(' ou ')}.`];
  capacitesDe(d).forEach((c) => morceaux.push(`${c.nom} : ${c.texte}`));
  return morceaux.join(' ');
}

// ---------- Bulle d'information au survol (souris) : nom, force, rangée et capacités ----------
const survolPossible = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
function remplirBulle(bulle, { d, chef }) {
  bulle.innerHTML = '';
  if (chef) {
    bulle.append(el('strong', 'bulle-nom', chef.nom), el('span', 'bulle-type', 'Chef'));
    const bloc = el('div', 'bulle-capacite');
    bloc.append(el('span', 'bulle-kanji', String(chef.id).startsWith('g_') ? '♛' : '将'), el('span', 'bulle-texte', chef.texte));
    bulle.appendChild(bloc);
    return;
  }
  bulle.appendChild(el('strong', 'bulle-nom', d.nom));
  if (d.type === 'unite') {
    bulle.appendChild(el('span', 'bulle-type', `Force ${d.force} · ${d.rangees.map((r) => NOMS_RANGEES[r]).join(' ou ')}`));
    const caps = capacitesDe(d);
    if (!caps.length) bulle.appendChild(el('span', 'bulle-vide', 'Aucune capacité'));
    caps.forEach((c) => {
      const bloc = el('div', 'bulle-capacite');
      const corps = el('span', 'bulle-texte');
      corps.append(el('b', '', c.nom), document.createTextNode(` : ${c.texte}`));
      bloc.append(el('span', 'bulle-kanji', c.kanji), corps);
      bulle.appendChild(bloc);
    });
  } else {
    bulle.appendChild(el('span', 'bulle-type', 'Carte spéciale'));
    const bloc = el('div', 'bulle-capacite');
    bloc.append(el('span', 'bulle-kanji', d.kanji || '✦'), el('span', 'bulle-texte', texteJeu(d, d.texte)));
    bulle.appendChild(bloc);
  }
}
function placerBulle(cible) {
  const bulle = $('bulle');
  const r = cible.getBoundingClientRect();
  const b = bulle.getBoundingClientRect();
  const marge = 10;
  let x = r.right + marge;
  if (x + b.width > window.innerWidth - 8) x = r.left - marge - b.width; // pas de place à droite : à gauche
  x = Math.max(8, Math.min(x, window.innerWidth - b.width - 8));
  let y = r.top + r.height / 2 - b.height / 2;
  y = Math.max(8, Math.min(y, window.innerHeight - b.height - 8));
  bulle.style.left = `${x}px`;
  bulle.style.top = `${y}px`;
}
// Pendant la bataille sur grand écran : la carte survolée s'affiche en grand à droite (comme dans The Witcher 3)
const grandEcran = window.matchMedia('(min-width: 900px) and (min-height: 600px)');
const modeApercu = () => document.body.classList.contains('en-bataille') && grandEcran.matches;
function montrerApercu(infos) {
  const zone = $('apercu');
  zone.innerHTML = '';
  const carte = infos.chef ? carteChefEl(infos.chef, '#3A3A3A', 'apercu') : carteEl({ c: infos.carte.c, u: infos.carte.u }, { taille: 'apercu' });
  const texte = el('div', 'apercu-texte');
  remplirBulle(texte, infos);
  zone.append(carte, texte);
  zone.hidden = false;
}
function cacherSurvol() { $('bulle').hidden = true; $('apercu').hidden = true; }
function brancherBulle(e, infos) {
  if (!survolPossible) return;
  e.addEventListener('mouseenter', () => {
    if (e.classList.contains('vol') || e.classList.contains('apercu')) return;
    if (modeApercu()) { montrerApercu(infos); return; }
    const bulle = $('bulle');
    remplirBulle(bulle, infos);
    bulle.hidden = false;
    placerBulle(e);
  });
  e.addEventListener('mouseleave', cacherSurvol);
}
// la bulle disparaît dès qu'on clique ou fait défiler (la carte peut avoir été redessinée)
['click', 'scroll', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { $('bulle').hidden = true; }, true));

// =====================================================================
// Écrans
// =====================================================================
function montrer(ecran) {
  if (atelier) ecran = 'atelier';
  ['choix-clan', 'atelier', 'echange-cartes', 'bataille'].forEach((id) => { $(id).hidden = id !== ecran; });
  // pendant la bataille, le plateau occupe toute la fenêtre
  document.body.classList.toggle('en-bataille', ecran === 'bataille');
  mesurerBarre();
  if (etat) document.body.dataset.jeu = M.editionDe(etat); // décor du plateau : Kassen ou Gwynt
  $('btn-plein-ecran').hidden = ecran !== 'bataille' || !document.fullscreenEnabled;
}
// hauteur réelle de la barre du haut (le plateau prend le reste de la fenêtre)
// Hauteur réelle de l'écran : sur iPhone, « 100dvh » est faux juste après une rotation.
// On la mesure à chaque changement (et encore un peu après, le temps que Safari se stabilise).
function mesurerBarre() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty('--hauteur', `${Math.round(h)}px`);
  document.documentElement.style.setProperty('--h-barre', `${document.querySelector('.barre').offsetHeight}px`);
  if (document.body.classList.contains('en-bataille')) window.scrollTo(0, 0);
}
function apresRotation() {
  mesurerBarre();
  [120, 350, 700].forEach((d) => setTimeout(() => { mesurerBarre(); if (etat && etat.status === 'jeu') serrerMain(); }, d));
}
window.addEventListener('resize', apresRotation);
window.addEventListener('orientationchange', apresRotation);
if (window.visualViewport) window.visualViewport.addEventListener('resize', mesurerBarre);
mesurerBarre();
// Téléphone : la partie se joue en paysage. Sur Android, plein écran + verrouillage de l'orientation
// (il faut un geste du joueur) ; sur iPhone c'est impossible pour un site : on demande de tourner le téléphone.
const ecranTactile = window.matchMedia('(pointer: coarse)').matches;
const verrouPossible = ecranTactile && !!(screen.orientation && screen.orientation.lock) && !!document.documentElement.requestFullscreen;
function passerPaysage() {
  if (!verrouPossible) return;
  const verrouiller = () => screen.orientation.lock('landscape').catch(() => {});
  if (document.fullscreenElement) verrouiller();
  else document.documentElement.requestFullscreen().then(verrouiller).catch(() => {});
}
$('btn-paysage').hidden = !verrouPossible;
$('btn-paysage').addEventListener('click', passerPaysage);
$('btn-pret').addEventListener('click', passerPaysage);
$('btn-quitter-jeu').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  $('btn-quitter').click();
});
// Bouton « plein écran » (cache aussi la barre du navigateur)
$('btn-plein-ecran').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
});

// Interrupteur Gwynt / Kassen (sur l'écran des clans)
function rendreInterrupteur() {
  const jeu = M.editionDe(etat);
  const verrou = etat.players.some((p) => p.clan);
  const b = $('interrupteur');
  b.dataset.jeu = jeu;
  b.setAttribute('aria-checked', String(jeu === 'gwynt'));
  $('interrupteur-texte').textContent = (EDITIONS[jeu] ? EDITIONS[jeu].nom : jeu).toUpperCase();
  b.classList.toggle('verrouille', verrou);
  const autre = jeu === 'gwynt' ? 'kassen' : 'gwynt';
  b.classList.toggle('autre-indisponible', !EDITIONS[autre].pret);
  b.title = verrou ? 'Le jeu est fixé : un joueur a déjà choisi son clan.' : `Passer à ${EDITIONS[autre].nom}`;
}
$('interrupteur').addEventListener('click', () => {
  if (!etat || etat.status !== 'clans') return;
  const aide = $('interrupteur-aide');
  aide.innerHTML = '';
  if (etat.players.some((p) => p.clan)) { aide.textContent = 'Le jeu est fixé : un joueur a déjà choisi son clan.'; return; }
  const autre = M.editionDe(etat) === 'gwynt' ? 'kassen' : 'gwynt';
  const e = EDITIONS[autre];
  if (!e.pret) {
    aide.appendChild(el('strong', '', `${e.nom} n'est pas encore jouable (fichier kassen/${autre}/jeu.js) :`));
    const ul = el('ul');
    e.erreurs.slice(0, 6).forEach((t) => ul.appendChild(el('li', '', t)));
    if (e.erreurs.length > 6) ul.appendChild(el('li', '', `… et ${e.erreurs.length - 6} autre(s) problème(s).`));
    aide.appendChild(ul);
    return;
  }
  try { localStorage.setItem(CLE_JEU, autre); } catch (err) { /* stockage indisponible */ }
  action({ type: 'edition', edition: autre });
});

// Logo du clan (image), ou son symbole si l'image manque
const logosAbsents = new Set();
function logoClan(clan, classe) {
  const e = el('span', classe, clan.kanji || '');
  if (!clan.logo || logosAbsents.has(clan.logo)) return e;
  const img = document.createElement('img');
  img.className = 'logo-clan';
  img.alt = '';
  img.src = clan.logo;
  img.addEventListener('load', () => { e.textContent = ''; e.appendChild(img); e.classList.add('avec-logo'); });
  img.addEventListener('error', () => logosAbsents.add(clan.logo));
  return e;
}

const chefTexte = (clan) => {
  const chef = chefEnregistre(clan);
  const n = (CLANS[clan].chefs || []).length;
  return chef ? `Chef : ${chef.nom}. ${chef.texte}${n > 1 ? ` (${n} chefs au choix dans « Modifier le deck »)` : ''}` : '';
};

function rendreClans() {
  rendreInterrupteur();
  rendreCompte();
  const moi = etat.players[maPlace];
  const autre = etat.players[1 - maPlace];
  const zone = $('clans');
  if (moi.clan) {
    zone.innerHTML = '';
    zone.dataset.cle = '';
    zone.hidden = true;
    $('attente-clan').textContent = `Tu as choisi : ${CLANS[moi.clan].nom}. En attente ${de(autre.name)}…`;
    return;
  }
  zone.hidden = false;
  const edition = EDITIONS[etat.edition || 'japon'];
  // on ne redessine la liste que si elle change (sinon un toucher pendant le choix du bot serait perdu)
  const clans = M.clansDeLEdition(etat);
  const cleListe = `${maPlace}|${etat.edition}|${clans.map((c) => `${emplacementActif(c)}:${deckEnregistre(c).length}:${Boolean(persoDeck(c))}:${(chefEnregistre(c) || {}).id}:${nomDeck(c, emplacementActif(c))}`).join(',')}`;
  if (zone.dataset.cle === cleListe && zone.children.length) return;
  zone.dataset.cle = cleListe;
  zone.innerHTML = '';
  $('attente-clan').textContent = `${edition ? edition.nom : ''}${salon.estLocal() && !autre.bot ? ` · ${moi.name}, choisis ton clan.` : ''}`;
  M.clansDeLEdition(etat).map((cle) => [cle, CLANS[cle]]).forEach(([cle, c]) => {
    const b = el('div', 'clan');
    b.style.setProperty('--clan', c.couleur);
    const deck = deckEnregistre(cle);
    const unites = deck.filter((x) => CARTES[x].type === 'unite').length;
    const choisir = el('button', 'btn btn-principal', 'Jouer ce clan');
    choisir.type = 'button';
    choisir.addEventListener('click', () => action({ type: 'clan', clan: cle, deck: deckEnregistre(cle), chef: (chefEnregistre(cle) || {}).id }));
    const modifier = el('button', 'btn', 'Modifier le deck');
    modifier.type = 'button';
    modifier.addEventListener('click', () => ouvrirAtelier(cle));
    // les 3 decks du clan : on choisit celui avec lequel jouer
    const actif = emplacementActif(cle);
    const choixDeck = el('div', 'choix-deck');
    choixDeck.setAttribute('role', 'group');
    choixDeck.setAttribute('aria-label', 'Deck à jouer');
    for (let n = 1; n <= NB_DECKS; n++) {
      const bouton = el('button', 'deck-num' + (n === actif ? ' actif' : '') + (persoDeck(cle, n) ? '' : ' vide'), String(n));
      bouton.type = 'button';
      bouton.title = `${nomDeck(cle, n)}${persoDeck(cle, n) ? '' : ' (deck par défaut)'}`;
      bouton.addEventListener('click', () => { choisirEmplacement(cle, n); zone.dataset.cle = ''; rendreClans(); });
      choixDeck.appendChild(bouton);
    }
    b.append(logoClan(c, 'clan-kanji'), el('strong', '', c.nom), el('span', 'clan-atout', c.atout),
      el('span', 'clan-chef', chefTexte(cle)),
      choixDeck,
      el('span', 'clan-deck', `${nomDeck(cle, actif)}${persoDeck(cle) ? '' : ' (par défaut)'} : ${deck.length} cartes, ${unites} unités`),
      choisir, modifier);
    zone.appendChild(b);
  });
}

// =====================================================================
// Compte (facultatif) : decks enregistrés en ligne
// =====================================================================
function rendreCompte() {
  const zone = $('compte');
  const c = compteActuel();
  zone.innerHTML = '';
  if (c) {
    zone.append(el('span', 'compte-texte', `☁ Connecté : ${c.nom}. Tes decks sont enregistrés dans ton compte.`));
    const b = el('button', 'btn btn-discret', 'Se déconnecter');
    b.type = 'button';
    b.addEventListener('click', () => deconnexion());
    zone.appendChild(b);
  } else {
    zone.append(el('span', 'compte-texte', 'Tes decks sont enregistrés sur cet appareil.'));
    const b = el('button', 'btn btn-discret', 'Se connecter pour les garder partout');
    b.type = 'button';
    b.addEventListener('click', ouvrirCompte);
    zone.appendChild(b);
  }
}
function ouvrirCompte() {
  $('compte-message').textContent = navigator.onLine ? '' : 'Pas de connexion internet : la connexion au compte est impossible pour l\'instant.';
  $('dialog-compte').showModal();
}
async function essayer(action, succes) {
  const msg = $('compte-message');
  msg.classList.remove('ok');
  msg.textContent = 'Un instant…';
  try {
    await action();
    if (succes) { msg.textContent = succes; msg.classList.add('ok'); } else $('dialog-compte').close();
  } catch (err) {
    msg.textContent = messageErreur(err);
  }
}
$('compte-form').addEventListener('submit', (ev) => { ev.preventDefault(); essayer(() => connexionEmail($('compte-email').value.trim(), $('compte-mdp').value, false)); });
$('compte-creer').addEventListener('click', () => {
  if (!$('compte-form').reportValidity()) return;
  essayer(() => connexionEmail($('compte-email').value.trim(), $('compte-mdp').value, true));
});
$('compte-oubli').addEventListener('click', () => {
  const email = $('compte-email').value.trim();
  if (!email) { $('compte-message').textContent = 'Indique d\'abord ton adresse e-mail.'; return; }
  essayer(() => motDePasseOublie(email), 'Un e-mail pour choisir un nouveau mot de passe vient de t\'être envoyé.');
});
$('compte-fermer').addEventListener('click', () => $('dialog-compte').close());
// connexion gardée d'une fois sur l'autre ; à chaque changement, la liste des clans est redessinée
initCompte(() => {
  if (!etat) return;
  $('clans').dataset.cle = '';
  if (etat.status === 'clans') rendreClans();
});

// =====================================================================
// Atelier de deck (enregistré sur cet appareil, un deck par clan)
// =====================================================================
// 3 decks par clan (n = 1, 2 ou 3) ; sans précision, le deck choisi pour jouer ce clan
function persoDeck(clan, n = emplacementActif(clan)) {
  const s = deckSauve(clan, n);
  return s && Array.isArray(s.deck) && !erreurDeck(clan, s.deck) ? s.deck : null;
}
const deckEnregistre = (clan, n = emplacementActif(clan)) => persoDeck(clan, n) || aPlat(DECKS_DEFAUT[clan]);
// Chef de ce deck (le premier de la liste par défaut)
function chefEnregistre(clan, n = emplacementActif(clan)) {
  const chefs = (CLANS[clan] && CLANS[clan].chefs) || [];
  const id = (deckSauve(clan, n) || {}).chef || '';
  return chefs.find((c) => c.id === id) || chefs[0];
}
const nomDeck = (clan, n) => ((deckSauve(clan, n) || {}).nom || '').trim() || `Deck ${n}`;

let atelier = null; // { clan, n (deck 1 à 3), deck: [ids], chef, nom, filtre }
function chargerEmplacement(clan, n) {
  atelier = { clan, n, deck: [...deckEnregistre(clan, n)], filtre: atelier ? atelier.filtre : 'tout', chef: (chefEnregistre(clan, n) || {}).id, nom: (deckSauve(clan, n) || {}).nom || '' };
  atelier.depart = JSON.stringify([atelier.deck, atelier.chef, atelier.nom]); // pour repérer les modifications
  $('atelier-nom').value = atelier.nom;
  $('atelier-nom').placeholder = `Deck ${n}`;
}
const atelierModifie = () => atelier && JSON.stringify([atelier.deck, atelier.chef, atelier.nom]) !== atelier.depart;
function rendreEmplacements() {
  const zone = $('atelier-emplacements');
  zone.innerHTML = '';
  for (let n = 1; n <= NB_DECKS; n++) {
    const b = el('button', 'onglet-deck' + (n === atelier.n ? ' actif' : ''), nomDeck(atelier.clan, n));
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(n === atelier.n));
    b.addEventListener('click', () => {
      if (n === atelier.n) return;
      if (atelierModifie() && !window.confirm('Changer de deck sans enregistrer tes modifications ?')) return;
      chargerEmplacement(atelier.clan, n);
      rendreAtelier();
    });
    zone.appendChild(b);
  }
}
$('atelier-nom').addEventListener('input', () => { if (atelier) atelier.nom = $('atelier-nom').value; });
function ouvrirAtelier(clan) {
  atelier = null;
  chargerEmplacement(clan, emplacementActif(clan));
  $('atelier').hidden = false;
  $('choix-clan').hidden = true;
  document.querySelectorAll('.filtre').forEach((f) => f.classList.toggle('actif', f.dataset.filtre === 'tout'));
  $('atelier-detail').textContent = 'Touche une carte (ou +) pour l\'ajouter à ton deck, et − pour la retirer.';
  rendreAtelier();
  window.scrollTo(0, 0);
}
function fermerAtelier() {
  atelier = null;
  $('atelier').hidden = true;
  rendre();
}

const passeFiltre = (id, dansDeck = {}) => {
  const d = CARTES[id];
  if (!atelier || atelier.filtre === 'tout') return true;
  if (atelier.filtre === 'deck') return (dansDeck[id] || 0) > 0;
  if (atelier.filtre === 'special') return d.type !== 'unite';
  return d.type === 'unite' && d.rangees.includes(atelier.filtre);
};
// ordre d'affichage : unités par rangée puis force, puis spéciales
const ordre = (a, b) => {
  const da = CARTES[a]; const db = CARTES[b];
  const ra = da.type === 'unite' ? RANGEES.indexOf(da.rangees[0]) : 9;
  const rb = db.type === 'unite' ? RANGEES.indexOf(db.rangees[0]) : 9;
  return ra - rb || (db.force || 0) - (da.force || 0) || da.nom.localeCompare(db.nom);
};

function rendreAtelier() {
  if (!atelier) return;
  const { clan, deck } = atelier;
  $('atelier-titre').textContent = `Decks : ${CLANS[clan].nom}`;
  rendreEmplacements();
  const unites = deck.filter((c) => CARTES[c].type === 'unite');
  const speciales = deck.length - unites.length;
  const force = unites.reduce((t, c) => t + CARTES[c].force, 0);
  const legendes = unites.filter((c) => CARTES[c].legende).length;
  const stats = $('atelier-stats');
  stats.innerHTML = '';
  const tuile = (valeur, titre, etat = '') => {
    const t = el('div', `stat ${etat}`);
    t.append(el('span', 'stat-valeur', valeur), el('span', 'stat-titre', titre));
    stats.appendChild(t);
  };
  tuile(`${unites.length}`, `Unités (min. ${DECK_MIN_UNITES})`, unites.length < DECK_MIN_UNITES ? 'manque' : 'ok');
  tuile(`${speciales}/${DECK_MAX_SPECIALES}`, 'Spéciales', speciales > DECK_MAX_SPECIALES ? 'manque' : '');
  tuile(String(force), 'Force totale');
  tuile(String(legendes), 'Légendes');
  tuile(String(deck.length), 'Cartes');
  const erreur = erreurDeck(clan, deck);
  $('atelier-erreur').textContent = erreur;
  $('atelier-enregistrer').disabled = !!erreur;

  const dansDeck = {};
  deck.forEach((c) => { dansDeck[c] = (dansDeck[c] || 0) + 1; });
  const dispo = Object.fromEntries(COLLECTIONS[clan]);

  // Toutes les cartes disponibles pour ce clan, en trois sections
  const ids = COLLECTIONS[clan].map(([id]) => id);
  const sections = [
    ['Cartes du clan', ids.filter((id) => CARTES[id].type === 'unite' && CARTES[id].clan === clan)],
    ['Cartes neutres', ids.filter((id) => CARTES[id].type === 'unite' && !CARTES[id].clan)],
    ['Cartes spéciales', ids.filter((id) => CARTES[id].type !== 'unite')],
  ];
  const zone = $('atelier-sections');
  zone.innerHTML = '';
  // Choix du chef (comme dans The Witcher 3)
  const chefs = CLANS[clan].chefs || [];
  if (chefs.length && atelier.filtre === 'tout') {
    const section = el('section', 'section-atelier');
    const h3 = el('h3', '', 'Chef ');
    h3.appendChild(el('small', '', chefs.length > 1 ? 'touche le chef que tu veux' : 'un seul chef pour ce clan'));
    section.appendChild(h3);
    const grille = el('div', 'grille-atelier');
    chefs.forEach((chef) => {
      const bloc = el('div', 'carte-atelier' + (chef.id === atelier.chef ? ' dans-deck' : ''));
      const carte = carteChefEl(chef, CLANS[clan].couleur);
      carte.addEventListener('click', () => {
        atelier.chef = chef.id;
        $('atelier-detail').textContent = `${chef.nom} : ${chef.texte}`;
        const y = window.scrollY;
        rendreAtelier();
        window.scrollTo(0, y);
      });
      carte.addEventListener('mouseenter', () => { $('atelier-detail').textContent = `${chef.nom} : ${chef.texte}`; });
      bloc.append(carte, el('span', 'chef-effet', chef.id === atelier.chef ? '✓ Choisi' : 'Choisir'));
      grille.appendChild(bloc);
    });
    section.appendChild(grille);
    zone.appendChild(section);
  }
  sections.forEach(([titre, liste]) => {
    const visibles = liste.filter((id) => passeFiltre(id, dansDeck)).sort(ordre);
    if (!visibles.length) return;
    const pris = liste.reduce((t, id) => t + (dansDeck[id] || 0), 0);
    const section = el('section', 'section-atelier');
    const h3 = el('h3', '', `${titre} `);
    h3.appendChild(el('small', '', `${pris} dans le deck`));
    section.appendChild(h3);
    const grille = el('div', 'grille-atelier');
    visibles.forEach((id) => grille.appendChild(carteAtelier(id, dansDeck[id] || 0, dispo[id] || 0)));
    section.appendChild(grille);
    zone.appendChild(section);
  });
  if (!zone.children.length) zone.appendChild(el('p', 'vide', atelier.filtre === 'deck' ? 'Ton deck est vide.' : 'Aucune carte ici.'));
}

// Une carte de l'atelier : la carte en grand, et dessous le compteur « dans le deck / disponibles » avec − et +
function carteAtelier(id, n, max) {
  const bloc = el('div', 'carte-atelier' + (n > 0 ? ' dans-deck' : '') + (n >= max ? ' complet' : ''));
  const carte = carteEl({ c: id }, { taille: 'atelier' });
  // nombre d'exemplaires dans le deck / disponibles, affiché sur la carte
  carte.appendChild(el('span', 'exemplaires' + (n > 0 ? ' pris' : ''), `${n}/${max}`));
  carte.addEventListener('click', () => changerDeck(id, +1));
  carte.addEventListener('mouseenter', () => { $('atelier-detail').textContent = description({ c: id }); });
  bloc.appendChild(carte);
  const barre = el('div', 'compteur');
  const moins = el('button', 'btn pas', '−');
  moins.type = 'button';
  moins.disabled = n === 0;
  moins.setAttribute('aria-label', `Retirer un exemplaire de ${CARTES[id].nom}`);
  moins.addEventListener('click', () => changerDeck(id, -1));
  const plus = el('button', 'btn pas', '+');
  plus.type = 'button';
  plus.disabled = n >= max;
  plus.setAttribute('aria-label', `Ajouter un exemplaire de ${CARTES[id].nom}`);
  plus.addEventListener('click', () => changerDeck(id, +1));
  barre.append(moins, plus);
  bloc.appendChild(barre);
  return bloc;
}

function changerDeck(id, sens) {
  const dispo = Object.fromEntries(COLLECTIONS[atelier.clan]);
  const n = atelier.deck.filter((c) => c === id).length;
  if (sens > 0) {
    if (n >= (dispo[id] || 0)) { $('atelier-detail').textContent = `Tous les exemplaires de « ${CARTES[id].nom} » sont déjà dans ton deck.`; return; }
    atelier.deck.push(id);
  } else {
    if (!n) return;
    atelier.deck.splice(atelier.deck.indexOf(id), 1);
  }
  $('atelier-detail').textContent = description({ c: id });
  // la grille est redessinée sans faire sauter la page
  const y = window.scrollY;
  rendreAtelier();
  window.scrollTo(0, y);
}

document.querySelectorAll('.filtre').forEach((f) => f.addEventListener('click', () => {
  if (!atelier) return;
  atelier.filtre = f.dataset.filtre;
  document.querySelectorAll('.filtre').forEach((x) => x.classList.toggle('actif', x === f));
  rendreAtelier();
}));
$('atelier-defaut').addEventListener('click', () => { atelier.deck = aPlat(DECKS_DEFAUT[atelier.clan]); rendreAtelier(); });
$('atelier-annuler').addEventListener('click', fermerAtelier);
$('atelier-enregistrer').addEventListener('click', () => {
  if (erreurDeck(atelier.clan, atelier.deck)) return;
  // sur l'appareil, et dans le compte si on est connecté
  enregistrerDeck(atelier.clan, atelier.n, atelier.deck, atelier.chef, atelier.nom.trim());
  fermerAtelier();
});

// Main de départ : toucher une carte la sélectionne et affiche ce qu'elle fait ;
// « Échanger cette carte » la remplace par une carte de la pioche (2 fois au plus)
let choixEchange = null;
function rendreEchange() {
  const moi = etat.players[maPlace];
  const autre = etat.players[1 - maPlace];
  const reste = M.ECHANGES_MAX - moi.echanges;
  $('echange-texte').textContent = moi.pret
    ? 'Ta main est prête.'
    : (reste > 0 ? `Touche une carte pour voir ce qu'elle fait, puis échange-la si tu veux (encore ${reste} échange${reste > 1 ? 's' : ''}).` : 'Échanges terminés : tu peux lancer la partie.');
  if (choixEchange !== null && !moi.main.some((c) => c.u === choixEchange)) choixEchange = null;
  const zone = $('main-echange');
  zone.innerHTML = '';
  moi.main.forEach((carte) => {
    const e = carteEl(carte, { taille: 'atelier' });
    if (carte.u === choixEchange) e.classList.add('choisie-echange');
    e.addEventListener('click', () => {
      choixEchange = choixEchange === carte.u ? null : carte.u;
      rendreEchange();
    });
    e.addEventListener('mouseenter', () => { $('echange-detail').textContent = description(carte); });
    zone.appendChild(e);
  });
  const choisie = moi.main.find((c) => c.u === choixEchange);
  $('echange-detail').textContent = choisie ? description(choisie) : (moi.pret ? '' : 'Touche une carte pour voir ce qu\'elle fait.');
  $('btn-echanger').disabled = !choisie || moi.pret || reste <= 0;
  $('btn-echanger').textContent = reste > 0 ? `Échanger cette carte (${reste})` : 'Plus d\'échange possible';
  $('btn-echanger').hidden = moi.pret;
  $('btn-pret').hidden = moi.pret;
  $('attente-echange').textContent = moi.pret ? `En attente ${de(autre.name)}…` : '';
}
$('btn-echanger').addEventListener('click', () => {
  if (choixEchange === null) return;
  const u = choixEchange;
  choixEchange = null;
  action({ type: 'echanger', u });
});

// ---------- Plateau ----------
function infoCamp(zone, j) {
  const p = etat.players[j];
  zone.innerHTML = '';
  const clan = CLANS[p.clan] || {};
  const nom = el('span', 'camp-nom');
  const embleme = logoClan(clan, 'embleme');
  embleme.style.setProperty('--clan', clan.couleur || '#555');
  const ident = el('span', 'camp-ident');
  ident.append(el('strong', '', p.name + (!salon.estLocal() && j === maPlace ? ' (toi)' : '')), el('span', 'camp-clan', clan.nom || ''));
  nom.append(embleme, ident);
  zone.appendChild(nom);
  const chefJ = M.chefDe(p);
  if (chefJ) {
    // la carte du chef (grand écran), puis son nom
    const carteChef = carteChefEl(chefJ, clan.couleur, 'mini');
    carteChef.classList.add('chef-panneau');
    if (p.chefUtilise) carteChef.classList.add('utilise');
    zone.appendChild(carteChef);
  }
  const chef = el('span', 'camp-chef' + (p.chefUtilise ? ' utilise' : ''), chefJ ? `Chef : ${chefJ.nom}${etiquetteChef(j)}` : '');
  chef.title = chefJ ? chefJ.texte : '';
  zone.appendChild(chef);
  const vies = el('span', 'vies');
  for (let k = 0; k < 2; k++) vies.appendChild(el('span', k < p.vies ? 'vie' : 'vie perdue'));
  zone.appendChild(vies);
  const nbMain = el('span', 'nb-main');
  nbMain.append(el('span', 'icone-main', ''), document.createTextNode(String(p.main.length)));
  nbMain.title = `${p.main.length} carte${p.main.length > 1 ? 's' : ''} en main`;
  zone.appendChild(nbMain);
  if (p.passe) zone.appendChild(el('span', 'badge-passe', 'a passé'));
  // score : en grand, dans un écusson
  const score = el('span', 'score-total');
  score.appendChild(el('span', 'score-nombre', String(M.total(etat, j))));
  score.title = 'Force totale';
  zone.appendChild(score);
  zone.classList.toggle('actif', etat.status === 'jeu' && etat.active === j);
}

// Pioche et défausse en tas de cartes (comme dans The Witcher 3) : nombre de cartes dans un losange
function rendrePiles(zone, j) {
  const p = etat.players[j];
  const clan = CLANS[p.clan] || {};
  zone.innerHTML = '';
  const losange = (n) => { const l = el('span', 'losange'); l.appendChild(el('span', '', String(n))); return l; };
  // pioche : dos de cartes aux couleurs du clan, avec son logo
  const pioche = el('div', 'pile pioche' + (p.pioche.length ? '' : ' vide'));
  const tasP = el('div', 'tas');
  tasP.style.setProperty('--clan', clan.couleur || '#3A3A3A');
  tasP.style.setProperty('--epaisseur', String(Math.min(4, Math.ceil(p.pioche.length / 6))));
  if (p.pioche.length) tasP.appendChild(logoClan(clan, 'dos-logo'));
  tasP.appendChild(losange(p.pioche.length));
  pioche.append(tasP, el('span', 'pile-titre', 'Pioche'));
  pioche.title = `Pioche : ${p.pioche.length} carte${p.pioche.length > 1 ? 's' : ''}`;
  // défausse : la dernière carte défaussée, face visible ; touchée, elle montre toute la défausse
  const defausse = el('div', 'pile defausse' + (p.defausse.length ? '' : ' vide'));
  const tasD = el('div', 'tas');
  tasD.style.setProperty('--epaisseur', String(Math.min(4, Math.ceil(p.defausse.length / 4))));
  if (p.defausse.length) {
    const derniere = p.defausse[p.defausse.length - 1];
    const c = carteEl(derniere, { taille: 'pile' });
    tasD.appendChild(c);
  } else {
    tasD.appendChild(el('span', 'crane', '☠'));
  }
  tasD.appendChild(losange(p.defausse.length));
  defausse.append(tasD, el('span', 'pile-titre', 'Défausse'));
  defausse.title = 'Voir la défausse';
  defausse.addEventListener('click', () => {
    if (!p.defausse.length) return;
    const qui = j === maPlace ? 'Ta défausse' : `Défausse ${de(p.name)}`;
    ouvrirFenetreChef(qui, `${p.defausse.length} carte${p.defausse.length > 1 ? 's' : ''}, de la plus ancienne à la plus récente.`, p.defausse.slice(), null);
  });
  zone.append(pioche, defausse);
}

function rendreCamp(zone, j, ordre) {
  zone.innerHTML = '';
  const cibles = ciblesSelection();
  ordre.forEach((r) => {
    const ligne = el('div', `rangee r-${r}`);
    ligne.dataset.rangee = r;
    if (etat.meteo[r]) ligne.classList.add('meteo');
    const tete = el('div', 'rangee-tete');
    tete.append(el('span', 'rangee-total', String(M.totalRangee(etat, j, r))), el('span', 'rangee-kanji', KANJI_RANGEES[r]));
    ligne.appendChild(tete);
    // emplacement du cor (taiko), comme dans The Witcher 3
    const pj = etat.players[j];
    const cor = el('div', 'emplacement-cor' + (pj.cors[r] ? ' plein' : ''), pj.cors[r] ? '鼓' : '');
    cor.title = pj.cors[r] ? 'Cor : force doublée' : 'Emplacement du cor';
    ligne.appendChild(cor);
    const cartes = el('div', 'rangee-cartes');
    etat.players[j].rangees[r].forEach((carte) => {
      const e = carteEl(carte, { force: M.forceCarte(etat, j, r, carte), taille: 'mini' });
      // Kagemusha : on touche l'unité à reprendre
      if (j === maPlace && cibles.some((c) => c.cible === carte.u)) {
        e.classList.add('cible');
        e.dataset.rangeeCible = r;
        e.addEventListener('click', (ev) => { ev.stopPropagation(); jouerSelection({ rangee: r, cible: carte.u }); });
      }
      cartes.appendChild(e);
    });
    ligne.appendChild(cartes);
    // rangée ciblée (unité, rōnin, taiko)
    const carteChoisie = selectionCarte();
    const cibleRangee = cibles.some((c) => c.rangee === r && !c.cible);
    const camp = carteChoisie && def(carteChoisie).capacite === 'espion' ? 1 - maPlace : maPlace;
    if (cibleRangee && j === camp) {
      ligne.classList.add('cible');
      ligne.addEventListener('click', () => jouerSelection({ rangee: r }));
    }
    zone.appendChild(ligne);
  });
}

function rendreCiel() {
  const zone = $('ciel');
  zone.innerHTML = '';
  const actives = RANGEES.filter((r) => etat.meteo[r]);
  const noms = M.editionDe(etat) === 'gwynt'
    ? { cac: ['❄', 'Froid mordant'], dist: ['☁', 'Brouillard impénétrable'], siege: ['☂', 'Pluie torrentielle'] }
    : { cac: ['雪', 'Neige'], dist: ['霧', 'Brume'], siege: ['嵐', 'Typhon'] };
  if (!actives.length) zone.appendChild(el('span', 'ciel-calme', 'Ciel dégagé'));
  if (actives.length) zone.appendChild(el('span', 'meteo-active', actives.map((r) => `${noms[r][0]} ${noms[r][1]}`).join('  ·  ')));
  const manche = el('span', 'manche', 'Manche');
  manche.appendChild(el('b', '', String(etat.manche)));
  zone.appendChild(manche);
}

const monTour = () => etat.status === 'jeu' && etat.active === maPlace && !etat.players[maPlace].passe;
const selectionCarte = () => (selection === null ? null : etat.players[maPlace].main.find((c) => c.u === selection));
function ciblesSelection() {
  if (!monTour() || !selectionCarte()) return [];
  return M.ciblesPossibles(etat, maPlace, selection);
}

function jouerSelection(choix) {
  const u = selection;
  if (u === null) return;
  action({ type: 'jouer', u, choix });
}

function rendreMain() {
  const zone = $('main');
  zone.innerHTML = '';
  const moi = etat.players[maPlace];
  if (selection !== null && !selectionCarte()) selection = null;
  moi.main.forEach((carte) => {
    const e = carteEl(carte, { taille: 'grande' });
    if (carte.u === selection) e.classList.add('choisie');
    e.addEventListener('mouseenter', () => { if (selection === null) $('detail').textContent = description(carte); });
    e.addEventListener('mouseleave', () => { if (selection === null) rendreCommandes(); });
    e.addEventListener('click', () => {
      if (clicIgnore) return; // fin d'un glisser-déposer
      selection = selection === carte.u ? null : carte.u;
      rendre();
    });
    e.addEventListener('pointerdown', (ev) => commencerGlisse(ev, carte, e));
    if (glisse && glisse.u === carte.u && glisse.parti) e.classList.add('en-glisse');
    zone.appendChild(e);
  });
  if (!moi.main.length) zone.appendChild(el('p', 'vide', 'Plus de cartes en main.'));
  serrerMain();
}
// ---------- Glisser-déposer : on prend une carte de la main et on la lâche sur sa rangée ----------
let glisse = null;      // { u, c, x0, y0, depart, parti, fantome, fleche }
let clicIgnore = false;
function commencerGlisse(ev, carte, e) {
  if (ev.button !== 0 || !monTour() || glisse) return;
  if (ev.pointerType === 'mouse') ev.preventDefault(); // ni glisser natif, ni sélection de texte
  const r = e.getBoundingClientRect();
  glisse = { u: carte.u, c: carte.c, x0: ev.clientX, y0: ev.clientY, depart: [r.left + r.width / 2, r.top + r.height * 0.25], parti: false };
  window.addEventListener('pointermove', bougerGlisse);
  window.addEventListener('pointerup', lacherGlisse);
  window.addEventListener('pointercancel', annulerGlisse);
}
function demarrerGlisse() {
  glisse.parti = true;
  selection = glisse.u;            // les rangées possibles s'illuminent
  cacherSurvol();
  rendre();
  document.body.classList.add('glisse-en-cours');
  const f = carteEl({ c: glisse.c, u: glisse.u }, { taille: 'grande' });
  f.classList.add('fantome');
  document.body.appendChild(f);
  glisse.fantome = f;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'fleche-glisse');
  svg.innerHTML = '<path/><polygon/>';
  document.body.appendChild(svg);
  glisse.fleche = svg;
}
// ce qu'il y a sous le pointeur : une unité ciblée (leurre), une rangée, ou le plateau
function cibleSous(x, y) {
  const sous = document.elementFromPoint(x, y);
  if (!sous) return null;
  const unite = sous.closest('.rangee-cartes .carte.cible');
  if (unite) return { el: unite, choix: { rangee: unite.dataset.rangeeCible, cible: Number(unite.dataset.u) } };
  const rangee = sous.closest('.rangee.cible');
  if (rangee) return { el: rangee, choix: { rangee: rangee.dataset.rangee } };
  // carte sans place à choisir (météo, éclaircie, Raijin…) : lâchée n'importe où sur le plateau
  const cibles = ciblesSelection();
  if (cibles.length === 1 && !cibles[0].rangee && !cibles[0].cible && sous.closest('.camp, .ciel, .bataille .statut')) return { el: null, choix: {} };
  return null;
}
function bougerGlisse(ev) {
  if (!glisse) return;
  if (!glisse.parti) {
    if (Math.hypot(ev.clientX - glisse.x0, ev.clientY - glisse.y0) < 10) return;
    demarrerGlisse();
  }
  ev.preventDefault();
  Object.assign(glisse.fantome.style, { left: `${ev.clientX}px`, top: `${ev.clientY}px` });
  // flèche courbe de la main vers le pointeur
  const [x1, y1] = glisse.depart;
  const x2 = ev.clientX; const y2 = ev.clientY;
  const cx = (x1 + x2) / 2 + (y2 - y1) * 0.15; const cy = Math.min(y1, y2) - 40;
  glisse.fleche.querySelector('path').setAttribute('d', `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`);
  const a = Math.atan2(y2 - cy, x2 - cx); const t = 16;
  const pts = [[x2 + Math.cos(a) * 4, y2 + Math.sin(a) * 4], [x2 - t * Math.cos(a - 0.5), y2 - t * Math.sin(a - 0.5)], [x2 - t * Math.cos(a + 0.5), y2 - t * Math.sin(a + 0.5)]];
  glisse.fleche.querySelector('polygon').setAttribute('points', pts.map((p) => p.join(',')).join(' '));
  document.querySelectorAll('.survolee').forEach((x) => x.classList.remove('survolee'));
  const cible = cibleSous(ev.clientX, ev.clientY);
  if (cible && cible.el) cible.el.classList.add('survolee');
}
function finirGlisse() {
  window.removeEventListener('pointermove', bougerGlisse);
  window.removeEventListener('pointerup', lacherGlisse);
  window.removeEventListener('pointercancel', annulerGlisse);
  document.body.classList.remove('glisse-en-cours');
  if (glisse && glisse.fantome) glisse.fantome.remove();
  if (glisse && glisse.fleche) glisse.fleche.remove();
  document.querySelectorAll('.survolee').forEach((x) => x.classList.remove('survolee'));
  const parti = glisse && glisse.parti;
  glisse = null;
  if (parti) { clicIgnore = true; setTimeout(() => { clicIgnore = false; }, 0); }
  return parti;
}
function lacherGlisse(ev) {
  if (!glisse) return;
  const parti = glisse.parti;
  const u = glisse.u;
  const cible = parti ? cibleSous(ev.clientX, ev.clientY) : null;
  finirGlisse();
  if (!parti) return; // simple clic : la sélection habituelle s'en charge
  if (cible && monTour() && selection === u) { jouerSelection(cible.choix); return; }
  selection = null; // lâchée ailleurs : la carte revient dans la main
  rendre();
}
function annulerGlisse() {
  if (!glisse) return;
  const parti = finirGlisse();
  if (parti) { selection = null; rendre(); }
}

// Main trop large pour l'écran : les cartes se chevauchent (au lieu de faire défiler)
function serrerMain() {
  const zone = $('main');
  const cartes = [...zone.querySelectorAll('.carte')];
  cartes.forEach((c) => { c.style.marginLeft = ''; });
  if (cartes.length < 2 || !document.body.classList.contains('en-bataille')) return;
  const ecart = parseFloat(getComputedStyle(zone).columnGap) || 0;
  const largeur = cartes.reduce((t, c) => t + c.getBoundingClientRect().width, 0) + ecart * (cartes.length - 1);
  const dispo = zone.clientWidth - 16;
  if (largeur <= dispo) return;
  const retrait = (largeur - dispo) / (cartes.length - 1);
  cartes.slice(1).forEach((c) => { c.style.marginLeft = `${-retrait}px`; });
}
window.addEventListener('resize', () => { if (etat && etat.status === 'jeu') serrerMain(); });

function rendreCommandes() {
  const moi = etat.players[maPlace];
  const tour = monTour();
  const clan = CLANS[moi.clan] || {};
  const chef = $('btn-chef');
  const chefMoi = M.chefDe(moi);
  chef.textContent = chefMoi ? (moi.chefUtilise ? `Chef utilisé (${chefMoi.nom})` : `Chef : ${chefMoi.nom}${etiquetteChef(maPlace)}`) : 'Chef';
  chef.title = chefMoi ? chefMoi.texte : '';
  chef.disabled = !tour || !M.chefUtilisable(etat, maPlace);
  $('btn-passer').disabled = !tour;
  // « Jouer cette carte » quand la carte n'a pas besoin qu'on choisisse sa place
  const carte = selectionCarte();
  const cibles = ciblesSelection();
  const implicite = carte && tour && cibles.length === 1 && !cibles[0].cible
    && !(def(carte).type === 'cor') && (def(carte).type !== 'unite' || def(carte).rangees.length === 1);
  $('btn-jouer').hidden = !implicite;

  const detail = $('detail');
  if (carte) {
    let aide = '';
    if (tour && def(carte).type === 'leurre') aide = cibles.length ? ' Touche l\'unité à reprendre.' : ' Aucune unité à reprendre.';
    else if (tour && (def(carte).type === 'cor' || (def(carte).type === 'unite' && def(carte).rangees.length > 1))) aide = ' Touche la rangée où la jouer.';
    detail.textContent = description(carte) + aide;
  } else {
    detail.textContent = tour ? 'Touche une carte de ta main pour la voir et la jouer.' : '';
  }
}

function rendreStatut() {
  const st = $('statut');
  const actif = etat.players[etat.active];
  const moi = etat.players[maPlace];
  if (etat.status !== 'jeu') { st.textContent = ''; return; }
  if (etat.attente) {
    const qui = etat.players[etat.attente.joueur];
    const moiQui = etat.attente.joueur === maPlace;
    st.textContent = etat.attente.type === 'premier'
      ? (moiQui ? 'Choisis qui commence la première manche.' : `${qui.name} choisit qui commence…`)
      : (moiQui ? 'Médecin : choisis l\'unité à ramener.' : `${qui.name} choisit l'unité à ramener…`);
    st.classList.remove('a-toi');
    return;
  }
  if (monTour()) {
    const autre = etat.players[1 - maPlace];
    const nom = salon.estLocal() && !autre.bot ? `${moi.name}, ` : '';
    st.textContent = autre.passe ? `${nom}l'adversaire a passé : joue ou passe à ton tour.` : `${nom}à toi de jouer.`;
  } else if (moi.passe) {
    st.textContent = `Tu as passé. ${actif.bot ? `${actif.name} réfléchit…` : `Au tour ${de(actif.name)}.`}`;
  } else {
    st.textContent = actif.bot ? `${actif.name} réfléchit…` : `Au tour ${de(actif.name)}`;
  }
  st.classList.toggle('a-toi', monTour());
}

// ---------- Fin de manche et fin de partie ----------
let derniereManche = null;
function verifierAnnonce() {
  const f = etat.finManche;
  const ts = f ? f.ts : 0;
  if (derniereManche === null) { derniereManche = ts; return; }
  if (!f || ts === derniereManche) return;
  derniereManche = ts;
  const zone = $('annonce-contenu');
  zone.innerHTML = '';
  const gagne = f.gagnant === maPlace && pointDeVueJoueur();
  zone.appendChild(el('span', 'annonce-sur-titre', `Fin de la manche ${f.manche}`));
  zone.appendChild(el('h2', '', f.gagnant < 0 ? 'Égalité' : gagne ? 'Manche gagnée !' : (pointDeVueJoueur() ? 'Manche perdue' : `${etat.players[f.gagnant].name} gagne la manche`)));
  zone.appendChild(el('p', 'annonce-scores', `${etat.players[0].name} ${f.scores[0]} à ${f.scores[1]} ${etat.players[1].name}`));
  $('annonce').hidden = false;
  annonceAffichee = true;
  finAnnonce = Date.now() + 3500;
  const fermer = () => {
    $('annonce').hidden = true;
    annonceAffichee = false;
    finAnnonce = Date.now();
    botPrevu = '';
    rendre(); // affiche la fin de partie si c'était la dernière manche
    planifierBot();
  };
  const minuteur = setTimeout(fermer, 3500);
  $('annonce').onclick = () => { clearTimeout(minuteur); fermer(); };
}

function rendreFin() {
  const voile = $('fin');
  voile.hidden = etat.status !== 'fin' || annonceAffichee;
  if (etat.status !== 'fin') return;
  const g = etat.gagnant;
  $('fin-titre').textContent = g < 0 ? 'Match nul !'
    : (pointDeVueJoueur() ? (g === maPlace ? 'Victoire !' : 'Défaite…') : `Victoire ${de(etat.players[g].name)} !`);
  const ol = $('fin-manches');
  ol.innerHTML = '';
  (etat.resultats || []).forEach((r, k) => {
    const qui = r.gagnant < 0 ? 'égalité' : etat.players[r.gagnant].name;
    ol.appendChild(el('li', '', `Manche ${k + 1} : ${qui} (${r.scores[0]} à ${r.scores[1]})`));
  });
}
$('btn-revanche').addEventListener('click', () => agir((s) => { if (s.status !== 'fin') return false; M.nouvellePartie(s); }));

// ---------- Boutons ----------
$('btn-pret').addEventListener('click', () => action({ type: 'pret' }));
$('btn-passer').addEventListener('click', () => action({ type: 'passer' }));
$('btn-chef').addEventListener('click', () => {
  // effets à choix (météo, défausses, pioche) : on choisit la carte dans une fenêtre
  const options = M.choixChef(etat, maPlace);
  if (!options.length) { action({ type: 'chef' }); return; }
  const chefMoi = M.chefDe(etat.players[maPlace]);
  if (chefMoi.effet !== 'echanger') {
    ouvrirFenetreChef(chefMoi.nom, `${chefMoi.texte} Touche la carte que tu veux.`, options, (carte) => action({ type: 'chef', u: carte.u }));
    return;
  }
  // « echanger » : d'abord les 2 cartes de la main à défausser, puis la carte de la pioche
  const aDefausser = [];
  const choisirPioche = () => ouvrirFenetreChef(chefMoi.nom, 'Maintenant, touche la carte de ta pioche que tu veux prendre.', options,
    (carte) => action({ type: 'chef', u: carte.u, defausse: aDefausser }));
  ouvrirFenetreChef(chefMoi.nom, 'Touche les 2 cartes de ta main à défausser.', etat.players[maPlace].main, (carte, e) => {
    const k = aDefausser.indexOf(carte.u);
    if (k >= 0) aDefausser.splice(k, 1); else aDefausser.push(carte.u);
    e.classList.toggle('choisie-echange', k < 0);
    if (aDefausser.length === 2) setTimeout(choisirPioche, 250);
    return true; // garder la fenêtre ouverte
  });
});

// « (passif) » ou « (annulé) » à côté du nom du chef
function etiquetteChef(j) {
  if (M.chefAnnule(etat, j)) return ' (annulé)';
  return M.chefPassif(etat.players[j]) ? ' (passif)' : '';
}

// Fenêtre du chef : une liste de cartes, à choisir (siChoix) ou simplement à regarder
function ouvrirFenetreChef(titre, texte, cartes, siChoix) {
  $('chef-titre').textContent = titre;
  $('chef-texte').textContent = texte;
  $('chef-detail').textContent = '';
  const zone = $('chef-cartes');
  zone.innerHTML = '';
  zone.classList.toggle('revelees', !siChoix);
  cartes.forEach((carte) => {
    const e = carteEl(carte, { taille: 'atelier' });
    e.addEventListener('mouseenter', () => { $('chef-detail').textContent = description(carte); });
    e.addEventListener('click', () => {
      if (!siChoix) { $('chef-detail').textContent = description(carte); return; }
      if (siChoix(carte, e) === true) return; // choix en plusieurs fois : la fenêtre reste ouverte
      fermerFenetreChef();
    });
    zone.appendChild(e);
  });
  $('btn-chef-fermer').textContent = siChoix ? 'Annuler' : 'Fermer';
  $('btn-chef-fermer').hidden = false;
  $('fenetre-chef').hidden = false;
}
function fermerFenetreChef() { $('fenetre-chef').hidden = true; }
$('btn-chef-fermer').addEventListener('click', fermerFenetreChef);

// Choix en cours de partie (Gwynt) : unité ramenée par un médecin, ou qui commence la manche 1.
// La fenêtre ne peut pas être fermée sans choisir (sinon la partie resterait bloquée).
let derniereAttente = '';
function verifierAttente() {
  const a = etat.attente;
  if (!a || a.joueur !== maPlace) return;
  const cle = `${a.type}-${etat.coup}`;
  if (derniereAttente === cle && !$('fenetre-chef').hidden) return;
  derniereAttente = cle;
  if (a.type === 'medecin') {
    ouvrirFenetreChef('Médecin', 'Choisis l\'unité de ta défausse à ramener en jeu.', M.choixMedecin(etat, maPlace), (carte) => {
      action({ type: 'medecin', u: carte.u });
    });
  } else {
    ouvrirFenetreChef('Qui commence ?', 'Ton clan choisit qui commence la première manche.', [], null);
    const zone = $('chef-cartes');
    const moi = el('button', 'btn btn-principal', 'Je commence');
    const lui = el('button', 'btn', `${etat.players[1 - maPlace].name} commence`);
    moi.addEventListener('click', () => { fermerFenetreChef(); action({ type: 'premier', moi: true }); });
    lui.addEventListener('click', () => { fermerFenetreChef(); action({ type: 'premier', moi: false }); });
    zone.append(moi, lui);
  }
  $('btn-chef-fermer').hidden = true;
}

// Chef « espionner » : les 3 cartes vues, montrées une seule fois à celui qui a utilisé son chef
const revelationsVues = new Set();
function verifierRevelation() {
  const r = etat.revelation;
  if (!r || r.joueur !== maPlace || revelationsVues.has(r.ts)) return;
  if (salon.estLocal() && etat.players[maPlace].bot) return;
  revelationsVues.add(r.ts);
  const autre = etat.players[1 - maPlace];
  ouvrirFenetreChef('Cartes espionnées', `Voici ${r.cartes.length} carte${r.cartes.length > 1 ? 's' : ''} de la main ${de(autre.name)}.`, r.cartes.map((c, k) => ({ c, u: -1 - k })), null);
}
$('btn-jouer').addEventListener('click', () => {
  const cibles = ciblesSelection();
  jouerSelection(cibles.length === 1 && cibles[0].rangee ? { rangee: cibles[0].rangee } : {});
});

// ---------- Règles ----------
function remplirRegles() {
  const cap = $('regles-capacites');
  Object.values(CAPACITES).forEach((c) => cap.appendChild(el('li', '', `${c.kanji} ${c.nom} : ${c.texte}`)));
  const spe = $('regles-speciales');
  ['neige', 'brume', 'typhon', 'soleil', 'taiko', 'kagemusha', 'raijin'].forEach((k) => { if (CARTES[k]) spe.appendChild(el('li', '', `${CARTES[k].kanji} ${CARTES[k].nom} : ${CARTES[k].texte}`)); });
  const clans = $('regles-clans');
  Object.values(CLANS).forEach((c) => clans.appendChild(el('li', '', `${c.kanji} ${c.nom} : ${c.atout} Chefs au choix : ${(c.chefs || []).map((h) => `« ${h.nom} » (${h.texte.charAt(0).toLowerCase()}${h.texte.slice(1)})`).join(', ')}.`)));
}

// =====================================================================
function rendre() {
  if (!etat) return;
  cacherSurvol(); // la carte survolée a pu être redessinée
  if (etat.status === 'clans') { montrer('choix-clan'); rendreClans(); }
  else if (etat.status === 'echange') { montrer('echange-cartes'); rendreEchange(); }
  else {
    montrer('bataille');
    infoCamp($('info-adverse'), 1 - maPlace);
    rendreCamp($('camp-adverse'), 1 - maPlace, ['siege', 'dist', 'cac']);
    rendreCiel();
    rendreCamp($('camp-moi'), maPlace, ['cac', 'dist', 'siege']);
    infoCamp($('info-moi'), maPlace);
    rendrePiles($('piles-adverse'), 1 - maPlace);
    rendrePiles($('piles-moi'), maPlace);
    rendreStatut();
    rendreMain();
    rendreCommandes();
    verifierAnnonce();
    verifierAttente();
    verifierRevelation();
  }
  if (etat.status !== 'jeu') fermerFenetreChef();
  rendreFin();
}
