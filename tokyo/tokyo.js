import { $, el, toast, initSalon, initRegles, de } from '../commun/salon.js';
import { CASES, GROUPES, TRANSPORTS, COMPAGNIES } from './plateau.js';
import * as M from './moteur.js';

const { yens } = M;
const COULEURS_JOUEURS = ['#D9412B', '#264A7A', '#5E8C3A', '#C9A24A', '#E58FB0', '#7B4FA0'];
const lire = (id) => $(id).value;

// =====================================================================
// Salon
// =====================================================================
let etat = null;
let maPlace = 0;
let botPrevu = '';
let derniereCarte = null;
let dernierEvenement = null;
let premiereSynchro = true;

// Fin de tour : résumé du tour, puis « À … de jouer »
const DUREE_SUIVANT = 1800;
let dernierResume = null;
let resumeAffiche = false;

// Nouveau résumé à montrer ? (attend la fin des animations en cours)
function verifierResume() {
  const r = etat.dernierResume;
  const ts = r ? r.ts : 0;
  if (dernierResume === null) { dernierResume = ts; return; } // à l'ouverture de la page : rien à montrer
  if (!r || ts === dernierResume || enAnimation || desQuiRoulent) return;
  dernierResume = ts;
  afficherFinDeTour(r);
}

async function afficherFinDeTour(r) {
  resumeAffiche = true;
  const p = etat.players[r.i];
  // durée adaptée au contenu : environ 4 s pour un tour simple, 7 s au plus pour un tour chargé
  const nbLignes = (r.lignes || []).length;
  const dureeResume = Math.min(7000, 2500 + 700 * nbLignes);
  finAnimation = Math.max(finAnimation, Date.now() + dureeResume + DUREE_SUIVANT + 400);
  const bilan = (r.argentFin || 0) - (r.argentDebut || 0);
  // 1) ce que le joueur a fait pendant son tour
  const resume = el('div', 'resume');
  resume.appendChild(el('span', 'resume-sur-titre', 'Fin du tour'));
  const titre = el('h2', '', p.name);
  titre.style.setProperty('--couleur-joueur', COULEURS_JOUEURS[p.couleur]);
  resume.appendChild(titre);
  const lignes = (r.lignes || []).filter((t) => !t.endsWith('commence.'));
  const ul = el('ul', 'resume-lignes');
  (lignes.length ? lignes : ['Rien de particulier.']).forEach((t) => ul.appendChild(el('li', '', t)));
  resume.appendChild(ul);
  const b = el('p', 'resume-bilan ' + (bilan > 0 ? 'gain' : bilan < 0 ? 'perte' : 'neutre'));
  b.textContent = bilan === 0 ? 'Bilan : aucun changement' : `Bilan : ${bilan > 0 ? '+' : '−'}${yens(Math.abs(bilan))}`;
  resume.appendChild(b);
  resume.appendChild(el('span', 'resume-solde', `Il lui reste ${yens(r.argentFin || 0)}`));
  await montrerFenetreTour(resume, dureeResume);
  // 2) à qui de jouer
  if (etat.status === 'jeu' && r.suivant !== undefined && etat.players[r.suivant]) {
    const q = etat.players[r.suivant];
    const suivant = el('div', 'suivant');
    const pastille = el('span', 'suivant-pastille', q.name.charAt(0).toUpperCase());
    pastille.style.background = COULEURS_JOUEURS[q.couleur];
    const moi = !salon.estLocal() && r.suivant === maPlace;
    suivant.append(pastille, el('h2', '', moi ? 'À toi de jouer !' : `À ${q.name} de jouer`));
    if (q.prison) suivant.appendChild(el('p', '', `(au kōban, essai ${q.prison}/3)`));
    await montrerFenetreTour(suivant, DUREE_SUIVANT);
  }
  resumeAffiche = false;
  finAnimation = Date.now();
  botPrevu = '';
  rendre();
  planifierBot();
}

// Fenêtre au centre, qui se ferme seule après `duree` ou d'un toucher
let fermerFenetreTour = null;
function montrerFenetreTour(contenu, duree) {
  return new Promise((ok) => {
    const zone = $('fenetre-tour-contenu');
    zone.innerHTML = '';
    zone.appendChild(contenu);
    const barre = $('fenetre-tour-barre');
    barre.style.setProperty('--duree', `${duree}ms`);
    barre.style.animation = 'none';
    void barre.offsetWidth;
    barre.style.animation = '';
    $('annonce-tour').hidden = false;
    const minuteur = setTimeout(() => fermerFenetreTour && fermerFenetreTour(), duree);
    fermerFenetreTour = () => {
      clearTimeout(minuteur);
      fermerFenetreTour = null;
      $('annonce-tour').hidden = true;
      ok();
    };
  });
}
$('annonce-tour').addEventListener('click', () => fermerFenetreTour && fermerFenetreTour());

// Roulement des dés à chaque nouveau lancer
let dernierLancer = null;
let desQuiRoulent = false;
let finRoulement = 0;

