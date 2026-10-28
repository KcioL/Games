import { $, el, toast, initSalon, initRegles } from '../commun/salon.js';
import * as R from './regles.js';

const NOMS_BOTS = ['Robotine', 'Cerveau', 'Bip-Bop', 'Sherlock', 'Einstein', 'Logik'];

let etat = null;
let maPlace = 0;
let rangee = [];        // essai en cours de composition
let precedent = null;   // état précédent (animations)
let finMasquee = false;

// ---------- Accueil ----------
const majLocal = () => { $('ligne-local-bots').hidden = $('local-mode').value !== 'course'; };
$('local-mode').addEventListener('change', majLocal);
majLocal();
const majLigne = () => {
  const duel = $('ligne-mode').value === 'duel';
  if (duel && parseInt($('nb-joueurs').value, 10) + parseInt($('ligne-bots').value, 10) > 2) { $('nb-joueurs').value = '2'; $('ligne-bots').value = '0'; }
};
$('ligne-mode').addEventListener('change', majLigne);

const lireOptions = () => ({
  couleurs: parseInt($('opt-couleurs').value, 10),
  longueur: parseInt($('opt-longueur').value, 10),
  essais: parseInt($('opt-essais').value, 10),
  doublons: $('opt-doublons').checked,
  niveau: $('opt-niveau').value,
});

