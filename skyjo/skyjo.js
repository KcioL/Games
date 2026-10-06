import { $, el, toast, melanger, initSalon, initRegles, de } from '../commun/salon.js';

const SCORE_FIN = 100;

// ---------- Règles ----------
function creerPaquet() {
  const p = [];
  for (let i = 0; i < 5; i++) p.push(-2);
  for (let i = 0; i < 10; i++) p.push(-1);
  for (let i = 0; i < 15; i++) p.push(0);
  for (let v = 1; v <= 12; v++) for (let i = 0; i < 10; i++) p.push(v);
  return melanger(p);
}

// Firebase supprime les tableaux vides et les valeurs null : on les recrée
function normaliser(s) {
  s.deck = s.deck || [];
  s.discard = s.discard || [];
  s.players = s.players || [];
  s.players.forEach((p) => { p.grid = p.grid || []; p.total = p.total || 0; });
  if (s.finisher === undefined || s.finisher === null) s.finisher = -1;
  s.held = s.held || null;
  return s;
}

const colonne = (c) => [c, c + 4, c + 8];
const visibles = (g) => g.filter((c) => c.up && !c.gone);
const sommeVisible = (g) => visibles(g).reduce((a, c) => a + c.v, 0);
const toutRetourne = (g) => g.length > 0 && g.every((c) => c.up || c.gone);

function remplirPioche(s) {
  if (s.deck.length > 0) return;
  if (s.discard.length <= 1) return;
  const dessus = s.discard.pop();
  s.deck = melanger(s.discard);
  s.discard = [dessus];
}

function nouvelleManche(s) {
  const paquet = creerPaquet();
  s.players.forEach((p) => {
    p.grid = Array.from({ length: 12 }, () => ({ v: paquet.pop(), up: false, gone: false }));
  });
  s.discard = [paquet.pop()];
  s.deck = paquet;
  s.status = 'flip';
  s.phase = 'choose';
  s.held = null;
  s.finisher = -1;
  s.active = 0;
  s.bilan = null;
  s.action = '';
  s.lastEvent = null;
}

function verifierColonnes(s, idx, messages) {
  const p = s.players[idx];
  for (let c = 0; c < 4; c++) {
    const cartes = colonne(c).map((i) => p.grid[i]);
    if (cartes.every((k) => k.up && !k.gone) && cartes.every((k) => k.v === cartes[0].v)) {
      cartes.forEach((k) => { k.gone = true; s.discard.push(k.v); });
      messages.push(`${p.name} élimine une colonne de ${cartes[0].v} !`);
    }
  }
}

function finDeManche(s, messages) {
  s.players.forEach((p, i) => {
    p.grid.forEach((c) => { if (!c.gone) c.up = true; });
    verifierColonnes(s, i, messages);
  });
  const scores = s.players.map((p) => p.grid.reduce((a, c) => a + (c.gone ? 0 : c.v), 0));
  const f = s.finisher;
  const minAutres = Math.min(...scores.filter((_, i) => i !== f));
  let double = false;
  if (scores[f] > 0 && scores[f] >= minAutres) { scores[f] *= 2; double = true; }
  s.players.forEach((p, i) => { p.total += scores[i]; });
  s.bilan = { scores, double, finisher: f };
  s.status = s.players.some((p) => p.total >= SCORE_FIN) ? 'finished' : 'roundEnd';
  s.held = null;
}

function finDeTour(s, messages) {
  const n = s.players.length;
  const joueur = s.players[s.active];
  verifierColonnes(s, s.active, messages);
  s.phase = 'choose';
  s.held = null;
  if (s.finisher < 0 && toutRetourne(joueur.grid)) {
    s.finisher = s.active;
    messages.push(`${joueur.name} a tout retourné : dernier tour pour les autres !`);
  }
  const suivant = (s.active + 1) % n;
  if (s.finisher >= 0 && suivant === s.finisher) finDeManche(s, messages);
  else s.active = suivant;
  if (messages.length) s.lastEvent = { ts: Date.now(), textes: messages };
}

