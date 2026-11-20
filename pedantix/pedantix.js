import { $, el, toast, initRegles, compterPartie } from '../commun/salon.js';
import { chargerSemantique, numeroDuJour, sansAccents } from '../commun/mots/semantique.js';

const CLE = 'jeux-vol:pedantix';
const CLE_PETITS = 'jeux-vol:pedantix-petits';
const API = 'https://fr.wikipedia.org/w/api.php';
const MOTS_MAX = 420;   // longueur du texte à deviner (on coupe à la fin d'un paragraphe)
const SEUIL = 0.55;     // proximité de sens à partir de laquelle un mot s'affiche en gris
// petits mots qu'on peut afficher d'office
const PETITS = new Set(('le la les l un une des de du d et à au aux en dans par pour sur avec ou où est a sont il elle ils elles '
  + 'se s sa son ses leur leurs qu que qui ce c cet cette ces ne n pas plus y été être ont était sous entre').split(' ').map((m) => sansAccents(m)));
initRegles();

let titres = [];
let sem = null;
let partie = null; // { mode, num, titre, page, url, texte, essais: [mot], trouve, abandon, compte }
let mode = 'jour';
const norm = (m) => sansAccents(String(m || '').toLowerCase());
const petitsVisibles = () => $('opt-petits').checked;
try { const v = localStorage.getItem(CLE_PETITS); if (v !== null) $('opt-petits').checked = v === '1'; } catch (e) { /* rien */ }
$('opt-petits').addEventListener('change', () => {
  try { localStorage.setItem(CLE_PETITS, $('opt-petits').checked ? '1' : '0'); } catch (e) { /* rien */ }
  if (partie) { verifierVictoire(); rendre(); }
});

// ---------- Mémoire du téléphone ----------
function lire() { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch (e) { return {}; } }
function sauver() {
  const m = lire();
  const p = { num: partie.num, titre: partie.titre, page: partie.page, url: partie.url, texte: partie.texte, essais: partie.essais, trouve: partie.trouve, abandon: partie.abandon, compte: partie.compte };
  if (partie.mode === 'jour') {
    m.jours = m.jours || {};
    m.jours[partie.num] = p;
    // on ne garde que les 30 derniers jours
    Object.keys(m.jours).map(Number).sort((a, b) => b - a).slice(30).forEach((k) => delete m.jours[k]);
  } else m.libre = p;
  try { localStorage.setItem(CLE, JSON.stringify(m)); } catch (e) { /* rien */ }
}

// ---------- Wikipédia ----------
async function extrait(titre, intro) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', prop: 'extracts|info', inprop: 'url', explaintext: '1',
    exsectionformat: 'plain', redirects: '1', titles: titre,
  });
  if (intro) params.set('exintro', '1'); else params.set('exchars', '6000');
  const r = await fetch(`${API}?${params}`);
  if (!r.ok) throw new Error('wikipédia');
  const d = await r.json();
  const pages = d.query && d.query.pages ? Object.values(d.query.pages) : [];
  const p = pages[0];
  if (!p || p.missing !== undefined || !p.extract) return null;
  return { titre: p.title, url: p.fullurl || `https://fr.wikipedia.org/wiki/${encodeURIComponent(p.title)}`, texte: p.extract };
}
// le début de l'article : l'introduction, complétée par la suite si elle est trop courte
function couper(texte) {
  const paras = texte.split(/\n+/).map((p) => p.trim())
    // titres de sections, lignes vides, prononciations…
    .filter((p) => p && /[.!?:;»)]$/.test(p) && p.split(/\s+/).length > 4);
  const garde = [];
  let n = 0;
  for (const p of paras) {
    if (n > 0 && n + p.split(/\s+/).length > MOTS_MAX) break;
    garde.push(p);
    n += p.split(/\s+/).length;
  }
  return garde.join('\n')
    .replace(/\s*\([^()]*(?:API|\/[^/]+\/|écouter|prononc)[^()]*\)/gi, '') // prononciations
    .replace(/\(\s*(?:ou|,|;|\s)*\)/g, '').replace(/ {2,}/g, ' ').replace(/ ([,.])/g, '$1');
}
async function chargerArticle(titre) {
  let a = await extrait(titre, true);
  if (!a) return null;
  if (/peut désigner|peut faire référence|homonymie/i.test(a.texte.slice(0, 400))) return null; // page d'homonymie
  if (a.texte.split(/\s+/).length < 150) {
    const plus = await extrait(titre, false);
    if (plus) a = plus;
  }
  const texte = couper(a.texte);
  if (texte.split(/\s+/).length < 40) return null;
  // le titre à deviner, sans la précision entre parenthèses : « Mars (planète) » → « Mars »
  return { page: a.titre, titre: a.titre.replace(/\s*\([^)]*\)\s*$/, ''), url: a.url, texte };
}

