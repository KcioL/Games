import { $, el, toast, initSalon, initRegles } from '../commun/salon.js';
import * as R from './regles.js';

let etat = null;
let maPlace = 0;
let precedent = null;
let modeDrapeau = false;
let finMasquee = false;

// ---------- Records (sur ce téléphone) ----------
const CLE_RECORDS = 'jeux-vol:demineur-records';
const lireRecords = () => { try { return JSON.parse(localStorage.getItem(CLE_RECORDS)) || {}; } catch (e) { return {}; } };
const ecrireRecords = (r) => { try { localStorage.setItem(CLE_RECORDS, JSON.stringify(r)); } catch (e) { /* rien */ } };
const temps = (ms) => {
  const s = Math.max(0, ms) / 1000;
  return s < 60 ? `${s.toFixed(1).replace('.', ',')} s` : `${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
function afficherRecords() {
  const r = lireRecords();
  const zone = $('records');
  zone.innerHTML = '';
  const lignes = Object.entries(R.NIVEAUX).filter(([k]) => r[k]);
  if (!lignes.length) return;
  zone.appendChild(el('p', 'records-titre', '🏆 Tes meilleurs temps'));
  lignes.forEach(([k, nv]) => zone.appendChild(el('p', '', `${nv.nom} : ${temps(r[k])}`)));
}
afficherRecords();

const niveauChoisi = () => (document.querySelector('input[name="niveau"]:checked') || {}).value || 'debutant';

const salon = initSalon({
  jeu: 'demineur',
  etatInitial: (nom, nb, { local }) => ({
    players: Array.from({ length: local ? 1 : nb }, (_, i) => ({ name: i === 0 ? nom : 'En attente', joined: i === 0 })),
    mode: local ? 'solo' : 'course',
    options: { niveau: niveauChoisi() },
  }),
  demarrer: (s) => R.nouvellePartie(s),
  afficher: (s, place) => {
    precedent = etat && etat.partie === s.partie && place === maPlace ? etat : null;
    if (!precedent) finMasquee = false;
    etat = R.normaliser(s);
    maPlace = place;
    rendre();
  },
  quiDoitJouer: () => -1,
  secret: false,
});
initRegles();
const agir = (fn) => salon.agir((s) => fn(R.normaliser(s)));
const moi = () => etat.players[maPlace];
const course = () => etat.mode === 'course';

// ---------- La grille ----------
const grilleEl = $('grille');
let cases = [];
let grilleVue = '';
let transpose = false;

function construireGrille() {
  const g = etat.grille;
  const cadre = $('cadre');
  // téléphone debout et grille plus large que haute : on la tourne
  const portrait = window.innerHeight > window.innerWidth;
  const tr = portrait && g.l > g.h;
  const cle = `${etat.partie}-${g.l}x${g.h}-${tr}`;
  const col = tr ? g.h : g.l;
  const lig = tr ? g.l : g.h;
  // taille des cases : tout doit tenir dans l'écran
  const dispoL = Math.min(cadre.parentElement.clientWidth, 1100) - 16;
  const haut = document.querySelector('.barre') ? document.querySelector('.barre').offsetHeight : 57;
  const dispoH = window.innerHeight - haut - 190 - (course() ? 44 : 0);
  const taille = Math.max(18, Math.min(44, Math.floor(dispoL / col), Math.floor(dispoH / lig)));
  grilleEl.style.setProperty('--c', `${taille}px`);
  grilleEl.style.gridTemplateColumns = `repeat(${col}, var(--c))`;
  if (cle === grilleVue && cases.length) return;
  grilleVue = cle;
  transpose = tr;
  grilleEl.innerHTML = '';
  cases = [];
  for (let k = 0; k < g.l * g.h; k++) {
    const x = k % g.l; const y = Math.floor(k / g.l);
    const c = el('button', 'case-dm');
    c.type = 'button';
    c.dataset.k = String(k);
    c.style.gridColumn = String((tr ? y : x) + 1);
    c.style.gridRow = String((tr ? x : y) + 1);
    if ((x + y) % 2) c.classList.add('impair');
    brancher(c, k);
    grilleEl.appendChild(c);
    cases.push(c);
  }
}
window.addEventListener('resize', () => { if (etat && etat.grille) { grilleVue = ''; construireGrille(); rendreGrille(); } });

// appui court : creuser (ou drapeau en mode drapeau) ; appui long ou clic droit : drapeau
function brancher(c, k) {
  let minuterie = null;
  let long = false;
  c.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return;
    long = false;
    clearTimeout(minuterie);
    minuterie = setTimeout(() => {
      long = true;
      if (navigator.vibrate) navigator.vibrate(30);
      action(k, 'drapeau');
    }, 380);
  });
  const annuler = () => { clearTimeout(minuterie); minuterie = null; };
  c.addEventListener('pointerleave', annuler);
  c.addEventListener('pointercancel', annuler);
  c.addEventListener('pointerup', annuler);
  c.addEventListener('click', (e) => {
    e.preventDefault();
    if (long) { long = false; return; }
    action(k, modeDrapeau ? 'drapeau' : 'creuser');
  });
  c.addEventListener('contextmenu', (e) => { e.preventDefault(); annuler(); if (!long) action(k, 'drapeau'); long = false; });
}

let derniereAction = -1;
function action(k, quoi) {
  if (!etat || etat.status !== 'jeu' || moi().etat !== 'jeu') return;
  const v = moi().vue[k];
  derniereAction = k;
  if (quoi === 'drapeau') {
    if (v === 'o') { agir((s) => R.accord(s, maPlace, k)); return; }
    agir((s) => R.drapeau(s, maPlace, k));
    return;
  }
  if (v === 'f') return; // une case avec drapeau ne se creuse pas
  if (v === 'o') { agir((s) => R.accord(s, maPlace, k)); return; }
  agir((s) => R.ouvrir(s, maPlace, k));
}

function rendreGrille() {
  const g = etat.grille;
  const p = moi();
  const ch = g.pret ? R.chiffres(g) : null;
  const avant = precedent && precedent.players[maPlace] ? precedent.players[maPlace].vue : null;
  const fini = p.etat !== 'jeu';
  const mines = new Set(g.mines);
  const origine = derniereAction >= 0 ? derniereAction : etat.depart;
  const ox = origine >= 0 ? origine % g.l : 0; const oy = origine >= 0 ? Math.floor(origine / g.l) : 0;
  let ordreBoum = 0;
  cases.forEach((c, k) => {
    const v = p.vue[k];
    c.className = `case-dm${((k % g.l) + Math.floor(k / g.l)) % 2 ? ' impair' : ''}`;
    c.textContent = '';
    c.disabled = false;
    if (v === 'o') {
      c.classList.add('ouverte');
      if (ch && ch[k] > 0) { c.textContent = String(ch[k]); c.classList.add(`n${ch[k]}`); }
      if (ch && ch[k] === -1) { c.classList.add('boum'); c.textContent = '💥'; }
      // les cases qui viennent de s'ouvrir apparaissent en vague autour du doigt
      if (avant && avant[k] !== 'o') {
        const d = Math.hypot((k % g.l) - ox, Math.floor(k / g.l) - oy);
        c.style.animationDelay = `${Math.min(500, d * 28)}ms`;
        c.classList.add('apparait');
      } else c.style.animationDelay = '';
    } else if (v === 'f') {
      c.classList.add('drapeau');
      c.textContent = '🚩';
      if (p.etat === 'perdu' && !mines.has(k)) { c.classList.add('faux'); c.textContent = '❌'; }
    }
    // partie perdue : on montre les mines
    if (p.etat === 'perdu' && v === '.' && mines.has(k)) {
      c.classList.add('mine');
      c.textContent = '💣';
      if (avant && avant.indexOf('o') >= 0 && precedent.players[maPlace].etat === 'jeu') c.style.animationDelay = `${150 + (ordreBoum++) * 25}ms`;
    }
    if (fini) c.disabled = true;
    c.setAttribute('aria-label', v === 'o' ? (ch && ch[k] > 0 ? `${ch[k]}` : 'vide') : v === 'f' ? 'drapeau' : 'case fermée');
  });
  if (p.etat === 'perdu' && precedent && precedent.players[maPlace] && precedent.players[maPlace].etat === 'jeu') {
    $('cadre').animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,3px)' }, { transform: 'translate(5px,-4px)' }, { transform: 'translate(-3px,2px)' }, { transform: 'none' }], { duration: 420 });
  }
}

// ---------- Barre : mines, visage, chrono ----------
let chronoMinuterie = null;
function rendreBarre() {
  const g = etat.grille;
  const p = moi();
  $('mines').textContent = `💣 ${g.n - R.nbDrapeaux(p)}`;
  const visage = p.etat === 'gagne' ? '😎' : p.etat === 'perdu' ? '😵' : '🙂';
  $('btn-visage').textContent = visage;
  $('btn-visage').disabled = course() && etat.status !== 'fin';
  $('btn-visage').title = course() ? 'Revanche (à la fin de la course)' : 'Nouvelle partie';
  clearInterval(chronoMinuterie);
  const maj = () => {
    const q = moi();
    const t = q.temps !== null && q.temps !== undefined ? q.temps : q.debut ? Date.now() - q.debut : 0;
    $('chrono').textContent = `⏱ ${Math.floor(t / 1000)}`;
  };
  maj();
  if (p.etat === 'jeu' && p.debut) chronoMinuterie = setInterval(maj, 250);
}
$('btn-visage').addEventListener('click', () => {
  if (course() && etat.status !== 'fin') return;
  if (!course() && moi().etat === 'jeu' && moi().debut && !confirm('Recommencer une nouvelle grille ?')) return;
  derniereAction = -1;
  agir((s) => R.nouvellePartie(s));
});
function choisirMode(drapeau) {
  modeDrapeau = drapeau;
  $('mode-creuser').classList.toggle('actif', !drapeau);
  $('mode-drapeau').classList.toggle('actif', drapeau);
  $('mode-creuser').setAttribute('aria-pressed', String(!drapeau));
  $('mode-drapeau').setAttribute('aria-pressed', String(drapeau));
  $('aide').textContent = drapeau ? 'Mode drapeau : un appui pose ou enlève un drapeau.' : 'Appui long (ou clic droit) : poser un drapeau.';
}
$('mode-creuser').addEventListener('click', () => choisirMode(false));
$('mode-drapeau').addEventListener('click', () => choisirMode(true));
$('btn-abandon').addEventListener('click', () => { if (confirm('Abandonner la course ?')) agir((s) => R.abandonner(s, maPlace)); });

// ---------- Course : les autres joueurs ----------
function rendreAdversaires() {
  const zone = $('adversaires');
  zone.hidden = !course();
  if (!course()) return;
  zone.innerHTML = '';
  const g = etat.grille;
  const total = g.l * g.h - g.n;
  etat.players.forEach((p, i) => {
    const e = el('div', `adv-dm${i === maPlace ? ' moi' : ''} ${p.etat}`);
    const pct = Math.round((R.nbOuvertes(p) / total) * 100);
    e.appendChild(el('strong', '', `${p.name}${i === maPlace ? ' (toi)' : ''}`));
    e.appendChild(el('span', '', p.etat === 'gagne' ? `✓ ${temps(p.temps)}` : p.etat === 'perdu' ? (p.abandon ? 'abandon' : '💥 boum') : `${pct} %`));
    if (p.victoires) e.appendChild(el('span', 'trophees-dm', `🏆 ${p.victoires}`));
    const barre = el('i', 'progres-dm');
    barre.style.width = `${pct}%`;
    e.appendChild(barre);
    zone.appendChild(e);
  });
}

// ---------- Fin ----------
function rendreFin() {
  const voile = $('fin');
  const p = moi();
  const solo = !course();
  const finiSolo = solo && p.etat !== 'jeu';
  const visible = (finiSolo || (course() && etat.status === 'fin')) && !finMasquee;
  $('btn-abandon').hidden = !course() || p.etat !== 'jeu' || etat.status !== 'jeu';
  if (!visible) { voile.hidden = true; return; }
  const montrer = () => { voile.hidden = false; };
  const nouveau = precedent && precedent.players[maPlace] && (precedent.players[maPlace].etat === 'jeu' || precedent.status !== 'fin');
  if (voile.hidden && nouveau) setTimeout(montrer, p.etat === 'perdu' ? 1300 : 700); else montrer();
  const ol = $('fin-classement');
  ol.innerHTML = '';
  if (solo) {
    ol.hidden = true;
    const nv = R.niveau(etat);
    if (p.etat === 'gagne') {
      $('fin-ico').textContent = '🎉';
      $('fin-titre').textContent = 'Grille déminée !';
      const rec = lireRecords();
      const cleNv = etat.options.niveau || 'debutant';
      let texte = `${nv.nom} en ${temps(p.temps)}.`;
      if (cleRecordVu !== `${etat.partie}`) {
        cleRecordVu = `${etat.partie}`;
        if (!rec[cleNv] || p.temps < rec[cleNv]) { nouveauRecord = rec[cleNv] ? 'Nouveau record !' : 'Premier record !'; rec[cleNv] = p.temps; ecrireRecords(rec); afficherRecords(); } else nouveauRecord = `Record : ${temps(rec[cleNv])}`;
      }
      $('fin-texte').textContent = `${texte} ${nouveauRecord}`;
    } else {
      $('fin-ico').textContent = '💥';
      $('fin-titre').textContent = 'Boum !';
      const g = etat.grille;
      $('fin-texte').textContent = `Tu avais ouvert ${R.nbOuvertes(p)} cases sur ${g.l * g.h - g.n}.`;
    }
    $('btn-rejouer').textContent = 'Nouvelle grille';
    return;
  }
  ol.hidden = false;
  const gagnant = etat.gagnant;
  const quelquUn = etat.players.some((q) => q.etat === 'gagne');
  $('fin-ico').textContent = gagnant === maPlace ? '🏆' : quelquUn ? '🏁' : '💥';
  $('fin-titre').textContent = gagnant === maPlace ? 'Tu as gagné la course !' : gagnant >= 0 ? `${etat.players[gagnant].name} gagne la course !` : 'Tout le monde a sauté !';
  $('fin-texte').textContent = quelquUn ? '' : 'Personne n\'a tout déminé : le classement se fait aux cases ouvertes.';
  const g = etat.grille;
  (etat.classement || []).forEach((i, k) => {
    const q = etat.players[i];
    const li = el('li', i === gagnant ? 'gagnant' : '');
    li.append(el('span', 'rang', ['🥇', '🥈', '🥉'][k] || `${k + 1}.`), el('span', 'nom', q.name + (i === maPlace ? ' (toi)' : '')),
      el('b', '', q.etat === 'gagne' ? temps(q.temps) : `${Math.round((R.nbOuvertes(q) / (g.l * g.h - g.n)) * 100)} %`));
    ol.appendChild(li);
  });
  $('btn-rejouer').textContent = 'Revanche';
}
let cleRecordVu = '';
let nouveauRecord = '';
$('btn-rejouer').addEventListener('click', () => {
  derniereAction = -1;
  agir((s) => {
    if (s.mode === 'course' && s.status !== 'fin') return false;
    return R.nouvellePartie(s);
  });
});
$('btn-voir').addEventListener('click', () => { finMasquee = true; $('fin').hidden = true; });

// ---------- Affichage ----------
function rendre() {
  if (!etat || !etat.players[maPlace] || !etat.grille) return;
  // course : mon chrono part quand la grille s'affiche chez moi
  if (course() && etat.status === 'jeu' && moi().etat === 'jeu' && !moi().debut) agir((s) => R.commencer(s, maPlace));
  if (!precedent) derniereAction = -1;
  construireGrille();
  rendreGrille();
  rendreBarre();
  rendreAdversaires();
  rendreFin();
  if (precedent && course()) {
    etat.players.forEach((q, i) => {
      const a = precedent.players[i];
      if (i === maPlace || !a || a.etat === q.etat) return;
      if (q.etat === 'gagne') toast(`${q.name} a tout déminé en ${temps(q.temps)} !`);
      else if (q.etat === 'perdu' && !q.abandon) toast(`💥 ${q.name} a sauté sur une mine !`);
    });
  }
}