// Animation des pions : chaque déplacement est rejoué case par case
let dernierMvt = null;
let enAnimation = false;
let finAnimation = 0;
let jetonAnimation = 0;
const positionsAnimees = new Map();
const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const salon = initSalon({
  jeu: 'tokyo',
  etatInitial: (nom, nb, { local }) => {
    const bots = parseInt(lire(local ? 'local-bots' : 'nb-bots'), 10) || 0;
    const fin = lire(local ? 'local-fin' : 'nb-fin');
    const joueurs = Array.from({ length: nb }, (_, i) => ({ name: i === 0 ? nom : 'En attente', joined: i === 0, bot: false }));
    for (let k = 1; k <= bots; k++) joueurs.push({ name: `Bot ${k}`, joined: true, bot: true });
    return { players: joueurs, finMode: fin === 'faillite' ? 'faillite' : 'tours', toursMax: fin === 'faillite' ? 0 : parseInt(fin, 10) };
  },
  validerLocal: () => {
    const total = parseInt(lire('local-nb'), 10) + parseInt(lire('local-bots'), 10);
    if (total < 2) return 'Il faut au moins 2 joueurs : ajoute un bot ou un joueur.';
    if (total > 6) return '6 places maximum autour du plateau.';
    return '';
  },
  validerEnLigne: () => (parseInt(lire('nb-joueurs'), 10) + parseInt(lire('nb-bots'), 10) > 6
    ? '6 places maximum : enlève un bot ou un joueur.' : ''),
  demarrer: (s) => { M.normaliser(s); M.nouvellePartie(s); },
  afficher: (s, place) => {
    etat = M.normaliser(s);
    maPlace = place;
    noterChangement();
    rendre();
    planifierBot();
  },
  // Sur un seul téléphone : rien de caché, l'écran suit le joueur humain qui doit agir
  quiDoitJouer: (s) => {
    const humains = (s.players || []).filter((p) => !p.bot);
    if (humains.length <= 1) return -1;
    const a = M.acteur(M.normaliser(s));
    return a >= 0 && !s.players[a].bot ? a : -1;
  },
  secret: false,
});
initRegles();

function agir(fn) {
  return salon.agir((s) => fn(M.normaliser(s)));
}
const action = (a) => agir((s) => M.jouerAction(s, maPlace, a));

// Les bots sont joués par l'appareil du premier joueur humain ; les autres prennent le relais
// après un délai s'il est déconnecté. Le compteur `coup` évite tout double coup.
function planifierBot() {
  if (!etat || etat.status !== 'jeu') return;
  const a = M.acteur(etat);
  if (a < 0 || !etat.players[a].bot) return;
  const moi = etat.players[maPlace];
  if (!moi || moi.bot) return;
  const cle = `${etat.coup}-${a}-${etat.phase}`;
  if (botPrevu === cle) return;
  botPrevu = cle;
  const coup = etat.coup;
  const premierHumain = etat.players.findIndex((p) => !p.bot && !p.faillite);
  const attente = Math.max(0, finAnimation - Date.now(), finRoulement - Date.now());
  // après son lancer, le bot laisse le temps de voir ses dés avant d'avancer
  const reflexion = etat.phase === 'avancer' ? 1500 : 850 + Math.random() * 400;
  const delai = attente + ((salon.estLocal() || maPlace === premierHumain) ? reflexion : 4000 + maPlace * 1500);
  setTimeout(() => {
    agir((s) => {
      if (s.status !== 'jeu' || s.coup !== coup) return false;
      const b = M.acteur(s);
      if (b < 0 || !s.players[b].bot) return false;
      try {
        if (M.jouerAction(s, b, M.decisionBot(s, b))) return true;
      } catch (err) {
        console.error('Bot : erreur dans sa décision', err);
      }
      return actionDeSecours(s, b);
    });
  }, delai);
}

// Si la décision d'un bot est refusée, il se rabat sur une action sûre pour ne jamais bloquer la partie
function actionDeSecours(s, b) {
  if (s.offre && s.offre.a === b) return M.jouerAction(s, b, { type: 'repondre', accepte: false });
  const essais = { lancer: ['lancer'], avancer: ['avancer'], acheter: ['encheres', 'refuser'], enchere: ['passer'], dette: ['regler'], 'fin-tour': ['fin'] };
  return (essais[s.phase] || []).some((type) => M.jouerAction(s, b, { type }));
}

const botDoitJouer = () => { const a = M.acteur(etat); return a >= 0 && etat.players[a].bot; };

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
  const occupe = resumeAffiche || enAnimation || desQuiRoulent || Date.now() < finAnimation;
  if (occupe || Date.now() - dernierChangement < 4500) return;
  dernierChangement = Date.now();
  botPrevu = '';
  planifierBot();
}, 1500);


// =====================================================================
// Plateau
// =====================================================================
const plateau = $('plateau');
let casesEls = null;

// Position de la case i sur la grille 11 × 11 (Départ en bas à droite, sens des aiguilles d'une montre)
function coord(i) {
  if (i <= 10) return [10, 10 - i, 'bas'];
  if (i < 20) return [10 - (i - 10), 0, 'gauche'];
  if (i <= 30) return [0, i - 20, 'haut'];
  return [i - 30, 10, 'droite'];
}

function construirePlateau() {
  casesEls = CASES.map((c, i) => {
    const [r, col, cote] = coord(i);
    const e = el('button', `case ${cote} type-${c.type}`);
    e.type = 'button';
    e.style.gridRow = String(r + 1);
    e.style.gridColumn = String(col + 1);
    if ([0, 10, 20, 30].includes(i)) e.classList.add('coin');
    if (c.groupe) {
      const bande = el('span', 'bande');
      bande.style.background = GROUPES[c.groupe].couleur;
      bande.appendChild(el('span', 'batiments'));
      e.appendChild(bande);
    }
    if (c.icone) e.appendChild(el('span', 'icone', c.icone));
    e.appendChild(el('span', 'nom', c.court));
    if (c.prix) e.appendChild(el('span', 'prix', yens(c.prix)));
    e.appendChild(el('span', 'proprio'));
    e.appendChild(el('span', 'pions'));
    e.setAttribute('aria-label', c.nom);
    e.addEventListener('click', () => (compo ? basculerCase(i) : ouvrirFiche(i)));
    plateau.appendChild(e);
    return e;
  });
}