// ---------- Les mots du texte ----------
const MOT = /[\p{L}\p{N}]+/gu;
function decouper(t) {
  const morceaux = [];
  let i = 0;
  for (const m of t.matchAll(MOT)) {
    if (m.index > i) morceaux.push({ sep: t.slice(i, m.index) });
    morceaux.push({ mot: m[0], n: norm(m[0]) });
    i = m.index + m[0].length;
  }
  if (i < t.length) morceaux.push({ sep: t.slice(i) });
  return morceaux;
}
const trouves = () => new Set(partie.essais.map(norm));
const visible = (n, t) => t.has(n) || (petitsVisibles() && PETITS.has(n));

// proximité : pour chaque mot caché, le mot proposé le plus proche par le sens
let proches = new Map(); // n -> { mot, s }
function calculerProches() {
  proches = new Map();
  if (!sem) return;
  const t = trouves();
  const caches = new Map();
  [...partie.morceauxTexte, ...partie.morceauxTitre].forEach((m) => {
    if (m.mot && !visible(m.n, t) && !caches.has(m.n)) caches.set(m.n, sem.trouver(m.mot.toLowerCase()));
  });
  partie.essais.forEach((e) => {
    const ie = sem.trouver(e);
    const ne = norm(e);
    caches.forEach((ic, n) => {
      let s = ie >= 0 && ic >= 0 ? sem.similarite(ie, ic) : 0;
      // même famille de mots (pluriel, féminin…) : « chat » / « chats »
      if (ne.length >= 4 && n.length >= 4 && Math.abs(ne.length - n.length) <= 3 && (n.startsWith(ne) || ne.startsWith(n))) s = Math.max(s, 0.8);
      if (s >= SEUIL && (!proches.has(n) || proches.get(n).s < s)) proches.set(n, { mot: e, s });
    });
  });
}

// ---------- Démarrer ----------
function indexDuJour(n) { return ((n - 1) % titres.length + titres.length) % titres.length; }
async function demarrer(m, nouveau = false) {
  mode = m;
  $('mode-jour').setAttribute('aria-selected', String(m === 'jour'));
  $('mode-libre').setAttribute('aria-selected', String(m === 'libre'));
  const memoire = lire();
  let deja = null;
  let num;
  if (m === 'jour') { num = numeroDuJour(); deja = (memoire.jours || {})[num] || null; } else {
    deja = !nouveau && memoire.libre && !memoire.libre.trouve && !memoire.libre.abandon ? memoire.libre : null;
    const jour = indexDuJour(numeroDuJour());
    num = deja ? deja.num : (() => { let x; do x = Math.floor(Math.random() * titres.length); while (x === jour && titres.length > 1); return x; })();
  }
  partie = null;
  rendre();
  if (deja && deja.texte) {
    partie = { mode: m, ...deja };
  } else {
    setMessage('Je vais chercher l\'article sur Wikipédia…');
    let a = null;
    let k = m === 'jour' ? indexDuJour(num) : num;
    try {
      // un titre introuvable (ou une page d'homonymie) : on passe au suivant de la liste
      for (let essai = 0; essai < 6 && !a; essai++, k = (k + 1) % titres.length) a = await chargerArticle(titres[k]);
    } catch (e) {
      setMessage('Impossible de joindre Wikipédia. Vérifie ta connexion internet, puis réessaie.', true);
      return;
    }
    if (mode !== m) return; // on a changé de mode pendant le chargement
    if (!a) { setMessage('Article introuvable sur Wikipédia. Réessaie plus tard.', true); return; }
    partie = { mode: m, num, ...a, essais: [], trouve: false, abandon: false, compte: false };
    sauver();
  }
  partie.morceauxTexte = decouper(partie.texte);
  partie.morceauxTitre = decouper(partie.titre);
  partie.dernier = null;
  calculerProches();
  setMessage('');
  $('mot').disabled = fini();
  $('btn-envoyer').disabled = fini();
  rendre();
  if (!fini()) $('mot').focus({ preventScroll: true });
}
const fini = () => partie && (partie.trouve || partie.abandon);