const melanger = (t) => { const a = [...t]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const salon = initSalon({
  jeu: 'mastermind',
  etatInitial: (nom, nb, { local }) => {
    const joueur = (name, joined, bot = false) => ({ name, joined, bot, victoires: 0 });
    let mode; let bots;
    if (local) {
      mode = $('local-mode').value;
      bots = mode === 'solo' ? 0 : mode === 'duel' ? 1 : parseInt($('local-bots').value, 10);
      if (mode === 'solo') mode = 'course';
    } else {
      mode = $('ligne-mode').value;
      bots = parseInt($('ligne-bots').value, 10) || 0;
    }
    const joueurs = Array.from({ length: nb }, (_, i) => joueur(i === 0 ? nom : 'En attente', i === 0));
    melanger(NOMS_BOTS).slice(0, bots).forEach((n) => joueurs.push(joueur(n, true, true)));
    return { players: joueurs, mode, options: lireOptions() };
  },
  validerEnLigne: () => {
    const total = parseInt($('nb-joueurs').value, 10) + parseInt($('ligne-bots').value, 10);
    if ($('ligne-mode').value === 'duel' && total !== 2) return 'Le duel se joue à 2 : 2 joueurs, ou 1 joueur et 1 bot.';
    if (total < 2) return 'Il faut au moins 2 joueurs : ajoute un bot, ou joue contre l\'ordinateur.';
    if (total > 8) return '8 joueurs maximum.';
    return '';
  },
  demarrer: (s) => R.nouvellePartie(s),
  afficher: (s, place) => {
    precedent = etat && etat.partie === s.partie && place === maPlace ? etat : null;
    if (!precedent) { rangee = []; finMasquee = false; }
    etat = R.normaliser(s);
    maPlace = place;
    noterChangement();
    rendre();
    planifierBot();
  },
  quiDoitJouer: () => -1,
  secret: false,
});
initRegles();
const agir = (fn) => salon.agir((s) => fn(R.normaliser(s)));

// ---------- Bots ----------
let botPrevu = '';
function botAttendu(s) {
  if (!s || s.status !== 'jeu') return -1;
  return s.players.findIndex((p, i) => R.botDoitJouer(s, i));
}
function planifierBot() {
  const i = botAttendu(etat);
  if (i < 0) return;
  const cle = `${etat.partie}-${etat.coup}-${i}`;
  if (botPrevu === cle) return;
  botPrevu = cle;
  const coup = etat.coup;
  setTimeout(() => agir((s) => {
    if (s.coup !== coup || !R.botDoitJouer(s, i)) return false;
    return R.proposer(s, i, R.essaiBot(s, i));
  }), 1100 + Math.random() * 900);
}
let dernierChangement = Date.now();
let dernierCoup = null;
function noterChangement() {
  const cle = `${etat.partie}-${etat.coup}`;
  if (cle !== dernierCoup) { dernierCoup = cle; dernierChangement = Date.now(); }
}
setInterval(() => {
  if (!etat || botAttendu(etat) < 0 || Date.now() - dernierChangement < 4000) return;
  dernierChangement = Date.now();
  botPrevu = '';
  planifierBot();
}, 1500);

// ---------- Outils ----------
const moi = () => etat.players[maPlace];
const r = () => R.reglages(etat);
const choixCode = () => etat.status === 'codes' && !moi().code;   // duel : je choisis le code de l'autre
const peutJouer = () => etat.status === 'jeu' && !moi().fini;

function pionEl(couleur, cls = '') {
  const e = el('span', `pion-mm ${cls}`.trim());
  if (couleur) { e.dataset.c = couleur; e.title = R.NOMS_COULEURS[couleur]; } else e.classList.add('vide');
  return e;
}
function fichesEl(noirs, blancs, longueur) {
  const f = el('span', `fiches-mm n${longueur}`);
  for (let k = 0; k < longueur; k++) f.appendChild(el('i', k < noirs ? 'noir' : k < noirs + blancs ? 'blanc' : ''));
  f.title = `${noirs} bien placé${noirs > 1 ? 's' : ''}, ${blancs} mal placé${blancs > 1 ? 's' : ''}`;
  return f;
}

// ---------- Commandes ----------
function ajouter(c) {
  if (!(peutJouer() || choixCode())) return;
  if (rangee.length >= r().longueur) return;
  if (!r().doublons && rangee.includes(c)) { toast('Pas de couleur répétée dans cette partie.'); return; }
  rangee = [...rangee, c];
  rendreJeu();
}
$('btn-effacer').addEventListener('click', () => { rangee = rangee.slice(0, -1); rendreJeu(); });
$('btn-valider').addEventListener('click', () => {
  if (rangee.length !== r().longueur) return;
  const code = [...rangee];
  rangee = [];
  if (choixCode()) { agir((s) => R.choisirCode(s, maPlace, code)); return; }
  agir((s) => R.proposer(s, maPlace, code));
});
$('btn-abandon').addEventListener('click', () => {
  if (!peutJouer()) return;
  if (confirm('Abandonner ? Le code te sera révélé et ta partie s\'arrête.')) agir((s) => R.abandonner(s, maPlace));
});
$('btn-revanche').addEventListener('click', () => agir((s) => {
  if (s.status !== 'fin') return false;
  return R.nouvellePartie(s);
}));
$('btn-voir').addEventListener('click', () => { finMasquee = true; rendre(); });
document.addEventListener('keydown', (e) => {
  if (!etat || $('jeu').hidden) return;
  if (e.key === 'Backspace') { rangee = rangee.slice(0, -1); rendreJeu(); }
  if (e.key === 'Enter' && !$('btn-valider').disabled) $('btn-valider').click();
  const k = parseInt(e.key, 10);
  const pal = R.palette(etat);
  if (k >= 1 && k <= pal.length) ajouter(pal[k - 1]);
});

// ---------- Affichage ----------
function rendreAdversaires() {
  const zone = $('adversaires');
  zone.innerHTML = '';
  if (etat.players.length < 2) { zone.hidden = true; return; }
  zone.hidden = false;
  const max = r().essais;
  etat.players.forEach((p, i) => {
    const e = el('div', `adv-mm${i === maPlace ? ' moi' : ''}${p.trouve ? ' trouve' : p.fini ? ' perdu' : ''}`);
    e.appendChild(el('strong', '', `${p.bot ? '🤖 ' : ''}${p.name}${i === maPlace ? ' (toi)' : ''}`));
    const etatTxt = p.trouve ? `✓ trouvé en ${p.essais.length}` : p.abandon ? 'abandon' : p.fini ? '✗ raté' : etat.status === 'codes' ? (p.code ? 'code caché ✓' : 'choisit son code…') : `${p.essais.length} / ${max}`;
    e.appendChild(el('span', '', etatTxt));
    if (p.victoires) e.appendChild(el('span', 'trophees-mm', `🏆 ${p.victoires}`));
    zone.appendChild(e);
  });
}

function rendreStatut() {
  const st = $('statut');
  const p = moi();
  let t = '';
  if (etat.status === 'codes') t = p.code ? `Code caché ! En attente de ${etat.players[R.adversaire(etat, maPlace)].name}…` : `Compose le code secret que ${etat.players[R.adversaire(etat, maPlace)].name} devra trouver.`;
  else if (etat.status === 'jeu') {
    if (p.trouve) t = `Bravo, trouvé en ${p.essais.length} essai${p.essais.length > 1 ? 's' : ''} ! En attente des autres…`;
    else if (p.fini) t = 'Ta partie est finie. En attente des autres…';
    else {
      const reste = r().essais - p.essais.length;
      t = `Essai ${p.essais.length + 1} sur ${r().essais} · ${reste > 1 ? `${reste} essais restants` : 'dernier essai !'}`;
    }
  } else if (etat.status === 'fin') t = 'Partie terminée.';
  st.textContent = t;
}

function rendrePlateau() {
  const zone = $('rangees');
  zone.innerHTML = '';
  const p = moi();
  const L = r().longueur;
  const max = r().essais;
  const composition = choixCode();
  const lignes = composition ? 1 : max;
  for (let k = 0; k < lignes; k++) {
    const ligne = el('div', 'rangee-mm');
    const e = composition ? null : p.essais[k];
    const courante = composition || (!e && k === p.essais.length && peutJouer());
    if (courante) ligne.classList.add('courante');
    ligne.appendChild(el('span', 'num-mm', composition ? '🔒' : String(k + 1)));
    const pions = el('span', 'pions-mm');
    for (let j = 0; j < L; j++) {
      const c = e ? e.c[j] : courante ? rangee[j] : null;
      const pe = pionEl(c);
      if (courante && c) {
        pe.classList.add('retirable');
        pe.addEventListener('click', () => { rangee = rangee.filter((_, x) => x !== j); rendreJeu(); });
      }
      if (e && precedent && k === p.essais.length - 1 && precedent.players[maPlace] && precedent.players[maPlace].essais.length === k) pe.classList.add('pose');
      pions.appendChild(pe);
    }
    ligne.appendChild(pions);
    if (!composition) {
      const f = e ? fichesEl(e.noirs, e.blancs, L) : fichesEl(0, 0, L);
      if (!e) f.classList.add('vides');
      else if (precedent && k === p.essais.length - 1 && precedent.players[maPlace] && precedent.players[maPlace].essais.length === k) f.classList.add('nouvelles');
      ligne.appendChild(f);
    }
    zone.appendChild(ligne);
  }
  // le code caché (révélé à la fin, ou quand ma partie est finie)
  const cache = $('cache');
  cache.innerHTML = '';
  const code = composition ? null : R.cible(etat, maPlace);
  const revele = etat.status === 'fin' || (p.fini && etat.status === 'jeu');
  cache.appendChild(el('span', 'num-mm', revele ? '🔓' : '🔒'));
  const pions = el('span', 'pions-mm');
  for (let j = 0; j < L; j++) pions.appendChild(pionEl(revele && code ? code[j] : null, revele ? '' : 'cache'));
  cache.appendChild(pions);
  cache.appendChild(el('span', 'cache-txt', composition ? 'Ton code secret' : revele ? 'Le code' : 'Code secret'));
  cache.hidden = etat.status === 'codes';
}

function rendrePalette() {
  const pal = $('palette');
  pal.innerHTML = '';
  const actif = peutJouer() || choixCode();
  $('commandes').classList.toggle('inactif', !actif);
  R.palette(etat).forEach((c, k) => {
    const b = el('button', 'couleur-mm');
    b.type = 'button';
    b.dataset.c = c;
    b.setAttribute('aria-label', R.NOMS_COULEURS[c]);
    b.title = `${R.NOMS_COULEURS[c]} (touche ${k + 1})`;
    b.disabled = !actif || (!r().doublons && rangee.includes(c));
    b.addEventListener('click', () => ajouter(c));
    pal.appendChild(b);
  });
  $('btn-valider').disabled = !actif || rangee.length !== r().longueur;
  $('btn-valider').textContent = choixCode() ? 'Cacher ce code' : 'Valider';
  $('btn-effacer').disabled = !actif || !rangee.length;
  $('btn-abandon').hidden = !peutJouer();
}

// Duel : les essais de l'autre sur mon code
function rendreCote() {
  const cote = $('cote');
  const duel = etat.mode === 'duel' && etat.players.length === 2;
  cote.hidden = !duel || etat.status === 'codes';
  if (cote.hidden) return;
  const a = R.adversaire(etat, maPlace);
  const pa = etat.players[a];
  $('cote-titre').textContent = `${pa.name} cherche ton code`;
  const mc = $('mon-code');
  mc.innerHTML = '';
  const pions = el('span', 'pions-mm');
  (moi().code || []).forEach((c) => pions.appendChild(pionEl(c)));
  mc.appendChild(pions);
  const zone = $('rangees-adverses');
  zone.innerHTML = '';
  pa.essais.forEach((e, k) => {
    const ligne = el('div', 'rangee-mm');
    ligne.appendChild(el('span', 'num-mm', String(k + 1)));
    const ps = el('span', 'pions-mm');
    e.c.forEach((c) => ps.appendChild(pionEl(c)));
    ligne.append(ps, fichesEl(e.noirs, e.blancs, r().longueur));
    zone.appendChild(ligne);
  });
  if (!pa.essais.length) zone.appendChild(el('p', 'vide-mm', 'Pas encore d\'essai.'));
}

function rendreFin() {
  const voile = $('fin');
  if (etat.status !== 'fin' || finMasquee) {
    voile.hidden = true;
    let b = document.getElementById('btn-reouvrir');
    if (etat.status === 'fin' && !b) {
      b = el('button', 'btn-mm principal', 'Voir le résultat');
      b.id = 'btn-reouvrir';
      b.addEventListener('click', () => { finMasquee = false; rendre(); });
      $('statut').after(b);
    } else if (etat.status !== 'fin' && b) b.remove();
    return;
  }
  const b = document.getElementById('btn-reouvrir');
  if (b) b.remove();
  voile.hidden = false;
  const g = etat.gagnants || [];
  const seul = etat.players.length === 1;
  let titre;
  if (seul) titre = moi().trouve ? `Trouvé en ${moi().essais.length} essai${moi().essais.length > 1 ? 's' : ''} !` : 'Raté !';
  else if (!g.length) titre = 'Personne n\'a trouvé !';
  else if (g.length > 1) titre = g.includes(maPlace) ? 'Égalité !' : `Égalité : ${g.map((i) => etat.players[i].name).join(' et ')}`;
  else titre = g[0] === maPlace ? 'Tu as gagné !' : `${etat.players[g[0]].name} gagne !`;
  $('fin-titre').textContent = titre;
  $('fin-texte').textContent = etat.mode === 'duel' ? 'Le code que tu cherchais :' : 'Le code secret :';
  const fc = $('fin-code');
  fc.innerHTML = '';
  (R.cible(etat, maPlace) || []).forEach((c, k) => {
    const p = pionEl(c);
    p.style.animationDelay = `${k * 120}ms`;
    p.classList.add('revele');
    fc.appendChild(p);
  });
  const ol = $('fin-classement');
  ol.innerHTML = '';
  ol.hidden = seul;
  (etat.classement || []).forEach((i, k) => {
    const p = etat.players[i];
    const li = el('li', g.includes(i) ? 'gagnant' : '');
    li.append(el('span', 'rang', g.includes(i) ? '🏆' : `${k + 1}.`), el('span', 'nom', p.name + (i === maPlace ? ' (toi)' : '')),
      el('b', '', p.trouve ? `${p.essais.length} essai${p.essais.length > 1 ? 's' : ''}` : p.abandon ? 'abandon' : 'raté'));
    ol.appendChild(li);
  });
  $('btn-revanche').textContent = seul ? 'Nouvelle partie' : 'Revanche';
}

function rendreJeu() {
  rendrePlateau();
  rendrePalette();
}
function rendre() {
  if (!etat || !etat.players[maPlace]) return;
  rendreAdversaires();
  rendreStatut();
  rendreJeu();
  rendreCote();
  rendreFin();
  // message quand quelqu'un trouve
  if (precedent) {
    etat.players.forEach((p, i) => {
      const q = precedent.players[i];
      if (i !== maPlace && p.trouve && q && !q.trouve) toast(`${p.name} a trouvé en ${p.essais.length} essai${p.essais.length > 1 ? 's' : ''} !`);
    });
  }
}
