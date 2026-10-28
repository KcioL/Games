import { $, el, toast, initSalon, initRegles } from '../commun/salon.js';
import * as R from './regles.js';

let etat = null;
let maPlace = 0;
let THEMES = {};

// ---------- Les thèmes (fichier categories.txt) ----------
const SECOURS = { classique: { nom: 'Classique', desc: 'Prénom, pays, animal, métier…', categories: ['Prénom', 'Pays', 'Ville', 'Animal', 'Fruit ou légume', 'Métier', 'Objet', 'Marque'] } };
fetch('categories.txt', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
  .then((t) => { THEMES = R.lireCategories(t); if (!Object.keys(THEMES).length) throw new Error('vide'); })
  .catch((err) => { console.warn('Petit bac : categories.txt illisible', err); THEMES = SECOURS; })
  .then(construireThemes);

function construireThemes() {
  const zone = $('themes');
  zone.innerHTML = '';
  Object.entries(THEMES).forEach(([id, th], k) => {
    const l = el('label', 'theme');
    const r = el('input');
    r.type = 'radio'; r.name = 'theme'; r.value = id; r.checked = k === 0;
    const sp = el('span');
    sp.append(el('strong', '', th.nom), el('small', '', `${th.desc ? `${th.desc} · ` : ''}${th.categories.length} catégories`));
    l.append(r, sp);
    zone.appendChild(l);
  });
}
const themeChoisi = () => (document.querySelector('input[name="theme"]:checked') || {}).value || Object.keys(THEMES)[0];

// ---------- Salon (en ligne seulement) ----------
const salon = initSalon({
  jeu: 'petitbac',
  etatInitial: (nom, nb) => {
    const th = THEMES[themeChoisi()] || SECOURS.classique;
    return {
      players: Array.from({ length: nb }, (_, i) => ({ name: i === 0 ? nom : 'En attente', joined: i === 0 })),
      pool: th.categories,
      themeNom: th.nom,
      options: {
        nbCategories: parseInt($('opt-nb').value, 10),
        manches: parseInt($('opt-manches').value, 10),
        compte: parseInt($('opt-compte').value, 10),
        duree: parseInt($('opt-duree').value, 10),
        changer: $('opt-changer').checked,
        difficiles: $('opt-difficiles').checked,
      },
    };
  },
  validerEnLigne: () => (Object.keys(THEMES).length ? '' : 'Les catégories se chargent, réessaie dans une seconde.'),
  demarrer: (s) => R.nouvellePartie(s),
  afficher: (s, place) => {
    const avant = etat;
    etat = R.normaliser(s);
    maPlace = place;
    rendre(avant);
  },
  secret: false,
});
initRegles();
const agir = (fn) => salon.agir((s) => fn(R.normaliser(s)));
const moi = () => etat.players[maPlace];
const hote = () => maPlace === 0;

// ---------- Minuteries (chaque téléphone les compte de son côté) ----------
let mancheVue = '';      // manche en cours (pour le temps maximum)
let debutLocal = 0;
let stopVu = null;       // STOP en cours
let stopLocal = 0;
let verrouille = false;  // le temps est écoulé : on n'écrit plus
const cleManche = () => `${etat.partie}-${etat.manche}`;
const compte = () => (etat.options.compte || 10) * 1000;

setInterval(() => {
  if (!etat || etat.status !== 'jeu') { $('rebours').hidden = true; return; }
  const maintenant = Date.now();
  // temps maximum : la manche s'arrête toute seule
  const duree = (etat.options.duree || 0) * 1000;
  if (duree && !etat.stop && maintenant - debutLocal > duree) agir((s) => (s.status === 'jeu' && s.partie === etat.partie && s.manche === etat.manche ? R.stop(s, -1) : false));
  if (!etat.stop) {
    if (duree) {
      const reste = Math.max(0, Math.ceil((duree - (maintenant - debutLocal)) / 1000));
      $('info').textContent = `Temps restant : ${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, '0')}`;
    }
    return;
  }
  // compte à rebours après le STOP
  const reste = compte() - (maintenant - stopLocal);
  const rb = $('rebours');
  rb.hidden = reste <= -800;
  $('rebours-n').textContent = reste > 0 ? String(Math.ceil(reste / 1000)) : 'Stylos levés !';
  if (reste <= 0 && !verrouille) {
    verrouille = true;
    enregistrer(true);
    verrouillerGrille();
  }
  // un peu plus tard (le temps que les dernières réponses arrivent) : place à la vérification
  if (reste < -2500) agir((s) => (s.status === 'jeu' && s.stop && s.stop.n === stopVu ? R.fermer(s) : false));
}, 250);

// ---------- Écrire ses réponses ----------
let grilleVue = '';
let minuterieSauvegarde = null;
function valeurs() { return [...$('grille').querySelectorAll('input')].map((i) => i.value); }
function enregistrer(maintenant = false) {
  clearTimeout(minuterieSauvegarde);
  const go = () => {
    const v = valeurs();
    agir((s) => (s.status === 'jeu' && s.partie === etat.partie && s.manche === etat.manche ? R.ecrire(s, maPlace, v) : false));
  };
  if (maintenant) go(); else minuterieSauvegarde = setTimeout(go, 450);
}
function construireGrille() {
  const g = $('grille');
  const cle = `${cleManche()}-${etat.categories.join('|')}`;
  if (cle === grilleVue) return;
  grilleVue = cle;
  verrouille = false;
  g.innerHTML = '';
  etat.categories.forEach((c, k) => {
    const l = el('label', 'ligne-pb');
    l.appendChild(el('span', 'cat-pb', c));
    const i = el('input');
    i.type = 'text';
    i.maxLength = 40;
    i.autocapitalize = 'words';
    i.spellcheck = false;
    i.placeholder = `${etat.lettre}…`;
    i.value = moi().reponses[k] || '';
    i.addEventListener('input', () => { majLigne(i); majStop(); enregistrer(); });
    i.addEventListener('blur', () => enregistrer(true));
    i.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const suivant = g.querySelectorAll('input')[k + 1];
      if (suivant) suivant.focus(); else i.blur();
    });
    l.appendChild(i);
    g.appendChild(l);
    majLigne(i);
  });
  g.onsubmit = (e) => e.preventDefault();
}
// la réponse ne commence pas par la bonne lettre : on le signale
function majLigne(i) {
  const v = i.value.trim();
  i.classList.toggle('mauvaise', !!v && !R.commencePar(v, etat.lettre));
  i.classList.toggle('remplie', !!v);
}
function verrouillerGrille() { $('grille').querySelectorAll('input').forEach((i) => { i.disabled = true; }); }
function majStop() {
  const b = $('btn-stop');
  const plein = valeurs().every((v) => v.trim());
  b.disabled = !plein || !!etat.stop || etat.status !== 'jeu';
  b.textContent = etat.stop ? 'STOP !' : plein ? 'STOP !' : `STOP (${valeurs().filter((v) => v.trim()).length}/${etat.categories.length})`;
}
$('btn-stop').addEventListener('click', () => {
  const v = valeurs();
  if (!v.every((x) => x.trim())) return;
  agir((s) => {
    if (s.status !== 'jeu' || s.stop) return false;
    R.ecrire(s, maPlace, v);
    return R.stop(s, maPlace);
  });
});

