import { $, el, toast, initSalon, initRegles, de } from '../commun/salon.js';

const TAILLE = 11;
const COLONNES = 'ABCDEFGHIJK';
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
// ---------- L'ordinateur (mode solo) ----------
const NOMS_BOTS = { facile: 'Moussaillon', moyen: 'Capitaine', difficile: 'Amiral' };
const majChoixNiveau = () => { $('choix-niveau').hidden = $('local-nb').value !== '1'; };
$('local-nb').addEventListener('change', majChoixNiveau);
majChoixNiveau();

// Remise à zéro des flottes pour une nouvelle partie ; l'ordinateur place la sienne tout de suite
function nouvellesFlottes(s) {
  s.taille = TAILLE;
  s.status = 'placement';
  s.winner = null;
  s.lastEvent = null;
  s.players.forEach((p) => {
    p.ready = !!p.bot;
    p.ships = p.bot ? placerAuHasard() : [];
    p.tirs = tirsVierges();
  });
}

const salon = initSalon({
  jeu: 'bataille',
  etatInitial: (nom, nb, { local } = {}) => {
    const contreBot = local && nb === 1;
    const niveau = $('local-niveau').value;
    return {
      taille: TAILLE,
      players: [
        { name: nom, joined: true, ready: false, tirs: tirsVierges() },
        contreBot
          ? { name: NOMS_BOTS[niveau] || 'Capitaine', joined: true, bot: true, niveau, ready: false, tirs: tirsVierges() }
          : { name: 'En attente', joined: false, ready: false, tirs: tirsVierges() },
      ],
    };
  },
  demarrer: (s) => nouvellesFlottes(s),
  afficher: (s, place) => {
    if (place !== maPlace) {
      // Mode un seul téléphone : changement de joueur, on oublie le placement en cours de l'autre
      placement = [];
      bateauChoisi = 0;
      horizontal = true;
      survol = -1;
    }
    etat = s;
    maPlace = place;
    if ((s.taille || 10) !== TAILLE) { mettreAJourGrille(); return; }
    rendre();
    planifierBot();
  },
  // Mode un seul téléphone : qui doit avoir le téléphone en main (jamais l'ordinateur)
  quiDoitJouer: (s) => {
    if (s.status === 'placement') return s.players.findIndex((p) => !p.ready && !p.bot);
    if (s.status === 'playing') return s.players[s.active] && s.players[s.active].bot ? -1 : s.active;
    return -1;
  },
  // à deux on cache sa flotte en passant le téléphone ; contre l'ordinateur, rien à cacher
  secret: (s) => !(s.players || []).some((p) => p.bot),
});
initRegles();

// Partie commencée avec l'ancienne grille (10 × 10) : on la relance en 11 × 11
let miseAJourFaite = false;
function mettreAJourGrille() {
  if (miseAJourFaite) return;
  miseAJourFaite = true;
  toast('Nouvelle grille 11 × 11 : la partie reprend au placement des bateaux.');
  salon.agir((s) => {
    if ((s.taille || 10) === TAILLE) return false;
    nouvellesFlottes(s);
  });
}

// ---------- Actions ----------
// Le joueur `tireur` vise la case i de la mer adverse
function appliquerTir(s, tireur, i) {
  if (s.status !== 'playing' || s.active !== tireur) return false;
  const adv = 1 - tireur;
  const cible = s.players[adv];
  cible.tirs = cible.tirs || tirsVierges();
  if (cible.tirs[i] !== VIDE) return false;
  const bateau = (cible.ships || []).find((b) => b.cells.includes(i));
  cible.tirs[i] = bateau ? TOUCHE : EAU;
  let resultat = 'eau';
  if (bateau) resultat = estCoule(bateau, cible.tirs) ? 'coule' : 'touche';
  s.lastEvent = {
    ts: Date.now(), par: tireur, case: i, resultat,
    bateau: resultat === 'coule' ? FLOTTE[bateau.id].nom : '',
  };
  if (cible.ships.every((b) => estCoule(b, cible.tirs))) {
    s.status = 'finished';
    s.winner = tireur;
  } else if (!bateau) {
    s.active = adv; // dans l'eau : la main passe
  }
  return true;
}
function tirer(i) {
  salon.agir((s) => appliquerTir(s, maPlace, i));
}