function rendrePlateau() {
  if (!casesEls) construirePlateau();
  casesEls.forEach((e, i) => {
    const etatCase = etat.cases[i];
    const proprio = e.querySelector('.proprio');
    if (etatCase.p >= 0) {
      proprio.style.background = COULEURS_JOUEURS[etat.players[etatCase.p].couleur];
      proprio.hidden = false;
    } else proprio.hidden = true;
    e.classList.toggle('hypotheque', !!etatCase.m);
    const bat = e.querySelector('.batiments');
    if (bat) bat.textContent = etatCase.b === 5 ? '🏨' : '■'.repeat(etatCase.b);
  });
  marquerEchange();
  placerPions();

  // Nombre de tours, bien visible au centre (parties à durée limitée)
  const tourEl = $('tour-plateau');
  tourEl.hidden = etat.finMode !== 'tours';
  if (etat.finMode === 'tours') {
    const t = Math.min(etat.tour || 1, etat.toursMax);
    tourEl.textContent = t >= etat.toursMax ? `Dernier tour ! (${t} / ${etat.toursMax})` : `Tour ${t} / ${etat.toursMax}`;
    tourEl.classList.toggle('dernier', t >= etat.toursMax);
  }

  // Dés : ils roulent un instant à chaque nouveau lancer, puis affichent le résultat et le total
  const lancerId = etat.desId || 0;
  if (dernierLancer !== null && lancerId !== dernierLancer && !mouvementReduit) roulerDes();
  else if (!desQuiRoulent) dessinerDes(etat.des);
  dernierLancer = lancerId;

  // Dernière carte tirée (affichée quand le pion est arrivé)
  const zone = $('carte-tiree');
  if (etat.carte && !enAnimation) {
    zone.hidden = false;
    zone.className = `carte-tiree ${etat.carte.type}`;
    zone.innerHTML = '';
    zone.appendChild(el('strong', '', etat.carte.type === 'omikuji' ? 'おみくじ Omikuji' : '祭 Matsuri'));
    zone.appendChild(el('span', '', etat.carte.texte));
    derniereCarte = etat.carte.ts;
  } else zone.hidden = true;
}

// Échange en cours : quartiers entourés (vert = je reçois, rouge = je donne, doré pour les autres joueurs)
function marquerEchange() {
  casesEls.forEach((e) => e.classList.remove('echange-recois', 'echange-donne', 'echange-neutre', 'selectionnable'));
  plateau.classList.toggle('mode-echange', !!compo);
  if (compo) {
    compo.donne.forEach((c) => casesEls[c].classList.add('echange-donne'));
    compo.recoit.forEach((c) => casesEls[c].classList.add('echange-recois'));
    casesEls.forEach((e, c) => {
      const p = etat.cases[c].p;
      if (p >= 0 && !etat.players[p].faillite && M.echangeable(etat, p, c) && (p === maPlace || !compo.contre || p === compo.a)) e.classList.add('selectionnable');
    });
    return;
  }
  const o = etat.offre;
  if (!o) return;
  const classe = (versMoi) => (o.a !== maPlace && o.de !== maPlace ? 'echange-neutre' : (versMoi ? 'echange-recois' : 'echange-donne'));
  // o.donne va du proposeur vers la cible ; o.recoit de la cible vers le proposeur
  o.donne.forEach((c) => casesEls[c].classList.add(classe(o.a === maPlace)));
  o.recoit.forEach((c) => casesEls[c].classList.add(classe(o.de === maPlace)));
}

function dessinerDes(valeurs) {
  const des = $('des');
  des.innerHTML = '';
  (valeurs || [0, 0]).forEach((v) => des.appendChild(deEl(v)));
  const total = $('total-des');
  const [a, b] = etat.des || [0, 0];
  total.hidden = desQuiRoulent || !a;
  total.textContent = a ? `${a} + ${b} = ${a + b}${a === b ? ' (double !)' : ''}` : '';
}

function roulerDes() {
  desQuiRoulent = true;
  finRoulement = Date.now() + 650;
  $('des').classList.add('roule');
  let n = 0;
  const minuteur = setInterval(() => {
    dessinerDes([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
    if (++n >= 10) {
      clearInterval(minuteur);
      desQuiRoulent = false;
      $('des').classList.remove('roule');
      rendre();
    }
  }, 65);
}

// Pions : position animée pendant un trajet, sinon position réelle
function placerPions() {
  casesEls.forEach((e) => { e.querySelector('.pions').innerHTML = ''; });
  etat.players.forEach((p, k) => {
    if (p.faillite) return;
    const pos = positionsAnimees.has(k) ? positionsAnimees.get(k) : p.pos;
    const pion = el('span', 'pion', p.name.charAt(0).toUpperCase());
    pion.style.background = COULEURS_JOUEURS[p.couleur];
    if (k === etat.active) pion.classList.add('actif');
    if (positionsAnimees.has(k)) pion.classList.add('en-route');
    else if (p.prison) pion.classList.add('en-prison');
    casesEls[pos].querySelector('.pions').appendChild(pion);
  });
}

// Rejoue le dernier coup dans l'ordre : trajet des dés, carte tirée (en grand), puis trajet imposé par la carte.
// Les reculs sont animés ; l'envoi au kōban est un saut direct.
const DUREE_CARTE = 6000;
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));

function animerDeplacements() {
  const id = etat.mvtId || 0;
  if (dernierMvt === null) { dernierMvt = id; return; } // à l'ouverture de la page : pas d'animation
  if (id === dernierMvt) return;
  dernierMvt = id;
  const mvts = etat.mouvements || [];
  const etapes = [];
  mvts.forEach((m) => {
    if (m.carte) { etapes.push({ carte: m }); return; }
    if (m.sens === 0) { etapes.push({ i: m.i, pos: m.a }); return; }
    let pos = m.de;
    for (let garde = 0; pos !== m.a && garde < 45; garde++) {
      pos = (pos + m.sens + 40) % 40;
      etapes.push({ i: m.i, pos });
    }
  });
  jetonAnimation += 1;
  positionsAnimees.clear();
  fermerGrandeCarte();
  if (!etapes.length) { enAnimation = false; return; }
  const nbPas = etapes.filter((e) => !e.carte).length;
  const nbCartes = etapes.length - nbPas;
  // Les longs trajets vont plus vite. Les pions des bots avancent plus posément, pour qu'on voie où ils vont.
  const parUnBot = mvts.some((m) => !m.carte && etat.players[m.i] && etat.players[m.i].bot);
  const pas = mouvementReduit ? 0 : (parUnBot
    ? Math.max(110, Math.min(210, 3500 / Math.max(1, nbPas)))
    : Math.max(45, Math.min(130, 2200 / Math.max(1, nbPas))));
  mvts.forEach((m) => { if (!m.carte && !positionsAnimees.has(m.i)) positionsAnimees.set(m.i, m.de); });
  enAnimation = true;
  finAnimation = Date.now() + pas * nbPas + nbCartes * DUREE_CARTE + 250;
  derouler(etapes, pas, jetonAnimation);
}

