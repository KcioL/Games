import { $, el, toast, initSalon, initRegles, de } from '../commun/salon.js';

const TAILLE = 10;
const COLONNES = 'ABCDEFGHIJ';
const FLOTTE = [
  { id: 0, nom: 'Porte-avions', taille: 5 },
  { id: 1, nom: 'Croiseur', taille: 4 },
  { id: 2, nom: 'Contre-torpilleur', taille: 3 },
  { id: 3, nom: 'Sous-marin', taille: 3 },
  { id: 4, nom: 'Torpilleur', taille: 2 },
];
// Tirs reçus par un joueur : 0 = pas encore visé, 1 = dans l'eau, 2 = touché
const VIDE = 0, EAU = 1, TOUCHE = 2;

// ---------- État local ----------
let etat = null;
let maPlace = 0;
let placement = [];        // bateaux posés localement avant « Flotte prête »
let bateauChoisi = 0;
let horizontal = true;
let survol = -1;           // case survolée (aperçu sur ordinateur)
let dernierEvenement = null;
let premiereSynchro = true;
let statutPrecedent = null;

const nomCase = (i) => COLONNES[i % TAILLE] + (Math.floor(i / TAILLE) + 1);

function cases(depart, taille, horiz) {
  const x = depart % TAILLE, y = Math.floor(depart / TAILLE);
  if (horiz && x + taille > TAILLE) return null;
  if (!horiz && y + taille > TAILLE) return null;
  return Array.from({ length: taille }, (_, k) => (horiz ? depart + k : depart + k * TAILLE));
}

function placementValide(cellules, flotte, ignorerId) {
  if (!cellules) return false;
  const prises = new Set();
  flotte.forEach((b) => { if (b.id !== ignorerId) b.cells.forEach((c) => prises.add(c)); });
  return cellules.every((c) => !prises.has(c));
}

function placerAuHasard() {
  const flotte = [];
  FLOTTE.forEach((b) => {
    for (;;) {
      const horiz = Math.random() < 0.5;
      const cel = cases(Math.floor(Math.random() * TAILLE * TAILLE), b.taille, horiz);
      if (placementValide(cel, flotte)) { flotte.push({ id: b.id, cells: cel }); break; }
    }
  });
  return flotte;
}

const tirsVierges = () => Array(TAILLE * TAILLE).fill(VIDE);

const estCoule = (bateau, tirs) => bateau.cells.every((c) => tirs[c] === TOUCHE);

// ---------- Salon ----------
const salon = initSalon({
  jeu: 'bataille',
  etatInitial: (nom) => ({
    players: [
      { name: nom, joined: true, ready: false, tirs: tirsVierges() },
      { name: 'En attente', joined: false, ready: false, tirs: tirsVierges() },
    ],
  }),
  demarrer: (s) => {
    s.status = 'placement';
    s.players.forEach((p) => { p.ready = false; p.ships = []; p.tirs = tirsVierges(); });
  },
  afficher: (s, place) => {
    if (place !== maPlace) {
      // Mode un seul téléphone : changement de joueuse, on oublie le placement en cours de l'autre
      placement = [];
      bateauChoisi = 0;
      horizontal = true;
      survol = -1;
    }
    etat = s;
    maPlace = place;
    rendre();
  },
  // Mode un seul téléphone : qui doit avoir le téléphone en main
  quiDoitJouer: (s) => {
    if (s.status === 'placement') return s.players.findIndex((p) => !p.ready);
    if (s.status === 'playing') return s.active;
    return -1;
  },
  secret: true,
});
initRegles();