// ---------- Salon ----------
let etat = null;
let maPlace = 0;
let dernierTs = null;
let premiereSynchro = true;
let bilanMasque = false;
let statutPrecedent = null;

const salon = initSalon({
  jeu: 'skyjo',
  etatInitial: (nom, nb, { local }) => {
    const joueurs = Array.from({ length: nb }, (_, i) => ({ name: i === 0 ? nom : 'En attente', joined: i === 0, total: 0, bot: false }));
    const bots = parseInt($(local ? 'local-bots' : 'nb-bots').value, 10) || 0;
    for (let k = 1; k <= bots; k++) joueurs.push({ name: `Bot ${k}`, joined: true, total: 0, bot: true });
    return { players: joueurs };
  },
  validerLocal: () => {
    const total = parseInt($('local-nb').value, 10) + parseInt($('local-bots').value, 10);
    if (total < 2) return 'Il faut au moins 2 joueurs : ajoute un bot ou un joueur.';
    if (total > 6) return '6 places maximum autour de la table.';
    return '';
  },
  validerEnLigne: () => (parseInt($('nb-joueurs').value, 10) + parseInt($('nb-bots').value, 10) > 6
    ? '6 places maximum : enlève un bot ou un joueur.' : ''),
  demarrer: (s) => {
    s.round = 1;
    s.players.forEach((p) => { p.total = 0; });
    nouvelleManche(s);
  },
  afficher: (s, place) => {
    etat = normaliser(s);
    maPlace = place;
    noterChangement();
    rendre();
    planifierBot();
  },
  // Mode un seul téléphone : personne ne connaît ses cartes cachées, inutile de cacher l'écran.
  // L'écran suit le joueur humain qui doit agir (les bots jouent tout seuls).
  quiDoitJouer: (s) => {
    const joueurs = s.players || [];
    if (joueurs.filter((p) => !p.bot).length <= 1) return -1;
    if (s.status === 'flip') return joueurs.findIndex((p) => !p.bot && (p.grid || []).filter((c) => c.up).length < 2);
    if (s.status === 'playing' && joueurs[s.active] && !joueurs[s.active].bot) return s.active;
    return -1;
  },
  secret: false,
});
initRegles();

// ---------- Actions (pour le joueur i, humain ou bot) ----------
const tourDe = (s, i) => s.status === 'playing' && s.active === i;
const monTour = (s) => tourDe(s, maPlace);
const compter = (s) => { s.coup = (s.coup || 0) + 1; };

function agir(fn) {
  return salon.agir((s) => fn(normaliser(s)));
}

function actPiocher(s, i) {
  if (!tourDe(s, i) || s.phase !== 'choose') return false;
  remplirPioche(s);
  if (!s.deck.length) return false;
  s.held = { v: s.deck.pop(), from: 'deck' };
  s.phase = 'holding';
  s.action = `${s.players[i].name} a pioché un ${s.held.v}`;
  compter(s);
  return true;
}

function actPrendreDefausse(s, i) {
  if (!tourDe(s, i) || s.phase !== 'choose' || !s.discard.length) return false;
  s.held = { v: s.discard.pop(), from: 'discard' };
  s.phase = 'holding';
  s.action = `${s.players[i].name} a pris le ${s.held.v} de la défausse`;
  compter(s);
  return true;
}

function actDefausser(s, i) {
  if (!tourDe(s, i) || s.phase !== 'holding' || !s.held || s.held.from !== 'deck') return false;
  const v = s.held.v;
  s.discard.push(v);
  s.held = null;
  s.action = `${s.players[i].name} a défaussé le ${v}`;
  compter(s);
  const g = s.players[i].grid;
  if (g.some((c) => !c.up && !c.gone)) s.phase = 'mustFlip';
  else finDeTour(s, []);
  return true;
}