async function derouler(etapes, pas, jeton) {
  placerPions();
  for (const e of etapes) {
    if (jeton !== jetonAnimation) return;
    if (e.carte) { await montrerGrandeCarte(e.carte, jeton); continue; }
    if (pas) await attendre(pas);
    if (jeton !== jetonAnimation) return;
    positionsAnimees.set(e.i, e.pos);
    placerPions();
  }
  await attendre(250);
  if (jeton !== jetonAnimation) return;
  positionsAnimees.clear();
  enAnimation = false;
  rendre();
}

// Carte en grand : se ferme après DUREE_CARTE, ou plus tôt d'un toucher
let finirCarte = null;
function montrerGrandeCarte(m, jeton) {
  return new Promise((ok) => {
    const carte = $('grande-carte');
    carte.className = `grande-carte ${m.type}`;
    $('grande-carte-type').textContent = m.type === 'omikuji' ? 'おみくじ Omikuji' : '祭 Matsuri';
    const joueur = etat.players[m.i];
    $('grande-carte-qui').textContent = joueur ? `${joueur.name} a tiré :` : '';
    $('grande-carte-texte').textContent = m.texte;
    const barre = $('grande-carte-barre');
    barre.style.setProperty('--duree', `${DUREE_CARTE}ms`);
    barre.style.animation = 'none';
    void barre.offsetWidth; // relance la barre de temps
    barre.style.animation = '';
    $('annonce-carte').hidden = false;
    const minuteur = setTimeout(() => finirCarte && finirCarte(), DUREE_CARTE);
    finirCarte = () => {
      clearTimeout(minuteur);
      finirCarte = null;
      $('annonce-carte').hidden = true;
      if (jeton === jetonAnimation) finAnimation = Math.min(finAnimation, Date.now() + 2500);
      ok();
    };
  });
}
function fermerGrandeCarte() { if (finirCarte) finirCarte(); }
$('annonce-carte').addEventListener('click', fermerGrandeCarte);

const POINTS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
function deEl(v) {
  const d = el('span', 'de');
  for (let k = 1; k <= 9; k++) d.appendChild(el('span', v && POINTS[v].includes(k) ? 'point' : ''));
  d.setAttribute('aria-label', v ? `Dé : ${v}` : 'Dé');
  return d;
}

// =====================================================================
// Fiche d'une case (détails et gestion)
// =====================================================================
let ficheOuverte = -1;

function ouvrirFiche(i) {
  ficheOuverte = i;
  rendreFiche();
  $('fiche').showModal();
}
$('fiche-fermer').addEventListener('click', () => { $('fiche').close(); ficheOuverte = -1; });
$('fiche').addEventListener('close', () => { ficheOuverte = -1; });

function ligne(tbody, a, b, actif) {
  const tr = el('tr', actif ? 'actuel' : '');
  tr.append(el('td', '', a), el('td', '', b));
  tbody.appendChild(tr);
}