// ---------- Vérifier les réponses ----------
const ETATS = {
  ok: { t: '+10', c: 'ok' }, double: { t: '+5', c: 'double' }, vide: { t: '0', c: 'zero' },
  lettre: { t: 'mauvaise lettre', c: 'zero' }, refusee: { t: 'refusée', c: 'zero' },
};
function rendreVote() {
  const zone = $('vote');
  zone.innerHTML = '';
  const calc = R.calculer(etat);
  zone.appendChild(el('p', 'aide-pb', 'Touche 👎 pour contester une réponse des autres. La majorité décide.'));
  etat.categories.forEach((c, k) => {
    const carte = el('div', 'carte-pb');
    carte.appendChild(el('h3', '', c));
    etat.players.forEach((p, i) => {
      const ligne = el('div', 'reponse-pb');
      const st = calc.statut[i][k];
      ligne.classList.add(`st-${st}`);
      ligne.appendChild(el('span', 'qui-pb', i === maPlace ? 'Toi' : p.name));
      ligne.appendChild(el('span', 'mot-pb', p.reponses[k] || '—'));
      ligne.appendChild(el('span', `pts-pb ${ETATS[st].c}`, ETATS[st].t));
      const n = R.contestations(etat, k, i);
      if (i !== maPlace && p.reponses[k] && st !== 'lettre') {
        const b = el('button', `contre-pb${R.aConteste(etat, k, i, maPlace) ? ' actif' : ''}`, `👎${n ? ` ${n}` : ''}`);
        b.type = 'button';
        b.title = 'Contester cette réponse';
        b.addEventListener('click', () => agir((s) => R.contester(s, maPlace, k, i)));
        ligne.appendChild(b);
      } else {
        ligne.appendChild(el('span', 'contre-pb muet', n ? `👎 ${n}` : ''));
      }
      carte.appendChild(ligne);
    });
    zone.appendChild(carte);
  });
  const prets = etat.players.filter((p) => p.pret).length;
  const pied = el('div', 'actions-pb');
  const b = el('button', `btn-pb${moi().pret ? '' : ' principal'}`, moi().pret ? `✓ Prêt (${prets}/${etat.players.length}) · annuler` : `J'ai vérifié (${prets}/${etat.players.length})`);
  b.type = 'button';
  b.addEventListener('click', () => agir((s) => R.pret(s, maPlace)));
  pied.appendChild(b);
  if (hote()) {
    const f = el('button', 'btn-pb discret', 'Compter les points maintenant');
    f.type = 'button';
    f.addEventListener('click', () => { if (confirm('Compter les points sans attendre tout le monde ?')) agir((s) => R.compter(s)); });
    pied.appendChild(f);
  }
  zone.appendChild(pied);
}

