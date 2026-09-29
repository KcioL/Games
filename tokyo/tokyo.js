import { $, el, toast, initSalon, initRegles, de } from '../commun/salon.js';
import { CASES, GROUPES } from './plateau.js';
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
  const attente = Math.max(0, finAnimation - Date.now());
  const delai = attente + ((salon.estLocal() || maPlace === premierHumain) ? 650 + Math.random() * 350 : 4000 + maPlace * 1500);
  setTimeout(() => {
    agir((s) => {
      if (s.status !== 'jeu' || s.coup !== coup) return false;
      const b = M.acteur(s);
      if (b < 0 || !s.players[b].bot) return false;
      return M.jouerAction(s, b, M.decisionBot(s, b));
    });
  }, delai);
}

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
    e.addEventListener('click', () => ouvrirFiche(i));
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

  // Dés
  const des = $('des');
  des.innerHTML = '';
  (etat.des || [0, 0]).forEach((v) => des.appendChild(deEl(v)));

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
  casesEls.forEach((e) => e.classList.remove('echange-recois', 'echange-donne', 'echange-neutre'));
  const o = etat.offre;
  if (!o) return;
  const classe = (versMoi) => (o.a !== maPlace && o.de !== maPlace ? 'echange-neutre' : (versMoi ? 'echange-recois' : 'echange-donne'));
  // o.donne va du proposeur vers la cible ; o.recoit de la cible vers le proposeur
  o.donne.forEach((c) => casesEls[c].classList.add(classe(o.a === maPlace)));
  o.recoit.forEach((c) => casesEls[c].classList.add(classe(o.de === maPlace)));
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
  const pas = mouvementReduit ? 0 : Math.max(45, Math.min(130, 2200 / Math.max(1, nbPas))); // les longs trajets vont plus vite
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
    const table = el('table', 'loyers');
    const tb = el('tbody');
    if (c.type === 'propriete') {
      ligne(tb, 'Terrain nu', yens(c.loyers[0]), e.b === 0);
      ligne(tb, 'Groupe complet', yens(c.loyers[0] * 2), false);
      for (let k = 1; k <= 4; k++) ligne(tb, `${k} maison${k > 1 ? 's' : ''}`, yens(c.loyers[k]), e.b === k);
      ligne(tb, 'Hôtel', yens(c.loyers[5]), e.b === 5);
      ligne(tb, 'Prix d\'une maison', yens(GROUPES[c.groupe].maison), false);
    } else if (c.type === 'transport') {
      [1, 2, 3, 4].forEach((n) => ligne(tb, `${n} transport${n > 1 ? 's' : ''}`, yens(2500 * 2 ** (n - 1)), false));
    } else {
      ligne(tb, '1 compagnie', '4 × les dés × 100 ¥', false);
      ligne(tb, '2 compagnies', '10 × les dés × 100 ¥', false);
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
// Panneau : statut, actions, biens, joueurs, journal
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

  if (enAnimation) {
    st.textContent = `${actif.name} avance…`;
    return;
  }

  if (!monTour() || moi.bot) {
    st.textContent = qui(actif);
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
      bouton(zone, 'Proposer un échange', ouvrirEchange);
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
      bouton(zone, 'Proposer un échange', ouvrirEchange);
      break;
    default:
      st.textContent = '';
  }
}

function rendreBiens() {
  const moi = etat.players[maPlace];
  $('mon-argent').textContent = yens(moi.argent);
  const zone = $('mes-biens');
  zone.innerHTML = '';
  const miens = etat.cases.map((e, c) => (e.p === maPlace ? c : -1)).filter((c) => c >= 0);
  if (!miens.length) zone.appendChild(el('p', 'vide', 'Aucun quartier pour l\'instant.'));
  miens.forEach((c) => {
    const def = CASES[c];
    const e = etat.cases[c];
    const b = el('button', 'bien' + (e.m ? ' hypotheque' : ''));
    b.type = 'button';
    b.style.setProperty('--couleur', def.groupe ? GROUPES[def.groupe].couleur : '#6B6B6B');
    b.append(def.icone && !def.groupe ? `${def.icone} ` : '', def.court);
    if (e.b) b.appendChild(el('span', 'nb-bat', e.b === 5 ? '🏨' : `${e.b}■`));
    b.addEventListener('click', () => ouvrirFiche(c));
    zone.appendChild(b);
  });
  if (moi.sortie.length) zone.appendChild(el('span', 'omamori', `Omamori × ${moi.sortie.length}`));
}

