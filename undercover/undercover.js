import { $, el, initSalon, initRegles, de } from '../commun/salon.js';
import { THEMES, chargerThemes } from './mots.js';
import {
  NOMS_ROLES, normaliser, compositionDemandee, erreurComposition, nouvellePartie, vivants, peutVoterPour,
  actVu, actIndice, actVote, actEliminer, actDeviner, actTourSuivant, actNouvellePartie,
} from './regles.js';
const COULEURS = ['#E0445A', '#4F8DE0', '#3FA56B', '#F2B632', '#A66BE0', '#E07A3F', '#3FC1C9', '#E06BB0', '#8BC34A', '#C9A24A', '#7A8BE0', '#E0C93F', '#5FD3A0', '#D0705F', '#9E9E9E', '#6BB5E0'];

// =====================================================================
// Salon
// =====================================================================
let etat = null;
let maPlace = 0;
let motVisible = false;      // en ligne : le mot est caché tant qu'on ne touche pas la carte
let selectionLocale = -1;    // sur un seul téléphone : joueur désigné avant confirmation
let brouillon = '';          // indice ou proposition en cours de saisie (gardé entre deux affichages)
let dernierePartie = null;

const lireReglages = () => ({
  theme: (document.querySelector('input[name="theme"]:checked') || {}).value || 'general',
  undercover: $('reglage-undercover').value,
  mrwhite: $('reglage-mrwhite').value,
});

// Aperçu de la composition sous les réglages
function majApercu() {
  const local = !$('volet-local').hidden;
  const n = parseInt($(local ? 'local-nb' : 'nb-joueurs').value, 10);
  const r = lireReglages();
  const err = erreurComposition(n, r);
  const { u, w, c } = compositionDemandee(n, r);
  const morceaux = [`${c} civil${c > 1 ? 's' : ''}`, `${u} Undercover`];
  if (w) morceaux.push('Mister White');
  $('compo-apercu').textContent = err || `Avec ${n} joueurs : ${morceaux.join(', ')}.`;
  $('compo-apercu').classList.toggle('erreur', !!err);
}
['nb-joueurs', 'local-nb', 'reglage-undercover', 'reglage-mrwhite'].forEach((id) => $(id).addEventListener('change', majApercu));
// Les thèmes (et leurs paires) sont lus dans paires.txt
function construireThemes() {
  const zone = $('themes');
  const avant = (document.querySelector('input[name="theme"]:checked') || {}).value || 'general';
  zone.innerHTML = '';
  const choix = [...Object.entries(THEMES).map(([id, th]) => [id, th.nom, `${th.desc ? `${th.desc} · ` : ''}${th.paires.length} paires`]),
    ['melange', 'Tous les thèmes', 'Un thème au hasard à chaque partie']];
  choix.forEach(([id, nom, desc]) => {
    const l = el('label', 'theme');
    const r = el('input');
    r.type = 'radio'; r.name = 'theme'; r.value = id;
    r.checked = id === avant || (!THEMES[avant] && avant !== 'melange' && id === Object.keys(THEMES)[0]);
    r.addEventListener('change', majApercu);
    const sp = el('span');
    sp.append(el('strong', '', nom), el('small', '', desc));
    l.append(r, sp);
    zone.appendChild(l);
  });
}
chargerThemes().then(construireThemes);
document.querySelectorAll('.onglets [role="tab"]').forEach((o) => o.addEventListener('click', () => setTimeout(majApercu)));
majApercu();
// les réglages se placent juste au-dessus du bouton qui lance la partie (« Créer un salon » ou « Commencer »)
function placerReglages() {
  const cible = $('volet-local').hidden ? $('btn-creer') : $('btn-local');
  cible.before($('reglages'));
}
document.querySelectorAll('.onglets [role="tab"], [data-aller-volet]').forEach((o) => o.addEventListener('click', () => setTimeout(placerReglages)));
placerReglages();

