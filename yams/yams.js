import { $, el, toast, initSalon, initRegles } from '../commun/salon.js';
import * as R from './regles.js';

const NOMS_BOTS = ['Robotine', 'Bip-Bop', 'Dédé', 'Lucky', 'Yamsy', 'Turbo'];
const CLE_RECORD = 'jeux-vol:yams-record';

let etat = null;
let maPlace = 0;
let precedent = null;   // état précédent (animations)
let finMasquee = false;
let zeroArme = null;    // case à 0 touchée une fois : il faut confirmer
let recordVu = '';

// ---------- Accueil ----------
const lireOptions = () => ({
  bonusYams: $('opt-bonus-yams').checked,
  niveau: $('opt-niveau').value,
});
const melanger = (t) => { const a = [...t]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const salon = initSalon({
  jeu: 'yams',
  etatInitial: (nom, nb, { local }) => {
    const joueur = (name, joined, bot = false) => ({ name, joined, bot, victoires: 0 });
    const bots = parseInt($(local ? 'local-bots' : 'ligne-bots').value, 10) || 0;
    const joueurs = Array.from({ length: nb }, (_, i) => joueur(i === 0 ? nom : 'En attente', i === 0 || local));
    melanger(NOMS_BOTS).slice(0, bots).forEach((n) => joueurs.push(joueur(n, true, true)));
    return { players: joueurs, options: lireOptions() };
  },
  validerLocal: () => {
    const total = parseInt($('local-nb').value, 10) + parseInt($('local-bots').value, 10);
    if (total > 8) return '8 joueurs maximum (bots compris).';
    return '';
  },
  validerEnLigne: () => {
    const total = parseInt($('nb-joueurs').value, 10) + parseInt($('ligne-bots').value, 10);
    if (total > 8) return '8 joueurs maximum (bots compris).';
    return '';
  },
  demarrer: (s) => R.nouvellePartie(s),
  afficher: (s, place) => {
    precedent = etat && etat.partie === s.partie ? etat : null;
    if (!precedent) finMasquee = false;
    etat = R.normaliser(s);
    maPlace = place;
    if (!precedent || precedent.coup !== etat.coup) zeroArme = null;
    noterChangement();
    rendre();
    planifierBot();
  },
  // sur un seul téléphone : c'est au joueur humain dont c'est le tour d'avoir le téléphone (rien de secret)
  quiDoitJouer: (s) => (s.status === 'jeu' && s.players[s.active] && !s.players[s.active].bot ? s.active : -1),
  secret: false,
});
initRegles();
const agir = (fn) => salon.agir((s) => fn(R.normaliser(s)));

// ---------- Bots ----------
let botPrevu = '';
const botAttendu = (s) => (s && s.status === 'jeu' && s.players[s.active] && s.players[s.active].bot ? s.active : -1);
function planifierBot(force = false) {
  const i = botAttendu(etat);
  if (i < 0) return;
  // en ligne, c'est le créateur du salon qui fait jouer les bots (les autres prennent le relais s'il est parti)
  if (!salon.estLocal() && maPlace !== 0 && !force) return;
  const cle = `${etat.partie}-${etat.coup}`;
  if (botPrevu === cle) return;
  botPrevu = cle;
  const coup = etat.coup;
  const c = R.coupBot(etat, i);
  const delai = c.type === 'lancer' ? 650 + Math.random() * 350 : c.type === 'garder' ? 300 + Math.random() * 150 : 900 + Math.random() * 400;
  setTimeout(() => agir((s) => {
    if (s.coup !== coup || botAttendu(s) !== i) return false;
    const k = R.coupBot(s, i);
    if (k.type === 'lancer') return R.lancer(s, i);
    if (k.type === 'garder') return R.garder(s, i, k.k);
    return R.inscrire(s, i, k.id);
  }), delai);
}
let dernierChangement = Date.now();
let dernierCoup = null;
function noterChangement() {
  const cle = `${etat.partie}-${etat.coup}`;
  if (cle !== dernierCoup) { dernierCoup = cle; dernierChangement = Date.now(); }
}
setInterval(() => {
  if (!etat || botAttendu(etat) < 0 || Date.now() - dernierChangement < 5000) return;
  dernierChangement = Date.now();
  botPrevu = '';
  planifierBot(true);
}, 1500);

// ---------- Outils ----------
const moi = () => etat.players[maPlace];
const aMoi = () => etat.status === 'jeu' && etat.active === maPlace && !moi().bot;
const peutGarder = () => aMoi() && etat.lancers >= 1 && etat.lancers < 3;
const peutLancer = () => aMoi() && etat.lancers < 3 && !(etat.lancers > 0 && etat.gardes.every(Boolean));
const peutInscrire = () => aMoi() && etat.lancers >= 1;
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// positions des points sur un dé (cases 1 à 9 d'une grille 3 × 3)
const POINTS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
function faceDe(v, cls = '') {
  const d = el('span', `face-ym ${cls}`.trim());
  d.dataset.v = v;
  (POINTS[v] || []).forEach((n) => {
    const p = el('i');
    p.style.gridArea = `${Math.ceil(n / 3)} / ${((n - 1) % 3) + 1}`;
    d.appendChild(p);
  });
  return d;
}

// ---------- Commandes ----------
function lancerDes() {
  if (!peutLancer()) return;
  agir((s) => R.lancer(s, maPlace));
}
function garderDe(k) {
  if (!peutGarder()) return;
  etat.gardes[k] = !etat.gardes[k]; // tout de suite à l'écran, la base suit
  rendrePiste();
  agir((s) => {
    if (s.lancers < 1 || s.lancers >= 3 || s.active !== maPlace) return false;
    if (!!s.gardes[k] === etat.gardes[k]) return false;
    return R.garder(s, maPlace, k);
  });
}
function inscrireCase(id) {
  if (!peutInscrire()) return;
  const pts = R.points(id, etat.des);
  if (pts === 0 && zeroArme !== id) { zeroArme = id; rendreFeuille(); return; }
  zeroArme = null;
  const coup = etat.coup;
  agir((s) => (s.coup === coup ? R.inscrire(s, maPlace, id) : false));
}
$('btn-lancer').addEventListener('click', lancerDes);
$('btn-revanche').addEventListener('click', () => agir((s) => (s.status === 'fin' ? R.nouvellePartie(s) : false)));
$('btn-voir').addEventListener('click', () => { finMasquee = true; rendre(); });
document.addEventListener('keydown', (e) => {
  if (!etat || $('jeu').hidden || document.querySelector('dialog[open]')) return;
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key === ' ') { e.preventDefault(); lancerDes(); }
  const k = parseInt(e.key, 10);
  if (k >= 1 && k <= 5) garderDe(k - 1);
});

