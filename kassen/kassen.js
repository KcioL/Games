import { $, el, initSalon, initRegles, de } from '../commun/salon.js';
import { EDITIONS } from './editions.js'; // à importer en premier : charge les cartes du Gwynt et de Kassen
import { CARTES, CLANS, CAPACITES, RANGEES, NOMS_RANGEES, KANJI_RANGEES, COLLECTIONS, DECKS_DEFAUT, DECK_MIN_UNITES, DECK_MAX_SPECIALES, aPlat, erreurDeck } from './cartes.js';
import * as M from './moteur.js';

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
    etat = M.normaliser(s);
    maPlace = place;
    noterChangement();
    rendre();
    if (coup) animerCoup(coup);
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

// Contour qui s'enflamme autour d'une carte qui se pose (légende)
function enflammer(cible) {
  const r = cible.getBoundingClientRect();
  const f = el('div', 'flammes');
  Object.assign(f.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  for (let k = 0; k < 16; k++) {
    const b = el('span', 'braise');
    b.style.left = `${Math.random() * 100}%`;
    b.style.animationDelay = `${(Math.random() * 0.5).toFixed(2)}s`;
    b.style.setProperty('--x', `${(Math.random() * 2 - 1) * 18}px`);
    f.appendChild(b);
  }
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1600);
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
  finAnnonce = Math.max(finAnnonce, Date.now() + duree + 300); // les bots attendent la fin de l'animation
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
  if (survolPossible) brancherBulle(e, { d }); // au survol de la souris : la bulle d'information
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
function brancherBulle(e, infos) {
  if (!survolPossible) return;
  e.addEventListener('mouseenter', () => {
    const bulle = $('bulle');
    remplirBulle(bulle, infos);
    bulle.hidden = false;
    placerBulle(e);
  });
  e.addEventListener('mouseleave', () => { $('bulle').hidden = true; });
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
  $('btn-plein-ecran').hidden = ecran !== 'bataille' || !document.fullscreenEnabled;
}
// hauteur réelle de la barre du haut (le plateau prend le reste de la fenêtre)
function mesurerBarre() { document.documentElement.style.setProperty('--h-barre', `${document.querySelector('.barre').offsetHeight}px`); }
window.addEventListener('resize', mesurerBarre);
mesurerBarre();
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

const chefTexte = (clan) => {
  const chef = chefEnregistre(clan);
  const n = (CLANS[clan].chefs || []).length;
  return chef ? `Chef : ${chef.nom}. ${chef.texte}${n > 1 ? ` (${n} chefs au choix dans « Modifier le deck »)` : ''}` : '';
};

function rendreClans() {
  rendreInterrupteur();
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
  const cleListe = `${maPlace}|${etat.edition}|${clans.map((c) => deckEnregistre(c).length).join(',')}|${clans.map(persoDeck).map(Boolean).join(',')}|${clans.map((c) => (chefEnregistre(c) || {}).id).join(',')}`;
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
    b.append(el('span', 'clan-kanji', c.kanji), el('strong', '', c.nom), el('span', 'clan-atout', c.atout),
      el('span', 'clan-chef', chefTexte(cle)),
      el('span', 'clan-deck', `${persoDeck(cle) ? 'Ton deck' : 'Deck par défaut'} : ${deck.length} cartes, ${unites} unités`),
      choisir, modifier);
    zone.appendChild(b);
  });
}

// =====================================================================
// Atelier de deck (enregistré sur cet appareil, un deck par clan)
// =====================================================================
const cleDeck = (clan) => `jeux-vol:gwynt-deck:${clan}`;
function persoDeck(clan) {
  try {
    const d = JSON.parse(localStorage.getItem(cleDeck(clan)));
    return Array.isArray(d) && !erreurDeck(clan, d) ? d : null;
  } catch (e) { return null; }
}
const deckEnregistre = (clan) => persoDeck(clan) || aPlat(DECKS_DEFAUT[clan]);
// Chef choisi pour chaque clan (le premier de la liste par défaut)
const cleChef = (clan) => `jeux-vol:gwynt-chef:${clan}`;
function chefEnregistre(clan) {
  const chefs = (CLANS[clan] && CLANS[clan].chefs) || [];
  let id = '';
  try { id = localStorage.getItem(cleChef(clan)) || ''; } catch (e) { /* stockage indisponible */ }
  return chefs.find((c) => c.id === id) || chefs[0];
}

let atelier = null; // { clan, deck: [ids], filtre }
function ouvrirAtelier(clan) {
  atelier = { clan, deck: [...deckEnregistre(clan)], filtre: 'tout', chef: (chefEnregistre(clan) || {}).id };
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
  $('atelier-titre').textContent = `Deck : ${CLANS[clan].nom}`;
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
  try {
    localStorage.setItem(cleDeck(atelier.clan), JSON.stringify(atelier.deck));
    if (atelier.chef) localStorage.setItem(cleChef(atelier.clan), atelier.chef);
  } catch (e) { /* stockage plein */ }
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
  const embleme = el('span', 'embleme', clan.kanji || '');
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
  zone.appendChild(el('span', 'nb-main', `${p.main.length} carte${p.main.length > 1 ? 's' : ''}`));
  if (p.passe) zone.appendChild(el('span', 'badge-passe', 'a passé'));
  zone.appendChild(el('span', 'score-total', String(M.total(etat, j))));
  zone.classList.toggle('actif', etat.status === 'jeu' && etat.active === j);
}

function rendrePiles(zone, j) {
  const p = etat.players[j];
  zone.innerHTML = '';
  const pile = (titre, n, classe) => {
    const b = el('div', `pile ${classe}`);
    b.append(el('span', 'pile-nombre', String(n)), el('span', 'pile-titre', titre));
    return b;
  };
  zone.append(pile('Pioche', p.pioche.length, 'pioche'), pile('Défausse', p.defausse.length, 'defausse'));
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
  actives.forEach((r) => zone.appendChild(el('span', 'meteo-active', `${noms[r][0]} ${noms[r][1]}`)));
  zone.appendChild(el('span', 'manche', `Manche ${etat.manche}`));
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
      selection = selection === carte.u ? null : carte.u;
      rendre();
    });
    zone.appendChild(e);
  });
  if (!moi.main.length) zone.appendChild(el('p', 'vide', 'Plus de cartes en main.'));
}

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
  $('bulle').hidden = true; // la carte survolée a pu être redessinée
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
