import { $, el, toast, initSalon, initRegles } from '../commun/salon.js';
import * as R from './regles.js';
import { PLATEAU, GRILLE, PIECES, PORTES } from './donnees.js';

const NOMS_BOTS = ['Sherlock', 'Lupin', 'Rouletabille', 'Dupin', 'Miss Fouine', 'Le Commissaire', 'Inspectrice Loupe'];
const MAX_JOUEURS = 6;

let etat = null;
let maPlace = 0;
let precedent = null; // état précédent (pour les animations)

const melanger = (t) => { const a = [...t]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const salon = initSalon({
  jeu: 'cluedo',
  etatInitial: (nom, nb, { local }) => {
    const joueur = (name, joined, bot = false) => ({ name, joined, bot });
    const joueurs = Array.from({ length: nb }, (_, i) => joueur(i === 0 ? nom : 'En attente', i === 0));
    const bots = parseInt($(local ? 'local-bots' : 'ligne-bots').value, 10) || 0;
    melanger(NOMS_BOTS).slice(0, bots).forEach((n) => joueurs.push(joueur(n, true, true)));
    return { players: joueurs, options: { des: parseInt($('opt-des').value, 10) === 2 ? 2 : 1 } };
  },
  validerLocal: () => {
    const total = parseInt($('local-nb').value, 10) + parseInt($('local-bots').value, 10);
    if (total < 2) return 'Il faut au moins 2 enquêteurs : ajoute un bot.';
    if (total > MAX_JOUEURS) return `${MAX_JOUEURS} enquêteurs maximum (il n'y a que 6 personnages).`;
    return '';
  },
  validerEnLigne: () => {
    const total = parseInt($('nb-joueurs').value, 10) + parseInt($('ligne-bots').value, 10);
    if (total < 2) return 'Il faut au moins 2 enquêteurs : ajoute un bot.';
    if (total > MAX_JOUEURS) return `${MAX_JOUEURS} enquêteurs maximum : enlève des bots.`;
    return '';
  },
  demarrer: (s) => R.nouvellePartie(s),
  afficher: (s, place) => {
    precedent = etat && etat.partie === s.partie ? etat : null;
    if (place !== maPlace) { precedent = null; fermerDialogues(); }
    etat = R.normaliser(s);
    maPlace = place;
    noterChangement();
    rendre();
    planifierBot();
  },
  // Sur un seul téléphone : on passe le téléphone au joueur qui doit agir (jouer, ou montrer une carte)
  quiDoitJouer: (s) => {
    const joueurs = s.players || [];
    if (joueurs.filter((p) => !p.bot).length <= 1) return -1;
    if (s.status !== 'jeu') return -1;
    if (s.phase === 'refuter' && s.suggestion) {
      const j = s.suggestion.attente;
      return joueurs[j] && !joueurs[j].bot ? j : -1;
    }
    return joueurs[s.active] && !joueurs[s.active].bot ? s.active : -1;
  },
  secret: true,
});
initRegles();
const agir = (fn) => salon.agir((s) => fn(R.normaliser(s)));

// ---------- Bots ----------
let botPrevu = '';
function botAttendu(s) {
  if (!s || s.status !== 'jeu') return -1;
  if (s.phase === 'refuter') {
    const j = s.suggestion ? s.suggestion.attente : -1;
    return s.players[j] && s.players[j].bot ? j : -1;
  }
  return s.players[s.active] && s.players[s.active].bot ? s.active : -1;
}
function planifierBot() {
  if (!etat || botAttendu(etat) < 0) return;
  const cle = `${etat.partie}-${etat.coup}`;
  if (botPrevu === cle) return;
  botPrevu = cle;
  const coup = etat.coup;
  const delais = { debut: 1100, deplacer: 1300, suggerer: 1200, apres: 2600, finir: 900, refuter: 1500 };
  let delai = (delais[etat.phase] || 1000) + Math.random() * 500;
  if (etat.anim && etat.anim.chemin && etat.anim.id === etat.coup) delai += etat.anim.chemin.length * 150;
  setTimeout(() => {
    agir((s) => {
      if (s.coup !== coup) return false;
      const i = botAttendu(s);
      if (i < 0) return false;
      try {
        if (s.phase === 'refuter') return R.montrer(s, i, R.refutationBot(s, i));
        return R.jouerBot(s, i) || R.finirTour(s, i);
      } catch (err) {
        console.error('Bot : erreur', err);
        return R.finirTour(s, i);
      }
    });
  }, delai);
}
let dernierChangement = Date.now();
let dernierCoupConnu = null;
function noterChangement() {
  const cle = `${etat.partie}-${etat.coup}-${etat.status}`;
  if (cle !== dernierCoupConnu) { dernierCoupConnu = cle; dernierChangement = Date.now(); }
}
setInterval(() => {
  if (!etat) return;
  // le joueur qui doit montrer une carte ne répond plus : on propose de choisir pour lui
  if (etat.phase === 'refuter') rendreTour();
  if (botAttendu(etat) < 0 || Date.now() - dernierChangement < 5000) return;
  dernierChangement = Date.now();
  botPrevu = '';
  planifierBot();
}, 1500);

// ---------- Outils ----------
const moi = () => etat.players[maPlace];
const monTour = () => etat && etat.status === 'jeu' && etat.active === maPlace && !moi().elimine;
const total = () => (etat.des || []).reduce((a, b) => a + b, 0);
const pct = (x, y) => ({ left: `${(x / PLATEAU.largeur) * 100}%`, top: `${(y / PLATEAU.hauteur) * 100}%` });
const centreCase = (c, r) => ({ x: GRILLE.x0 + (c + 0.5) * GRILLE.dx, y: GRILLE.y0 + (r + 0.5) * GRILLE.dy });
const couleurDe = (id) => (R.CARTES[id] && R.CARTES[id].couleur) || '#888';
const joueurDuSuspect = (id) => etat.players.findIndex((p) => p.suspect === id);
const prenom = (i) => (i === maPlace ? 'Toi' : etat.players[i].name);
const article = (id) => {
  const c = R.CARTES[id];
  if (!c) return id;
  if (c.cat === 'piece') return `${/^[aeiouéèh]/i.test(c.nom) ? "l'" : (['Cuisine', 'Salle de bal', 'Véranda', 'Salle de billard', 'Bibliothèque', 'Salle à manger'].includes(c.nom) ? 'la ' : 'le ')}${c.nom}`;
  if (c.cat === 'arme') return `${/^[aeiouéèh]/i.test(c.nom) ? "l'" : (/^(Corde|Clé|Barre|Matraque|Hache|Bouteille|Batte)/.test(c.nom) ? 'la ' : 'le ')}${c.nom}`;
  return c.nom;
};

// emplacements dans une pièce : en rangées de 3 autour du point prévu
function emplacement(idPiece, k, n, type) {
  const p = R.piece(idPiece);
  const [ax, ay] = type === 'armes' ? p.armes : p.pions;
  const ecart = type === 'armes' ? 34 : 38;
  const parRang = n <= 3 ? n : Math.ceil(n / 2);
  const rang = Math.floor(k / parRang);
  const dansRang = k % parRang;
  const nbRang = rang === 0 ? Math.min(parRang, n) : n - parRang;
  // la deuxième rangée s'éloigne de l'étiquette de la pièce
  return {
    x: ax + (dansRang - (nbRang - 1) / 2) * ecart,
    y: ay + rang * (ecart - 4) * (type === 'armes' ? -1 : 1),
  };
}
function positionsPions(s) {
  const res = {};
  const parPiece = {};
  R.CATS.suspect.forEach((id) => {
    const p = s.pions[id];
    if (!p) return;
    if (p.piece) (parPiece[p.piece] = parPiece[p.piece] || []).push(id);
    else res[id] = centreCase(p.c, p.r);
  });
  Object.entries(parPiece).forEach(([pc, ids]) => ids.forEach((id, k) => { res[id] = emplacement(pc, k, ids.length, 'pions'); }));
  return res;
}
function positionsArmes(s) {
  const res = {};
  const parPiece = {};
  R.CATS.arme.forEach((id) => { const pc = s.armes[id]; if (pc) (parPiece[pc] = parPiece[pc] || []).push(id); });
  Object.entries(parPiece).forEach(([pc, ids]) => ids.forEach((id, k) => { res[id] = emplacement(pc, k, ids.length, 'armes'); }));
  return res;
}

// ---------- Illustrations (dossier cartes/) ----------
// Une image déposée dans cluedo/cartes/ (jpg, png ou webp) remplace le dessin par défaut.
const EXTENSIONS = ['jpg', 'png', 'webp'];
const images = new Map();
function chargerImages() {
  R.TOUTES.forEach((id) => {
    const essayer = (k) => {
      if (k >= EXTENSIONS.length) { images.set(id, null); return; }
      const url = `cartes/${id}.${EXTENSIONS[k]}`;
      const img = new Image();
      img.onload = () => { images.set(id, url); if (etat) rendre(); };
      img.onerror = () => essayer(k + 1);
      img.src = url;
    };
    essayer(0);
  });
}
chargerImages();

const ICONES = {
  chandelier: '<path d="M32 6c-3 5-4 8 0 11 4-3 3-6 0-11z" fill="#F5B53D" stroke="none"/><rect x="28" y="17" width="8" height="15" rx="1.5"/><path d="M22 32h20l-3 5H25z"/><path d="M32 37v14"/><path d="M24 58h16l-3-7H27z"/><path d="M20 61h24"/>',
  poignard: '<path d="M44 8 26 36l4 4L52 16z"/><path d="M22 34l10 10"/><path d="M27 39 15 51"/><circle cx="13" cy="53" r="3"/>',
  barre: '<rect x="10" y="40" width="34" height="9" rx="2" transform="rotate(-35 27 44)"/><path d="M38 20c6-4 13-3 16 2"/><rect x="36" y="12" width="12" height="9" rx="2" transform="rotate(-35 42 16)"/>',
  revolver: '<path d="M10 22h36v8H24l-2 4h-6z"/><path d="M16 30l-4 20h9l4-14"/><circle cx="31" cy="34" r="5"/><path d="M46 22v-3h4v3"/>',
  corde: '<ellipse cx="32" cy="34" rx="18" ry="12"/><ellipse cx="32" cy="34" rx="11" ry="7"/><ellipse cx="32" cy="34" rx="4.5" ry="2.8"/><path d="M50 34c4 6 2 14-6 18"/>',
  cle: '<path d="M14 50 36 28"/><path d="M36 28a10 10 0 1 0 6-14l-4 7 4 5 7-3a10 10 0 0 1-13 5z"/><circle cx="14" cy="50" r="2.5"/>',
};
function svgArme(id) {
  const c = ICONES[id];
  if (!c) return `<svg viewBox="0 0 64 64"><circle cx="28" cy="28" r="13"/><path d="M38 38 52 52"/></svg>`;
  return `<svg viewBox="0 0 64 64">${c}</svg>`;
}
const SILHOUETTE = '<svg viewBox="0 0 100 100"><circle cx="50" cy="38" r="19"/><path d="M14 100c1-27 16-41 36-41s35 14 36 41z"/></svg>';

// une carte du jeu (personnage, arme ou pièce)
function carteEl(id, cls = '') {
  const c = R.CARTES[id];
  const e = el('div', `carte-cl ${c.cat} ${cls}`.trim());
  e.dataset.id = id;
  e.title = c.nom;
  const img = images.get(id);
  if (img) {
    // une carte complète dessinée (dossier cartes/) : on l'affiche telle quelle
    e.classList.add('complete');
    e.style.backgroundImage = `url("${img}")`;
    e.setAttribute('aria-label', c.nom);
    return e;
  }
  const etiquette = { suspect: 'Suspect', arme: 'Arme', piece: 'Lieu' }[c.cat];
  e.append(el('span', 'cat-cl', etiquette));
  const ill = el('div', 'ill-cl');
  if (c.cat === 'suspect') {
    ill.style.setProperty('--teinte', c.couleur);
    ill.innerHTML = SILHOUETTE;
  } else if (c.cat === 'arme') {
    ill.innerHTML = svgArme(id);
  } else {
    // un morceau du plateau, centré sur la pièce
    const [x1, y1, x2, y2] = c.zone;
    const cote = Math.min(x2 - x1, y2 - y1) * 0.92;
    const cx = (x1 + x2) / 2; const cy = (y1 + y2) / 2;
    const ox = Math.max(0, Math.min(PLATEAU.largeur - cote, cx - cote / 2));
    const oy = Math.max(0, Math.min(PLATEAU.hauteur - cote, cy - cote / 2));
    ill.classList.add('lieu');
    ill.style.backgroundSize = `${(PLATEAU.largeur / cote) * 100}% ${(PLATEAU.hauteur / cote) * 100}%`;
    ill.style.backgroundPosition = `${(ox / (PLATEAU.largeur - cote)) * 100}% ${(oy / (PLATEAU.hauteur - cote)) * 100}%`;
  }
  e.append(ill);
  e.append(el('span', 'nom-cl', c.nom));
  if (c.cat === 'suspect') e.style.setProperty('--teinte', c.couleur);
  return e;
}

// ---------- Le plateau ----------
const plateauEl = $('plateau');
const pionsEl = {};
const armesEl = {};
let decorFait = false;

function construireDecor() {
  if (decorFait) return;
  decorFait = true;
  // les portes : de petites flèches dorées
  const calque = $('calque-pieces');
  const rot = { h: -90, b: 90, g: 180, d: 0 };
  PORTES.forEach((d) => {
    const { x, y } = centreCase(d.c, d.r);
    const dx = { h: 0, b: 0, g: -1, d: 1 }[d.sens] * GRILLE.dx * 0.5;
    const dy = { h: -1, b: 1, g: 0, d: 0 }[d.sens] * GRILLE.dy * 0.5;
    const p = el('span', 'porte');
    Object.assign(p.style, pct(x + dx, y + dy));
    p.style.setProperty('--rot', `${rot[d.sens]}deg`);
    calque.append(p);
  });
  // les pièces : zones cliquables, et les passages secrets
  PIECES.forEach((pc) => {
    const [x1, y1, x2, y2] = pc.zone;
    const z = el('div', 'zone-piece');
    z.dataset.piece = pc.id;
    Object.assign(z.style, pct(x1, y1));
    z.style.width = `${((x2 - x1) / PLATEAU.largeur) * 100}%`;
    z.style.height = `${((y2 - y1) / PLATEAU.hauteur) * 100}%`;
    calque.append(z);
    if (pc.passage) {
      const t = el('button', 'trappe');
      t.type = 'button';
      t.dataset.piece = pc.id;
      t.title = `Passage secret vers : ${R.nomCarte(pc.passage)}`;
      t.setAttribute('aria-label', t.title);
      t.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 20h4v-4h4v-4h4V8h4V4"/></svg>';
      Object.assign(t.style, pct(pc.trappe[0], pc.trappe[1]));
      t.addEventListener('click', (e) => { e.stopPropagation(); prendrePassage(pc.id); });
      calque.append(t);
    }
  });
  // les pions et les armes
  const objets = $('calque-objets');
  R.SUSPECTS.forEach((sp) => {
    const p = el('div', 'pion');
    p.style.setProperty('--teinte', sp.couleur);
    p.dataset.id = sp.id;
    p.title = sp.nom;
    p.append(el('span', '', sp.nom.replace(/^(Mademoiselle|Madame|Monsieur|Colonel|Docteur|Professeur|Révérend|Mlle|Mme|M\.|Dr|Pr|Col\.)\s+/i, '').charAt(0)));
    pionsEl[sp.id] = p;
    objets.append(p);
  });
  R.ARMES.forEach((a) => {
    const e = el('div', 'arme-jeton');
    e.dataset.id = a.id;
    e.title = a.nom;
    e.innerHTML = svgArme(a.id);
    armesEl[a.id] = e;
    objets.append(e);
  });
}

// déplacement d'un objet du plateau, éventuellement le long d'un chemin (en pixels du plateau)
function placer(e, cible, chemin, depuis) {
  const k = plateauEl.clientWidth / PLATEAU.largeur;
  Object.assign(e.style, pct(cible.x, cible.y));
  if (!k || (!chemin && !depuis)) return;
  const etapes = chemin || [depuis, cible];
  if (etapes.length < 2) return;
  const cadres = etapes.map((pt, n) => {
    const dx = (pt.x - cible.x) * k; const dy = (pt.y - cible.y) * k;
    const saut = chemin && n > 0 && n < etapes.length - 1 ? ' scale(1.12)' : '';
    return { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px)${saut}` };
  });
  cadres[cadres.length - 1].transform = 'translate(-50%, -50%)';
  const duree = chemin ? Math.min(2400, 170 * (etapes.length - 1) + 120) : 650;
  e.animate(cadres, { duration: duree, easing: chemin ? 'linear' : 'cubic-bezier(.4,.1,.3,1)' });
}

function rendrePlateau() {
  construireDecor();
  const pos = positionsPions(etat);
  const avant = precedent ? positionsPions(precedent) : null;
  const anim = etat.anim && (!precedent || !precedent.anim || precedent.anim.id !== etat.anim.id) ? etat.anim : null;
  R.CATS.suspect.forEach((id) => {
    const e = pionsEl[id];
    const cible = pos[id];
    if (!e || !cible) return;
    const j = joueurDuSuspect(id);
    e.classList.toggle('joue', j >= 0);
    e.classList.toggle('actif', j >= 0 && j === etat.active && etat.status === 'jeu');
    e.classList.toggle('moi', j === maPlace);
    const a = avant && avant[id];
    const bouge = a && (Math.abs(a.x - cible.x) > 0.5 || Math.abs(a.y - cible.y) > 0.5);
    if (anim && anim.suspect === id && anim.chemin && bouge) {
      // le long du chemin : cases du couloir, et la place dans la pièce au départ et à l'arrivée
      const pts = anim.chemin.map((pt, n) => {
        if (pt.piece) return n === 0 ? a : cible;
        return centreCase(pt.c, pt.r);
      });
      if (anim.passage) placer(e, cible, null, a);
      else placer(e, cible, pts);
    } else {
      placer(e, cible, null, bouge ? a : null);
    }
  });
  const posA = positionsArmes(etat);
  const avantA = precedent ? positionsArmes(precedent) : null;
  R.CATS.arme.forEach((id) => {
    const e = armesEl[id];
    const cible = posA[id];
    if (!e || !cible) return;
    const a = avantA && avantA[id];
    const bouge = a && (Math.abs(a.x - cible.x) > 0.5 || Math.abs(a.y - cible.y) > 0.5);
    placer(e, cible, null, bouge ? a : null);
  });
  rendreDestinations();
}

// les cases et les pièces où l'on peut aller
let destinationsActuelles = null;
function rendreDestinations() {
  const calque = $('calque-cases');
  calque.innerHTML = '';
  document.querySelectorAll('.zone-piece').forEach((z) => z.classList.remove('ok'));
  document.querySelectorAll('.trappe').forEach((t) => {
    const ici = monTour() && etat.phase === 'debut' && R.pieceDe(etat, moi().suspect) === t.dataset.piece;
    t.classList.toggle('ok', ici);
    t.disabled = !ici;
  });
  destinationsActuelles = null;
  plateauEl.classList.toggle('choix', false);
  if (!monTour() || etat.phase !== 'deplacer') return;
  destinationsActuelles = R.destinations(etat, moi().suspect, total());
  plateauEl.classList.add('choix');
  destinationsActuelles.cases.forEach((chemin, k) => {
    const [c, r] = k.split(',').map(Number);
    const e = el('span', 'case-ok');
    Object.assign(e.style, pct(GRILLE.x0 + c * GRILLE.dx, GRILLE.y0 + r * GRILLE.dy));
    e.style.width = `${(GRILLE.dx / PLATEAU.largeur) * 100}%`;
    e.style.height = `${(GRILLE.dy / PLATEAU.hauteur) * 100}%`;
    e.style.animationDelay = `${(chemin.length - 1) * 40}ms`;
    calque.append(e);
  });
  destinationsActuelles.pieces.forEach((_, id) => {
    const z = document.querySelector(`.zone-piece[data-piece="${id}"]`);
    if (z) z.classList.add('ok');
  });
}

// toucher le plateau : on va vers la destination la plus proche du doigt
plateauEl.addEventListener('click', (ev) => {
  if (!destinationsActuelles || !monTour() || etat.phase !== 'deplacer') return;
  const b = plateauEl.getBoundingClientRect();
  const x = ((ev.clientX - b.left) / b.width) * PLATEAU.largeur;
  const y = ((ev.clientY - b.top) / b.height) * PLATEAU.hauteur;
  // une case du couloir sous le doigt (ou tout près)
  let meilleure = null; let dMin = 1e9;
  destinationsActuelles.cases.forEach((_, k) => {
    const [c, r] = k.split(',').map(Number);
    const ct = centreCase(c, r);
    const d = Math.hypot((ct.x - x) / GRILLE.dx, (ct.y - y) / GRILLE.dy);
    if (d < dMin) { dMin = d; meilleure = { c, r }; }
  });
  if (meilleure && dMin < 0.62) { aller(meilleure); return; }
  // une pièce
  const pc = PIECES.find((p) => destinationsActuelles.pieces.has(p.id)
    && x >= p.zone[0] && x <= p.zone[2] && y >= p.zone[1] && y <= p.zone[3]);
  if (pc) { aller({ piece: pc.id }); return; }
  if (meilleure && dMin < 1.1) { aller(meilleure); return; }
  toast('Touche une case qui brille, ou une pièce entourée.');
});
function aller(cible) {
  destinationsActuelles = null;
  agir((s) => R.deplacer(s, maPlace, cible));
}
function prendrePassage(idPiece) {
  if (!monTour() || etat.phase !== 'debut' || R.pieceDe(etat, moi().suspect) !== idPiece) return;
  agir((s) => R.passageSecret(s, maPlace));
}

// ---------- Les dés ----------
const POINTS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
function faceDe(v) {
  const d = el('div', 'de');
  for (let k = 1; k <= 9; k++) d.append(el('span', POINTS[v].includes(k) ? 'pt' : ''));
  return d;
}
let desRendus = '';
function rendreDes() {
  const zone = $('des');
  const cle = etat.des ? `${etat.partie}-${etat.active}-${etat.des.join('')}-${etat.journal.length}` : '';
  if (!etat.des) { zone.innerHTML = ''; desRendus = ''; return; }
  if (cle === desRendus) return;
  const nouveau = precedent && !precedent.des && etat.des;
  desRendus = cle;
  zone.innerHTML = '';
  etat.des.forEach((v) => {
    const d = faceDe(v);
    zone.append(d);
    if (nouveau) {
      // le dé roule : quelques faces au hasard, puis la vraie
      d.animate([
        { transform: 'translateY(-26px) rotate(-200deg) scale(.7)', opacity: 0 },
        { transform: 'translateY(4px) rotate(20deg) scale(1.05)', opacity: 1, offset: 0.7 },
        { transform: 'none' },
      ], { duration: 650, easing: 'cubic-bezier(.3,.7,.4,1)' });
    }
  });
}

// ---------- Le tour ----------
function bouton(texte, cls, fn) {
  const b = el('button', `btn-cl ${cls || ''}`.trim(), texte);
  b.type = 'button';
  b.addEventListener('click', fn);
  return b;
}

function rendreTour() {
  const zone = $('actions');
  const consigne = $('consigne');
  const info = $('info-suggestion');
  zone.innerHTML = '';
  info.hidden = true;
  info.innerHTML = '';
  if (etat.status !== 'jeu') {
    consigne.textContent = etat.status === 'fin' ? 'L\'enquête est terminée.' : '';
    return;
  }
  const a = etat.active;
  const pa = etat.players[a];
  const ici = R.pieceDe(etat, pa.suspect);
  const sg = etat.suggestion;

  // la suggestion en cours
  if (sg) {
    info.hidden = false;
    const titre = el('p', 'sg-titre');
    titre.append(el('strong', '', sg.par === maPlace ? 'Ta suggestion' : `Suggestion de ${etat.players[sg.par].name}`));
    info.append(titre);
    const trio = el('div', 'trio mini');
    [sg.suspect, sg.arme, sg.piece].forEach((c) => trio.append(carteEl(c, 'petite')));
    info.append(trio);
    const lignes = el('ul', 'sg-reponses');
    sg.passes.forEach((j) => lignes.append(el('li', 'rien', `${prenom(j)} : aucune de ces cartes`)));
    if (sg.refuteur >= 0) {
      if (sg.carte) {
        if (sg.par === maPlace) {
          const li = el('li', 'vue');
          li.append(el('span', '', `${etat.players[sg.refuteur].name} te montre :`));
          const c = carteEl(sg.carte, 'revelee');
          if (precedent && precedent.suggestion && !precedent.suggestion.carte) c.classList.add('retourne');
          li.append(c);
          lignes.append(li);
        } else if (sg.refuteur === maPlace) {
          lignes.append(el('li', 'montre', `Tu as montré : ${R.nomCarte(sg.carte)}`));
        } else {
          lignes.append(el('li', 'montre', `${etat.players[sg.refuteur].name} montre une carte à ${prenom(sg.par)}`));
        }
      } else {
        lignes.append(el('li', 'attente', `${prenom(sg.refuteur)} choisit une carte à montrer…`));
        if (sg.refuteur !== maPlace && !etat.players[sg.refuteur].bot && Date.now() - (sg.depuis || 0) > 45000) {
          const b = bouton('Il ne répond pas : montrer une carte au hasard', 'petit', () => agir((s) => R.forcerRefutation(s)));
          lignes.append(b);
        }
      }
    } else if (etat.phase === 'apres') {
      lignes.append(el('li', 'personne', 'Personne ne peut réfuter !'));
    }
    info.append(lignes);
  }

  if (moi().elimine && etat.status === 'jeu') {
    // éliminé : on a vu l'enveloppe
    const p = el('div', 'elimine-info');
    p.append(el('p', '', 'Tu es éliminé. L\'enveloppe contenait :'));
    const trio = el('div', 'trio mini');
    [etat.solution.suspect, etat.solution.arme, etat.solution.piece].forEach((c) => trio.append(carteEl(c, 'petite')));
    p.append(trio);
    zone.append(p);
  }

  if (!monTour()) {
    const nom = pa.name;
    const textes = {
      debut: `${nom} réfléchit…`,
      deplacer: `${nom} se déplace (${total()}).`,
      suggerer: `${nom} est dans : ${ici ? R.nomCarte(ici) : ''}.`,
      refuter: sg && sg.attente === maPlace ? 'Choisis la carte à montrer.' : `${nom} attend une réponse…`,
      apres: `${nom} réfléchit…`,
      finir: `${nom} termine son tour.`,
    };
    consigne.textContent = textes[etat.phase] || '';
    consigne.prepend(pastille(pa.suspect));
    if (etat.phase === 'refuter' && sg && sg.attente === maPlace) zone.append(bouton('Montrer une carte', 'principal', ouvrirRefutation));
    return;
  }

  // c'est à moi
  consigne.innerHTML = '';
  consigne.append(pastille(pa.suspect));
  const accuser = () => zone.append(bouton('⚖️ Accuser', 'accuser', () => ouvrirChoix('accuser')));
  const finir = () => zone.append(bouton('Finir mon tour', '', () => agir((s) => R.finirTour(s, maPlace))));
  switch (etat.phase) {
    case 'debut': {
      consigne.append(ici ? `À toi ! Tu es dans : ${R.nomCarte(ici)}.` : 'À toi de jouer !');
      zone.append(bouton(`🎲 Lancer ${R.nbDes(etat) === 2 ? 'les dés' : 'le dé'}`, 'principal', () => agir((s) => R.lancer(s, maPlace))));
      const pc = ici && R.piece(ici);
      if (pc && pc.passage) zone.append(bouton(`🕳️ Passage secret → ${R.nomCarte(pc.passage)}`, '', () => prendrePassage(ici)));
      if (etat.suggererIci) zone.append(bouton('🔍 Suggérer ici', '', () => agir((s) => R.rester(s, maPlace))));
      accuser();
      break;
    }
    case 'deplacer':
      consigne.append(`Tu as fait ${total()} : touche une case qui brille ou une pièce entourée.`);
      break;
    case 'suggerer':
      consigne.append(`Tu es dans : ${R.nomCarte(ici)}.`);
      zone.append(bouton('🔍 Faire une suggestion', 'principal', () => ouvrirChoix('suggerer')));
      accuser();
      finir();
      break;
    case 'refuter':
      consigne.append('On cherche qui peut te répondre…');
      break;
    case 'apres':
      consigne.append(sg && sg.carte ? 'Note ce que tu as appris !' : 'Personne n\'a ces cartes… intéressant !');
      accuser();
      finir();
      break;
    default:
      consigne.append('Ton déplacement est fini.');
      accuser();
      finir();
  }
}
function pastille(suspect) {
  const p = el('span', 'pastille-cl');
  p.style.setProperty('--teinte', couleurDe(suspect));
  return p;
}

// ---------- Suggestion et accusation ----------
let choix = null; // { mode, suspect, arme, piece }
function ouvrirChoix(mode) {
  const ici = R.pieceDe(etat, moi().suspect);
  choix = { mode, suspect: null, arme: null, piece: mode === 'suggerer' ? ici : null };
  $('choix-titre').textContent = mode === 'suggerer' ? 'Suggestion' : 'Accusation';
  $('choix-texte').textContent = mode === 'suggerer'
    ? `Le crime a eu lieu dans : ${R.nomCarte(ici)}. Qui, et avec quelle arme ?`
    : 'Attention : si tu te trompes, tu es éliminé de l\'enquête !';
  $('choix-valider').textContent = mode === 'suggerer' ? 'Suggérer' : 'Accuser';
  $('choix-valider').classList.toggle('danger', mode === 'accuser');
  $('choix-valider').classList.toggle('principal', mode !== 'accuser');
  rendreChoix();
  $('dlg-choix').showModal();
}
function rendreChoix() {
  const zone = $('choix-contenu');
  zone.innerHTML = '';
  const savoir = connu();
  const cats = ['suspect', 'arme', 'piece'];
  cats.forEach((cat) => {
    zone.append(el('h3', '', { suspect: 'Le coupable', arme: 'L\'arme', piece: choix.mode === 'suggerer' ? 'La pièce (celle où tu es)' : 'La pièce' }[cat]));
    const rangee = el('div', 'rangee-cartes choix');
    // suggestion : la pièce est celle où l'on se trouve
    const ids = choix.mode === 'suggerer' && cat === 'piece' ? [choix.piece] : R.CATS[cat];
    ids.forEach((id) => {
      const c = carteEl(id, 'petite');
      c.tabIndex = 0;
      c.setAttribute('role', 'button');
      if (choix[cat] === id) c.classList.add('choisie');
      if (savoir[id]) c.classList.add('connue');
      const choisir = () => { if (choix.mode === 'suggerer' && cat === 'piece') return; choix[cat] = id; rendreChoix(); };
      c.addEventListener('click', choisir);
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choisir(); } });
      rangee.append(c);
    });
    zone.append(rangee);
  });
  $('choix-valider').disabled = !(choix.suspect && choix.arme && choix.piece);
}
$('choix-annuler').addEventListener('click', () => $('dlg-choix').close());
$('choix-valider').addEventListener('click', () => {
  if (!choix || !(choix.suspect && choix.arme && choix.piece)) return;
  const c = { ...choix };
  $('dlg-choix').close();
  if (c.mode === 'suggerer') agir((s) => R.suggerer(s, maPlace, c.suspect, c.arme));
  else agir((s) => R.accuser(s, maPlace, c.suspect, c.arme, c.piece));
});

// montrer une carte (quand on est interrogé)
function ouvrirRefutation() {
  const sg = etat.suggestion;
  if (!sg || sg.attente !== maPlace) return;
  $('refuter-texte').textContent = `${etat.players[sg.par].name} soupçonne ${R.nomCarte(sg.suspect)}, avec ${article(sg.arme)}, dans ${article(sg.piece)}. Choisis la carte que tu lui montres (lui seul la verra).`;
  const zone = $('refuter-cartes');
  zone.innerHTML = '';
  R.cartesPourRefuter(etat, maPlace).forEach((id) => {
    const c = carteEl(id);
    c.tabIndex = 0;
    c.setAttribute('role', 'button');
    const go = () => { $('dlg-refuter').close(); agir((s) => R.montrer(s, maPlace, id)); };
    c.addEventListener('click', go);
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    zone.append(c);
  });
  if (!$('dlg-refuter').open) $('dlg-refuter').showModal();
}
function fermerDialogues() {
  ['dlg-choix', 'dlg-refuter'].forEach((id) => { if ($(id).open) $(id).close(); });
}

// ---------- Ce que je sais (fiche) ----------
function connu() {
  const res = {};
  const p = moi();
  p.main.forEach((c) => { res[c] = { qui: maPlace, texte: 'à moi' }; });
  p.vues.forEach((v) => { if (!res[v.carte]) res[v.carte] = { qui: v.par, texte: etat.players[v.par].name }; });
  return res;
}
const MARQUES = ['', 'x', '?', 'v'];
const SYMBOLES = { x: '✗', '?': '?', v: '★' };
function rendreFiche() {
  const zone = $('vue-fiche');
  zone.innerHTML = '';
  const savoir = connu();
  const notes = moi().notes || {};
  zone.append(el('p', 'fiche-titre', 'Fiche d\'enquête'));
  [['suspect', 'Suspects'], ['arme', 'Armes'], ['piece', 'Pièces']].forEach(([cat, titre]) => {
    zone.append(el('h3', '', titre));
    const ul = el('ul', 'fiche-liste');
    R.CATS[cat].forEach((id) => {
      const li = el('li');
      const b = el('button', 'fiche-ligne');
      b.type = 'button';
      if (cat === 'suspect') b.append(pastille(id));
      else if (cat === 'arme') { const ic = el('span', 'fiche-icone'); ic.innerHTML = svgArme(id); b.append(ic); }
      else b.append(el('span', 'fiche-icone porte-ic', '🚪'));
      b.append(el('span', 'fiche-nom', R.nomCarte(id)));
      const k = savoir[id];
      const m = notes[id] || '';
      if (k) {
        b.classList.add('innocente');
        b.append(el('span', `fiche-qui${k.qui === maPlace ? ' moi' : ''}`, k.texte));
        b.disabled = true;
      } else {
        const marque = el('span', `fiche-marque m-${m === '?' ? 'doute' : m || 'vide'}`, SYMBOLES[m] || '');
        b.append(marque);
        if (m === 'x') b.classList.add('innocente');
        if (m === 'v') b.classList.add('suspecte');
        b.setAttribute('aria-label', `${R.nomCarte(id)} : touche pour noter`);
        b.addEventListener('click', () => {
          const suivant = MARQUES[(MARQUES.indexOf(m) + 1) % MARQUES.length];
          agir((s) => {
            const p = s.players[maPlace];
            if (!p) return false;
            p.notes = p.notes || {};
            if (suivant) p.notes[id] = suivant; else delete p.notes[id];
          });
        });
      }
      li.append(b);
      ul.append(li);
    });
    zone.append(ul);
  });
}

// ---------- Ma main, les enquêteurs, le journal ----------
function rendreMain() {
  const zone = $('main');
  zone.innerHTML = '';
  const m = [...moi().main].sort((x, y) => R.TOUTES.indexOf(x) - R.TOUTES.indexOf(y));
  m.forEach((id) => zone.append(carteEl(id)));
  if (!m.length) zone.append(el('p', 'vide', 'Pas de cartes.'));
}
function rendreEnqueteurs() {
  const zone = $('enqueteurs');
  zone.innerHTML = '';
  etat.players.forEach((p, i) => {
    const e = el('div', 'enqueteur');
    e.classList.toggle('actif', i === etat.active && etat.status === 'jeu');
    e.classList.toggle('elimine', !!p.elimine);
    e.classList.toggle('moi', i === maPlace);
    e.append(pastille(p.suspect));
    const t = el('span', 'enq-texte');
    t.append(el('strong', '', p.name + (i === maPlace ? ' (toi)' : '')));
    t.append(el('small', '', `${R.CARTES[p.suspect] ? R.CARTES[p.suspect].court || R.CARTES[p.suspect].nom : ''} · ${p.main.length} cartes${p.bot ? ' · bot' : ''}${p.elimine ? ' · éliminé' : ''}`));
    e.append(t);
    zone.append(e);
  });
}
function rendreJournal() {
  const ol = $('journal');
  ol.innerHTML = '';
  [...etat.journal].reverse().forEach((j) => ol.append(el('li', '', j.t)));
}

// ---------- Bandeau (accusations) et fin ----------
let bandeauTimer = null;
function montrerBandeau(texte, cls) {
  const b = $('bandeau');
  b.textContent = texte;
  b.className = `bandeau-cl ${cls || ''}`;
  b.hidden = false;
  b.animate([{ opacity: 0, transform: 'translate(-50%, -40%) scale(.9)' }, { opacity: 1, transform: 'translate(-50%, -50%)' }], { duration: 300, easing: 'ease-out' });
  clearTimeout(bandeauTimer);
  bandeauTimer = setTimeout(() => { b.hidden = true; }, 4200);
}
function rendreFin() {
  const f = $('fin');
  if (etat.status !== 'fin') { f.hidden = true; return; }
  const etaitFini = precedent && precedent.status === 'fin';
  f.hidden = false;
  const g = etat.gagnant;
  $('fin-titre').textContent = g >= 0 ? (g === maPlace ? 'Bravo, tu as résolu l\'affaire !' : `${etat.players[g].name} a résolu l'affaire !`) : 'Le coupable court toujours…';
  $('fin-sous').textContent = etat.parDefaut ? 'Tous les autres enquêteurs se sont trompés. L\'enveloppe contenait :' : 'L\'enveloppe contenait :';
  const trio = $('fin-trio');
  trio.innerHTML = '';
  [etat.solution.suspect, etat.solution.arme, etat.solution.piece].forEach((c, k) => {
    const e = carteEl(c);
    if (!etaitFini) {
      e.animate([{ transform: 'rotateY(90deg) translateY(20px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 500, delay: 400 + k * 350, easing: 'ease-out', fill: 'backwards' });
    }
    trio.append(e);
  });
}
$('btn-nouvelle').addEventListener('click', () => agir((s) => {
  if (s.status !== 'fin') return false;
  R.nouvellePartie(s);
  return true;
}));

// ---------- Onglets du panneau ----------
document.querySelectorAll('.onglets-cote [role="tab"]').forEach((o) => o.addEventListener('click', () => {
  document.querySelectorAll('.onglets-cote [role="tab"]').forEach((x) => {
    x.setAttribute('aria-selected', String(x === o));
    $(x.dataset.vue).hidden = x !== o;
  });
}));

function majHauteurBarre() {
  const b = document.querySelector('.barre');
  if (b) document.documentElement.style.setProperty('--h-barre', `${b.offsetHeight}px`);
}
window.addEventListener('resize', majHauteurBarre);
majHauteurBarre();

// ---------- Affichage ----------
function rendre() {
  if (!etat || !etat.players[maPlace]) return;
  majHauteurBarre();
  rendrePlateau();
  rendreDes();
  rendreTour();
  rendreEnqueteurs();
  rendreMain();
  rendreFiche();
  rendreJournal();
  rendreFin();
  // une accusation vient d'être faite
  if (etat.accusation && (!precedent || !precedent.accusation || precedent.accusation.n !== etat.accusation.n)) {
    const ac = etat.accusation;
    if (precedent) {
      montrerBandeau(`${ac.par === maPlace ? 'Tu accuses' : `${etat.players[ac.par].name} accuse`} ${R.nomCarte(ac.suspect)}, avec ${article(ac.arme)}, dans ${article(ac.piece)}… ${ac.juste ? 'C\'est juste !' : 'C\'est faux !'}`, ac.juste ? 'juste' : 'faux');
    }
  }
  // on m'interroge : j'ouvre le choix de la carte à montrer
  if (etat.status === 'jeu' && etat.phase === 'refuter' && etat.suggestion && etat.suggestion.attente === maPlace) {
    ouvrirRefutation();
  } else if ($('dlg-refuter').open) $('dlg-refuter').close();
  if ($('dlg-choix').open && !(monTour() && ['suggerer', 'debut', 'apres', 'finir'].includes(etat.phase))) $('dlg-choix').close();
}