// ---------- Actions ----------
function tirer(i) {
  salon.agir((s) => {
    if (s.status !== 'playing' || s.active !== maPlace) return false;
    const adv = 1 - maPlace;
    const cible = s.players[adv];
    if (cible.tirs[i] !== VIDE) return false;
    const bateau = (cible.ships || []).find((b) => b.cells.includes(i));
    cible.tirs[i] = bateau ? TOUCHE : EAU;
    let resultat = 'eau';
    if (bateau) resultat = estCoule(bateau, cible.tirs) ? 'coule' : 'touche';
    s.lastEvent = {
      ts: Date.now(), par: maPlace, case: i, resultat,
      bateau: resultat === 'coule' ? FLOTTE[bateau.id].nom : '',
    };
    if (cible.ships.every((b) => estCoule(b, cible.tirs))) {
      s.status = 'finished';
      s.winner = maPlace;
    } else if (!bateau) {
      s.active = adv; // dans l'eau : la main passe
    }
  });
}

function validerFlotte() {
  if (placement.length !== FLOTTE.length) return;
  const flotte = placement.map((b) => ({ id: b.id, cells: b.cells }));
  salon.agir((s) => {
    if (s.status !== 'placement') return false;
    const moi = s.players[maPlace];
    moi.ships = flotte;
    moi.ready = true;
    if (s.players.every((p) => p.ready)) {
      s.status = 'playing';
      s.active = Math.random() < 0.5 ? 0 : 1;
      s.lastEvent = { ts: Date.now(), resultat: 'debut' };
    }
  });
}

function rejouer() {
  salon.agir((s) => {
    if (s.status !== 'finished') return false;
    s.status = 'placement';
    s.winner = null;
    s.lastEvent = null;
    s.players.forEach((p) => { p.ready = false; p.ships = []; p.tirs = tirsVierges(); });
  });
}

$('btn-pivoter').addEventListener('click', () => { horizontal = !horizontal; rendreDock(); majApercu(); });
$('btn-hasard').addEventListener('click', () => {
  placement = placerAuHasard();
  bateauChoisi = -1;
  rendre();
});
$('btn-pret').addEventListener('click', validerFlotte);
$('btn-rejouer').addEventListener('click', rejouer);
document.addEventListener('keydown', (e) => {
  if ((e.key === 'r' || e.key === 'R') && etat && etat.status === 'placement' && e.target.tagName !== 'INPUT') { horizontal = !horizontal; rendreDock(); majApercu(); }
});

function clicPlacement(i) {
  // Toucher un bateau déjà posé : on le reprend
  const pose = placement.find((b) => b.cells.includes(i));
  if (pose) {
    placement = placement.filter((b) => b !== pose);
    bateauChoisi = pose.id;
    rendre();
    return;
  }
  if (bateauChoisi < 0) return;
  const b = FLOTTE[bateauChoisi];
  const cel = cases(i, b.taille, horizontal);
  if (!placementValide(cel, placement)) {
    toast(cel ? 'Il y a déjà un bateau ici.' : 'Le bateau dépasse de la grille.');
    return;
  }
  placement.push({ id: b.id, cells: cel });
  const restant = FLOTTE.find((f) => !placement.some((p) => p.id === f.id));
  bateauChoisi = restant ? restant.id : -1;
  rendre();
}

// ---------- Affichage ----------
function construireGrille(conteneur, reglages) {
  conteneur.innerHTML = '';
  conteneur.appendChild(el('span', 'coin'));
  for (let x = 0; x < TAILLE; x++) conteneur.appendChild(el('span', 'repere', COLONNES[x]));
  for (let y = 0; y < TAILLE; y++) {
    conteneur.appendChild(el('span', 'repere', String(y + 1)));
    for (let x = 0; x < TAILLE; x++) {
      const i = y * TAILLE + x;
      const c = el('button', 'case');
      c.type = 'button';
      c.setAttribute('aria-label', nomCase(i));
      reglages(c, i);
      conteneur.appendChild(c);
    }
  }
}

function classesBateau(c, bateau, i) {
  c.classList.add('navire');
  const k = bateau.cells.indexOf(i);
  const horiz = bateau.cells.length > 1 && bateau.cells[1] - bateau.cells[0] === 1;
  c.classList.add(horiz ? 'h' : 'v');
  if (k === 0) c.classList.add('debut');
  if (k === bateau.cells.length - 1) c.classList.add('fin');
}

const survolPossible = window.matchMedia('(hover: hover)').matches;