// Toucher la carte k de son jeu : la retourner (début de manche, ou après avoir défaussé), ou y poser la carte tenue
function actCarte(s, i, k) {
  const g = s.players[i].grid;
  const carte = g[k];
  if (!carte || carte.gone) return false;

  // Début de manche : chacun retourne 2 cartes
  if (s.status === 'flip') {
    if (carte.up || g.filter((c) => c.up).length >= 2) return false;
    carte.up = true;
    compter(s);
    if (s.players.every((p) => p.grid.filter((c) => c.up).length >= 2)) {
      // À chaque manche, le plus gros total des 2 cartes retournées commence.
      // Égalité (non prévue par la règle) : tirage au sort entre les ex-aequo.
      const totaux = s.players.map((p) => sommeVisible(p.grid));
      const max = Math.max(...totaux);
      const exAequo = totaux.map((t, n) => (t === max ? n : -1)).filter((n) => n >= 0);
      const premier = exAequo[Math.floor(Math.random() * exAequo.length)];
      s.active = premier;
      s.status = 'playing';
      s.action = '';
      const pourquoi = exAequo.length > 1 ? `égalité à ${max}, tirage au sort` : `plus gros total : ${max}`;
      s.lastEvent = { ts: Date.now(), textes: [`${s.players[premier].name} commence (${pourquoi}) !`] };
    }
    return true;
  }

  if (!tourDe(s, i)) return false;

  if (s.phase === 'holding' && s.held) {
    const ancienne = carte.v;
    s.discard.push(ancienne);
    g[k] = { v: s.held.v, up: true, gone: false };
    s.action = `${s.players[i].name} a posé un ${s.held.v} et défaussé un ${ancienne}`;
    compter(s);
    finDeTour(s, []);
    return true;
  }

  if (s.phase === 'mustFlip') {
    if (carte.up) return false;
    carte.up = true;
    s.action = `${s.players[i].name} a défaussé puis retourné un ${carte.v}`;
    compter(s);
    finDeTour(s, []);
    return true;
  }
  return false;
}

// Boutons et cartes de l'écran : actions de « mon » joueur
const piocher = () => agir((s) => actPiocher(s, maPlace));
const prendreDefausse = () => agir((s) => actPrendreDefausse(s, maPlace));
const defausserTenue = () => agir((s) => actDefausser(s, maPlace));
const cliquerCarte = (k) => agir((s) => actCarte(s, maPlace, k));

function suite() {
  agir((s) => {
    if (s.status === 'roundEnd') {
      s.round = (s.round || 1) + 1;
      nouvelleManche(s);
    } else if (s.status === 'finished') {
      s.round = 1;
      s.players.forEach((p) => { p.total = 0; });
      nouvelleManche(s);
    } else {
      return false;
    }
    compter(s);
  });
}

// =====================================================================
// Bots
// =====================================================================
const VALEUR_CACHEE = 5; // valeur moyenne d'une carte encore cachée

// Points gagnés en posant la valeur v à la place k (colonne de trois identiques comprise)
function gainPlacement(g, k, v) {
  const c = g[k];
  if (!c || c.gone) return -Infinity;
  const avant = c.up ? c.v : VALEUR_CACHEE;
  const autres = colonne(k % 4).filter((x) => x !== k).map((x) => g[x]);
  if (autres.every((o) => o.up && !o.gone && o.v === v)) {
    return autres.reduce((t, o) => t + o.v, 0) + avant; // la colonne disparaît
  }
  let gain = avant - v;
  // une paire dans la colonne : on se rapproche d'une colonne éliminée
  if (v >= 3 && autres.some((o) => o.up && !o.gone && o.v === v)) gain += 1.5;
  return gain;
}