function rendreFiche() {
  if (ficheOuverte < 0 || !etat) return;
  const i = ficheOuverte;
  const c = CASES[i];
  const e = etat.cases[i];
  const zone = $('fiche-contenu');
  zone.innerHTML = '';
  const titre = el('div', 'fiche-titre');
  if (c.groupe) titre.style.setProperty('--couleur', GROUPES[c.groupe].couleur);
  titre.appendChild(el('h2', '', c.nom));
  if (c.groupe) titre.appendChild(el('span', '', GROUPES[c.groupe].nom));
  zone.appendChild(titre);

  if (M.achetable(i)) {
    const infos = el('p', 'fiche-infos');
    infos.textContent = e.p >= 0
      ? `Propriétaire : ${etat.players[e.p].name}${e.m ? ' (hypothéqué)' : ''}`
      : `À vendre : ${yens(c.prix)}`;
    zone.appendChild(infos);
    // Ce qui s'applique en ce moment : groupe complet, nombre de transports ou de compagnies possédés
    const proprio = e.p;
    const complet = c.type === 'propriete' && proprio >= 0 && M.possedeGroupe(etat, proprio, c.groupe);
    const nbTransports = proprio >= 0 ? TRANSPORTS.filter((t) => etat.cases[t].p === proprio).length : 0;
    const nbCompagnies = proprio >= 0 ? COMPAGNIES.filter((t) => etat.cases[t].p === proprio).length : 0;
    if (proprio >= 0) {
      const actuel = el('p', 'loyer-actuel');
      if (e.m) actuel.textContent = 'Hypothéqué : aucun loyer pour l\'instant.';
      else if (c.type === 'propriete') {
        const raison = e.b === 5 ? 'hôtel' : e.b > 0 ? `${e.b} maison${e.b > 1 ? 's' : ''}` : complet ? 'groupe complet, loyer doublé' : 'terrain nu';
        actuel.textContent = `Loyer actuel : ${yens(M.loyer(etat, i))} (${raison})`;
      } else if (c.type === 'transport') {
        actuel.textContent = `Loyer actuel : ${yens(2500 * 2 ** (nbTransports - 1))} (${nbTransports} transport${nbTransports > 1 ? 's' : ''})`;
      } else {
        actuel.textContent = `Loyer actuel : ${nbCompagnies === 2 ? 10 : 4} × les dés × 100 ¥`;
      }
      zone.appendChild(actuel);
    }
    const table = el('table', 'loyers');
    const tb = el('tbody');
    const possede = proprio >= 0 && !e.m;
    if (c.type === 'propriete') {
      ligne(tb, 'Terrain nu', yens(c.loyers[0]), possede && e.b === 0 && !complet);
      ligne(tb, 'Groupe complet', yens(c.loyers[0] * 2), possede && e.b === 0 && complet);
      for (let k = 1; k <= 4; k++) ligne(tb, `${k} maison${k > 1 ? 's' : ''}`, yens(c.loyers[k]), possede && e.b === k);
      ligne(tb, 'Hôtel', yens(c.loyers[5]), possede && e.b === 5);
      ligne(tb, 'Prix d\'une maison', yens(GROUPES[c.groupe].maison), false);
    } else if (c.type === 'transport') {
      [1, 2, 3, 4].forEach((n) => ligne(tb, `${n} transport${n > 1 ? 's' : ''}`, yens(2500 * 2 ** (n - 1)), possede && n === nbTransports));
    } else {
      ligne(tb, '1 compagnie', '4 × les dés × 100 ¥', possede && nbCompagnies === 1);
      ligne(tb, '2 compagnies', '10 × les dés × 100 ¥', possede && nbCompagnies === 2);
    }
    ligne(tb, 'Hypothèque', yens(c.prix / 2), false);
    table.appendChild(tb);
    zone.appendChild(table);
  } else {
    const textes = {
      depart: `Chaque passage rapporte ${yens(M.SALAIRE)}.`,
      koban: 'Simple visite… sauf pour ceux qui y sont emmenés.',
      police: 'Direction le kōban, sans passer par le Départ.',
      jardin: 'Un moment de calme : rien ne se passe.',
      taxe: `À payer : ${yens(c.montant || 0)}.`,
      omikuji: 'Tire un papier de fortune du temple.',
      matsuri: 'Tire une carte de fête de quartier.',
    };
    zone.appendChild(el('p', 'fiche-infos', textes[c.type] || ''));
  }

  // Actions de gestion (propriétaire, à son tour)
  const acts = $('fiche-actions');
  acts.innerHTML = '';
  if (e && e.p === maPlace && M.peutGerer(etat, maPlace)) {
    const bouton = (texte, a, actif, principal) => {
      const b = el('button', 'btn' + (principal ? ' btn-principal' : ''), texte);
      b.disabled = !actif;
      b.addEventListener('click', () => action(a));
      acts.appendChild(b);
    };
    if (c.type === 'propriete') {
      const cout = GROUPES[c.groupe].maison;
      bouton(`${e.b === 4 ? 'Hôtel' : 'Maison'} (${yens(cout)})`, { type: 'construire', c: i },
        etat.phase !== 'dette' && M.peutConstruire(etat, maPlace, i), true);
      bouton(`Revendre (+${yens(cout / 2)})`, { type: 'vendre', c: i }, M.peutVendre(etat, maPlace, i));
    }
    if (!e.m) bouton(`Hypothéquer (+${yens(c.prix / 2)})`, { type: 'hypothequer', c: i }, M.peutHypothequer(etat, maPlace, i));
    else bouton(`Lever l'hypothèque (${yens(M.coutLevee(i))})`, { type: 'lever', c: i },
      etat.phase !== 'dette' && etat.players[maPlace].argent >= M.coutLevee(i), true);
    if (c.type === 'propriete' && !M.possedeGroupe(etat, maPlace, c.groupe)) {
      acts.appendChild(el('p', 'fiche-aide', 'Possède tout le groupe de couleur pour construire.'));
    }
  }
}

// =====================================================================
// Panneau : statut, actions, biens, joueurs
// =====================================================================
const monTour = () => etat && etat.status === 'jeu' && etat.active === maPlace;

function bouton(conteneur, texte, a, { principal = false, actif = true } = {}) {
  const b = el('button', 'btn' + (principal ? ' btn-principal' : ''), texte);
  b.disabled = !actif;
  b.addEventListener('click', () => (typeof a === 'function' ? a() : action(a)));
  conteneur.appendChild(b);
  return b;
}

