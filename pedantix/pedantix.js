import { $, el, toast, initRegles, compterPartie } from '../commun/salon.js';
import { chargerSemantique, numeroDuJour, sansAccents } from '../commun/mots/semantique.js';
import { pseudo, assurerPseudo, boutonPseudo, avisPseudo } from '../commun/pseudo.js';

const CLE = 'jeux-vol:pedantix';
const CLE_PETITS = 'jeux-vol:pedantix-petits';
const API = 'https://fr.wikipedia.org/w/api.php';
const MOTS_MAX = 420;   // longueur du texte à deviner (on coupe à la fin d'un paragraphe)
const SEUIL = 0.45;    // proximité de sens à partir de laquelle un mot s'affiche en gris
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
  if (partie && !fini()) {
    verifierVictoire();
    if (partie.trouve) { noterResultat(); sauver(); }
  }
  if (partie) rendre();
});

// ---------- Mémoire du téléphone ----------
function lire() { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch (e) { return {}; } }
function sauver() {
  const m = lire();
  const p = { num: partie.num, titre: partie.titre, page: partie.page, url: partie.url, texte: partie.texte, essais: partie.essais, trouve: partie.trouve, abandon: partie.abandon, compte: partie.compte, debut: partie.debut || 0, envoye: !!partie.envoye };
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
// Même mot sous une autre forme (pluriel, féminin, conjugaison…) : on compare les lemmes du dictionnaire
// (« chats », « chatons » → non ; « chats » → « chat », « grandes » → « grand », « mangeaient » → « manger »)
let versionSem = 0; // change quand le dictionnaire (ou ses formes en plus) arrive
let familles = new Map(); // lemme -> lemme principal (« différents » → « différent », « chienne » → « chien »)
let sansFamille = new Set(); // « être » et « avoir » : trop de formes ambiguës (« été », « est », « a »…), on compare tels quels
function lemme(mot) {
  if (!sem) return -1;
  let i = sem.trouver(String(mot).toLowerCase());
  if (i < 0) return -1;
  if (familles.has(i)) i = familles.get(i);
  return sansFamille.has(i) ? -1 : i;
}
function lemmeDe(m) {
  if (m.lv !== versionSem) { m.l = lemme(m.mot); m.lv = versionSem; }
  return m.l;
}
// t : les mots proposés (sans accents) et leurs lemmes
function trouves() {
  const t = new Set(partie.essais.map(norm));
  t.lemmes = new Set(partie.essais.map(lemme).filter((i) => i >= 0));
  return t;
}
const visible = (m, t) => t.has(m.n) || (petitsVisibles() && PETITS.has(m.n)) || (t.lemmes.size > 0 && t.lemmes.has(lemmeDe(m)));
// le morceau m correspond-il au mot proposé (n : sans accents, l : son lemme) ?
const correspond = (m, n, l) => m.mot && (m.n === n || (l >= 0 && lemmeDe(m) === l));
const combien = (n, l) => partie.morceauxTexte.filter((m) => correspond(m, n, l)).length + partie.morceauxTitre.filter((m) => correspond(m, n, l)).length;

// proximité : pour chaque mot caché, le mot proposé le plus proche par le sens
let proches = new Map(); // n -> { mot, s }
function calculerProches() {
  proches = new Map();
  if (!sem) return;
  const t = trouves();
  const caches = new Map();
  [...partie.morceauxTexte, ...partie.morceauxTitre].forEach((m) => {
    if (m.mot && !visible(m, t) && !caches.has(m.n)) caches.set(m.n, sem.trouver(m.mot.toLowerCase()));
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
  partie.dernierL = -1;
  calculerProches();
  setMessage('');
  $('mot').disabled = fini() || !pseudo();
  $('btn-envoyer').disabled = fini() || !pseudo();
  rendre();
  if (!fini()) $('mot').focus({ preventScroll: true });
}
const fini = () => partie && (partie.trouve || partie.abandon);


// ---------- Résultat pour le tableau de bord (voir suivi.js) : pseudo, essais, temps ----------
function noterResultat() {
  if (!partie || partie.envoye) return;
  partie.envoye = true;
  try {
    if (window.suivi && window.suivi.resultat) window.suivi.resultat('pedantix', {
      n: pseudo(), e: partie.essais.length, s: partie.debut ? (Date.now() - partie.debut) / 1000 : undefined,
      g: partie.trouve ? 'trouve' : 'abandon', m: partie.mode, k: partie.mode === 'jour' ? partie.num : undefined,
    });
  } catch (e) { /* jamais bloquant */ }
}

$('mode-libre').parentElement.after(boutonPseudo());
// pas de pseudo, pas de partie : il apparaît dans les résultats du tableau de bord
$('saisie').before(avisPseudo());
document.addEventListener('pseudo-change', () => { if (partie) { rendre(); if (!fini()) $('mot').focus({ preventScroll: true }); } });

// ---------- Proposer un mot ----------
// renvoie true si le mot est pris en compte (false : mot inconnu, déjà proposé…)
async function proposer(texte) {
  if (!partie || fini()) return false;
  // le pseudo apparaît dans les résultats : on le demande avant le premier mot
  if (!pseudo()) { assurerPseudo().then((n) => { if (n) proposer(texte); }); return true; }
  const mots = String(texte).match(MOT);
  if (!mots) return false;
  const mot = mots[0];
  const n = norm(mot);
  if (partie.essais.some((e) => norm(e) === n)) { setMessage(`« ${mot} » est déjà proposé.`); partie.dernier = n; partie.dernierL = lemme(mot); rendre(); return true; }
  // le dictionnaire et ses formes (pluriels, féminins…) : pour reconnaître le mot sous une autre forme dans l'article
  if (!dicoPret) {
    if (!sem) setMessage('Un instant, je vérifie le mot…');
    try { await pret; } catch (e) { /* dictionnaire indisponible : on compare juste les mots tels quels */ }
    if (!partie || fini()) return false;
  }
  // un mot qui n'existe pas (faute de frappe) ne compte pas : on le refuse, en proposant la bonne orthographe
  // (les mots de l'article sont toujours acceptés, même les noms propres que le dictionnaire ne connaît pas)
  const l = lemme(mot);
  const dansArticle = combien(n, l) > 0;
  if (!dansArticle && !/^\d+$/.test(n)) {
    try {
      if (!sem) throw new Error('dictionnaire');
      const i = await sem.trouverPartout(mot);
      if (!partie || fini()) return false;
      if (i < 0) {
        const s = sem.suggerer(mot);
        setMessage(`« ${mot} » n'existe pas dans le dictionnaire${s ? ` : tu voulais dire « ${s} » ?` : '.'} Il ne compte pas.`);
        return false;
      }
    } catch (e) { /* dictionnaire indisponible : on accepte le mot */ }
  }
  partie.essais.push(mot.toLowerCase());
  if (!partie.debut) partie.debut = Date.now();
  partie.dernier = n;
  partie.dernierL = l;
  if (!partie.compte) { partie.compte = true; compterPartie('pedantix', 'telephone'); }
  const nb = combien(n, l);
  setMessage(nb ? `« ${mot} » : ${nb} fois dans l'article !` : `« ${mot} » n'est pas dans l'article.`, !nb);
  verifierVictoire();
  if (partie.trouve) noterResultat();
  calculerProches();
  sauver();
  rendre();
  return true;
}
function verifierVictoire() {
  if (!partie || partie.abandon) return;
  const t = trouves();
  if (partie.morceauxTitre.filter((m) => m.mot).every((m) => visible(m, t))) partie.trouve = true;
}
$('saisie').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const t = $('mot').value;
  $('mot').value = '';
  // mot refusé (faute de frappe) : on le remet dans la case pour le corriger
  if (t.trim()) proposer(t).then((ok) => { if (!ok && !$('mot').value) $('mot').value = t; });
});
$('btn-abandon').addEventListener('click', () => {
  if (!partie || fini() || !confirm('Abandonner et voir l\'article ?')) return;
  partie.abandon = true;
  noterResultat();
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
    if (tout || visible(m, t)) {
      const s = el('span', `vu-px${correspond(m, partie.dernier, partie.dernierL ?? -1) ? ' nouveau' : ''}`, m.mot);
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
      c.style.setProperty('--force', Math.min(1, (p.s - SEUIL) / (0.85 - SEUIL)).toFixed(2));
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
  const vus = partie.morceauxTexte.filter((m) => m.mot && visible(m, t)).length;
  $('compte').textContent = `${partie.mode === 'jour' ? `Article du jour n°${partie.num}` : 'Partie libre'} · ${partie.essais.length} mot${partie.essais.length > 1 ? 's' : ''} proposé${partie.essais.length > 1 ? 's' : ''} · ${Math.round((100 * vus) / Math.max(1, total))} % du texte dévoilé`;
  const ol = $('essais');
  ol.innerHTML = '';
  [...partie.essais].reverse().forEach((e) => {
    const nb = combien(norm(e), lemme(e));
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
  }
  $('mot').disabled = termine || !pseudo();
  $('btn-envoyer').disabled = termine || !pseudo();
  $('btn-abandon').hidden = termine || !pseudo();
  $('btn-nouveau').hidden = !(termine || partie.mode === 'libre');
  $('btn-nouveau').textContent = partie.mode === 'jour' ? 'Jouer une partie libre' : 'Nouvel article';
}

// ---------- Chargement ----------
fetch('articles.txt').then((r) => r.text()).then((t) => {
  titres = t.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  demarrer('jour');
  if (!pseudo()) assurerPseudo();
}).catch(() => setMessage('Impossible de charger la liste des articles.', true));
// le sens des mots (pour les mots « proches ») arrive un peu après : le jeu marche déjà sans
function chargerDico() {
  return chargerSemantique().then((s) => {
    if (!sem) { sem = s; sansFamille = new Set(['être', 'avoir'].map((m) => s.trouver(m))); versionSem++; if (partie) { calculerProches(); rendre(); } }
    return s;
  });
}
function chargerFamilles(s) {
  return fetch('../commun/mots/familles.txt').then((r) => (r.ok ? r.text() : '')).then((t) => {
    const f = new Map();
    t.split('\n').forEach((ligne) => {
      const [a, b] = ligne.trim().split(' ');
      const i = s.trouver(a); const j = s.trouver(b);
      if (a && b && i >= 0 && j >= 0 && i !== j) f.set(i, j);
    });
    familles = f;
  }).catch(() => {});
}
let dicoPret = false;
const pret = chargerDico().then((s) => Promise.all([s.chargerPlus(), chargerFamilles(s)]).then(() => {
  // les autres formes des mots (pluriels, conjugaisons…) et les mots plus rares : en arrière-plan
  dicoPret = true;
  versionSem++;
  if (partie) { verifierPartie(); calculerProches(); rendre(); }
})).catch(() => { dicoPret = true; });
// une partie déjà commencée : un mot proposé peut maintenant en dévoiler d'autres (et même le titre)
function verifierPartie() {
  if (!partie || fini()) return;
  verifierVictoire();
  if (partie.trouve) { noterResultat(); sauver(); }
}