// Finir la manche serait-il risqué (points doublés si on n'a pas le plus petit score) ?
function finirEstRisque(s, i, gApres) {
  if (s.finisher >= 0) return false;
  const estime = (g) => g.reduce((t, c) => t + (c.gone ? 0 : c.up ? c.v : VALEUR_CACHEE), 0);
  const moi = estime(gApres);
  return moi > 0 && s.players.some((p, n) => n !== i && estime(p.grid) <= moi);
}

function meilleurePlace(s, i, v, { eviterFin = true } = {}) {
  const g = s.players[i].grid;
  const cachees = g.filter((c) => !c.up && !c.gone).length;
  let meilleure = -1;
  let meilleurGain = -Infinity;
  g.forEach((c, k) => {
    if (c.gone) return;
    // poser sur la dernière carte cachée finirait la manche : seulement si ce n'est pas risqué
    if (eviterFin && !c.up && cachees === 1) {
      const apres = g.map((x, n) => (n === k ? { v, up: true, gone: false } : x));
      if (finirEstRisque(s, i, apres)) return;
    }
    const gain = gainPlacement(g, k, v);
    if (gain > meilleurGain) { meilleurGain = gain; meilleure = k; }
  });
  return { k: meilleure, gain: meilleurGain };
}

function jouerBot(s, i) {
  const g = s.players[i].grid;
  if (s.status === 'flip') {
    // retourner 2 cartes dans des colonnes différentes
    const dejaCol = g.map((c, k) => (c.up ? k % 4 : -1)).filter((x) => x >= 0);
    const choix = g.map((c, k) => k).filter((k) => !g[k].up && !dejaCol.includes(k % 4));
    const k = choix[Math.floor(Math.random() * choix.length)];
    return actCarte(s, i, k);
  }
  if (s.phase === 'choose') {
    const dessus = s.discard[s.discard.length - 1];
    if (dessus !== undefined && meilleurePlace(s, i, dessus).gain >= 3) return actPrendreDefausse(s, i);
    return actPiocher(s, i);
  }
  if (s.phase === 'holding' && s.held) {
    const v = s.held.v;
    const place = meilleurePlace(s, i, v);
    const cachees = g.filter((c) => !c.up && !c.gone).length;
    // jeter la carte obligerait à retourner la dernière cachée : risqué en fin de manche
    const jeterRisque = cachees === 1 && finirEstRisque(s, i, g.map((c) => (!c.up && !c.gone ? { ...c, up: true } : c)));
    if (s.held.from === 'discard' || place.gain > 0.5 || (jeterRisque && place.k >= 0)) {
      return actCarte(s, i, place.k >= 0 ? place.k : meilleurePlace(s, i, v, { eviterFin: false }).k);
    }
    return actDefausser(s, i);
  }
  if (s.phase === 'mustFlip') {
    const cachees = g.map((c, k) => k).filter((k) => !g[k].up && !g[k].gone);
    return actCarte(s, i, cachees[Math.floor(Math.random() * cachees.length)]);
  }
  return false;
}

// Si la décision d'un bot est refusée, une action sûre pour ne jamais bloquer la partie
function secoursBot(s, i) {
  const g = s.players[i].grid;
  const premiereCachee = g.findIndex((c) => !c.up && !c.gone);
  if (s.status === 'flip' || s.phase === 'mustFlip') return actCarte(s, i, premiereCachee);
  if (s.phase === 'choose') return actPiocher(s, i);
  if (s.phase === 'holding') return actDefausser(s, i) || actCarte(s, i, g.findIndex((c) => !c.gone));
  return false;
}

// Quel bot doit agir maintenant ?
function botAJouer(s) {
  if (s.status === 'flip') return s.players.findIndex((p) => p.bot && (p.grid || []).filter((c) => c.up).length < 2);
  if (s.status === 'playing' && s.players[s.active] && s.players[s.active].bot) return s.active;
  return -1;
}
const botDoitJouer = () => botAJouer(etat) >= 0;