function rendreActions() {
  const zone = $('actions');
  zone.innerHTML = '';
  const st = $('statut');
  if (etat.status !== 'jeu') { st.textContent = 'Partie terminée'; return; }
  const moi = etat.players[maPlace];
  const actif = etat.players[etat.active];
  const qui = (p) => (p.bot ? `${p.name} réfléchit…` : `Au tour ${de(p.name)}`);

  if (compo) {
    st.textContent = compo.contre ? 'Compose ta contre-offre sur le plateau.' : 'Compose ton échange sur le plateau.';
    return;
  }

  // Échange en cours
  if (etat.offre) {
    const o = etat.offre;
    if (o.de === maPlace) {
      st.textContent = `En attente de la réponse ${de(etat.players[o.a].name)}…`;
      bouton(zone, 'Annuler l\'offre', { type: 'annuler' });
    } else if (o.a !== maPlace) {
      st.textContent = `${etat.players[o.de].name} propose un échange à ${etat.players[o.a].name}…`;
    } else {
      st.textContent = 'On te propose un échange.';
    }
    return;
  }

  // Enchères
  if (etat.phase === 'enchere' && etat.enchere) {
    const e = etat.enchere;
    const c = CASES[e.case];
    const meneur = e.meneur >= 0 ? `${etat.players[e.meneur].name} mène avec ${yens(e.mise)}` : 'aucune mise pour l\'instant';
    st.textContent = `Enchères pour ${c.nom} (valeur ${yens(c.prix)}) : ${meneur}.`;
    if (e.actif === maPlace && !moi.bot) {
      const ench = el('div', 'rangee-boutons encheres');
      [1000, 5000, 10000].forEach((m) => bouton(ench, `+${yens(m)}`, { type: 'encherir', montant: m },
        { principal: m === 1000, actif: e.mise + m <= moi.argent }));
      zone.appendChild(ench);
      bouton(zone, 'Passer', { type: 'passer' });
    } else {
      zone.appendChild(el('p', 'attente', qui(etat.players[e.actif])));
    }
    return;
  }

  if (resumeAffiche) {
    st.textContent = 'Fin du tour…';
    return;
  }
  if (desQuiRoulent) {
    st.textContent = `${actif.name} lance les dés…`;
    return;
  }
  if (enAnimation) {
    st.textContent = `${actif.name} avance…`;
    return;
  }
  const [d1, d2] = etat.des || [0, 0];
  const resultat = `${d1} + ${d2} = ${d1 + d2}${d1 === d2 ? ' (double !)' : ''}`;

  if (!monTour() || moi.bot) {
    st.textContent = etat.phase === 'avancer' ? `${actif.name} a fait ${resultat}` : qui(actif);
    return;
  }

  const nom = salon.estLocal() ? `${moi.name}, ` : '';
  switch (etat.phase) {
    case 'lancer':
      if (moi.prison) {
        st.textContent = moi.prison >= 3
          ? `${nom}dernier essai au kōban : sans double, tu paieras ${yens(M.AMENDE)} et tu sortiras.`
          : `${nom}tu es au kōban (essai ${moi.prison} sur 3).`;
        bouton(zone, `Payer ${yens(M.AMENDE)}`, { type: 'amende' }, { actif: moi.argent >= M.AMENDE });
        if (moi.sortie.length) bouton(zone, 'Utiliser l\'omamori', { type: 'omamori' });
        bouton(zone, 'Tenter un double', { type: 'lancer' }, { principal: true });
      } else {
        st.textContent = etat.rejoue ? `${nom}double ! Tu rejoues.` : `${nom}à toi de lancer les dés.`;
        bouton(zone, 'Lancer les dés', { type: 'lancer' }, { principal: true });
      }
      bouton(zone, 'Proposer un échange', () => entrerModeEchange());
      break;
    case 'avancer':
      st.textContent = `${nom}tu as fait ${resultat}.`;
      bouton(zone, `Avancer de ${etat.aAvancer} cases`, { type: 'avancer' }, { principal: true });
      break;
    case 'acheter': {
      const c = CASES[moi.pos];
      st.textContent = `${nom}${c.nom} est à vendre.`;
      bouton(zone, `Acheter (${yens(c.prix)})`, { type: 'acheter' }, { principal: true, actif: moi.argent >= c.prix });
      bouton(zone, 'Mettre aux enchères', { type: 'encheres' });
      bouton(zone, etat.rejoue ? 'Ne pas acheter' : 'Fin du tour', { type: 'refuser' });
      if (moi.argent < c.prix) zone.appendChild(el('p', 'aide', 'Pas assez de yens : hypothèque un quartier (touche-le), mets aux enchères ou passe.'));
      break;
    }
    case 'dette': {
      const d = etat.dette;
      st.textContent = `${nom}tu dois ${yens(d.montant)} (${d.motif}).`;
      zone.appendChild(el('p', 'aide', 'Touche tes quartiers pour revendre des bâtiments ou hypothéquer, puis paie.'));
      bouton(zone, `Payer ${yens(d.montant)}`, { type: 'regler' }, { principal: true, actif: moi.argent >= d.montant });
      bouton(zone, 'Déclarer faillite', () => {
        if (confirm('Déclarer faillite ? Tu seras éliminé de la partie.')) action({ type: 'faillite' });
      });
      break;
    }
    case 'fin-tour':
      st.textContent = `${nom}tu peux construire, échanger, ou finir ton tour.`;
      bouton(zone, 'Fin du tour', { type: 'fin' }, { principal: true });
      bouton(zone, 'Proposer un échange', () => entrerModeEchange());
      break;
    default:
      st.textContent = '';
  }
}

// Liste des biens d'un joueur (quartiers dans l'ordre du plateau, bâtiments, omamori)
function remplirBiens(zone, joueur) {
  zone.innerHTML = '';
  const siens = etat.cases.map((e, c) => (e.p === joueur ? c : -1)).filter((c) => c >= 0);
  if (!siens.length) zone.appendChild(el('p', 'vide', 'Aucun quartier pour l\'instant.'));
  siens.forEach((c) => {
    const def = CASES[c];
    const e = etat.cases[c];
    const b = el('button', 'bien' + (e.m ? ' hypotheque' : ''));
    b.type = 'button';
    b.style.setProperty('--couleur', def.groupe ? GROUPES[def.groupe].couleur : '#6B6B6B');
    b.append(def.icone && !def.groupe ? `${def.icone} ` : '', def.court);
    if (def.groupe && M.possedeGroupe(etat, joueur, def.groupe)) {
      const etoile = el('span', 'groupe-complet', '★');
      etoile.title = 'Groupe complet';
      b.appendChild(etoile);
    }
    if (e.b) b.appendChild(el('span', 'nb-bat', e.b === 5 ? '🏨' : `${e.b}■`));
    b.addEventListener('click', () => (compo ? basculerCase(c) : ouvrirFiche(c)));
    zone.appendChild(b);
  });
  const p = etat.players[joueur];
  if (p.sortie.length) zone.appendChild(el('span', 'omamori', `Omamori × ${p.sortie.length}`));
}

function rendreBiens() {
  $('mon-argent').textContent = yens(etat.players[maPlace].argent);
  remplirBiens($('mes-biens'), maPlace);
  if (biensOuverts >= 0) rendreBiensJoueur();
}