const salon = initSalon({
  jeu: 'undercover',
  etatInitial: (nom, nb) => ({
    players: Array.from({ length: nb }, (_, i) => ({ name: i === 0 ? nom : 'En attente', joined: i === 0, score: 0 })),
    reglages: lireReglages(),
  }),
  validerLocal: () => erreurComposition(parseInt($('local-nb').value, 10), lireReglages()),
  validerEnLigne: () => erreurComposition(parseInt($('nb-joueurs').value, 10), lireReglages()),
  demarrer: (s) => nouvellePartie(s),
  afficher: (s, place) => {
    etat = normaliser(s);
    if (maPlace !== place) { motVisible = false; brouillon = ''; }
    if (dernierePartie !== etat.partie) { dernierePartie = etat.partie; motVisible = false; selectionLocale = -1; brouillon = ''; }
    maPlace = place;
    rendre();
  },
  // Sur un seul téléphone : on se passe l'appareil seulement pour découvrir son mot
  quiDoitJouer: (s) => {
    if (s.status !== 'jeu' || s.phase !== 'mots') return -1;
    return (s.players || []).findIndex((p) => !p.vu);
  },
  secret: true,
});
initRegles();

function agir(fn) {
  return salon.agir((s) => (fn(normaliser(s)) === false ? false : undefined));
}

// =====================================================================
// Affichage
// =====================================================================
const local = () => salon.estLocal();
const nom = (i) => (etat.players[i] ? etat.players[i].name : '?');

function pastilleRole(role) {
  return el('span', `role role-${role}`, NOMS_ROLES[role] || '?');
}
function avatar(i) {
  const a = el('span', 'avatar', (nom(i)[0] || '?').toUpperCase());
  a.style.setProperty('--c', COULEURS[i % COULEURS.length]);
  return a;
}

function rendre() {
  const s = etat;
  const moi = s.players[maPlace] || {};
  $('uc-tour').textContent = s.status === 'fin' ? `Partie ${s.partie} terminée` : (s.phase === 'mots' ? `Partie ${s.partie}` : `Partie ${s.partie} · Tour ${s.tour}`);
  $('uc-theme').textContent = THEMES[s.themeJoue] ? THEMES[s.themeJoue].nom : '';
  rendreStatut();
  rendreMot(moi);
  rendreAction(moi);
  rendreJoueurs();
  $('uc-joueurs').hidden = s.status === 'fin'; // le tableau de fin montre déjà tout le monde
  rendreIndices();
  $('btn-revoir').hidden = !(local() && s.status === 'jeu' && s.phase !== 'mots');
}

function rendreStatut() {
  const s = etat;
  const moi = s.players[maPlace] || {};
  const st = $('statut');
  let texte = '';
  let aMoi = false;
  if (s.status === 'fin') texte = '';
  else if (s.phase === 'mots') {
    if (local()) texte = moi.vu ? 'C\'est noté !' : `${moi.name}, découvre ton mot en secret.`;
    else if (!moi.vu) { texte = 'Découvre ton mot, puis touche « J\'ai vu mon mot ».'; aMoi = true; }
    else texte = `En attente : ${s.players.filter((p) => !p.vu).map((p) => p.name).join(', ')}.`;
  } else if (s.phase === 'indices') {
    const qui = s.ordre[s.parle];
    if (local()) texte = `${nom(qui)}, donne ton indice à voix haute.`;
    else if (qui === maPlace) { texte = 'À toi : donne un indice en un seul mot.'; aMoi = true; }
    else texte = `${nom(qui)} cherche son indice…`;
  } else if (s.phase === 'vote') {
    const egal = s.candidats ? `Égalité entre ${s.candidats.map(nom).join(' et ')} : on revote entre eux. ` : '';
    if (local()) texte = `${egal}Discutez, puis touchez le joueur que vous éliminez.`;
    else if (!moi.vivant) texte = `${egal}Tu n'es plus en jeu : regarde les autres voter.`;
    else if (moi.vote < 0) { texte = `${egal}Vote pour le joueur le plus suspect.`; aMoi = true; }
    else {
      const attente = vivants(s).filter((k) => s.players[k].vote < 0).map(nom);
      texte = `${egal}Tu votes contre ${nom(moi.vote)}. En attente : ${attente.join(', ')}.`;
    }
  } else if (s.phase === 'mrwhite') {
    const w = s.elimine.joueur;
    texte = local() || w === maPlace ? 'Mister White a été démasqué ! Dernière chance : deviner le mot des civils.' : `${nom(w)} était Mister White ! Il cherche le mot des civils…`;
    aMoi = !local() && w === maPlace;
  } else if (s.phase === 'revelation') texte = '';
  st.textContent = texte;
  st.hidden = !texte;
  st.classList.toggle('a-toi', aMoi);
}

