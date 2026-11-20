import { $, el, toast, initSalon, initRegles } from '../commun/salon.js';
import * as R from './regles.js';
import { assurerPseudo, boutonPseudo } from '../commun/pseudo.js';

const CLE_STATS = 'jeux-vol:sutom-jours';
const CLAVIER = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'];

let dico = null;          // Set des mots acceptés
let solutions = [];       // mots à trouver (le mot du jour se tire dedans)
let etat = null;
let maPlace = 0;
let precedent = null;
let saisie = '';          // ligne en cours d'écriture
let finMasquee = false;
let modeLibre = false;    // le bouton « Partie libre » a été touché
let animerLigne = -1;     // ligne qui vient d'être jouée (révélation lettre par lettre)

// ---------- Données ----------
const lireListe = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.text(); })
  .then((t) => t.split(/\r?\n/).map((x) => x.trim().toUpperCase()).filter(Boolean));
const pret = Promise.all([lireListe('dico.txt'), lireListe('solutions.txt')]).then(([d, s]) => {
  solutions = s;
  dico = new Set([...d, ...s]);
  $('btn-local').disabled = false;
  $('btn-libre').disabled = false;
  majAccueil();
}).catch(() => toast('Impossible de charger le dictionnaire. Vérifie ta connexion puis recharge la page.', true));

const jourActuel = () => R.numeroDuJour();
const tirer = (longueur) => {
  const choix = longueur ? solutions.filter((m) => m.length === longueur) : solutions;
  return choix[Math.floor(Math.random() * choix.length)];
};

// ---------- Mot du jour : résultats gardés sur ce téléphone ----------
function lireJours() { try { return JSON.parse(localStorage.getItem(CLE_STATS)) || {}; } catch (e) { return {}; } }
function ecrireJour(n, essais, mot) {
  const j = lireJours();
  j[n] = { essais, trouve: essais[essais.length - 1] === mot, fini: essais[essais.length - 1] === mot || essais.length >= R.ESSAIS };
  try { localStorage.setItem(CLE_STATS, JSON.stringify(j)); } catch (e) { /* rien */ }
}
function statistiques() {
  const j = lireJours();
  const finis = Object.entries(j).filter(([, v]) => v.fini).map(([k, v]) => [parseInt(k, 10), v]).sort((a, b) => a[0] - b[0]);
  const gagnes = finis.filter(([, v]) => v.trouve);
  const repartition = Array(R.ESSAIS).fill(0);
  gagnes.forEach(([, v]) => { repartition[v.essais.length - 1] += 1; });
  // série : jours gagnés d'affilée jusqu'à aujourd'hui (ou hier, si aujourd'hui n'est pas encore joué)
  let serie = 0;
  let n = jourActuel();
  if (!j[n] || !j[n].fini) n -= 1;
  while (j[n] && j[n].trouve) { serie += 1; n -= 1; }
  let meilleure = 0; let cours = 0; let avant = null;
  finis.forEach(([k, v]) => { cours = v.trouve ? (avant === k - 1 ? cours + 1 : 1) : 0; if (!v.trouve) cours = 0; avant = v.trouve ? k : null; meilleure = Math.max(meilleure, cours); });
  return { joues: finis.length, gagnes: gagnes.length, serie, meilleure, repartition };
}
function rendreStats(zone, surligne = 0) {
  zone.innerHTML = '';
  const st = statistiques();
  if (!st.joues) return;
  const ligne = el('div', 'stats-chiffres');
  [[st.joues, 'parties'], [`${Math.round((100 * st.gagnes) / st.joues)} %`, 'gagnées'], [st.serie, 'série'], [st.meilleure, 'record']]
    .forEach(([v, t]) => { const b = el('div'); b.append(el('b', '', String(v)), el('span', '', t)); ligne.appendChild(b); });
  zone.appendChild(ligne);
  const max = Math.max(1, ...st.repartition);
  const barres = el('div', 'stats-barres');
  st.repartition.forEach((v, k) => {
    const b = el('div', `stats-barre${surligne === k + 1 ? ' moi' : ''}`);
    const i = el('i', '', String(v));
    i.style.width = `${Math.max(8, (v / max) * 100)}%`;
    b.append(el('span', '', String(k + 1)), i);
    barres.appendChild(b);
  });
  zone.appendChild(barres);
}
function majAccueil() {
  const n = jourActuel();
  const j = lireJours()[n];
  $('btn-local').textContent = j && j.fini ? `Mot du jour n°${n} : revoir` : j ? `Mot du jour n°${n} : continuer` : `Mot du jour n°${n}`;
  $('info-jour').textContent = j && j.fini ? (j.trouve ? `Trouvé en ${j.essais.length} essai${j.essais.length > 1 ? 's' : ''} ✓ · prochain mot à minuit` : 'Raté aujourd\'hui · prochain mot à minuit') : 'Le même mot pour tout le monde aujourd\'hui.';
  rendreStats($('stats'));
}
majAccueil();