// ---------- Où tire l'ordinateur ? ----------
// Il ne voit que ce que verrait un joueur : ses tirs (eau / touché) et les bateaux déjà coulés.
const voisinsCase = (i) => {
  const x = i % TAILLE, y = Math.floor(i / TAILLE);
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
    .filter(([a, b]) => a >= 0 && b >= 0 && a < TAILLE && b < TAILLE).map(([a, b]) => b * TAILLE + a);
};
const auHasard = (t) => t[Math.floor(Math.random() * t.length)];
function vueDuBot(cible) {
  const tirs = cible.tirs || tirsVierges();
  const coules = (cible.ships || []).filter((b) => estCoule(b, tirs));
  const casesCoulees = new Set(coules.flatMap((b) => b.cells));
  const touchesEnCours = [];
  tirs.forEach((t, i) => { if (t === TOUCHE && !casesCoulees.has(i)) touchesEnCours.push(i); });
  const restants = FLOTTE.filter((f) => !coules.some((b) => b.id === f.id)).map((f) => f.taille);
  const libres = [];
  tirs.forEach((t, i) => { if (t === VIDE) libres.push(i); });
  return { tirs, casesCoulees, touchesEnCours, restants, libres };
}
// Difficile : pour chaque case, combien de positions possibles des bateaux restants la recouvrent
function caseLaPlusProbable(v) {
  const score = new Array(TAILLE * TAILLE).fill(0);
  const enCours = new Set(v.touchesEnCours);
  v.restants.forEach((t) => {
    for (let depart = 0; depart < TAILLE * TAILLE; depart++) {
      [true, false].forEach((horiz) => {
        const cel = cases(depart, t, horiz);
        if (!cel || cel.some((c) => v.tirs[c] === EAU || v.casesCoulees.has(c))) return;
        const k = cel.filter((c) => enCours.has(c)).length;
        if (enCours.size && !k) return; // un bateau touché est à finir d'abord
        const poids = enCours.size ? 1 + 30 * k * k : 1;
        cel.forEach((c) => { if (v.tirs[c] === VIDE) score[c] += poids; });
      });
    }
  });
  let max = -1; let meilleures = [];
  v.libres.forEach((i) => {
    if (score[i] > max) { max = score[i]; meilleures = [i]; } else if (score[i] === max) meilleures.push(i);
  });
  return auHasard(meilleures.length ? meilleures : v.libres);
}
// Moyen : vise autour des touches (dans l'alignement s'il y en a deux), sinon une case sur deux en damier
function caseChasseCible(v) {
  if (v.touchesEnCours.length) {
    const enCours = new Set(v.touchesEnCours);
    const alignees = [];
    v.touchesEnCours.forEach((i) => {
      [1, TAILLE].forEach((pas) => {
        if (!enCours.has(i + pas) || (pas === 1 && (i % TAILLE) === TAILLE - 1)) return;
        // on prolonge la ligne des deux côtés jusqu'à une case libre
        for (const sens of [-1, 1]) {
          let c = i;
          while (enCours.has(c)) {
            const n = c + sens * pas;
            if (n < 0 || n >= TAILLE * TAILLE || (pas === 1 && Math.floor(n / TAILLE) !== Math.floor(c / TAILLE))) { c = -1; break; }
            c = n;
          }
          if (c >= 0 && v.tirs[c] === VIDE) alignees.push(c);
        }
      });
    });
    if (alignees.length) return auHasard(alignees);
    const autour = v.touchesEnCours.flatMap(voisinsCase).filter((c) => v.tirs[c] === VIDE);
    if (autour.length) return auHasard(autour);
  }
  const damier = v.libres.filter((i) => ((i % TAILLE) + Math.floor(i / TAILLE)) % 2 === 0);
  return auHasard(damier.length ? damier : v.libres);
}
// Facile : au hasard, et seulement de temps en temps autour d'une touche
function caseFacile(v) {
  if (v.touchesEnCours.length && Math.random() < 0.5) {
    const autour = v.touchesEnCours.flatMap(voisinsCase).filter((c) => v.tirs[c] === VIDE);
    if (autour.length) return auHasard(autour);
  }
  return auHasard(v.libres);
}
function choixDuBot(s, b) {
  const v = vueDuBot(s.players[1 - b]);
  if (!v.libres.length) return -1;
  const niveau = s.players[b].niveau || 'moyen';
  if (niveau === 'facile') return caseFacile(v);
  if (niveau === 'difficile') return caseLaPlusProbable(v);
  return caseChasseCible(v);
}
let botPrevu = '';
function planifierBot() {
  if (!etat || etat.status !== 'playing') return;
  const b = etat.active;
  if (!etat.players[b] || !etat.players[b].bot) return;
  const cle = `${b}-${etat.lastEvent ? etat.lastEvent.ts : 0}`;
  if (botPrevu === cle) return;
  botPrevu = cle;
  const ts = etat.lastEvent ? etat.lastEvent.ts : 0;
  const apresTouche = etat.lastEvent && etat.lastEvent.par === b && etat.lastEvent.resultat !== 'eau';
  setTimeout(() => salon.agir((s) => {
    if (s.status !== 'playing' || s.active !== b || !s.players[b].bot) return false;
    if ((s.lastEvent ? s.lastEvent.ts : 0) !== ts) return false;
    const i = choixDuBot(s, b);
    return i >= 0 && appliquerTir(s, b, i);
  }), apresTouche ? 1100 : 900 + Math.random() * 500);
}
// surveillant : si l'ordinateur doit tirer et que rien ne bouge, on relance son coup
setInterval(() => {
  if (!etat || etat.status !== 'playing' || !etat.players[etat.active] || !etat.players[etat.active].bot) return;
  const ts = etat.lastEvent ? etat.lastEvent.ts : 0;
  if (Date.now() - ts > 4000) { botPrevu = ''; planifierBot(); }
}, 2000);

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
    nouvellesFlottes(s);
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
  if (ignorerProchainClic) return;
  if (placement.some((b) => b.cells.includes(i))) return; // géré par le glisser / toucher
  if (bateauChoisi < 0) return;
  const b = FLOTTE[bateauChoisi];
  const cel = cellulesAutour({ id: b.id, horiz: horizontal, prise: 0 }, i);
  if (!placementValide(cel, placement)) {
    toast('Il y a déjà un bateau ici.');
    return;
  }
  poser(b.id, cel);
}