// En ligne : la carte « Ton mot », cachée tant qu'on ne la touche pas
function rendreMot(moi) {
  const zone = $('uc-mot');
  zone.innerHTML = '';
  const s = etat;
  zone.hidden = local() || s.status !== 'jeu' || s.phase === 'mots' || !moi.role;
  if (zone.hidden) return;
  const carte = el('button', 'carte-mot' + (motVisible ? ' visible' : ''));
  carte.type = 'button';
  if (!motVisible) carte.append(el('span', 'carte-mot-titre', 'Ton mot'), el('span', 'carte-mot-cache', 'Touche pour le voir'));
  else carte.append(...contenuMot(moi, true));
  carte.addEventListener('click', () => { motVisible = !motVisible; rendreMot(moi); });
  zone.appendChild(carte);
}

// Le mot d'un joueur (ou le message de Mister White)
function contenuMot(p, petit = false) {
  if (p.role === 'mrwhite') {
    return [el('span', 'carte-mot-titre', 'Tu es'), el('strong', 'carte-mot-texte mrwhite', 'Mister White'),
      el('span', 'carte-mot-aide', petit ? 'Tu n\'as pas de mot : bluffe !' : 'Tu n\'as pas de mot. Écoute les indices des autres et bluffe pour ne pas te faire repérer (si tu parles en premier, reste vague !). Si tu es éliminé, tu pourras deviner le mot des civils.')];
  }
  return [el('span', 'carte-mot-titre', 'Ton mot'), el('strong', 'carte-mot-texte', p.mot),
    el('span', 'carte-mot-aide', petit ? 'Touche pour le cacher' : 'Retiens-le bien. Tu ne sais pas si tu es civil ou Undercover : écoute les autres !')];
}

function bouton(texte, classe, fn) {
  const b = el('button', `btn ${classe || ''}`, texte);
  b.type = 'button';
  b.addEventListener('click', fn);
  return b;
}

function champTexte(placeholder, envoyer, libelle) {
  const ligne = el('form', 'uc-saisie');
  const input = el('input');
  input.maxLength = 40;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.value = brouillon;
  input.addEventListener('input', () => { brouillon = input.value; });
  const b = el('button', 'btn btn-principal', libelle);
  b.type = 'submit';
  ligne.append(input, b);
  ligne.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t) { input.focus(); return; }
    brouillon = '';
    envoyer(t);
  });
  setTimeout(() => input.focus({ preventScroll: true }));
  return ligne;
}

