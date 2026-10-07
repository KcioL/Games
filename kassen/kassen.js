import { $, el, initSalon, initRegles, de } from '../commun/salon.js';
import { EDITIONS, ERREURS_JEU_PERSO, JEU_PERSO_DEMANDE } from './editions.js'; // à importer en premier : ajoute le jeu personnalisé
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
    edition: EDITIONS[$(local ? 'local-edition' : 'nb-edition').value] ? $(local ? 'local-edition' : 'nb-edition').value : 'japon',
    players: [
      { name: nom, joined: true, bot: false },
      local && nb === 1 ? { name: 'Bot', joined: true, bot: true } : { name: 'En attente', joined: false, bot: false },
    ],
  }),
  demarrer: (s) => { M.normaliser(s); M.nouvellePartie(s); },
  afficher: (s, place) => {
    if (place !== maPlace) selection = null;
    etat = M.normaliser(s);
    maPlace = place;
    noterChangement();
    rendre();
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

// Choix de l'édition (visible seulement si le jeu personnalisé est prêt)
document.querySelectorAll('.select-edition').forEach((sel) => {
  Object.entries(EDITIONS).forEach(([cle, e]) => {
    const o = el('option', '', e.nom);
    o.value = cle;
    sel.appendChild(o);
  });
});
document.querySelectorAll('.choix-edition').forEach((l) => { l.hidden = Object.keys(EDITIONS).length < 2; });
// Jeu personnalisé activé mais incomplet : on dit précisément quoi corriger
if (JEU_PERSO_DEMANDE && ERREURS_JEU_PERSO.length) {
  const zone = $('erreur-perso');
  zone.hidden = false;
  zone.appendChild(el('strong', '', 'Ton jeu personnalisé (jeu-perso.js) n\'est pas encore jouable :'));
  const ul = el('ul');
  ERREURS_JEU_PERSO.slice(0, 8).forEach((t) => ul.appendChild(el('li', '', t)));
  if (ERREURS_JEU_PERSO.length > 8) ul.appendChild(el('li', '', `… et ${ERREURS_JEU_PERSO.length - 8} autre(s) problème(s).`));
  zone.appendChild(ul);
}

function agir(fn) { return salon.agir((s) => fn(M.normaliser(s))); }
// « Tu as gagné » a un sens en ligne ou contre le bot ; à deux sur un téléphone, on nomme le gagnant
const pointDeVueJoueur = () => !salon.estLocal() || etat.players.some((p) => p.bot);
const action = (a) => { selection = null; return agir((s) => M.jouerAction(s, maPlace, a)); };

// =====================================================================
// Bot (et surveillant anti-blocage)
// =====================================================================
function botAJouer(s) {
  if (s.status === 'clans') return s.players.findIndex((p) => p.bot && !p.clan);
  if (s.status === 'echange') return s.players.findIndex((p) => p.bot && !p.pret);
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
// Cartes
// =====================================================================
const def = (carte) => CARTES[carte.c];

// Images des cartes : cartes/<identifiant>.jpg (voir cartes/LISTE-DES-CARTES.md).
// Une image est une carte complète (force, icônes, nom déjà dessinés) : elle remplace le dessin par défaut.
// Une image absente est simplement ignorée et la carte garde son dessin par défaut.
const imagesAbsentes = new Set();
const imagesChargees = new Set(); // déjà affichées une fois : on les montre tout de suite (pas de clignotement)
const cheminImage = (id) => (CARTES[id] && CARTES[id].image) || `cartes/${id}.jpg`;
function ajouterImage(e, id) {
  if (imagesAbsentes.has(id)) return;
  const img = document.createElement('img');
  img.className = 'image-carte';
  img.alt = CARTES[id] ? CARTES[id].nom : '';
  img.decoding = 'async';
  img.src = cheminImage(id);
  img.addEventListener('error', () => { imagesAbsentes.add(id); img.remove(); });
  img.addEventListener('load', () => { imagesChargees.add(id); e.classList.add('image-pleine'); });
  if (imagesChargees.has(id)) e.classList.add('image-pleine');
  e.prepend(img);
}

// Élément d'une carte ; `force` = force actuelle sur le plateau (sinon force imprimée)
function carteEl(carte, { force, taille = '' } = {}) {
  const d = def(carte);
  const e = el('div', `carte ${taille} type-${d.type}`);
  // sur le plateau, la force actuelle reste affichée par-dessus l'image (elle change avec les effets)
  if (force !== undefined) e.classList.add('sur-plateau');
  ajouterImage(e, carte.c);
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
  e.title = description(carte); // au survol de la souris : ce que fait la carte
  return e;
}

function description(carte) {
  const d = def(carte);
  if (d.type !== 'unite') return `${d.nom} : ${d.texte}`;
  const morceaux = [`${d.nom}, force ${d.force}, ${d.rangees.map((r) => NOMS_RANGEES[r].toLowerCase()).join(' ou ')}.`];
  if (d.legende) morceaux.push(`${CAPACITES.legende.nom} : ${CAPACITES.legende.texte}`);
  if (d.capacite && d.capacite !== 'agile') morceaux.push(`${CAPACITES[d.capacite].nom} : ${CAPACITES[d.capacite].texte}`);
  return morceaux.join(' ');
}

// =====================================================================
// Écrans
// =====================================================================
function montrer(ecran) {
  if (atelier) ecran = 'atelier';
  ['choix-clan', 'atelier', 'echange-cartes', 'bataille'].forEach((id) => { $(id).hidden = id !== ecran; });
}

function rendreClans() {
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
  const cleListe = `${maPlace}|${etat.edition}|${clans.map((c) => deckEnregistre(c).length).join(',')}|${clans.map(persoDeck).map(Boolean).join(',')}`;
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
    choisir.addEventListener('click', () => action({ type: 'clan', clan: cle, deck: deckEnregistre(cle) }));
    const modifier = el('button', 'btn', 'Modifier le deck');
    modifier.type = 'button';
    modifier.addEventListener('click', () => ouvrirAtelier(cle));
    b.append(el('span', 'clan-kanji', c.kanji), el('strong', '', c.nom), el('span', 'clan-atout', c.atout),
      el('span', 'clan-chef', `Chef : ${c.chef}. ${c.chefTexte}`),
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

let atelier = null; // { clan, deck: [ids], filtre }
function ouvrirAtelier(clan) {
  atelier = { clan, deck: [...deckEnregistre(clan)], filtre: 'tout' };
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
  $('atelier-stats').textContent = `Unités : ${unites.length} (min. ${DECK_MIN_UNITES}) · Spéciales : ${speciales}/${DECK_MAX_SPECIALES} · Force totale : ${force} · Légendes : ${legendes} · ${deck.length} cartes`;
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
  barre.append(moins, el('span', 'nombre', `${n} / ${max}`), plus);
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
  try { localStorage.setItem(cleDeck(atelier.clan), JSON.stringify(atelier.deck)); } catch (e) { /* stockage plein */ }
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
  const chef = el('span', 'camp-chef' + (p.chefUtilise ? ' utilise' : ''), clan.chef ? `Chef : ${clan.chef}` : '');
  chef.title = clan.chefTexte || '';
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
    const cor = el('div', 'emplacement-cor' + (etat.players[j].cors[r] ? ' plein' : ''), etat.players[j].cors[r] ? '鼓' : '');
    cor.title = etat.players[j].cors[r] ? 'Taiko de guerre : force doublée' : 'Emplacement du taiko';
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
  const noms = { cac: ['雪', 'Neige'], dist: ['霧', 'Brume'], siege: ['嵐', 'Typhon'] };
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
  chef.textContent = moi.chefUtilise ? `Chef utilisé (${clan.chef})` : `Chef : ${clan.chef || ''}`;
  chef.title = clan.chefTexte || '';
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
$('btn-chef').addEventListener('click', () => action({ type: 'chef' }));
$('btn-jouer').addEventListener('click', () => jouerSelection({}));

// ---------- Règles ----------
function remplirRegles() {
  const cap = $('regles-capacites');
  Object.values(CAPACITES).forEach((c) => cap.appendChild(el('li', '', `${c.kanji} ${c.nom} : ${c.texte}`)));
  const spe = $('regles-speciales');
  ['neige', 'brume', 'typhon', 'soleil', 'taiko', 'kagemusha', 'raijin'].forEach((k) => spe.appendChild(el('li', '', `${CARTES[k].kanji} ${CARTES[k].nom} : ${CARTES[k].texte}`)));
  const clans = $('regles-clans');
  Object.values(CLANS).forEach((c) => clans.appendChild(el('li', '', `${c.kanji} ${c.nom} : ${c.atout} Chef « ${c.chef} » : ${c.chefTexte}`)));
}

// =====================================================================
function rendre() {
  if (!etat) return;
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
  }
  rendreFin();
}