// Les bots sont joués par l'appareil du premier joueur humain ; les autres prennent le relais
// après un délai s'il est déconnecté. Le compteur `coup` évite tout double coup.
let botPrevu = '';
function planifierBot() {
  if (!etat || !['flip', 'playing'].includes(etat.status)) return;
  const b = botAJouer(etat);
  if (b < 0) return;
  const moi = etat.players[maPlace];
  if (!moi || moi.bot) return;
  const cle = `${etat.round}-${etat.coup || 0}-${b}-${etat.status}-${etat.phase}`;
  if (botPrevu === cle) return;
  botPrevu = cle;
  const coup = etat.coup || 0;
  const premierHumain = etat.players.findIndex((p) => !p.bot);
  // le bot laisse le temps de voir la carte qu'il tient avant de la poser
  const reflexion = etat.phase === 'holding' ? 1400 : 800 + Math.random() * 400;
  const delai = (salon.estLocal() || maPlace === premierHumain) ? reflexion : 4000 + maPlace * 1500;
  setTimeout(() => {
    agir((s) => {
      if ((s.coup || 0) !== coup) return false;
      const j = botAJouer(s);
      if (j < 0) return false;
      try {
        if (jouerBot(s, j)) return true;
      } catch (err) {
        console.error('Bot : erreur dans sa décision', err);
      }
      return secoursBot(s, j);
    });
  }, delai);
}

// Surveillant : si un bot doit jouer et que rien n'a bougé depuis un moment, on reprogramme son coup
let dernierChangement = Date.now();
let dernierCoupConnu = null;
function noterChangement() {
  const cle = `${etat && etat.round}-${etat && etat.coup}-${etat && etat.status}`;
  if (cle !== dernierCoupConnu) { dernierCoupConnu = cle; dernierChangement = Date.now(); }
}
setInterval(() => {
  if (!etat || !['flip', 'playing'].includes(etat.status) || !botDoitJouer()) return;
  if (Date.now() - dernierChangement < 3500) return;
  dernierChangement = Date.now();
  botPrevu = '';
  planifierBot();
}, 1500);

$('pioche').addEventListener('click', piocher);
$('defausse').addEventListener('click', prendreDefausse);
$('btn-defausser').addEventListener('click', defausserTenue);
$('btn-suite').addEventListener('click', suite);
$('btn-voir').addEventListener('click', () => { bilanMasque = true; $('bilan').hidden = true; rendreBoutonBilan(); });

// ---------- Affichage ----------
function carteEl(c, taille) {
  const e = el('div', 'carte' + (taille ? ' ' + taille : ''));
  if (!c || c.gone) { e.classList.add('partie'); return e; }
  if (!c.up) { e.classList.add('cachee'); return e; }
  e.classList.add(famille(c.v));
  e.appendChild(el('span', 'val', String(c.v)));
  return e;
}

function famille(v) {
  if (v < 0) return 'f-neg';
  if (v === 0) return 'f-zero';
  if (v <= 4) return 'f-vert';
  if (v <= 8) return 'f-jaune';
  return 'f-rouge';
}

function rendreAdversaires() {
  const zone = $('adversaires');
  zone.innerHTML = '';
  const n = etat.players.length;
  for (let k = 1; k < n; k++) {
    const idx = (maPlace + k) % n;
    const p = etat.players[idx];
    const bloc = el('div', 'adversaire');
    if (etat.status === 'playing' && etat.active === idx) bloc.classList.add('actif');
    if (etat.finisher === idx) bloc.classList.add('fini');
    const tete = el('div', 'adv-tete');
    tete.appendChild(el('strong', '', p.name));
    tete.appendChild(el('span', '', `${sommeVisible(p.grid)} pts visibles, total ${p.total}`));
    const g = el('div', 'grille-cartes mini');
    p.grid.forEach((c) => g.appendChild(carteEl(c)));
    bloc.append(tete, g);
    zone.appendChild(bloc);
  }
}