function rendreAction(moi) {
  const s = etat;
  const zone = $('uc-action');
  zone.innerHTML = '';
  zone.className = 'uc-action';

  if (s.status === 'fin') { rendreFin(zone); return; }

  if (s.phase === 'mots') {
    // sur un seul téléphone, seul le joueur qui a l'appareil en main peut découvrir son mot
    const suivant = s.players.findIndex((p) => !p.vu);
    if (local() && suivant >= 0 && suivant !== maPlace) {
      zone.appendChild(el('p', 'uc-info', `Passe le téléphone à ${nom(suivant)}.`));
      return;
    }
    if (!moi.vu && !motVisible) {
      // le mot reste caché tant que le joueur ne touche pas la carte (personne ne regarde par-dessus son épaule)
      const carte = el('button', 'carte-mot grande');
      carte.type = 'button';
      carte.append(el('span', 'carte-mot-titre', local() ? `Mot ${de(moi.name)}` : 'Ton mot'), el('span', 'carte-mot-cache', 'Touche pour le découvrir'));
      carte.addEventListener('click', () => { motVisible = true; rendre(); });
      zone.appendChild(carte);
    } else if (!moi.vu) {
      const carte = el('div', 'carte-mot visible grande');
      carte.append(...contenuMot(moi));
      zone.append(carte, bouton(local() ? 'J\'ai retenu mon mot' : 'J\'ai vu mon mot', 'btn-principal', () => {
        motVisible = false;
        agir((x) => actVu(x, maPlace));
      }));
    } else if (!local()) {
      zone.appendChild(el('p', 'uc-info', 'Les autres découvrent leur mot…'));
    }
    return;
  }

  if (s.phase === 'indices') {
    const qui = s.ordre[s.parle];
    // ordre de parole
    const ordre = el('ol', 'uc-ordre');
    s.ordre.forEach((k, n) => {
      const li = el('li', n < s.parle ? 'fait' : n === s.parle ? 'actuel' : '');
      li.append(avatar(k), el('span', '', nom(k)));
      ordre.appendChild(li);
    });
    zone.appendChild(ordre);
    if (local()) {
      const dernier = s.parle >= s.ordre.length - 1;
      zone.appendChild(bouton(dernier ? 'Tout le monde a parlé : voter' : `Indice donné, au tour ${de(nom(s.ordre[s.parle + 1]))}`, 'btn-principal',
        () => agir((x) => actIndice(x, qui, ''))));
    } else if (qui === maPlace) {
      zone.appendChild(champTexte('Ton indice (un mot)', (t) => agir((x) => actIndice(x, maPlace, t)), 'Envoyer'));
    }
    return;
  }

  if (s.phase === 'vote') {
    if (local()) {
      if (selectionLocale >= 0 && s.players[selectionLocale] && s.players[selectionLocale].vivant) {
        zone.appendChild(bouton(`Éliminer ${nom(selectionLocale)}`, 'btn-principal btn-eliminer', () => {
          const j = selectionLocale;
          selectionLocale = -1;
          agir((x) => actEliminer(x, j));
        }));
      } else {
        zone.appendChild(el('p', 'uc-info', 'Touchez un joueur ci-dessous.'));
      }
    } else if (moi.vivant) {
      zone.appendChild(el('p', 'uc-info', moi.vote >= 0 ? 'Tu peux changer ton vote tant que tout le monde n\'a pas voté.' : 'Touche un joueur ci-dessous pour voter contre lui.'));
    }
    return;
  }

  if (s.phase === 'mrwhite') {
    zone.appendChild(carteElimine());
    if (local() || s.elimine.joueur === maPlace) {
      zone.appendChild(champTexte('Le mot des civils', (t) => agir((x) => actDeviner(x, s.elimine.joueur, t)), 'Deviner'));
    }
    return;
  }

  if (s.phase === 'revelation') {
    zone.appendChild(carteElimine());
    zone.appendChild(bouton('Tour suivant', 'btn-principal', () => agir((x) => actTourSuivant(x))));
  }
}

// Le joueur éliminé, son rôle et le détail des votes
function carteElimine() {
  const s = etat;
  const e = s.elimine;
  const carte = el('div', `uc-elimine role-fond-${e.role}`);
  const tete = el('div', 'uc-elimine-tete');
  tete.append(avatar(e.joueur), el('strong', '', `${nom(e.joueur)} sort du jeu`));
  carte.appendChild(tete);
  const ligne = el('p', 'uc-elimine-role');
  ligne.append('C\'était ', pastilleRole(e.role));
  carte.appendChild(ligne);
  const messages = {
    civil: 'Aïe, un civil de moins…',
    undercover: 'Bien vu, un Undercover de moins !',
    mrwhite: 'Bien vu, Mister White est démasqué !',
  };
  carte.appendChild(el('p', 'uc-elimine-message', messages[e.role]));
  if (s.devinette) {
    carte.appendChild(el('p', 'uc-elimine-message', `Mister White a proposé « ${s.devinette.texte} » : ${s.devinette.juste ? 'c\'est le bon mot !' : 'raté !'}`));
  }
  if (e.tirage) carte.appendChild(el('p', 'uc-detail', `Encore une égalité entre ${e.tirage.map(nom).join(' et ')} : le sort a désigné ${nom(e.joueur)}.`));
  if (e.votes && e.votes.length) {
    const v = el('p', 'uc-detail');
    v.textContent = 'Votes : ' + e.votes.map(([a, b]) => `${nom(a)} → ${nom(b)}`).join(', ');
    carte.appendChild(v);
  }
  return carte;
}

