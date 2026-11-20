import { $, el, toast, initRegles, compterPartie } from '../commun/salon.js';
import { chargerSemantique, numeroDuJour } from '../commun/mots/semantique.js';
import { pseudo, assurerPseudo, boutonPseudo, avisPseudo } from '../commun/pseudo.js';

const CLE = 'jeux-vol:cemantix';
initRegles();

let sem = null;      // vocabulaire et vecteurs
let infos = null;    // { nb, parPaquet, top, calibrage }
let partie = null;   // { mode, num, cible, proches: Int32 rangs, essais: [{i, mot, t, r}], trouve, abandon, indices }
let mode = 'jour';

// ---------- Mémoire du téléphone ----------
function lire() { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch (e) { return {}; } }
function sauver() {
  const m = lire();
  const p = { num: partie.num, essais: partie.essais.map((e) => e.mot), trouve: partie.trouve, abandon: partie.abandon, indices: partie.indices, compte: partie.compte, debut: partie.debut || 0, envoye: !!partie.envoye };
  if (partie.mode === 'jour') { m.jours = m.jours || {}; m.jours[partie.num] = p; } else m.libre = p;
  try { localStorage.setItem(CLE, JSON.stringify(m)); } catch (e) { /* rien */ }
}

// ---------- Les données d'un mot secret ----------
const paquets = {};
function chargerPaquet(k) {
  if (!paquets[k]) {
    paquets[k] = fetch(`donnees/paquet-${String(k).padStart(2, '0')}.bin`).then((r) => { if (!r.ok) throw new Error('paquet'); return r.arrayBuffer(); });
  }
  return paquets[k];
}
async function chargerCible(num) {
  const t = ((num % infos.nb) + infos.nb) % infos.nb;
  const buf = await chargerPaquet(Math.floor(t / infos.parPaquet));
  const T = infos.top;
  const debut = (t % infos.parPaquet) * (T * 4 + infos.communs);
  const idx = new Uint16Array(buf.slice(debut, debut + T * 2));
  const sc = new Int16Array(buf.slice(debut + T * 2, debut + T * 4));
  const table = new Uint8Array(buf.slice(debut + T * 4, debut + T * 4 + infos.communs)); // températures au demi-degré
  const rang = new Map(); // mot -> rang (0 = le mot secret)
  idx.forEach((i, r) => rang.set(i, r));
  return { cible: idx[0], idx, sc, rang, table };
}

// Température d'un mot : précise pour les 1000 plus proches, au demi-degré pour les 30 000 mots courants,
// approchée pour les mots plus rares
function mesurer(i) {
  const r = partie.rang.get(i);
  if (r !== undefined) return { t: partie.sc[r] / 100, r };
  const plafond = partie.sc[infos.top - 1] / 100 - 0.01;
  if (i < infos.communs) return { t: Math.min(plafond, partie.table[i] / 2 - 27), r: -1 };
  const [a, b] = infos.calibrage;
  return { t: Math.min(plafond, (a * sem.similarite(i, partie.cible) + b) * 100), r: -1 };
}
const pourMille = (r) => (r >= 0 && r < 1000 ? 1000 - r : 0);
function emoji(e) {
  const pm = pourMille(e.r);
  if (e.r === 0) return '🥳';
  if (pm >= 999) return '😱';
  if (pm >= 990) return '🔥';
  if (pm >= 900) return '🥵';
  if (pm >= 1) return '😎';
  return e.t >= 0 ? '🥶' : '🧊';
}

// ---------- Démarrer une partie ----------
async function demarrer(m, nouveau = false) {
  mode = m;
  $('mode-jour').setAttribute('aria-selected', String(m === 'jour'));
  $('mode-libre').setAttribute('aria-selected', String(m === 'libre'));
  const memoire = lire();
  let num;
  let deja = null;
  if (m === 'jour') {
    num = numeroDuJour();
    deja = (memoire.jours || {})[num] || null;
  } else {
    deja = !nouveau && memoire.libre && !memoire.libre.trouve && !memoire.libre.abandon ? memoire.libre : null;
    // un mot qui n'est pas celui du jour
    const jour = (numeroDuJour() % infos.nb + infos.nb) % infos.nb;
    num = deja ? deja.num : (() => { let x; do x = Math.floor(Math.random() * infos.nb); while (x === jour); return x; })();
  }
  setMessage('Chargement…');
  const d = await chargerCible(num);
  partie = { mode: m, num, ...d, essais: [], trouve: false, abandon: false, indices: 0, compte: false, dernier: null };
  if (deja) {
    deja.essais.forEach((mot) => { const i = sem.trouver(mot); if (i >= 0 && !partie.essais.some((e) => e.i === i)) partie.essais.push({ i, mot: sem.mots[i], ...mesurer(i) }); });
    partie.trouve = !!deja.trouve; partie.abandon = !!deja.abandon; partie.indices = deja.indices || 0; partie.compte = !!deja.compte;
    partie.debut = deja.debut || 0; partie.envoye = !!deja.envoye;
    partie.dernier = partie.essais[partie.essais.length - 1] || null;
  }
  setMessage('');
  rendre();
  if (!fini()) $('mot').focus({ preventScroll: true });
}
const fini = () => partie && (partie.trouve || partie.abandon);