// ---------- Salon ----------
$('btn-libre').addEventListener('click', async () => {
  // le pseudo d'abord : la partie libre démarre ensuite d'un coup (modeLibre n'est lu qu'au démarrage)
  if (!(await assurerPseudo())) return;
  modeLibre = true; $('btn-local').click(); modeLibre = false;
});
$('btn-local').before(boutonPseudo());

const salon = initSalon({
  jeu: 'sutom',
  etatInitial: (nom, nb, { local }) => {
    const joueurs = Array.from({ length: local ? 1 : nb }, (_, i) => ({ name: i === 0 ? nom : 'En attente', joined: i === 0, victoires: 0 }));
    if (!local) return { players: joueurs, mode: 'course', longueur: parseInt($('ligne-longueur').value, 10) || 0 };
    if (modeLibre) return { players: joueurs, mode: 'libre', longueur: parseInt($('libre-longueur').value, 10) || 0 };
    return { players: joueurs, mode: 'jour', jour: jourActuel() };
  },
  demarrer: (s) => {
    if (s.mode === 'jour') {
      R.nouvellePartie(s, R.motDuJour(solutions, s.jour));
      // on reprend là où on en était aujourd'hui
      const j = lireJours()[s.jour];
      if (j) j.essais.forEach((e) => R.proposer(s, 0, e));
      return;
    }
    R.nouvellePartie(s, tirer(s.longueur));
  },
  afficher: (s, place) => {
    precedent = etat && etat.partie === s.partie && place === maPlace ? etat : null;
    if (!precedent) { saisie = ''; finMasquee = false; animerLigne = -1; }
    etat = R.normaliser(s);
    maPlace = place;
    const p = moi();
    if (precedent && precedent.players[maPlace] && precedent.players[maPlace].essais.length < p.essais.length) animerLigne = p.essais.length - 1;
    if (etat.mode === 'jour' && etat.jour) ecrireJour(etat.jour, p.essais, etat.mot);
    // fin de la partie : le résultat de chaque joueur part au tableau de bord (une fois : par l'hôte, ou sur ce téléphone)
    if (etat.status === 'fin' && precedent && precedent.status !== 'fin' && (salon.estLocal() || maPlace === 0)) envoyerResultats(etat);
    rendre();
  },
  quiDoitJouer: () => -1,
  secret: false,
  pseudoObligatoire: true, // le pseudo apparaît dans les résultats du tableau de bord
});
initRegles();
const agir = (fn) => salon.agir((s) => fn(R.normaliser(s)));

// ---------- Résultats pour le tableau de bord (voir suivi.js) ----------
const resultatsEnvoyes = new Set();
function envoyerResultats(s) {
  const cle = `${s.createdAt || ''}-${s.partie}`;
  if (resultatsEnvoyes.has(cle) || !window.suivi || !window.suivi.resultat) return;
  resultatsEnvoyes.add(cle);
  s.players.forEach((p) => {
    if (!p || !p.essais || (!p.essais.length && !p.abandon)) return; // une place jamais jouée
    try {
      window.suivi.resultat('sutom', {
        n: p.name, e: p.essais.length, s: (p.temps || 0) / 1000,
        g: p.trouve ? 'trouve' : p.abandon ? 'abandon' : 'rate',
        m: s.mode, k: s.mode === 'jour' ? s.jour : undefined,
      });
    } catch (e) { /* jamais bloquant */ }
  });
}

// ---------- Outils ----------
const moi = () => etat.players[maPlace];
const peutJouer = () => etat && etat.status === 'jeu' && !moi().fini;
const L = () => etat.mot.length;

// ---------- Saisie ----------
let messageMinuterie = null;
function message(t, erreur = false) {
  const m = $('message');
  m.textContent = t;
  m.classList.toggle('erreur', erreur);
  clearTimeout(messageMinuterie);
  if (t) messageMinuterie = setTimeout(() => { m.textContent = ''; }, 2600);
}
function taper(lettre) {
  if (!peutJouer()) return;
  // la première lettre est déjà là : on peut commencer à taper directement la deuxième
  if (!saisie && lettre !== etat.mot[0]) saisie = etat.mot[0];
  if (saisie.length >= L()) return;
  saisie += lettre;
  rendreGrille();
}
function effacer() {
  if (!peutJouer()) return;
  saisie = saisie.length > 1 ? saisie.slice(0, -1) : '';
  rendreGrille();
}
function valider() {
  if (!peutJouer()) return;
  const essai = R.normaliserMot(saisie);
  const err = R.refus(essai, etat.mot, dico);
  if (err) {
    message(err, true);
    const ligne = $('grille').children[moi().essais.length];
    if (ligne) { ligne.classList.remove('secoue'); void ligne.offsetWidth; ligne.classList.add('secoue'); }
    return;
  }
  saisie = '';
  agir((s) => R.proposer(s, maPlace, essai));
}
document.addEventListener('keydown', (e) => {
  if (!etat || $('jeu').hidden || document.querySelector('dialog[open]') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key === 'Enter') { e.preventDefault(); valider(); return; }
  if (e.key === 'Backspace') { e.preventDefault(); effacer(); return; }
  const l = R.normaliserMot(e.key);
  if (l.length === 1) taper(l);
});