// ---------- Proposer un mot ----------
function proposer(texte) {
  if (!partie || fini()) return;
  const mots = String(texte).match(MOT);
  if (!mots) return;
  const mot = mots[0];
  const n = norm(mot);
  if (partie.essais.some((e) => norm(e) === n)) { setMessage(`« ${mot} » est déjà proposé.`); partie.dernier = n; rendre(); return; }
  partie.essais.push(mot.toLowerCase());
  partie.dernier = n;
  if (!partie.compte) { partie.compte = true; compterPartie('pedantix', 'telephone'); }
  const nb = partie.morceauxTexte.filter((m) => m.n === n).length + partie.morceauxTitre.filter((m) => m.n === n).length;
  setMessage(nb ? `« ${mot} » : ${nb} fois dans l'article !` : `« ${mot} » n'est pas dans l'article.`, !nb);
  verifierVictoire();
  calculerProches();
  sauver();
  rendre();
}
function verifierVictoire() {
  if (!partie || partie.abandon) return;
  const t = trouves();
  if (partie.morceauxTitre.filter((m) => m.mot).every((m) => visible(m.n, t))) partie.trouve = true;
}
$('saisie').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const t = $('mot').value;
  $('mot').value = '';
  if (t.trim()) proposer(t);
});
$('btn-abandon').addEventListener('click', () => {
  if (!partie || fini() || !confirm('Abandonner et voir l\'article ?')) return;
  partie.abandon = true;
  sauver();
  rendre();
});
$('btn-nouveau').addEventListener('click', () => demarrer('libre', true));
$('mode-jour').addEventListener('click', () => { if (titres.length && mode !== 'jour') demarrer('jour'); });
$('mode-libre').addEventListener('click', () => { if (titres.length && mode !== 'libre') demarrer('libre'); });

// ---------- Affichage ----------
let minuterieMessage = null;
function setMessage(t, discret = false) {
  const m = $('message');
  m.textContent = t;
  m.classList.toggle('discret', discret);
  clearTimeout(minuterieMessage);
  if (t && partie) minuterieMessage = setTimeout(() => { m.textContent = ''; }, 3500);
}

function rendreMorceaux(zone, morceaux, tout) {
  zone.innerHTML = '';
  const t = trouves();
  morceaux.forEach((m) => {
    if (m.sep !== undefined) {
      // retours à la ligne : nouveaux paragraphes
      const bouts = m.sep.split('\n');
      bouts.forEach((b, k) => { if (k) zone.appendChild(el('span', 'para-px')); if (b) zone.appendChild(document.createTextNode(b)); });
      return;
    }
    if (tout || visible(m.n, t)) {
      const s = el('span', `vu-px${partie.dernier === m.n ? ' nouveau' : ''}`, m.mot);
      zone.appendChild(s);
      return;
    }
    const c = el('span', 'cache-px');
    c.style.minWidth = `${Math.max(1.2, m.mot.length * 0.62)}em`;
    const p = proches.get(m.n);
    if (p) {
      c.classList.add('proche');
      c.textContent = p.mot;
      // plus c'est proche, plus c'est foncé
      c.style.setProperty('--force', Math.min(1, (p.s - SEUIL) / (0.9 - SEUIL)).toFixed(2));
      if (partie.dernier === norm(p.mot)) c.classList.add('nouveau');
    }
    c.title = `${m.mot.length} lettre${m.mot.length > 1 ? 's' : ''}`;
    c.addEventListener('click', () => toast(`${m.mot.length} lettre${m.mot.length > 1 ? 's' : ''}`));
    zone.appendChild(c);
  });
}