function majApercu() {
  const grille = $('grille-moi');
  grille.querySelectorAll('.apercu, .apercu-ko').forEach((c) => c.classList.remove('apercu', 'apercu-ko'));
  if (survol < 0 || bateauChoisi < 0) return;
  const cel = cases(survol, FLOTTE[bateauChoisi].taille, horizontal);
  const ok = placementValide(cel, placement);
  const boutons = grille.querySelectorAll('.case');
  (cel || [survol]).forEach((i) => boutons[i].classList.add(ok ? 'apercu' : 'apercu-ko'));
}

function rendreGrilleMoi(enPlacement) {
  const moi = etat.players[maPlace];
  const flotte = enPlacement ? placement : (moi.ships || []);
  const tirs = moi.tirs || tirsVierges();

  construireGrille($('grille-moi'), (c, i) => {
    const bateau = flotte.find((b) => b.cells.includes(i));
    if (bateau) classesBateau(c, bateau, i);
    if (tirs[i] === EAU) c.classList.add('eau');
    if (tirs[i] === TOUCHE) c.classList.add(bateau && estCoule(bateau, tirs) ? 'coule' : 'touche');
    if (dernierEvenement && dernierEvenement.par !== maPlace && dernierEvenement.case === i) c.classList.add('impact');
    if (enPlacement) {
      c.addEventListener('click', () => clicPlacement(i));
      if (survolPossible) c.addEventListener('mouseenter', () => { survol = i; majApercu(); });
    } else {
      c.disabled = true;
    }
  });
  $('grille-moi').onmouseleave = enPlacement ? () => { survol = -1; majApercu(); } : null;
  if (enPlacement) majApercu();
}

function rendreGrilleAdverse() {
  const adv = etat.players[1 - maPlace];
  const tirs = adv.tirs || tirsVierges();
  const ships = adv.ships || [];
  const monTour = etat.status === 'playing' && etat.active === maPlace;

  construireGrille($('grille-adverse'), (c, i) => {
    if (tirs[i] === EAU) c.classList.add('eau');
    if (tirs[i] === TOUCHE) {
      const b = ships.find((s) => s.cells.includes(i));
      c.classList.add(b && estCoule(b, tirs) ? 'coule' : 'touche');
    }
    if (monTour && tirs[i] === VIDE) {
      c.classList.add('visable');
      c.addEventListener('click', () => tirer(i));
    } else {
      c.disabled = true;
    }
    if (dernierEvenement && dernierEvenement.par === maPlace && dernierEvenement.case === i) c.classList.add('impact');
  });

  const liste = $('flotte-adverse');
  liste.innerHTML = '';
  FLOTTE.forEach((f) => {
    const b = ships.find((s) => s.id === f.id);
    const li = el('li', b && estCoule(b, tirs) ? 'coule' : '', `${f.nom} (${f.taille})`);
    liste.appendChild(li);
  });
}

function rendreDock() {
  const dock = $('dock');
  dock.innerHTML = '';
  FLOTTE.forEach((f) => {
    const pose = placement.some((p) => p.id === f.id);
    const b = el('button', 'piece' + (f.id === bateauChoisi ? ' choisi' : '') + (pose ? ' pose' : ''));
    b.type = 'button';
    b.disabled = pose;
    const coque = el('span', 'coque');
    for (let k = 0; k < f.taille; k++) coque.appendChild(el('i'));
    b.append(coque, el('span', 'nom', f.nom));
    b.addEventListener('click', () => { bateauChoisi = f.id; rendre(); });
    dock.appendChild(b);
  });
  $('btn-pivoter').textContent = horizontal ? 'Horizontal ↻' : 'Vertical ↻';
  $('btn-pret').disabled = placement.length !== FLOTTE.length;
}