function rendreJoueurs() {
  $('tour').textContent = etat.finMode === 'tours' ? `tour ${Math.min(etat.tour, etat.toursMax)} / ${etat.toursMax}` : `tour ${etat.tour}`;
  const liste = $('joueurs');
  liste.innerHTML = '';
  etat.players.forEach((p, k) => {
    const li = el('li', p.faillite ? 'faillite' : '');
    if (k === etat.active && etat.status === 'jeu') li.classList.add('actif');
    const pastille = el('span', 'pastille-joueur', p.name.charAt(0).toUpperCase());
    pastille.style.background = COULEURS_JOUEURS[p.couleur];
    li.appendChild(pastille);
    li.appendChild(el('span', 'nom', p.name + (!salon.estLocal() && k === maPlace ? ' (toi)' : '')));
    const infos = [];
    if (p.prison) infos.push(`au kōban, essai ${p.prison}/3`);
    if (p.faillite) infos.push('ruiné');
    if (infos.length) li.appendChild(el('span', 'etat', infos.join(', ')));
    li.appendChild(el('span', 'argent', yens(p.argent)));
    liste.appendChild(li);
  });
  const journal = $('journal');
  journal.innerHTML = '';
  [...etat.journal].reverse().forEach((t) => journal.appendChild(el('li', '', t)));
}

// =====================================================================
// Échanges
// =====================================================================
function listeCases(zone, joueur) {
  zone.innerHTML = '';
  const cases = etat.cases.map((e, c) => (M.echangeable(etat, joueur, c) ? c : -1)).filter((c) => c >= 0);
  if (!cases.length) zone.appendChild(el('p', 'vide', 'Rien d\'échangeable.'));
  cases.forEach((c) => {
    const lab = el('label', 'choix-case');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.value = String(c);
    const pastille = el('span', 'mini-bande');
    pastille.style.background = CASES[c].groupe ? GROUPES[CASES[c].groupe].couleur : '#6B6B6B';
    lab.append(cb, pastille, CASES[c].nom + (etat.cases[c].m ? ' (hyp.)' : ''));
    zone.appendChild(lab);
  });
}

function ouvrirEchange() {
  const sel = $('echange-avec');
  sel.innerHTML = '';
  etat.players.forEach((p, k) => {
    if (k === maPlace || p.faillite) return;
    const o = el('option', '', p.name);
    o.value = String(k);
    sel.appendChild(o);
  });
  if (!sel.options.length) return;
  $('echange-donne-argent').value = '0';
  $('echange-recoit-argent').value = '0';
  $('echange-donne-argent').max = String(etat.players[maPlace].argent);
  const majListes = () => {
    listeCases($('echange-donne'), maPlace);
    listeCases($('echange-recoit'), Number(sel.value));
    $('echange-recoit-argent').max = String(etat.players[Number(sel.value)].argent);
  };
  sel.onchange = majListes;
  majListes();
  $('echange').showModal();
}
$('echange-annuler').addEventListener('click', () => $('echange').close());
$('echange-proposer').addEventListener('click', () => {
  const coches = (id) => [...$(id).querySelectorAll('input:checked')].map((x) => Number(x.value));
  const offre = {
    a: Number($('echange-avec').value),
    donne: coches('echange-donne'),
    recoit: coches('echange-recoit'),
    donneArgent: Number($('echange-donne-argent').value) || 0,
    recoitArgent: Number($('echange-recoit-argent').value) || 0,
  };
  if (!offre.donne.length && !offre.recoit.length && !offre.donneArgent && !offre.recoitArgent) {
    toast('Choisis au moins un quartier ou un montant.');
    return;
  }
  if (offre.donneArgent > etat.players[maPlace].argent) { toast('Tu n\'as pas autant de yens.'); return; }
  if (offre.recoitArgent > etat.players[offre.a].argent) { toast(`${etat.players[offre.a].name} n'a pas autant de yens.`); return; }
  $('echange').close();
  action({ type: 'proposer', offre });
});

function rendreOffre() {
  const voile = $('offre-recue');
  const o = etat.offre;
  const pourMoi = o && o.a === maPlace && !etat.players[maPlace].bot && etat.status === 'jeu';
  voile.hidden = !pourMoi;
  if (!pourMoi) return;
  $('offre-titre').textContent = `${etat.players[o.de].name} te propose un échange`;
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
  rendreActions();
  rendreBiens();
  rendreJoueurs();
  rendreOffre();
  rendreFin();
  rendreFiche();
  const ev = etat.lastEvent;
  if (ev && ev.ts !== dernierEvenement && !premiereSynchro) toast(ev.texte, true);
  dernierEvenement = ev ? ev.ts : null;
  premiereSynchro = false;
}