function rendre() {
  const page = $('page');
  page.classList.toggle('chargement', !partie);
  if (!partie) {
    $('titre').innerHTML = '';
    $('texte').innerHTML = '';
    $('essais').innerHTML = '';
    $('compte').textContent = '';
    $('gagne').hidden = true;
    $('source').hidden = true;
    return;
  }
  const termine = fini();
  rendreMorceaux($('titre'), partie.morceauxTitre, termine);
  rendreMorceaux($('texte'), partie.morceauxTexte, termine);
  $('source').hidden = !termine;
  if (termine) {
    $('source').innerHTML = '';
    const a = el('a', '', 'Lire l\'article sur Wikipédia');
    a.href = partie.url; a.target = '_blank'; a.rel = 'noopener';
    $('source').append(a, ' · Texte : Wikipédia, licence CC BY-SA');
  }
  // les mots proposés (le dernier en haut) et combien de fois on les a trouvés
  const t = trouves();
  const total = partie.morceauxTexte.filter((m) => m.mot).length;
  const vus = partie.morceauxTexte.filter((m) => m.mot && visible(m.n, t)).length;
  $('compte').textContent = `${partie.mode === 'jour' ? `Article du jour n°${partie.num}` : 'Partie libre'} · ${partie.essais.length} mot${partie.essais.length > 1 ? 's' : ''} proposé${partie.essais.length > 1 ? 's' : ''} · ${Math.round((100 * vus) / Math.max(1, total))} % du texte dévoilé`;
  const ol = $('essais');
  ol.innerHTML = '';
  [...partie.essais].reverse().forEach((e) => {
    const n = norm(e);
    const nb = partie.morceauxTexte.filter((m) => m.n === n).length + partie.morceauxTitre.filter((m) => m.n === n).length;
    const li = el('li', nb ? 'oui' : 'non');
    li.append(el('span', '', e), el('b', '', nb ? String(nb) : '0'));
    ol.appendChild(li);
  });
  const g = $('gagne');
  g.innerHTML = '';
  g.hidden = !termine;
  if (termine) {
    g.appendChild(el('h2', '', partie.trouve ? '🎉 Trouvé !' : 'Dommage !'));
    g.appendChild(el('p', '', partie.trouve ? `C'était « ${partie.titre} », trouvé en ${partie.essais.length} mots.` : `C'était « ${partie.titre} ».`));
    if (partie.mode === 'jour' && partie.trouve) {
      const b = el('button', 'btn', 'Partager mon résultat');
      b.type = 'button';
      b.addEventListener('click', partager);
      g.appendChild(b);
    }
  }
  $('mot').disabled = termine;
  $('btn-envoyer').disabled = termine;
  $('btn-abandon').hidden = termine;
  $('btn-nouveau').hidden = !(termine || partie.mode === 'libre');
  $('btn-nouveau').textContent = partie.mode === 'jour' ? 'Jouer une partie libre' : 'Nouvel article';
}

async function partager() {
  const texte = `Pédantix n°${partie.num} : trouvé en ${partie.essais.length} mots ! 📖`;
  try {
    if (navigator.share) await navigator.share({ text: texte });
    else { await navigator.clipboard.writeText(texte); toast('Résultat copié : tu peux le coller où tu veux.'); }
  } catch (e) { /* partage annulé */ }
}

// ---------- Chargement ----------
fetch('articles.txt').then((r) => r.text()).then((t) => {
  titres = t.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  $('mot').disabled = false;
  $('btn-envoyer').disabled = false;
  demarrer('jour');
}).catch(() => setMessage('Impossible de charger la liste des articles.', true));
// le sens des mots (pour les mots « proches ») arrive un peu après : le jeu marche déjà sans
chargerSemantique().then((s) => { sem = s; if (partie) { calculerProches(); rendre(); } }).catch(() => {});