function rendreJoueurs() {
  const s = etat;
  const zone = $('uc-joueurs');
  zone.innerHTML = '';
  const moi = s.players[maPlace] || {};
  const enVote = s.status === 'jeu' && s.phase === 'vote';
  s.players.forEach((p, i) => {
    const b = el('button', 'uc-joueur');
    b.type = 'button';
    if (!p.vivant) b.classList.add('elimine');
    if (s.status === 'jeu' && s.phase === 'indices' && s.ordre[s.parle] === i) b.classList.add('parle');
    if (!local() && i === maPlace) b.classList.add('moi');
    b.append(avatar(i));
    const texte = el('span', 'uc-joueur-texte');
    texte.appendChild(el('span', 'uc-joueur-nom', p.name + (!local() && i === maPlace ? ' (toi)' : '')));
    // ligne d'état
    let etatTexte = '';
    if (!p.vivant || s.status === 'fin') {
      texte.appendChild(pastilleRole(p.role));
    } else if (s.phase === 'mots') etatTexte = p.vu ? 'a vu son mot' : '…';
    else if (enVote && !local()) etatTexte = p.vote >= 0 ? 'a voté ✓' : 'vote…';
    else if (s.phase === 'indices') {
      const ind = s.indices.find((x) => x.tour === s.tour && x.joueur === i);
      if (ind) etatTexte = `« ${ind.texte} »`;
    }
    if (etatTexte) texte.appendChild(el('span', 'uc-joueur-etat', etatTexte));
    b.appendChild(texte);
    b.appendChild(el('span', 'uc-joueur-score', `${p.score} pt${p.score > 1 ? 's' : ''}`));

    // vote
    const peutVoter = enVote && p.vivant && (local() ? (!s.candidats || s.candidats.includes(i)) : (moi.vivant && peutVoterPour(s, maPlace, i)));
    if (peutVoter) {
      b.classList.add('votable');
      if (local() ? selectionLocale === i : moi.vote === i) b.classList.add('vise');
      b.addEventListener('click', () => {
        if (local()) { selectionLocale = selectionLocale === i ? -1 : i; rendre(); return; }
        agir((x) => actVote(x, maPlace, i));
      });
    } else {
      b.disabled = true;
    }
    zone.appendChild(b);
  });
}

// En ligne : les indices écrits, tour par tour
function rendreIndices() {
  const s = etat;
  const zone = $('uc-indices');
  zone.innerHTML = '';
  zone.hidden = local() || !s.indices.length;
  if (zone.hidden) return;
  zone.appendChild(el('h3', '', 'Indices'));
  const tours = [...new Set(s.indices.map((x) => x.tour))].sort((a, b) => b - a);
  tours.forEach((t) => {
    const bloc = el('div', 'uc-indices-tour');
    bloc.appendChild(el('span', 'uc-indices-titre', `Tour ${t}`));
    const liste = el('ul');
    s.indices.filter((x) => x.tour === t).forEach((x) => {
      const li = el('li');
      li.append(el('span', 'uc-indices-nom', nom(x.joueur)), el('span', 'uc-indices-mot', x.texte));
      liste.appendChild(li);
    });
    bloc.appendChild(liste);
    // éliminé à la fin de ce tour
    const elim = s.historique.find((h) => h.tour === t);
    if (elim) {
      const e = el('p', 'uc-indices-elim');
      e.append(`Sorti du jeu : ${nom(elim.joueur)}`, pastilleRole(elim.role));
      bloc.appendChild(e);
    }
    zone.appendChild(bloc);
  });
}