// ---------- Affichage ----------
function rendreStatut() {
  const st = $('statut');
  const aide = $('aide');
  let t = '';
  let a = '';
  if (etat.status === 'fin') t = 'Partie terminée !';
  else {
    const p = etat.players[etat.active];
    const tour = `Tour ${Math.min(etat.tour, 13)} / 13`;
    if (aMoi()) {
      const plusieurs = etat.players.filter((q) => !q.bot).length > 1 && salon.estLocal();
      t = `${tour} · ${plusieurs ? `À toi, ${p.name} !` : 'À toi de jouer !'}`;
      if (etat.lancers === 0) a = 'Lance les dés.';
      else if (etat.lancers < 3) a = `Touche les dés à garder, relance (${pluriel(3 - etat.lancers, 'lancer')} restant${3 - etat.lancers > 1 ? 's' : ''}) ou choisis une case.`;
      else a = 'Choisis une case sur ta feuille.';
    } else {
      t = `${tour} · ${p.bot ? '🤖 ' : ''}${p.name} joue…`;
      a = etat.lancers ? `Lancer ${etat.lancers} sur 3` : '';
    }
  }
  st.textContent = t;
  aide.textContent = a;
}

function rendrePiste() {
  const zone = $('des');
  zone.innerHTML = '';
  const actif = etat.status === 'jeu';
  const avantLancer = actif && etat.lancers === 0;
  // les dés qui viennent d'être lancés roulent
  const vientDeLancer = precedent && actif && etat.lancers > 0
    && (precedent.lancers !== etat.lancers || precedent.active !== etat.active) && precedent.coup !== etat.coup;
  etat.des.forEach((v, k) => {
    const b = el('button', 'de-ym');
    b.type = 'button';
    const garde = etat.lancers > 0 && etat.lancers < 3 && etat.gardes[k];
    b.classList.toggle('garde', garde);
    b.classList.toggle('attente', avantLancer || !actif);
    const avantGarde = precedent && precedent.gardes && precedent.lancers > 0 && precedent.lancers < 3 && precedent.gardes[k] && precedent.active === etat.active;
    if (vientDeLancer && !avantGarde) {
      b.classList.add('roule');
      b.style.animationDelay = `${k * 40}ms`;
    }
    b.appendChild(faceDe(v));
    b.disabled = !peutGarder();
    b.setAttribute('aria-label', `Dé ${k + 1} : ${v}${garde ? ', gardé' : ''}`);
    b.setAttribute('aria-pressed', String(!!garde));
    b.addEventListener('click', () => garderDe(k));
    zone.appendChild(b);
  });
  const btn = $('btn-lancer');
  btn.hidden = !aMoi();
  btn.disabled = !peutLancer();
  const reste = 3 - etat.lancers;
  btn.textContent = etat.lancers === 0 ? '🎲 Lancer les dés' : reste > 0 ? `🎲 Relancer · ${pluriel(reste, 'lancer')} restant${reste > 1 ? 's' : ''}` : 'Plus de lancer : choisis une case';
  // les lancers déjà faits
  const piste = document.querySelector('.piste-ym');
  piste.classList.toggle('a-moi', aMoi());
  piste.dataset.lancers = etat.lancers;
}