// ---------- Résultats ----------
function rendreBilan() {
  const zone = $('bilan');
  zone.innerHTML = '';
  const fin = etat.status === 'fin';
  const cl = R.classement(etat);
  zone.appendChild(el('h2', '', fin ? `${cl[0].nom} gagne la partie !` : `Résultats de la manche ${etat.manche}`));
  const table = el('table', 'table-pb');
  const tete = el('tr');
  ['', fin ? 'Dernière manche' : 'Manche', 'Total'].forEach((h) => tete.appendChild(el('th', '', h)));
  table.appendChild(tete);
  cl.forEach((x, rang) => {
    const p = etat.players[x.i];
    const tr = el('tr', x.i === maPlace ? 'moi' : '');
    tr.append(el('td', 'nom', `${fin ? ['🥇', '🥈', '🥉'][rang] || `${rang + 1}.` : ''} ${p.name}`.trim()),
      el('td', '', `+${p.historique[p.historique.length - 1] || 0}`), el('td', 'total', String(p.score)));
    table.appendChild(tr);
  });
  zone.appendChild(table);
  // le détail de la manche
  if (etat.resultats) {
    const det = el('details', 'detail-pb');
    det.appendChild(el('summary', '', 'Voir toutes les réponses'));
    etat.categories.forEach((c, k) => {
      const d = el('div', 'carte-pb');
      d.appendChild(el('h3', '', c));
      etat.players.forEach((p, i) => {
        const st = etat.resultats.statut[i] ? etat.resultats.statut[i][k] : 'vide';
        const l = el('div', `reponse-pb st-${st}`);
        l.append(el('span', 'qui-pb', p.name), el('span', 'mot-pb', p.reponses[k] || '—'), el('span', `pts-pb ${ETATS[st] ? ETATS[st].c : ''}`, ETATS[st] ? ETATS[st].t : ''));
        d.appendChild(l);
      });
      det.appendChild(d);
    });
    zone.appendChild(det);
  }
  const pied = el('div', 'actions-pb');
  if (hote()) {
    if (fin) {
      const b = el('button', 'btn-pb principal', 'Nouvelle partie');
      b.type = 'button';
      b.addEventListener('click', () => agir((s) => (s.status === 'fin' ? R.nouvellePartie(s) : false)));
      pied.appendChild(b);
    } else {
      const b = el('button', 'btn-pb principal', `Manche ${etat.manche + 1}`);
      b.type = 'button';
      b.addEventListener('click', () => agir((s) => R.mancheSuivante(s)));
      pied.appendChild(b);
      if (!etat.options.manches) {
        const t = el('button', 'btn-pb discret', 'Terminer la partie');
        t.type = 'button';
        t.addEventListener('click', () => agir((s) => R.terminer(s)));
        pied.appendChild(t);
      }
    }
  } else pied.appendChild(el('p', 'aide-pb', `En attente de ${etat.players[0].name} pour la suite…`));
  zone.appendChild(pied);
}