function poser(id, cellules) {
  placement = placement.filter((b) => b.id !== id);
  placement.push({ id, cells: cellules });
  const restant = FLOTTE.find((f) => !placement.some((p) => p.id === f.id));
  bateauChoisi = restant ? restant.id : -1;
  rendre();
}

// Cases occupées par le bateau `g.id` si la case `i` est sous le doigt, à la position `g.prise`
// du bateau. Le bateau est ramené dans la grille s'il dépasse d'un bord.
function cellulesAutour(g, i) {
  const t = FLOTTE[g.id].taille;
  const x = i % TAILLE;
  const y = Math.floor(i / TAILLE);
  const borne = (v) => Math.min(Math.max(v, 0), TAILLE - t);
  const ancre = g.horiz ? y * TAILLE + borne(x - g.prise) : borne(y - g.prise) * TAILLE + x;
  return cases(ancre, t, g.horiz);
}

// Toucher un bateau posé : il pivote autour de la case touchée (ou de sa première case)
function pivoter(id, prise) {
  const b = placement.find((p) => p.id === id);
  if (!b) return;
  const horiz = !(b.cells.length > 1 && b.cells[1] - b.cells[0] === 1);
  for (const [pivot, p] of [[b.cells[prise], prise], [b.cells[0], 0]]) {
    const cel = cellulesAutour({ id, horiz, prise: p }, pivot);
    if (placementValide(cel, placement, id)) {
      b.cells = cel;
      rendre();
      return;
    }
  }
  toast('Pas la place pour le tourner ici.');
}

// ---------- Glisser-déposer (doigt ou souris) ----------
let glisse = null;
// Le clic que le navigateur envoie juste après un glissement ne doit rien faire
let ignorerProchainClic = false;
window.addEventListener('pointerdown', () => { ignorerProchainClic = false; }, true);
let rendreApresGlisse = false;

function caseSousDoigt(x, y) {
  const e = document.elementFromPoint(x, y);
  const c = e && e.closest('#grille-moi .case');
  return c ? Number(c.dataset.i) : -1;
}

function debutGlisse(e, source, id, horiz, prise) {
  if (e.button > 0 || glisse) return;
  glisse = { source, id, horiz, prise, x0: e.clientX, y0: e.clientY, actif: false, pointerId: e.pointerId, cel: null, dehors: false };
}

function montrerGlisse(cel, ok) {
  const grille = $('grille-moi');
  grille.querySelectorAll('.apercu, .apercu-ko').forEach((c) => c.classList.remove('apercu', 'apercu-ko'));
  if (!cel) return;
  const boutons = grille.querySelectorAll('.case');
  cel.forEach((i) => boutons[i].classList.add(ok ? 'apercu' : 'apercu-ko'));
}