function cellule(tag, cls, txt) { const c = el(tag, cls, txt); return c; }

function rendreFeuille() {
  const t = $('feuille');
  t.innerHTML = '';
  const n = etat.players.length;
  t.style.setProperty('--nb', n);
  const nouveau = etat.dernier && (!precedent || !precedent.dernier || precedent.dernier.n !== etat.dernier.n) ? etat.dernier : null;
  // en-tête : les joueurs
  const thead = el('thead');
  const tr = el('tr');
  tr.appendChild(cellule('th', 'coin-ym', ''));
  etat.players.forEach((p, i) => {
    const th = el('th', 'joueur-ym');
    if (i === etat.active && etat.status === 'jeu') th.classList.add('actif');
    if (i === maPlace) th.classList.add('moi');
    th.appendChild(el('span', 'nom-ym', `${p.bot ? '🤖 ' : ''}${p.name}`));
    if (p.victoires) th.appendChild(el('span', 'trophees-ym', `🏆 ${p.victoires}`));
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  t.appendChild(thead);

  const tbody = el('tbody');
  const ligne = (cls, libelle, contenu) => {
    const r = el('tr', cls);
    const th = el('th', 'case-ym');
    if (libelle instanceof Node) th.appendChild(libelle); else th.textContent = libelle;
    r.appendChild(th);
    etat.players.forEach((p, i) => {
      const td = el('td');
      if (i === etat.active && etat.status === 'jeu') td.classList.add('actif');
      if (i === maPlace) td.classList.add('moi');
      contenu(td, p, i);
      r.appendChild(td);
    });
    tbody.appendChild(r);
  };
  const caseJeu = (c) => {
    const libelle = el('span', 'libelle-ym');
    if (c.haut) libelle.appendChild(faceDe(c.haut, 'mini'));
    libelle.appendChild(el('span', '', c.nom));
    libelle.title = c.aide;
    ligne(c.haut ? 'haut' : 'bas', libelle, (td, p, i) => {
      const v = p.feuille[c.id];
      if (v !== undefined && v !== null) {
        td.appendChild(el('span', `ecrit-ym${v === 0 ? ' raye' : ''}`, v === 0 ? '—' : String(v)));
        if (nouveau && nouveau.j === i && nouveau.id === c.id) td.classList.add('nouveau');
        return;
      }
      if (i === etat.active && i === maPlace && peutInscrire()) {
        const pts = R.points(c.id, etat.des);
        const b = el('button', `possible-ym${pts === 0 ? ' zero' : ''}${zeroArme === c.id ? ' arme' : ''}`, zeroArme === c.id ? 'Barrer ?' : String(pts));
        b.type = 'button';
        b.title = pts === 0 ? `Barrer ${c.nom} (0 point)` : `Inscrire ${pts} en ${c.nom}`;
        if (R.yamsEnPlus(etat, p, etat.des)) b.classList.add('extra');
        b.addEventListener('click', () => inscrireCase(c.id));
        td.appendChild(b);
      }
    });
  };
  R.CASES.slice(0, 6).forEach(caseJeu);
  ligne('sous-total', 'Total du haut', (td, p) => {
    const st = R.sousTotalHaut(p);
    td.textContent = `${st}`;
    td.title = `${st} / ${R.SEUIL_BONUS}`;
  });
  ligne('bonus', `Bonus (${R.SEUIL_BONUS} et +)`, (td, p) => {
    const st = R.sousTotalHaut(p);
    const plein = R.HAUT.every((id) => p.feuille[id] !== undefined && p.feuille[id] !== null);
    if (st >= R.SEUIL_BONUS) td.appendChild(el('span', 'ecrit-ym ok', `+${R.BONUS}`));
    else if (plein) td.appendChild(el('span', 'ecrit-ym raye', '—'));
    else td.appendChild(el('span', 'manque-ym', `encore ${R.SEUIL_BONUS - st}`));
  });
  R.CASES.slice(6).forEach(caseJeu);
  if (etat.options.bonusYams && etat.players.some((p) => p.bonusYams)) {
    ligne('bonus', "Yam's en plus", (td, p) => { if (p.bonusYams) td.appendChild(el('span', 'ecrit-ym ok', `+${p.bonusYams * R.BONUS_YAMS}`)); });
  }
  ligne('total', 'Total', (td, p) => { td.textContent = String(R.total(p)); });
  t.appendChild(tbody);
}

function rendreFin() {
  const voile = $('fin');
  let b = document.getElementById('btn-reouvrir');
  if (etat.status !== 'fin' || finMasquee) {
    voile.hidden = true;
    if (etat.status === 'fin' && !b) {
      b = el('button', 'btn-ym principal', 'Voir le résultat');
      b.id = 'btn-reouvrir';
      b.type = 'button';
      b.addEventListener('click', () => { finMasquee = false; rendre(); });
      document.querySelector('.actions-ym').appendChild(b);
    } else if (etat.status !== 'fin' && b) b.remove();
    return;
  }
  if (b) b.remove();
  voile.hidden = false;
  const g = etat.gagnants || [];
  const seul = etat.players.length === 1;
  let titre;
  if (seul) titre = `${R.total(moi())} points !`;
  else if (g.length > 1) titre = g.includes(maPlace) ? 'Égalité !' : `Égalité : ${g.map((i) => etat.players[i].name).join(' et ')}`;
  else titre = g[0] === maPlace && !salon.estLocal() ? 'Tu as gagné !' : `${etat.players[g[0]].name} gagne !`;
  if (!seul && salon.estLocal() && g.length === 1 && etat.players.filter((p) => !p.bot).length === 1 && g[0] === maPlace) titre = 'Tu as gagné !';
  $('fin-titre').textContent = titre;
  const ol = $('fin-classement');
  ol.innerHTML = '';
  ol.hidden = seul;
  (etat.classement || []).forEach((i, k) => {
    const p = etat.players[i];
    const li = el('li', g.includes(i) ? 'gagnant' : '');
    li.append(el('span', 'rang', g.includes(i) ? '🏆' : `${k + 1}.`), el('span', 'nom', `${p.bot ? '🤖 ' : ''}${p.name}${i === maPlace && !salon.estLocal() ? ' (toi)' : ''}`),
      el('b', '', `${R.total(p)} pts`));
    ol.appendChild(li);
  });
  // record de ce téléphone (joueurs humains)
  const rec = $('fin-record');
  const cle = `${etat.partie}-${etat.createdAt || ''}`;
  let ancien = 0;
  try { ancien = parseInt(localStorage.getItem(CLE_RECORD), 10) || 0; } catch (e) { /* rien */ }
  const humains = etat.players.filter((p) => !p.bot);
  const meilleur = Math.max(0, ...(salon.estLocal() ? humains : [moi()]).map(R.total));
  if (recordVu !== cle) {
    recordVu = cle;
    rec.dataset.ancien = ancien;
    if (meilleur > ancien) { try { localStorage.setItem(CLE_RECORD, String(meilleur)); } catch (e) { /* rien */ } }
  }
  const avant = parseInt(rec.dataset.ancien, 10) || 0;
  rec.hidden = !meilleur;
  rec.textContent = meilleur > avant ? (avant ? `Nouveau record ! (l'ancien : ${avant})` : `Record sur ce téléphone : ${meilleur}`) : `Record sur ce téléphone : ${Math.max(avant, meilleur)}`;
  rec.classList.toggle('nouveau', meilleur > avant && avant > 0);
  $('btn-revanche').textContent = seul ? 'Nouvelle partie' : 'Revanche';
}

function annoncer() {
  if (!precedent || !etat.dernier) return;
  const d = etat.dernier;
  if (precedent.dernier && precedent.dernier.n === d.n) return;
  const p = etat.players[d.j];
  if (!p) return;
  if (d.id === 'yams' && d.pts === 50) toast(`🎲 YAM'S ! ${d.j === maPlace && !salon.estLocal() ? 'Bravo !' : `pour ${p.name} !`}`, true);
  else if (d.extra) toast(`🎲 Encore un Yam's pour ${p.name} : +${R.BONUS_YAMS} !`, true);
  // bonus du haut décroché
  const q = precedent.players[d.j];
  if (q && R.bonusHaut(p) && !R.bonusHaut(q)) setTimeout(() => toast(`⭐ ${p.name} décroche le bonus de ${R.BONUS} !`), 1400);
}

function rendre() {
  if (!etat || !etat.players[maPlace]) return;
  rendreStatut();
  rendrePiste();
  rendreFeuille();
  rendreFin();
  annoncer();
}