// ---------- Affichage ----------
function rendreEntete(avant) {
  const L = $('lettre');
  if (L.textContent !== etat.lettre) {
    L.textContent = etat.lettre;
    if (avant) L.animate([{ transform: 'rotateY(90deg) scale(.6)', opacity: 0 }, { transform: 'rotateY(-10deg) scale(1.1)', opacity: 1, offset: 0.7 }, { transform: 'none' }], { duration: 650, easing: 'ease-out' });
  }
  const m = etat.options.manches;
  $('manche').textContent = `Manche ${etat.manche}${m ? ` / ${m}` : ''} · ${etat.themeNom || ''}`;
  const info = $('info');
  if (etat.status === 'jeu' && !etat.stop && !(etat.options.duree > 0)) info.textContent = 'Trouve un mot pour chaque catégorie !';
  else if (etat.status === 'vote') info.textContent = 'Vérification des réponses';
  else if (etat.status === 'bilan' || etat.status === 'fin') info.textContent = '';
  const zone = $('joueurs');
  zone.innerHTML = '';
  etat.players.forEach((p, i) => {
    let t = `${p.score} pts`;
    if (etat.status === 'jeu') t = `${p.reponses.filter((r) => String(r).trim()).length}/${etat.categories.length}`;
    if (etat.status === 'vote') t = p.pret ? '✓ prêt' : 'vérifie…';
    zone.appendChild(el('span', `puce-pb${i === maPlace ? ' moi' : ''}`, `${i === maPlace ? 'Toi' : p.name} · ${t}`));
  });
}

function rendre(avant) {
  if (!etat || !etat.players[maPlace]) return;
  // nouvelle manche, nouveau STOP : on note l'heure (sur ce téléphone)
  if (etat.status === 'jeu' && cleManche() !== mancheVue) { mancheVue = cleManche(); debutLocal = Date.now(); stopVu = null; verrouille = false; }
  if (etat.status === 'jeu' && etat.stop && etat.stop.n !== stopVu) {
    stopVu = etat.stop.n;
    stopLocal = Date.now();
    const qui = etat.stop.par < 0 ? 'Temps écoulé !' : etat.stop.par === maPlace ? 'Tu as dit STOP !' : `${etat.players[etat.stop.par].name} a dit STOP !`;
    $('rebours-qui').textContent = qui;
    if (navigator.vibrate) navigator.vibrate(200);
  }
  rendreEntete(avant);
  const jeu = etat.status === 'jeu';
  $('grille').hidden = !jeu;
  $('pied').hidden = !jeu;
  $('vote').hidden = etat.status !== 'vote';
  $('bilan').hidden = !['bilan', 'fin'].includes(etat.status);
  if (jeu) { construireGrille(); majStop(); if (verrouille) verrouillerGrille(); }
  if (etat.status === 'vote') rendreVote();
  if (etat.status === 'bilan' || etat.status === 'fin') rendreBilan();
  if (avant && avant.status === 'jeu' && etat.status === 'vote') window.scrollTo({ top: 0 });
  if (avant && avant.status !== etat.status && (etat.status === 'bilan' || etat.status === 'fin')) window.scrollTo({ top: 0 });
  if (avant && avant.status !== 'jeu' && jeu) { window.scrollTo({ top: 0 }); toast(`Nouvelle lettre : ${etat.lettre} !`); }
}