function rendreCentre() {
  const tour = monTour(etat);
  const pioche = $('pioche');
  pioche.disabled = !(tour && etat.phase === 'choose');
  pioche.classList.toggle('jouable', !pioche.disabled);
  $('nb-pioche').textContent = String(etat.deck.length);

  const def = $('defausse');
  def.innerHTML = '';
  const dessus = etat.discard[etat.discard.length - 1];
  if (dessus !== undefined) def.appendChild(carteEl({ v: dessus, up: true }));
  else def.appendChild(el('div', 'carte partie'));
  def.disabled = !(tour && etat.phase === 'choose' && dessus !== undefined);
  def.classList.toggle('jouable', !def.disabled);

  const main = $('main-tenue');
  const tenue = etat.status === 'playing' && etat.held;
  main.hidden = !tenue;
  if (tenue) {
    const zone = $('carte-tenue');
    zone.innerHTML = '';
    zone.appendChild(carteEl({ v: etat.held.v, up: true }));
    const bouton = $('btn-defausser');
    bouton.hidden = !(tour && etat.held.from === 'deck');
  }
}

function rendreMonJeu() {
  const moi = etat.players[maPlace];
  $('mon-nom').textContent = salon.estLocal() ? `Jeu ${de(moi.name)}` : `${moi.name} (toi)`;
  $('mon-score').textContent = `${sommeVisible(moi.grid)} pts visibles, total ${moi.total}`;
  const g = $('ma-grille');
  g.innerHTML = '';
  const tour = monTour(etat);
  const nbRetournees = moi.grid.filter((c) => c.up).length;
  moi.grid.forEach((c, i) => {
    const e = carteEl(c, 'grande');
    let cliquable = false;
    if (etat.status === 'flip') cliquable = !c.up && nbRetournees < 2;
    else if (tour && etat.phase === 'holding') cliquable = !c.gone;
    else if (tour && etat.phase === 'mustFlip') cliquable = !c.up && !c.gone;
    if (cliquable) {
      e.classList.add('jouable');
      e.tabIndex = 0;
      e.setAttribute('role', 'button');
      e.addEventListener('click', () => cliquerCarte(i));
      e.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); cliquerCarte(i); } });
    }
    g.appendChild(e);
  });
  $('ma-grille').closest('.mon-jeu').classList.toggle('actif', tour || (etat.status === 'flip' && nbRetournees < 2));
}

function rendreStatut() {
  const st = $('statut');
  st.innerHTML = '';
  const moi = etat.players[maPlace];
  const actif = etat.players[etat.active];
  const dernierTour = etat.finisher >= 0 && etat.status === 'playing';

  if (etat.status === 'flip') {
    const n = moi.grid.filter((c) => c.up).length;
    if (n < 2) {
      const qui = salon.estLocal() ? `${moi.name}, retourne` : 'Retourne';
      st.appendChild(el('span', 'a-toi', n === 0 ? `${qui} 2 de tes cartes` : 'Encore une carte à retourner'));
    } else {
      const attente = etat.players.filter((p) => p.grid.filter((c) => c.up).length < 2).map((p) => p.name);
      st.textContent = `En attente : ${attente.join(', ')}`;
    }
    st.appendChild(el('span', 'sous-statut', `Manche ${etat.round || 1}`));
    return;
  }
  if (etat.status !== 'playing') {
    st.textContent = `Manche ${etat.round || 1} terminée`;
    return;
  }

  if (monTour(etat)) {
    let texte = salon.estLocal()
      ? `À ${etat.players[maPlace].name} : pioche ou prends la défausse`
      : 'À toi : pioche ou prends la défausse';
    if (etat.phase === 'holding') {
      texte = etat.held && etat.held.from === 'deck'
        ? 'Échange-la avec une de tes cartes, ou défausse-la'
        : 'Échange-la avec une de tes cartes';
    }
    if (etat.phase === 'mustFlip') texte = 'Retourne une de tes cartes cachées';
    st.appendChild(el('span', 'a-toi', texte));
  } else {
    st.append(actif.bot ? `${actif.name} joue…` : `Au tour ${de(actif.name)}`);
  }
  const details = [];
  if (dernierTour) details.push('Dernier tour !');
  if (etat.action) details.push(etat.action);
  if (details.length) st.appendChild(el('span', 'sous-statut', details.join(' ')));
}