function annoncer(ev) {
  if (!ev) return;
  const moi = ev.par === maPlace;
  const nomAdv = etat.players[1 - maPlace].name;
  if (ev.resultat === 'debut') {
    toast(etat.active === maPlace ? 'Les flottes sont prêtes. Tu tires en premier !' : `Les flottes sont prêtes. ${nomAdv} tire en premier.`);
  } else if (ev.resultat === 'eau') {
    toast(moi ? `${nomCase(ev.case)} : dans l'eau.` : `${nomAdv} a tiré en ${nomCase(ev.case)} : raté !`);
  } else if (ev.resultat === 'touche') {
    toast(moi ? `${nomCase(ev.case)} : touché ! Rejoue.` : `${nomAdv} a touché ton bateau en ${nomCase(ev.case)}.`, true);
  } else if (ev.resultat === 'coule') {
    toast(moi ? `Coulé ! Le ${ev.bateau.toLowerCase()} adverse sombre.` : `${nomAdv} a coulé ton ${ev.bateau.toLowerCase()}.`, true);
  }
}

function rendre() {
  if (!etat) return;
  const moi = etat.players[maPlace];
  const adv = etat.players[1 - maPlace];
  const statut = $('statut');

  // Événement partagé (tir) : on l'annonce une seule fois
  const ev = etat.lastEvent || null;
  if (premiereSynchro) {
    premiereSynchro = false;
    dernierEvenement = ev;
  } else if (ev && (!dernierEvenement || ev.ts !== dernierEvenement.ts)) {
    dernierEvenement = ev;
    annoncer(ev);
  }

  if (etat.status === 'placement' && statutPrecedent !== 'placement') {
    placement = [];
    bateauChoisi = 0;
    horizontal = true;
  }
  statutPrecedent = etat.status;

  const enPlacement = etat.status === 'placement' && !moi.ready;
  $('outils-placement').hidden = !enPlacement;
  $('bloc-adverse').hidden = etat.status === 'placement';
  $('plateaux').classList.toggle('en-placement', etat.status === 'placement');

  if (etat.status === 'placement') {
    if (!moi.ready) {
      statut.innerHTML = '';
      statut.append('Place tes 5 bateaux');
      let aide = 'Ton adversaire place les siens en même temps.';
      if (adv.ready) aide = `${adv.name} est déjà prête. À toi !`;
      else if (salon.estLocal()) aide = `Ensuite, tu passeras le téléphone à ${adv.name}.`;
      statut.appendChild(el('span', 'sous-statut', aide));
    } else {
      statut.textContent = `Flotte prête. ${adv.name} place encore ses bateaux…`;
    }
  } else if (etat.status === 'playing' || etat.status === 'finished') {
    statut.innerHTML = '';
    if (etat.status === 'finished') {
      statut.textContent = 'Partie terminée';
    } else if (etat.active === maPlace) {
      statut.appendChild(el('span', 'a-toi', 'À toi de tirer'));
      statut.appendChild(el('span', 'sous-statut', 'Touche une case de la mer adverse.'));
    } else {
      statut.textContent = salon.estLocal() ? `Au tour ${de(adv.name)}` : `${adv.name} vise ta flotte…`;
    }
    $('titre-adverse').textContent = `Mer ${de(adv.name)}`;
    rendreGrilleAdverse();
  }

  if (enPlacement) rendreDock();
  rendreGrilleMoi(enPlacement);

  $('bloc-moi').classList.toggle('attente-tir', etat.status === 'playing' && etat.active !== maPlace);

  // Fin de partie
  const fin = $('fin');
  if (etat.status === 'finished') {
    const gagne = etat.winner === maPlace;
    const gagnante = etat.players[etat.winner];
    const perdante = etat.players[1 - etat.winner];
    if (salon.estLocal()) {
      $('fin-titre').textContent = `Victoire ${de(gagnante.name)} !`;
      $('fin-texte').textContent = `${gagnante.name} a coulé toute la flotte ${de(perdante.name)}.`;
    } else {
      $('fin-titre').textContent = gagne ? 'Victoire !' : 'Défaite…';
      $('fin-texte').textContent = gagne
        ? `Tu as coulé toute la flotte ${de(adv.name)}.`
        : `${adv.name} a coulé toute ta flotte.`;
    }
    fin.hidden = false;
  } else {
    fin.hidden = true;
  }
}