// ---------- Résultat pour le tableau de bord (voir suivi.js) : pseudo, essais, temps ----------
function noterResultat() {
  if (!partie || partie.envoye) return;
  partie.envoye = true;
  try {
    if (window.suivi && window.suivi.resultat) window.suivi.resultat('cemantix', {
      n: pseudo(), e: partie.essais.length, s: partie.debut ? (Date.now() - partie.debut) / 1000 : undefined,
      g: partie.trouve ? 'trouve' : 'abandon', m: partie.mode, k: partie.mode === 'jour' ? partie.num : undefined, i: partie.indices,
    });
  } catch (e) { /* jamais bloquant */ }
}

$('mode-libre').parentElement.after(boutonPseudo());
// pas de pseudo, pas de partie : il apparaît dans les résultats du tableau de bord
$('saisie').before(avisPseudo());
document.addEventListener('pseudo-change', () => { if (partie) { rendre(); if (!fini()) $('mot').focus({ preventScroll: true }); } });

// ---------- Proposer un mot ----------
function proposer(texte) {
  if (!partie || fini()) return;
  // le pseudo apparaît dans les résultats : on le demande avant le premier mot
  if (!pseudo()) { assurerPseudo().then((n) => { if (n) proposer(texte); }); return; }
  const i = sem.trouver(texte);
  if (i < 0) { setMessage(`Je ne connais pas « ${texte.trim()} ».`, true); return; }
  const deja = partie.essais.find((e) => e.i === i);
  if (deja) { partie.dernier = deja; setMessage(`« ${deja.mot} » est déjà dans la liste.`); rendre(); return; }
  const e = { i, mot: sem.mots[i], ...mesurer(i) };
  partie.essais.push(e);
  if (!partie.debut) partie.debut = Date.now();
  partie.dernier = e;
  if (!partie.compte) { partie.compte = true; compterPartie('cemantix', 'telephone'); }
  if (e.r === 0) { partie.trouve = true; noterResultat(); }
  sauver();
  setMessage('');
  rendre();
}
$('saisie').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const t = $('mot').value;
  if (!t.trim()) return;
  $('mot').value = '';
  proposer(t);
});

// Un indice : un mot un peu plus chaud que le meilleur trouvé
$('btn-indice').addEventListener('click', () => {
  if (!partie || fini()) return;
  const meilleur = Math.min(...partie.essais.filter((e) => e.r > 0).map((e) => e.r), 1000);
  let cible = Math.max(1, Math.floor(meilleur * 0.6));
  const pris = new Set(partie.essais.map((e) => e.i));
  while (cible < infos.top && pris.has(partie.idx[cible])) cible += 1;
  while (cible > 1 && pris.has(partie.idx[cible])) cible -= 1;
  if (pris.has(partie.idx[cible])) return;
  partie.indices += 1;
  toast(`💡 Essaie « ${sem.mots[partie.idx[cible]]} »`);
  proposer(sem.mots[partie.idx[cible]]);
});
$('btn-abandon').addEventListener('click', () => {
  if (!partie || fini() || !confirm('Abandonner et voir le mot ?')) return;
  partie.abandon = true;
  noterResultat();
  sauver();
  rendre();
});
$('btn-nouveau').addEventListener('click', () => demarrer('libre', true));
$('mode-jour').addEventListener('click', () => { if (sem) demarrer('jour'); });
$('mode-libre').addEventListener('click', () => { if (sem) demarrer('libre'); });

// ---------- Affichage ----------
let minuterieMessage = null;
function setMessage(t, erreur = false) {
  const m = $('message');
  m.textContent = t;
  m.classList.toggle('erreur', erreur);
  clearTimeout(minuterieMessage);
  if (t && erreur) minuterieMessage = setTimeout(() => { m.textContent = ''; }, 3000);
}