function rendreBoutonBilan() {
  // Permet de rouvrir le bilan après avoir regardé les cartes
  let b = document.getElementById('btn-bilan');
  const utile = (etat.status === 'roundEnd' || etat.status === 'finished') && bilanMasque;
  if (utile && !b) {
    b = el('button', 'btn btn-principal btn-bilan', 'Voir les scores');
    b.id = 'btn-bilan';
    b.addEventListener('click', () => { bilanMasque = false; rendre(); });
    document.getElementById('statut').after(b);
  } else if (!utile && b) {
    b.remove();
  }
}

function rendreBilan() {
  const voile = $('bilan');
  const fini = etat.status === 'roundEnd' || etat.status === 'finished';
  if (!fini) { voile.hidden = true; bilanMasque = false; return; }
  rendreBoutonBilan();
  if (bilanMasque) { voile.hidden = true; return; }
  voile.hidden = false;

  const b = etat.bilan || { scores: [], double: false, finisher: -1 };
  const lignes = $('bilan-lignes');
  lignes.innerHTML = '';
  const ordre = etat.players.map((p, i) => i).sort((a, c) => etat.players[a].total - etat.players[c].total);
  ordre.forEach((i) => {
    const p = etat.players[i];
    const tr = el('tr', i === maPlace && !salon.estLocal() ? 'moi' : '');
    tr.appendChild(el('td', '', p.name));
    const sc = b.scores ? b.scores[i] : 0;
    tr.appendChild(el('td', '', (sc > 0 ? '+' : '') + sc + (b.double && i === b.finisher ? ' (×2)' : '')));
    tr.appendChild(el('td', '', String(p.total)));
    lignes.appendChild(tr);
  });

  if (etat.status === 'finished') {
    const gagnant = etat.players[ordre[0]];
    $('bilan-titre').textContent = ordre[0] === maPlace && !salon.estLocal() ? 'Tu as gagné !' : `${gagnant.name} gagne !`;
    $('bilan-texte').textContent = `Quelqu'un a dépassé ${SCORE_FIN} points : le plus petit total l'emporte.`;
    $('btn-suite').textContent = 'Nouvelle partie';
  } else {
    $('bilan-titre').textContent = `Fin de la manche ${etat.round || 1}`;
    const f = etat.players[b.finisher];
    $('bilan-texte').textContent = b.double && f
      ? `${f.name} a fini sans avoir le plus petit score : ses points sont doublés.`
      : (f ? `${f.name} a fini la manche.` : '');
    $('btn-suite').textContent = 'Manche suivante';
  }
}

function rendre() {
  if (!etat) return;
  // Disposition sur ordinateur : à 2, les deux jeux côte à côte ; à plusieurs, les adversaires en haut
  $('jeu').classList.toggle('deux-joueurs', etat.players.length === 2);
  $('jeu').classList.toggle('multi', etat.players.length > 2);

  if (statutPrecedent !== etat.status) {
    if (etat.status === 'roundEnd' || etat.status === 'finished') bilanMasque = false;
    statutPrecedent = etat.status;
  }

  const ev = etat.lastEvent || null;
  if (premiereSynchro) {
    premiereSynchro = false;
    dernierTs = ev ? ev.ts : null;
  } else if (ev && ev.ts !== dernierTs) {
    dernierTs = ev.ts;
    (ev.textes || []).forEach((t, k) => setTimeout(() => toast(t, true), k * 1800));
  }

  rendreAdversaires();
  rendreCentre();
  rendreStatut();
  rendreMonJeu();
  rendreBilan();
  rendreBoutonBilan();
}