$('btn-abandon').addEventListener('click', () => {
  if (peutJouer() && confirm('Abandonner ? Le mot te sera révélé.')) agir((s) => R.abandonner(s, maPlace));
});
$('btn-voir').addEventListener('click', () => { finMasquee = true; rendre(); });
$('btn-suite').addEventListener('click', () => agir((s) => {
  if (s.status !== 'fin') return false;
  // après le mot du jour, on enchaîne sur des parties libres
  if (s.mode === 'jour') { s.mode = 'libre'; s.longueur = 0; delete s.jour; }
  return R.nouvellePartie(s, tirer(s.longueur));
}));
$('btn-partager').addEventListener('click', async () => {
  const texte = R.partage(etat.mot, moi().essais, `SUTOM n°${etat.jour}`);
  try {
    if (navigator.share) await navigator.share({ text: texte });
    else { await navigator.clipboard.writeText(texte); toast('Résultat copié : tu peux le coller où tu veux.'); }
  } catch (e) { /* partage annulé */ }
});

// ---------- Affichage ----------
const CLASSES = { [R.BIEN]: 'bien', [R.MAL]: 'mal', [R.ABSENT]: 'absent' };

function rendreGrille() {
  const zone = $('grille');
  zone.innerHTML = '';
  zone.style.setProperty('--n', L());
  const p = moi();
  const sures = R.lettresSures(etat.mot, p.essais);
  for (let r = 0; r < R.ESSAIS; r++) {
    const ligne = el('div', 'ligne-st');
    const essai = p.essais[r];
    const courante = !essai && r === p.essais.length && peutJouer();
    if (courante) ligne.classList.add('courante');
    const couleurs = essai ? R.evaluer(essai, etat.mot) : null;
    for (let k = 0; k < L(); k++) {
      const c = el('div', 'case-st');
      if (essai) {
        c.textContent = essai[k];
        c.classList.add(CLASSES[couleurs[k]]);
        if (r === animerLigne) { c.classList.add('revele'); c.style.animationDelay = `${k * 160}ms`; }
      } else if (courante) {
        if (saisie[k]) { c.textContent = saisie[k]; c.classList.add('tapee'); } else if (sures[k]) { c.textContent = sures[k]; c.classList.add('indice'); } else c.textContent = '·';
      }
      ligne.appendChild(c);
    }
    zone.appendChild(ligne);
  }
  // après l'animation, plus besoin de la rejouer
  if (animerLigne >= 0) {
    const fin = (L() - 1) * 160 + 450;
    const ligneAnimee = animerLigne;
    setTimeout(() => { if (animerLigne === ligneAnimee) animerLigne = -1; }, fin);
  }
}

function rendreClavier() {
  const zone = $('clavier');
  zone.innerHTML = '';
  const etats = R.etatClavier(etat.mot, moi().essais);
  CLAVIER.forEach((rang, k) => {
    const r = el('div', 'rang-st');
    if (k === 2) {
      const ent = el('button', 'touche-st large', '⏎');
      ent.type = 'button'; ent.setAttribute('aria-label', 'Valider');
      ent.addEventListener('click', valider);
      r.appendChild(ent);
    }
    [...rang].forEach((l) => {
      const b = el('button', 'touche-st', l);
      b.type = 'button';
      if (etats[l] !== undefined) b.classList.add(CLASSES[etats[l]]);
      b.addEventListener('click', () => taper(l));
      r.appendChild(b);
    });
    if (k === 2) {
      const del = el('button', 'touche-st large', '⌫');
      del.type = 'button'; del.setAttribute('aria-label', 'Effacer');
      del.addEventListener('click', effacer);
      r.appendChild(del);
    }
    zone.appendChild(r);
  });
  zone.classList.toggle('inactif', !peutJouer());
}