window.addEventListener('pointermove', (e) => {
  if (!glisse || e.pointerId !== glisse.pointerId) return;
  if (!glisse.actif) {
    if (Math.hypot(e.clientX - glisse.x0, e.clientY - glisse.y0) < 8) return;
    glisse.actif = true;
    document.body.classList.add('en-glisse');
    if (glisse.source === 'grille') {
      const b = placement.find((p) => p.id === glisse.id);
      const boutons = $('grille-moi').querySelectorAll('.case');
      if (b) b.cells.forEach((i) => boutons[i].classList.add('fantome'));
    }
  }
  e.preventDefault();
  const i = caseSousDoigt(e.clientX, e.clientY);
  glisse.dehors = i < 0;
  if (i < 0) { glisse.cel = null; montrerGlisse(null); return; }
  const cel = cellulesAutour(glisse, i);
  const ok = placementValide(cel, placement, glisse.id);
  glisse.cel = ok ? cel : null;
  montrerGlisse(cel, ok);
}, { passive: false });

function finGlisse(e, annule) {
  if (!glisse || e.pointerId !== glisse.pointerId) return;
  const g = glisse;
  glisse = null;
  document.body.classList.remove('en-glisse');
  if (!g.actif) {
    // Simple toucher : un bateau posé pivote ; dans la réserve, le « click » le sélectionne
    if (!annule && g.source === 'grille') { ignorerProchainClic = true; pivoter(g.id, g.prise); }
    if (rendreApresGlisse) { rendreApresGlisse = false; rendre(); }
    return;
  }
  ignorerProchainClic = true;
  if (!annule && g.cel) {
    poser(g.id, g.cel);
  } else if (!annule && g.dehors && g.source === 'grille') {
    // Lâché hors de la grille : le bateau retourne dans la réserve
    placement = placement.filter((b) => b.id !== g.id);
    bateauChoisi = g.id;
    rendre();
  } else {
    if (!annule && g.source === 'dock' && !g.dehors) toast('Pas la place ici.');
    rendre();
  }
  rendreApresGlisse = false;
}
window.addEventListener('pointerup', (e) => finGlisse(e, false));
window.addEventListener('pointercancel', (e) => finGlisse(e, true));

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
      c.dataset.i = String(i);
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
  if (survol < 0 || bateauChoisi < 0 || placement.some((b) => b.cells.includes(survol))) return;
  const cel = cellulesAutour({ id: bateauChoisi, horiz: horizontal, prise: 0 }, survol);
  const ok = placementValide(cel, placement);
  const boutons = grille.querySelectorAll('.case');
  cel.forEach((i) => boutons[i].classList.add(ok ? 'apercu' : 'apercu-ko'));
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
      if (bateau) {
        c.classList.add('deplacable');
        c.addEventListener('pointerdown', (e) => debutGlisse(e, 'grille', bateau.id,
          bateau.cells.length > 1 && bateau.cells[1] - bateau.cells[0] === 1, bateau.cells.indexOf(i)));
      } else {
        c.addEventListener('click', () => clicPlacement(i));
      }
      if (survolPossible) c.addEventListener('mouseenter', () => { if (!glisse) { survol = i; majApercu(); } });
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
    b.addEventListener('click', () => {
      if (ignorerProchainClic) return;
      bateauChoisi = f.id;
      rendre();
    });
    if (!pose) {
      b.addEventListener('pointerdown', (e) => debutGlisse(e, 'dock', f.id, horizontal, Math.floor((f.taille - 1) / 2)));
    }
    dock.appendChild(b);
  });
  $('btn-pivoter').textContent = horizontal ? 'Sens ↔' : 'Sens ↕';
  $('btn-pivoter').setAttribute('aria-label', horizontal ? 'Sens des prochains bateaux : horizontal' : 'Sens des prochains bateaux : vertical');
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
  if (glisse && glisse.actif) { rendreApresGlisse = true; return; }
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
  $('jeu').classList.toggle('placement', enPlacement);
  $('bloc-adverse').hidden = etat.status === 'placement';
  $('plateaux').classList.toggle('en-placement', etat.status === 'placement');

  if (etat.status === 'placement') {
    if (!moi.ready) {
      statut.innerHTML = '';
      statut.append('Place tes 5 bateaux');
      let aide = 'Ton adversaire place les siens en même temps.';
      if (adv.ready) aide = `${adv.name} a déjà placé sa flotte. À toi !`;
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
      statut.textContent = salon.estLocal() && !adv.bot ? `Au tour ${de(adv.name)}` : `${adv.name} vise ta flotte…`;
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
    const gagnant = etat.players[etat.winner];
    const perdant = etat.players[1 - etat.winner];
    if (salon.estLocal() && !adv.bot) {
      $('fin-titre').textContent = `Victoire ${de(gagnant.name)} !`;
      $('fin-texte').textContent = `${gagnant.name} a coulé toute la flotte ${de(perdant.name)}.`;
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