// Biens d'un autre joueur (en touchant son nom)
let biensOuverts = -1;
function ouvrirBiensJoueur(k) {
  biensOuverts = k;
  rendreBiensJoueur();
  $('biens-joueur').showModal();
}
function rendreBiensJoueur() {
  const p = etat.players[biensOuverts];
  if (!p) return;
  $('biens-joueur-titre').textContent = biensOuverts === maPlace && !salon.estLocal() ? 'Mes biens' : `Biens ${de(p.name)}`;
  const nb = etat.cases.filter((e) => e.p === biensOuverts).length;
  $('biens-joueur-argent').textContent = `${yens(p.argent)} en poche, ${nb} propriété${nb > 1 ? 's' : ''}, patrimoine total ${yens(M.patrimoine(etat, biensOuverts))}`;
  remplirBiens($('biens-joueur-liste'), biensOuverts);
}
$('biens-joueur-fermer').addEventListener('click', () => $('biens-joueur').close());
$('biens-joueur').addEventListener('close', () => { biensOuverts = -1; });

function rendreJoueurs() {
  $('tour').textContent = etat.finMode === 'tours' ? `tour ${Math.min(etat.tour, etat.toursMax)} / ${etat.toursMax}` : `tour ${etat.tour}`;
  const liste = $('joueurs');
  liste.innerHTML = '';
  etat.players.forEach((p, k) => {
    const li = el('li', p.faillite ? 'faillite' : '');
    if (k === etat.active && etat.status === 'jeu') li.classList.add('actif');
    // toucher un joueur affiche tous ses biens
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.setAttribute('aria-label', `Voir les biens ${de(p.name)}`);
    li.addEventListener('click', () => ouvrirBiensJoueur(k));
    li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ouvrirBiensJoueur(k); } });
    const pastille = el('span', 'pastille-joueur', p.name.charAt(0).toUpperCase());
    pastille.style.background = COULEURS_JOUEURS[p.couleur];
    li.appendChild(pastille);
    li.appendChild(el('span', 'nom', p.name + (!salon.estLocal() && k === maPlace ? ' (toi)' : '')));
    const infos = [];
    const nb = etat.cases.filter((e) => e.p === k).length;
    if (!p.faillite) infos.push(`${nb} propriété${nb > 1 ? 's' : ''}`);
    if (p.prison) infos.push(`au kōban, essai ${p.prison}/3`);
    if (p.faillite) infos.push('ruiné');
    if (infos.length) li.appendChild(el('span', 'etat', infos.join(', ')));
    li.appendChild(el('span', 'argent', yens(p.argent)));
    liste.appendChild(li);
  });
}

// =====================================================================
// Échanges : composition directement sur le plateau
// =====================================================================
// compo = null, ou { a, donne: [], recoit: [], contre } pendant qu'on compose une offre
let compo = null;
const champDonne = $('compo-donne-argent');
const champRecoit = $('compo-recoit-argent');

function entrerModeEchange(depart) {
  const autres = etat.players.map((p, k) => k).filter((k) => k !== maPlace && !etat.players[k].faillite);
  if (!autres.length) return;
  compo = depart || { a: autres[0], donne: [], recoit: [], contre: false };
  champDonne.value = String(depart ? depart.donneArgent || 0 : 0);
  champRecoit.value = String(depart ? depart.recoitArgent || 0 : 0);
  const sel = $('compo-avec');
  sel.innerHTML = '';
  autres.forEach((k) => {
    const o = el('option', '', etat.players[k].name);
    o.value = String(k);
    sel.appendChild(o);
  });
  sel.value = String(compo.a);
  sel.disabled = compo.contre;
  $('compo-titre').textContent = compo.contre ? `Contre-offre à ${etat.players[compo.a].name}` : 'Proposer un échange';
  $('compo-proposer').textContent = compo.contre ? 'Envoyer la contre-offre' : 'Proposer';
  rendre();
}

function quitterModeEchange() {
  compo = null;
  rendre();
}

// Toucher un quartier : l'ajouter ou le retirer de l'offre
function basculerCase(c) {
  const p = etat.cases[c].p;
  if (p < 0) { toast('Ce quartier n\'appartient à personne.'); return; }
  if (etat.players[p].faillite) return;
  if (!M.echangeable(etat, p, c)) { toast('Impossible : il y a des maisons dans ce groupe.'); return; }
  const bascule = (liste) => (liste.includes(c) ? liste.filter((x) => x !== c) : [...liste, c]);
  if (p === maPlace) {
    compo.donne = bascule(compo.donne);
  } else {
    if (p !== compo.a) {
      if (compo.contre) { toast(`La contre-offre se fait avec ${etat.players[compo.a].name}.`); return; }
      // un quartier d'un autre joueur : l'échange se fera avec lui
      if (compo.recoit.length) toast(`Échange maintenant avec ${etat.players[p].name}.`);
      compo.a = p;
      compo.recoit = [];
      $('compo-avec').value = String(p);
    }
    compo.recoit = bascule(compo.recoit);
  }
  rendre();
}

$('compo-avec').addEventListener('change', (e) => {
  compo.a = Number(e.target.value);
  compo.recoit = [];
  rendre();
});
document.querySelectorAll('#compo-echange .pas').forEach((b) => b.addEventListener('click', () => {
  const champ = $(b.dataset.champ);
  champ.value = String(Math.max(0, (Number(champ.value) || 0) + Number(b.dataset.pas)));
}));
$('compo-annuler').addEventListener('click', quitterModeEchange);
$('compo-proposer').addEventListener('click', () => {
  const offre = {
    a: compo.a,
    donne: compo.donne,
    recoit: compo.recoit,
    donneArgent: Math.max(0, Number(champDonne.value) || 0),
    recoitArgent: Math.max(0, Number(champRecoit.value) || 0),
  };
  if (!offre.donne.length && !offre.recoit.length && !offre.donneArgent && !offre.recoitArgent) {
    toast('Touche au moins un quartier, ou indique un montant.');
    return;
  }
  if (offre.donneArgent > etat.players[maPlace].argent) { toast('Tu n\'as pas autant de yens.'); return; }
  if (offre.recoitArgent > etat.players[offre.a].argent) { toast(`${etat.players[offre.a].name} n'a pas autant de yens.`); return; }
  const type = compo.contre ? 'contre' : 'proposer';
  compo = null;
  action({ type, offre });
});