function rendreFin(zone) {
  const s = etat;
  const camp = s.resultat ? s.resultat.camp : '';
  const titres = {
    civils: 'Les civils gagnent !',
    imposteurs: s.compo && s.compo.w && s.players.some((p) => p.role === 'mrwhite' && p.vivant) && !s.players.some((p) => p.role === 'undercover' && p.vivant)
      ? 'Mister White gagne !' : 'Les imposteurs gagnent !',
    mrwhite: 'Mister White gagne !',
  };
  const bandeau = el('div', `uc-fin uc-fin-${camp}`);
  bandeau.appendChild(el('h2', '', titres[camp] || 'Fin de la partie'));
  if (s.elimine && (camp === 'mrwhite' || s.phase === 'fin')) {
    const e = s.elimine;
    const p = el('p', 'uc-fin-detail');
    if (camp === 'mrwhite') p.textContent = `${nom(e.joueur)} a deviné le mot des civils : « ${s.motCivil} » !`;
    else {
      p.append(`Dernier sorti du jeu : ${nom(e.joueur)}`, pastilleRole(e.role));
      if (s.devinette) p.append(`Mister White avait proposé « ${s.devinette.texte} ».`);
    }
    bandeau.appendChild(p);
  }
  const mots = el('div', 'uc-fin-mots');
  const m1 = el('div', 'uc-fin-mot');
  m1.append(el('span', '', 'Mot des civils'), el('strong', '', s.motCivil));
  const m2 = el('div', 'uc-fin-mot undercover');
  m2.append(el('span', '', 'Mot des Undercover'), el('strong', '', s.motUndercover));
  mots.append(m1, m2);
  bandeau.appendChild(mots);

  // tableau des joueurs : rôle, mot, points gagnés, total
  const table = el('ol', 'uc-fin-joueurs');
  s.players.map((p, i) => i).sort((a, b) => s.players[b].score - s.players[a].score).forEach((i) => {
    const p = s.players[i];
    const li = el('li', p.gain ? 'gagnant' : '');
    li.append(avatar(i), el('span', 'uc-fin-nom', p.name), pastilleRole(p.role),
      el('span', 'uc-fin-gain', p.gain ? `+${p.gain}` : ''), el('span', 'uc-fin-total', `${p.score} pt${p.score > 1 ? 's' : ''}`));
    table.appendChild(li);
  });
  bandeau.appendChild(table);

  // thème de la partie suivante
  const choix = el('label', 'uc-fin-theme', 'Thème de la prochaine partie');
  const sel = el('select');
  [...Object.entries(THEMES).map(([id, th]) => [id, th.nom]), ['melange', 'Tous les thèmes']].forEach(([v, t]) => {
    const o = el('option', '', t);
    o.value = v;
    if (v === s.reglages.theme) o.selected = true;
    sel.appendChild(o);
  });
  choix.appendChild(sel);
  bandeau.appendChild(choix);
  bandeau.appendChild(bouton('Nouvelle partie', 'btn-principal', () => agir((x) => actNouvellePartie(x, sel.value))));
  zone.appendChild(bandeau);
}

// ---------- Revoir son mot (un seul téléphone) ----------
$('btn-revoir').addEventListener('click', () => {
  const d = $('dialog-mot');
  const contenu = $('dialog-mot-contenu');
  const liste = () => {
    contenu.innerHTML = '';
    contenu.appendChild(el('p', '', 'Touche ton nom. Les autres, on ne regarde pas !'));
    const grille = el('div', 'uc-revoir-noms');
    etat.players.forEach((p, i) => {
      if (!p.vivant) return;
      const b = bouton(p.name, '', () => {
        contenu.innerHTML = '';
        const carte = el('div', 'carte-mot visible grande');
        carte.append(...contenuMot(p, true));
        contenu.append(carte, bouton('Cacher', 'btn-principal', liste));
      });
      b.prepend(avatar(i));
      grille.appendChild(b);
    });
    contenu.appendChild(grille);
  };
  liste();
  d.showModal();
});
$('dialog-mot-fermer').addEventListener('click', () => $('dialog-mot').close());
$('dialog-mot').addEventListener('close', () => { $('dialog-mot-contenu').innerHTML = ''; });