function ligne(e, n) {
  const tr = el('tr');
  if (e.r === 0) tr.classList.add('cible');
  tr.append(el('td', 'num', String(n)), el('td', 'mot', e.mot), el('td', 'temp', e.t.toFixed(2)), el('td', 'emoji', emoji(e)));
  const td = el('td', 'prog');
  const pm = pourMille(e.r);
  if (pm) {
    const barre = el('span', 'barre-cx');
    const i = el('i');
    i.style.width = `${pm / 10}%`;
    barre.appendChild(i);
    td.append(el('span', 'pm', `${pm} ‰`), barre);
  }
  tr.appendChild(td);
  return tr;
}

function rendre() {
  if (!partie) return;
  $('titre').textContent = partie.mode === 'jour' ? `Mot du jour n°${partie.num} · ${partie.essais.length} essai${partie.essais.length > 1 ? 's' : ''}` : `Partie libre · ${partie.essais.length} essai${partie.essais.length > 1 ? 's' : ''}`;
  const termine = fini();
  $('mot').disabled = termine || !pseudo();
  $('btn-envoyer').disabled = termine || !pseudo();
  $('outils').hidden = !pseudo();
  $('btn-indice').hidden = termine;
  $('btn-abandon').hidden = termine;
  $('btn-nouveau').hidden = !(termine || partie.mode === 'libre');
  $('btn-nouveau').textContent = partie.mode === 'jour' ? 'Jouer une partie libre' : 'Nouveau mot';

  // victoire / abandon
  const g = $('gagne');
  g.innerHTML = '';
  g.hidden = !termine;
  if (termine) {
    const mot = sem.mots[partie.cible];
    g.appendChild(el('h2', '', partie.trouve ? '🥳 Bravo !' : 'Dommage !'));
    g.appendChild(el('p', '', partie.trouve
      ? `Tu as trouvé « ${mot} » en ${partie.essais.length} essai${partie.essais.length > 1 ? 's' : ''}${partie.indices ? ` (dont ${partie.indices} indice${partie.indices > 1 ? 's' : ''})` : ''}.`
      : `Le mot était « ${mot} ».`));
    const proches = el('details', 'proches-cx');
    proches.appendChild(el('summary', '', 'Les 100 mots les plus proches'));
    const ol = el('ol');
    for (let r = 1; r <= 100; r++) ol.appendChild(el('li', '', `${sem.mots[partie.idx[r]]} · ${(partie.sc[r] / 100).toFixed(2)} °C`));
    proches.appendChild(ol);
    g.appendChild(proches);
    if (partie.mode === 'jour' && partie.trouve) {
      const b = el('button', 'btn', 'Partager mon résultat');
      b.type = 'button';
      b.addEventListener('click', partager);
      g.appendChild(b);
    }
  }

  // la liste : le dernier mot en haut, puis tous les mots du plus chaud au plus froid
  $('liste').hidden = !partie.essais.length;
  const num = new Map(partie.essais.map((e, k) => [e.i, k + 1]));
  const d = $('dernier');
  d.innerHTML = '';
  if (partie.dernier) { const tr = ligne(partie.dernier, num.get(partie.dernier.i)); tr.classList.add('dernier'); d.appendChild(tr); }
  const corps = $('essais');
  corps.innerHTML = '';
  [...partie.essais].sort((a, b) => b.t - a.t).forEach((e) => corps.appendChild(ligne(e, num.get(e.i))));
}

async function partager() {
  const pm = (seuil) => partie.essais.filter((e) => pourMille(e.r) >= seuil && e.r !== 0).length;
  const texte = `Cémantix n°${partie.num} : trouvé en ${partie.essais.length} essais !\n🥳 1\n😱 ${pm(999)}\n🔥 ${pm(990)}\n🥵 ${pm(900)}\n😎 ${pm(1)}`;
  try {
    if (navigator.share) await navigator.share({ text: texte });
    else { await navigator.clipboard.writeText(texte); toast('Résultat copié : tu peux le coller où tu veux.'); }
  } catch (e) { /* partage annulé */ }
}

// ---------- Chargement ----------
Promise.all([chargerSemantique(), fetch('donnees/infos.json').then((r) => r.json())])
  .then(([s, inf]) => {
    sem = s;
    infos = inf;
    return demarrer('jour').then(() => { if (!pseudo()) assurerPseudo(); });
  })
  .catch(() => setMessage('Impossible de charger les mots. Vérifie ta connexion puis recharge la page.', true));