function rendreCompo() {
  const panneau = $('compo-echange');
  // l'offre composée n'est plus possible (tour terminé, offre retirée…) : on referme
  if (compo && (etat.status !== 'jeu' || (compo.contre ? !(etat.offre && etat.offre.a === maPlace) : !(etat.active === maPlace && ['lancer', 'fin-tour'].includes(etat.phase) && !etat.offre)))) compo = null;
  panneau.hidden = !compo;
  if (!compo) return;
  // on retire ce qui n'est plus échangeable
  compo.donne = compo.donne.filter((c) => M.echangeable(etat, maPlace, c));
  compo.recoit = compo.recoit.filter((c) => M.echangeable(etat, compo.a, c));
  const liste = (id, cases) => {
    const ul = $(id);
    ul.innerHTML = '';
    if (!cases.length) ul.appendChild(el('li', 'vide', 'Touche un quartier sur le plateau'));
    cases.forEach((c) => {
      const li = el('li');
      const b = el('button', 'retirer', '×');
      b.type = 'button';
      b.setAttribute('aria-label', `Retirer ${CASES[c].nom}`);
      b.addEventListener('click', () => basculerCase(c));
      const pastille = el('span', 'mini-bande');
      pastille.style.background = CASES[c].groupe ? GROUPES[CASES[c].groupe].couleur : '#6B6B6B';
      li.append(pastille, CASES[c].nom + (etat.cases[c].m ? ' (hyp.)' : ''), b);
      ul.appendChild(li);
    });
  };
  liste('compo-donne', compo.donne);
  liste('compo-recoit', compo.recoit);
  champDonne.max = String(etat.players[maPlace].argent);
  champRecoit.max = String(etat.players[compo.a].argent);
}

function rendreOffre() {
  const voile = $('offre-recue');
  const o = etat.offre;
  const pourMoi = o && o.a === maPlace && !etat.players[maPlace].bot && etat.status === 'jeu' && !compo;
  voile.hidden = !pourMoi;
  if (!pourMoi) return;
  $('offre-titre').textContent = o.contre
    ? `${etat.players[o.de].name} te fait une contre-offre`
    : `${etat.players[o.de].name} te propose un échange`;
  // Après l'échange, qui posséderait la case k ?
  const apres = (k) => {
    if (o.donne.includes(k)) return o.a;
    if (o.recoit.includes(k)) return o.de;
    return etat.cases[k].p;
  };
  const completeGroupe = (c, j) => CASES[c].groupe && GROUPES[CASES[c].groupe]
    && Object.keys(CASES).filter((k) => CASES[k].groupe === CASES[c].groupe).every((k) => apres(Number(k)) === j);
  const remplir = (id, cases, argent, recu) => {
    const ul = $(id);
    ul.innerHTML = '';
    cases.forEach((c) => {
      const li = el('li');
      const pastille = el('span', 'mini-bande');
      pastille.style.background = CASES[c].groupe ? GROUPES[CASES[c].groupe].couleur : '#6B6B6B';
      li.append(pastille, CASES[c].nom + (etat.cases[c].m ? ' (hypothéqué)' : ''));
      if (recu && completeGroupe(c, maPlace)) li.appendChild(el('small', '', 'Complète ton groupe !'));
      if (!recu && completeGroupe(c, o.de)) li.appendChild(el('small', '', `Complète le groupe ${de(etat.players[o.de].name)}`));
      ul.appendChild(li);
    });
    if (argent) ul.appendChild(el('li', '', yens(argent)));
    if (!cases.length && !argent) ul.appendChild(el('li', 'vide', 'Rien'));
  };
  remplir('offre-recois', o.donne, o.donneArgent, true);
  remplir('offre-donnes', o.recoit, o.recoitArgent, false);
}
$('offre-accepter').addEventListener('click', () => action({ type: 'repondre', accepte: true }));
$('offre-refuser').addEventListener('click', () => action({ type: 'repondre', accepte: false }));
// Contre-offre : on part de l'offre reçue, inversée, et on la modifie sur le plateau
$('offre-contre').addEventListener('click', () => {
  const o = etat.offre;
  if (!o || o.a !== maPlace) return;
  entrerModeEchange({ a: o.de, donne: [...o.recoit], recoit: [...o.donne], donneArgent: o.recoitArgent, recoitArgent: o.donneArgent, contre: true });
});

// =====================================================================
// Fin de partie
// =====================================================================
function rendreFin() {
  const voile = $('fin');
  voile.hidden = etat.status !== 'fin';
  if (etat.status !== 'fin' || !etat.classement) return;
  const gagnant = etat.players[etat.classement[0].i];
  $('fin-titre').textContent = !salon.estLocal() && etat.classement[0].i === maPlace ? 'Tu as gagné !' : `Victoire ${de(gagnant.name)} !`;
  const ol = $('classement');
  ol.innerHTML = '';
  etat.classement.forEach(({ i, valeur }) => {
    const p = etat.players[i];
    ol.appendChild(el('li', p.faillite ? 'faillite' : '', `${p.name} : ${p.faillite ? 'ruiné' : yens(valeur)}`));
  });
}
$('btn-rejouer').addEventListener('click', () => {
  agir((s) => {
    if (s.status !== 'fin') return false;
    M.nouvellePartie(s);
  });
});

// =====================================================================
function rendre() {
  if (!etat || !etat.cases) return;
  if (!casesEls) construirePlateau();
  animerDeplacements();
  rendrePlateau();
  verifierResume();
  rendreActions();
  rendreBiens();
  rendreJoueurs();
  rendreCompo();
  if (casesEls) marquerEchange();
  rendreOffre();
  rendreFin();
  rendreFiche();
  const ev = etat.lastEvent;
  if (ev && ev.ts !== dernierEvenement && !premiereSynchro) toast(ev.texte, true);
  dernierEvenement = ev ? ev.ts : null;
  premiereSynchro = false;
}