function rendreAdversaires() {
  const zone = $('adversaires');
  zone.innerHTML = '';
  zone.hidden = etat.players.length < 2;
  if (zone.hidden) return;
  etat.players.forEach((p, i) => {
    if (i === maPlace) return;
    const b = el('div', `adv-st${p.trouve ? ' trouve' : p.fini ? ' perdu' : ''}`);
    b.appendChild(el('strong', '', p.name));
    const mini = el('div', 'mini-st');
    mini.style.setProperty('--n', L());
    p.essais.forEach((e) => {
      const l = el('div');
      R.evaluer(e, etat.mot).forEach((c) => l.appendChild(el('i', CLASSES[c])));
      mini.appendChild(l);
    });
    b.appendChild(mini);
    b.appendChild(el('span', '', p.trouve ? `✓ ${p.essais.length}/${R.ESSAIS}` : p.fini ? (p.abandon ? 'abandon' : '✗ raté') : `${p.essais.length}/${R.ESSAIS}`));
    if (p.victoires) b.appendChild(el('span', 'trophees-st', `🏆 ${p.victoires}`));
    zone.appendChild(b);
  });
}

function rendreTitre() {
  const t = etat.mode === 'jour' ? `Mot du jour n°${etat.jour}` : etat.mode === 'course' ? 'Course' : 'Partie libre';
  const p = moi();
  let suite = `${L()} lettres`;
  if (etat.status === 'jeu' && p.fini) suite = p.trouve ? `trouvé en ${p.essais.length} ! En attente des autres…` : 'raté… en attente des autres';
  $('titre-partie').textContent = `${t} · ${suite}`;
  $('btn-abandon').hidden = !peutJouer() || etat.mode === 'jour';
}

function rendreFin() {
  const voile = $('fin');
  let b = document.getElementById('btn-reouvrir');
  if (etat.status !== 'fin' || finMasquee) {
    voile.hidden = true;
    if (etat.status === 'fin' && !b) {
      b = el('button', 'btn-st principal', 'Voir le résultat');
      b.id = 'btn-reouvrir';
      b.type = 'button';
      b.addEventListener('click', () => { finMasquee = false; rendre(); });
      $('btn-abandon').after(b);
    } else if (etat.status !== 'fin' && b) b.remove();
    return;
  }
  if (b) b.remove();
  // on laisse le temps de voir la dernière ligne se retourner
  const attente = animerLigne >= 0 ? (L() - 1) * 160 + 600 : 0;
  setTimeout(() => {
    if (!etat || etat.status !== 'fin' || finMasquee) return;
    voile.hidden = false;
    const p = moi();
    const seul = etat.players.length === 1;
    const g = etat.gagnants || [];
    let titre;
    if (seul) titre = p.trouve ? ['Génial !', 'Bravo !', 'Très fort !', 'Bien joué !', 'Ouf !', 'Sauvé !'][p.essais.length - 1] || 'Bravo !' : 'Perdu…';
    else if (!g.length) titre = 'Personne n\'a trouvé !';
    else if (g.length > 1) titre = g.includes(maPlace) ? 'Égalité !' : `Égalité : ${g.map((i) => etat.players[i].name).join(' et ')}`;
    else titre = g[0] === maPlace ? 'Tu as gagné !' : `${etat.players[g[0]].name} gagne !`;
    $('fin-titre').textContent = titre;
    $('fin-mot').textContent = etat.mot;
    $('fin-def').href = `https://fr.wiktionary.org/wiki/${encodeURIComponent(etat.mot.toLowerCase())}`;
    const ol = $('fin-classement');
    ol.innerHTML = '';
    ol.hidden = seul;
    (etat.classement || []).forEach((i, k) => {
      const q = etat.players[i];
      const li = el('li', g.includes(i) ? 'gagnant' : '');
      li.append(el('span', 'rang', g.includes(i) ? '🏆' : `${k + 1}.`), el('span', 'nom', q.name + (i === maPlace ? ' (toi)' : '')),
        el('b', '', q.trouve ? `${q.essais.length}/${R.ESSAIS} · ${Math.round((q.temps || 0) / 1000)} s` : q.abandon ? 'abandon' : 'raté'));
      ol.appendChild(li);
    });
    const jour = etat.mode === 'jour';
    if (jour) rendreStats($('fin-stats'), p.trouve ? p.essais.length : 0); else $('fin-stats').innerHTML = '';
    $('btn-partager').hidden = !jour;
    $('btn-suite').textContent = jour ? 'Jouer une partie libre' : etat.mode === 'course' ? 'Revanche' : 'Nouveau mot';
  }, attente);
}

function rendre() {
  if (!etat || !etat.players[maPlace] || !etat.mot) return;
  rendreTitre();
  rendreAdversaires();
  rendreGrille();
  rendreClavier();
  rendreFin();
  if (precedent) {
    etat.players.forEach((q, i) => {
      const a = precedent.players[i];
      if (i !== maPlace && q.trouve && a && !a.trouve) toast(`${q.name} a trouvé en ${q.essais.length} essai${q.essais.length > 1 ? 's' : ''} !`);
    });
  }
  majAccueil();
}

// la partie en ligne a besoin du dictionnaire pour tirer le mot : on attend qu'il soit chargé
pret.then(() => { if (etat) rendre(); });
