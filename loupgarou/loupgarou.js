import { $, el, toast, initSalon, initRegles, de } from '../commun/salon.js';
import * as R from './regles.js';

let etat = null;
let maPlace = 0;
let choix = [];          // joueurs choisis pour l'action en cours
let canal = 'village';   // chat affiché
let carteVue = false;    // carte de rôle retournée (écran de distribution)
let canalChoisi = null;  // chat choisi par un loup pendant la nuit

// ---------- Accueil : nombre de joueurs et composition ----------
const nbSel = $('nb-joueurs');
for (let n = 4; n <= 18; n++) nbSel.appendChild(new Option(`${n} joueurs`, String(n), n === 8, n === 8));
const zoneRoles = $('roles-choix');
const PAR_DEFAUT = ['voyante', 'sorciere', 'chasseur', 'cupidon'];
R.SPECIAUX.forEach((r) => {
  const l = el('label', 'role-option');
  const c = el('input');
  c.type = 'checkbox';
  c.id = `role-${r}`;
  c.checked = PAR_DEFAUT.includes(r);
  const d = R.ROLES[r];
  l.append(c, el('span', 'ico', d.ico), el('span', '', d.nom));
  l.title = d.texte;
  zoneRoles.appendChild(l);
  c.addEventListener('change', majCompo);
});
let loupsTouches = false;
$('nb-loups').addEventListener('change', () => { loupsTouches = true; majCompo(); });
nbSel.addEventListener('change', () => {
  if (!loupsTouches) $('nb-loups').value = String(R.loupsConseilles(parseInt(nbSel.value, 10)));
  majCompo();
});
function compoChoisie() {
  const c = { loups: parseInt($('nb-loups').value, 10) || 1 };
  R.SPECIAUX.forEach((r) => { if ($(`role-${r}`).checked) c[r] = true; });
  return c;
}
function texteCompo(c, n) {
  const liste = R.compositionListe(c, n);
  const compte = {};
  liste.forEach((r) => { compte[r] = (compte[r] || 0) + 1; });
  const pluriel = (r, k) => (k < 2 ? R.ROLES[r].nom : r === 'loup' ? 'Loups-Garous' : r === 'villageois' ? 'Villageois' : `${R.ROLES[r].nom}s`);
  return Object.entries(compte).map(([r, k]) => `${R.ROLES[r].ico} ${k > 1 ? `${k} ` : ''}${pluriel(r, k)}`).join(' · ');
}
function majCompo() {
  const n = parseInt(nbSel.value, 10);
  const c = compoChoisie();
  const err = R.erreurComposition(c, n);
  $('compo').textContent = err || `${texteCompo(c, n)} (conseillé : ${R.loupsConseilles(n)} loup${R.loupsConseilles(n) > 1 ? 's' : ''})`;
  $('compo').classList.toggle('erreur', !!err);
}
$('nb-loups').value = String(R.loupsConseilles(8));
majCompo();

const salon = initSalon({
  jeu: 'loupgarou',
  etatInitial: (nom, nb) => ({
    players: Array.from({ length: nb }, (_, i) => ({ name: i === 0 ? nom : 'En attente', joined: i === 0 })),
    options: { roles: compoChoisie() },
  }),
  validerEnLigne: () => R.erreurComposition(compoChoisie(), parseInt(nbSel.value, 10)),
  demarrer: (s) => R.nouvellePartie(s),
  afficher: (s, place) => {
    const avant = etat;
    if (place !== maPlace || !avant || avant.partie !== s.partie) { choix = []; carteVue = false; }
    if (avant && (avant.status !== s.status || avant.etape !== s.etape || avant.jour !== s.jour)) choix = [];
    if (avant && avant.status !== s.status) { canalChoisi = null; canal = 'village'; }
    etat = R.normaliser(s);
    maPlace = place;
    rendre(avant);
  },
  secret: true,
});
initRegles();
const agir = (fn) => salon.agir((s) => fn(R.normaliser(s)));

// Les étapes qui attendent un délai avancent toutes seules (n'importe quel téléphone s'en charge)
setInterval(() => {
  if (!etat) return;
  if (etat.status === 'nuit' && etat.etapeFin && Date.now() >= etat.etapeFin) agir((s) => R.tic(s));
  majForcer();
}, 1000);

// ---------- Utilitaires d'affichage ----------
const moi = () => etat.players[maPlace];
const nomDe = (i) => (i === maPlace ? 'toi' : etat.players[i].name);
const NomDe = (i) => (i === maPlace ? 'Toi' : etat.players[i].name);
const role = (r) => R.ROLES[r];
// ce que je sais du rôle d'un joueur
function roleConnu(i) {
  const p = etat.players[i];
  const m = moi();
  if (i === maPlace || !p.vivant || etat.status === 'fin' || !m.vivant) return p.role;
  if (R.estLoup(m) && R.estLoup(p)) return p.role === 'loupblanc' && m.role !== 'loupblanc' ? 'loup' : p.role; // le Loup blanc se cache parmi les loups
  if (p.revele) return p.role;
  const vision = m.visions.find((v) => v.cible === i);
  if (vision) return vision.role;
  return null;
}
const amoureuxDe = (i) => {
  const p = etat.players[i];
  if (p.amoureux < 0) return false;
  return i === maPlace || p.amoureux === maPlace || !moi().vivant || etat.status === 'fin';
};

// ---------- Rendu ----------
function rendre(avant) {
  if (!etat) return;
  document.body.classList.toggle('nuit', etat.status === 'nuit' || etat.status === 'roles');
  document.body.classList.toggle('jour', etat.status === 'jour' || etat.status === 'chasseur');
  document.body.classList.toggle('mort', !moi().vivant && etat.status !== 'fin');
  rendreCiel();
  rendreMonRole();
  rendreAnnonce(avant);
  rendreAction();
  rendreVillage();
  rendreChat();
  rendreJournal();
  majForcer();
}

function rendreCiel() {
  const p = moi();
  let phase = '';
  let narr = '';
  switch (etat.status) {
    case 'roles':
      phase = 'Le village s\'endort bientôt…';
      narr = `Découvre ton rôle en secret. ${etat.players.filter((q) => q.pret).length} / ${etat.players.length} prêts.`;
      break;
    case 'nuit':
      phase = `🌙 Nuit ${etat.nuit}`;
      narr = R.NARRATION[etat.etape] || 'Le village dort…';
      break;
    case 'jour':
      phase = `☀️ Jour ${etat.jour}`;
      narr = etat.candidats ? 'Égalité ! On revote entre les ex æquo.' : 'Le village débat, puis vote pour éliminer un suspect.';
      break;
    case 'chasseur':
      phase = `☀️ Jour ${etat.jour}`;
      narr = `🏹 Le Chasseur ${etat.players[etat.chasseurs[0]].name} va tirer une dernière balle…`;
      break;
    case 'fin':
      phase = '🏁 Fin de la partie';
      narr = etat.vainqueur ? etat.vainqueur.texte : '';
      break;
    default:
  }
  if (!p.vivant && etat.status !== 'fin') narr = `💀 Tu es mort. ${narr}`;
  $('phase').textContent = phase;
  $('narration').textContent = narr;
}

function rendreMonRole() {
  const p = moi();
  const b = $('mon-role');
  if (!p.role || etat.status === 'roles') { b.hidden = true; return; }
  b.hidden = false;
  b.innerHTML = '';
  b.append(el('span', 'ico', role(p.role).ico), el('span', '', role(p.role).nom));
  if (p.amoureux >= 0) b.appendChild(el('span', 'coeur', `💘 ${etat.players[p.amoureux].name}`));
}
function carteRole(r, avecTexte = true) {
  const d = role(r);
  const c = el('div', `carte-role camp-${d.camp} r-${r}`);
  c.append(el('span', 'carte-ico', d.ico), el('strong', 'carte-nom', d.nom));
  if (avecTexte) c.appendChild(el('p', 'carte-texte', d.texte));
  c.appendChild(el('span', 'carte-camp', d.camp === 'loups' ? (r === 'loupblanc' ? 'Joue pour lui seul' : 'Camp des loups') : 'Camp du village'));
  return c;
}
$('mon-role').addEventListener('click', () => {
  const z = $('dialog-role-contenu');
  z.innerHTML = '';
  const p = moi();
  z.appendChild(carteRole(p.role));
  if (p.amoureux >= 0) z.appendChild(el('p', 'info-role', `💘 Tu es amoureux de ${etat.players[p.amoureux].name}. Si l'un de vous meurt, l'autre meurt de chagrin.`));
  if (R.estLoup(p)) {
    const autres = etat.players.map((q, i) => [q, i]).filter(([q, i]) => i !== maPlace && R.estLoup(q)).map(([q]) => q.name);
    if (autres.length) z.appendChild(el('p', 'info-role', `🐺 Ta meute : ${autres.join(', ')}.`));
  }
  if (p.visions.length) z.appendChild(el('p', 'info-role', `🔮 Tes visions : ${p.visions.map((v) => `${etat.players[v.cible].name} est ${role(v.role).nom}`).join(' · ')}.`));
  if (p.role === 'sorciere') z.appendChild(el('p', 'info-role', `🧪 Potions : vie ${etat.potions.vie ? '✓' : '✗'} · mort ${etat.potions.mort ? '✓' : '✗'}`));
  if (etat.pouvoirsPerdus) z.appendChild(el('p', 'info-role', '⚠️ L\'Ancien a été tué par le village : les villageois ont perdu leurs pouvoirs.'));
  $('dialog-role').showModal();
});
$('fermer-role').addEventListener('click', () => $('dialog-role').close());

// Annonce : les morts de la nuit, le résultat du vote, le tir du chasseur
const CAUSES = {
  loups: 'victime des loups', sorciere: 'victime du poison de la Sorcière', loupblanc: 'victime du Loup blanc',
  chagrin: 'victime du chagrin (son amour est mort)', chasseur: 'victime du tir du Chasseur', vote: 'désigné par le village',
};
function rendreAnnonce(avant) {
  const z = $('annonce');
  z.innerHTML = '';
  let lignes = [];
  let titre = '';
  if (etat.status === 'jour' || (etat.status === 'chasseur' && etat.apres === 'jour')) {
    titre = `Au petit matin du jour ${etat.jour}…`;
    lignes = etat.morts.map((m) => [m.j, `${etat.players[m.j].name} : ${CAUSES[m.cause]}`, m.role]);
    if (!lignes.length) lignes = [[-1, 'Personne n\'est mort cette nuit. 🌅', null]];
  } else if (etat.status === 'nuit' && etat.elimine && etat.nuit === etat.jour + 1) {
    titre = `Le vote du jour ${etat.jour}`;
    if (etat.elimine.idiot) lignes = [[etat.elimine.j, `${etat.players[etat.elimine.j].name} est l'Idiot du village : épargné !`, 'idiot']];
    else lignes = (etat.elimine.morts || []).map((m) => [m.j, `${etat.players[m.j].name} : ${CAUSES[m.cause]}`, m.role]);
  } else if (etat.status === 'nuit' && etat.dernierVote && !etat.elimine && etat.nuit === etat.jour + 1) {
    titre = `Le vote du jour ${etat.jour}`;
    lignes = [[-1, 'Le village n\'a éliminé personne.', null]];
  } else if (etat.status === 'chasseur' && etat.apres === 'nuit' && etat.elimine) {
    titre = 'Le vote du village';
    lignes = (etat.elimine.morts || []).map((m) => [m.j, `${etat.players[m.j].name} : ${CAUSES[m.cause]}`, m.role]);
  }
  if (etat.dernierTir && etat.dernierTir.jour === etat.jour && (etat.status === 'jour' || etat.status === 'nuit') && etat.dernierTir.morts) {
    etat.dernierTir.morts.forEach((m) => { if (!lignes.some((l) => l[0] === m.j)) lignes.push([m.j, `${etat.players[m.j].name} : ${CAUSES[m.cause]}`, m.role]); });
  }
  if (etat.status === 'fin' || etat.status === 'roles' || !lignes.length) { z.hidden = true; return; }
  z.hidden = false;
  z.appendChild(el('p', 'annonce-titre', titre));
  lignes.forEach(([, t, r]) => {
    const li = el('div', 'annonce-ligne');
    li.appendChild(el('span', 'annonce-ico', r ? role(r).ico : '☀️'));
    li.appendChild(el('span', '', `${t}.`));
    if (r && r !== 'idiot') li.appendChild(el('span', 'annonce-role', role(r).nom));
    z.appendChild(li);
  });
  const nouveau = !avant || avant.status !== etat.status || avant.jour !== etat.jour;
  if (nouveau && !sansAnimation()) z.animate([{ opacity: 0, transform: 'translateY(-10px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'ease-out' });
}

// ---------- Ce que je dois faire ----------
let cibles = null;      // joueurs que je peux choisir (null : pas de choix en cours)
let maxChoix = 1;
function definirChoix(liste, max = 1) { cibles = liste; maxChoix = max; choix = choix.filter((c) => liste.includes(c)).slice(-max); }
function rendreAction() {
  const z = $('action');
  z.innerHTML = '';
  cibles = null;
  const p = moi();
  const titre = (t) => z.appendChild(el('p', 'action-titre', t));
  const texte = (t) => z.appendChild(el('p', 'action-texte', t));
  const bouton = (t, fn, { principal = true, actif = true } = {}) => {
    const b = el('button', `btn ${principal ? 'btn-principal' : ''}`, t);
    b.type = 'button';
    b.disabled = !actif;
    b.addEventListener('click', fn);
    z.appendChild(b);
    return b;
  };
  const viv = R.vivants(etat);

  if (etat.status === 'roles') {
    z.classList.add('distribution');
    const carte = el('button', 'carte-retournable' + (carteVue ? ' vue' : ''));
    carte.type = 'button';
    const dos = el('span', 'carte-dos');
    dos.append(el('span', '', '🌕'), el('strong', '', 'Touche pour découvrir ton rôle'), el('small', '', 'Cache bien ton écran !'));
    const face = el('span', 'carte-face');
    face.appendChild(carteRole(p.role));
    carte.append(dos, face);
    carte.addEventListener('click', () => {
      carteVue = !carteVue;
      carte.classList.toggle('vue', carteVue);
      const b = z.querySelector('.btn-principal');
      if (b) b.disabled = !carteVue;
    });
    z.appendChild(carte);
    const compo = el('p', 'action-texte', `Dans cette partie : ${texteCompo(etat.options.roles, etat.players.length)}`);
    z.appendChild(compo);
    if (p.pret) texte('✓ Tu es prêt. La nuit tombera quand tout le monde aura vu son rôle.');
    else bouton('J\'ai vu mon rôle, je suis prêt', () => agir((s) => R.pret(s, maPlace)), { actif: carteVue });
    return;
  }
  z.classList.remove('distribution');

  if (etat.status === 'fin') {
    titre(etat.vainqueur.texte);
    const g = etat.vainqueur.gagnants;
    texte(g.includes(maPlace) ? '🎉 Tu as gagné !' : '😵 Tu as perdu…');
    if (maPlace === 0) bouton('Nouvelle partie (nouveaux rôles)', () => agir((s) => { if (s.status !== 'fin') return false; R.nouvellePartie(s); return true; }));
    else texte('Celui qui a créé le salon peut relancer une partie.');
    return;
  }

  if (!p.vivant && !(etat.status === 'chasseur' && etat.chasseurs[0] === maPlace)) {
    titre('💀 Tu es mort');
    texte('Tu vois maintenant tous les rôles. Ne dis rien aux vivants !');
    return;
  }

  if (etat.status === 'nuit') {
    const acteur = R.acteurs(etat, etat.etape).includes(maPlace);
    // la petite fille, pendant le tour des loups
    if (etat.etape === 'loups' && p.role === 'petitefille' && !etat.pouvoirsPerdus) {
      titre('👧 Les loups chuchotent…');
      if (!etat.act.espion) {
        texte('Tu peux entrouvrir les yeux pour voir qui ils visent. Mais une fois sur cinq, ils te surprennent et découvrent qui tu es.');
        bouton('👀 Espionner les loups', () => agir((s) => R.espionner(s, maPlace)));
      } else {
        const votes = Object.values(etat.act.loups).map((c) => etat.players[c].name);
        texte(votes.length ? `Les loups visent : ${votes.map((n) => `🐺 → ${n}`).join(' · ')}` : 'Les loups n\'ont encore désigné personne…');
        if (etat.act.espion.surprise) texte('😱 Un loup t\'a vue ! Ils savent qui tu es…');
      }
      return;
    }
    if (!acteur) {
      titre('😴 Tu dors…');
      texte('Garde les yeux fermés : d\'autres agissent cette nuit.');
      if (p.visions.length && p.role === 'voyante') texte(`🔮 Ta dernière vision : ${etat.players[p.visions.at(-1).cible].name} est ${role(p.visions.at(-1).role).nom}.`);
      return;
    }
    switch (etat.etape) {
      case 'cupidon':
        titre('💘 Désigne deux amoureux');
        texte('Touche deux joueurs (tu peux te choisir).');
        definirChoix(viv, 2);
        bouton(choix.length === 2 ? `Unir ${etat.players[choix[0]].name} et ${etat.players[choix[1]].name}` : 'Choisis deux joueurs', () => agir((s) => R.actionNuit(s, maPlace, { cibles: choix })), { actif: choix.length === 2 });
        break;
      case 'salvateur':
        titre('🛡️ Qui protèges-tu cette nuit ?');
        if (etat.dernierProtege >= 0) texte(`Tu ne peux pas protéger ${nomDe(etat.dernierProtege)} deux nuits de suite.`);
        definirChoix(viv.filter((i) => i !== etat.dernierProtege));
        bouton(choix.length ? `Protéger ${nomDe(choix[0])}` : 'Choisis un joueur', () => agir((s) => R.actionNuit(s, maPlace, { cible: choix[0] })), { actif: choix.length === 1 });
        break;
      case 'voyante':
        titre('🔮 Quel joueur veux-tu sonder ?');
        definirChoix(viv.filter((i) => i !== maPlace && !p.visions.some((v) => v.cible === i)));
        bouton(choix.length ? `Découvrir le rôle de ${etat.players[choix[0]].name}` : 'Choisis un joueur', () => agir((s) => R.actionNuit(s, maPlace, { cible: choix[0] })), { actif: choix.length === 1 });
        break;
      case 'loups': {
        titre('🐺 Choisissez votre victime');
        const proies = viv.filter((i) => !R.estLoup(etat.players[i]));
        definirChoix(proies);
        const monVote = etat.act.loups[maPlace];
        texte(monVote !== undefined ? `Tu as choisi ${etat.players[monVote].name}. Mettez-vous d'accord (chat des loups) : si vous n'êtes pas d'accord, le sort tranche au bout de 20 s.` : 'Mettez-vous d\'accord dans le chat des loups.');
        if (choix.length && choix[0] !== monVote) bouton(`Dévorer ${etat.players[choix[0]].name}`, () => agir((s) => R.actionNuit(s, maPlace, { cible: choix[0] })));
        if (etat.etapeFin) z.appendChild(el('p', 'compte', ''));
        break;
      }
      case 'loupblanc':
        titre('🤍 Trahir un loup ?');
        texte('Tu peux dévorer un des loups cette nuit, ou les épargner.');
        definirChoix(viv.filter((i) => etat.players[i].role === 'loup'));
        if (choix.length) bouton(`Dévorer ${etat.players[choix[0]].name}`, () => agir((s) => R.actionNuit(s, maPlace, { cible: choix[0] })));
        bouton('Épargner les loups', () => agir((s) => R.actionNuit(s, maPlace, { cible: -1 })), { principal: false });
        break;
      case 'sorciere': {
        titre('🧪 Tes potions');
        const v = etat.act.victime;
        texte(v !== undefined && v >= 0 ? `Cette nuit, les loups ont attaqué ${nomDe(v)}.` : 'Cette nuit, les loups n\'ont attaqué personne.');
        if (etat.act.sauve) texte(`✓ Tu as sauvé ${nomDe(v)}.`);
        else if (etat.potions.vie && v !== undefined && v >= 0) bouton(`💚 Sauver ${nomDe(v)}`, () => agir((s) => R.actionNuit(s, maPlace, { sauver: true })), { principal: false });
        if (etat.act.poison !== undefined) texte(`☠️ Tu as empoisonné ${nomDe(etat.act.poison)}.`);
        else if (etat.potions.mort) {
          texte('Tu peux aussi empoisonner un joueur : touche-le.');
          definirChoix(viv);
          if (choix.length) bouton(`☠️ Empoisonner ${nomDe(choix[0])}`, () => agir((s) => R.actionNuit(s, maPlace, { tuer: choix[0] })), { principal: false });
        }
        bouton('Terminer et me rendormir', () => agir((s) => R.actionNuit(s, maPlace, { fini: true })));
        break;
      }
      default:
    }
    return;
  }

  if (etat.status === 'chasseur') {
    if (etat.chasseurs[0] === maPlace) {
      titre('🏹 Ta dernière balle');
      texte('Tu meurs… mais tu emportes quelqu\'un avec toi. Sur qui tires-tu ?');
      definirChoix(viv);
      bouton(choix.length ? `Tirer sur ${etat.players[choix[0]].name}` : 'Choisis ta cible', () => agir((s) => R.tirer(s, maPlace, choix[0])), { actif: choix.length === 1 });
    } else {
      titre('🏹 Le Chasseur vise…');
      texte(`${etat.players[etat.chasseurs[0]].name} choisit sur qui tirer.`);
    }
    return;
  }

  if (etat.status === 'jour') {
    if (!R.peutVoter(etat, maPlace)) {
      titre('🤪 Tu ne votes plus');
      texte('L\'Idiot du village peut débattre, mais ne vote plus.');
    } else {
      titre(etat.candidats ? '🗳️ Revote : départagez les ex æquo' : '🗳️ Qui éliminer ?');
      const monVote = etat.votes[maPlace];
      definirChoix((etat.candidats || viv).filter((i) => i !== maPlace));
      texte(monVote === undefined ? 'Débattez, puis touche le joueur que tu soupçonnes.' : monVote === -1 ? 'Tu as voté blanc. Tu peux changer d\'avis tant que tout le monde n\'a pas voté.' : `Tu votes contre ${etat.players[monVote].name}. Tu peux changer d'avis tant que tout le monde n'a pas voté.`);
      if (choix.length && choix[0] !== monVote) bouton(`Voter contre ${etat.players[choix[0]].name}`, () => agir((s) => R.voter(s, maPlace, choix[0])));
      if (monVote !== -1) bouton('Voter blanc', () => agir((s) => R.voter(s, maPlace, -1)), { principal: false });
    }
    const votants = R.vivants(etat).filter((i) => R.peutVoter(etat, i));
    z.appendChild(el('p', 'compte', `${votants.filter((i) => etat.votes[i] !== undefined).length} / ${votants.length} votes`));
    if (maPlace === 0) {
      const b = bouton('Clore le vote maintenant', () => { if (confirm('Clore le vote avec les votes déjà faits ?')) agir((s) => R.forcer(s, 0)); }, { principal: false });
      b.classList.add('btn-hote');
    }
  }
}

// bouton de l'hôte pour débloquer une étape (joueur absent)
function majForcer() {
  let b = document.getElementById('btn-forcer');
  const peut = etat && maPlace === 0 && (etat.status === 'nuit' || etat.status === 'chasseur') && Date.now() - etat.etapeDebut >= R.DELAI_FORCER && !etat.etapeFin;
  if (!peut) { if (b) b.remove(); return; }
  if (!b) {
    b = el('button', 'btn btn-hote', '⏭️ Un joueur ne répond pas : passer cette étape');
    b.id = 'btn-forcer';
    b.type = 'button';
    b.addEventListener('click', () => { if (confirm('Passer cette étape ? (le joueur concerné ne pourra pas agir)')) agir((s) => R.forcer(s, 0)); });
    $('action').appendChild(b);
  }
  const c = document.querySelector('#action .compte');
  if (c && etat.status === 'nuit' && etat.etape === 'loups' && etat.etapeFin) c.textContent = `Le sort tranche dans ${Math.max(0, Math.ceil((etat.etapeFin - Date.now()) / 1000))} s`;
}

// ---------- Le village ----------
function rendreVillage() {
  const z = $('village');
  z.innerHTML = '';
  // votes visibles (jour) et votes des loups (pour les loups)
  const compte = {};
  const qui = {};
  if (etat.status === 'jour') Object.entries(etat.votes).forEach(([k, c]) => { if (c >= 0) { compte[c] = (compte[c] || 0) + 1; (qui[c] = qui[c] || []).push(etat.players[k].name); } });
  const voitLoups = etat.status === 'nuit' && etat.etape === 'loups' && (R.estLoup(moi()) || !moi().vivant);
  const loupsSur = {};
  if (voitLoups) Object.entries(etat.act.loups).forEach(([k, c]) => { (loupsSur[c] = loupsSur[c] || []).push(etat.players[k].name); });
  etat.players.forEach((p, i) => {
    const t = el('button', 'joueur');
    t.type = 'button';
    t.style.setProperty('--teinte', String((i * 53 + 20) % 360));
    if (!p.vivant) t.classList.add('mort');
    if (i === maPlace) t.classList.add('moi');
    const r = roleConnu(i);
    const avatar = el('span', 'avatar', p.vivant ? (p.name || '?').trim().charAt(0).toUpperCase() : '💀');
    if (r) avatar.appendChild(el('span', 'avatar-role', role(r).ico));
    t.appendChild(avatar);
    const txt = el('span', 'joueur-txt');
    txt.appendChild(el('strong', '', p.name + (i === maPlace ? ' (toi)' : '')));
    const sous = [];
    if (r && (i !== maPlace || true)) sous.push(role(r).nom);
    if (amoureuxDe(i)) sous.push('💘');
    if (p.sansVote) sous.push('ne vote plus');
    if (etat.status === 'roles') sous.push(p.pret ? '✓ prêt' : '…');
    txt.appendChild(el('small', '', sous.join(' · ')));
    t.appendChild(txt);
    if (compte[i]) { const v = el('span', 'votes', `🗳️ ${compte[i]}`); v.title = qui[i].join(', '); t.appendChild(v); }
    if (loupsSur[i]) { const v = el('span', 'votes loups', `🐺 ${loupsSur[i].length}`); v.title = loupsSur[i].join(', '); t.appendChild(v); }
    if (etat.status === 'jour' && etat.votes[i] !== undefined) t.appendChild(el('span', 'a-vote', '✓ a voté'));
    if (etat.candidats && etat.candidats.includes(i)) t.classList.add('candidat');
    if (etat.vainqueur && etat.vainqueur.gagnants.includes(i)) t.classList.add('gagnant');
    if (cibles && cibles.includes(i)) {
      t.classList.add('choisissable');
      if (choix.includes(i)) t.classList.add('choisi');
      t.addEventListener('click', () => {
        if (choix.includes(i)) choix = choix.filter((c) => c !== i);
        else choix = [...choix, i].slice(-maxChoix);
        rendreAction(); rendreVillage(); majForcer();
      });
    } else t.disabled = true;
    z.appendChild(t);
  });
}

// ---------- Discussion ----------
function canauxVisibles() {
  const p = moi();
  const c = ['village'];
  if (R.estLoup(p) || !p.vivant || etat.status === 'fin') c.push('loups');
  return c;
}
function rendreChat() {
  const c = canauxVisibles();
  if (!c.includes(canal)) canal = 'village';
  // la nuit, un loup arrive directement sur le chat de sa meute
  if (etat.status === 'nuit' && R.estLoup(moi()) && moi().vivant) canal = canalChoisi || 'loups';
  const tabs = $('onglets-chat');
  tabs.innerHTML = '';
  if (c.length > 1) c.forEach((k) => {
    const b = el('button', 'onglet-chat' + (k === canal ? ' actif' : ''), k === 'loups' ? '🐺 Meute' : '🏘️ Village');
    b.type = 'button';
    b.addEventListener('click', () => { canal = k; canalChoisi = k; rendreChat(); });
    tabs.appendChild(b);
  });
  const liste = canal === 'loups' ? etat.chatLoups : etat.chat;
  const z = $('messages');
  const enBas = z.scrollHeight - z.scrollTop - z.clientHeight < 40;
  z.innerHTML = '';
  if (!liste.length) z.appendChild(el('p', 'vide', canal === 'loups' ? 'Le chat de la meute est vide.' : 'Aucun message pour l\'instant. Débattez ici (ou de vive voix).'));
  liste.forEach((m) => {
    const d = el('div', 'msg' + (m.j === maPlace ? ' de-moi' : '') + (m.j < 0 ? ' systeme' : ''));
    if (m.j >= 0) {
      const n = el('strong', '', etat.players[m.j].name);
      n.style.color = `hsl(${(m.j * 53 + 20) % 360} 70% 70%)`;
      d.appendChild(n);
    }
    d.appendChild(el('span', '', m.t));
    z.appendChild(d);
  });
  if (enBas) z.scrollTop = z.scrollHeight;
  const peut = R.peutParler(etat, maPlace, canal);
  const input = $('saisie-texte');
  input.disabled = !peut;
  $('saisie').querySelector('button').disabled = !peut;
  input.placeholder = peut ? (canal === 'loups' ? 'Chuchoter à la meute…' : 'Écrire au village…')
    : !moi().vivant ? 'Les morts ne parlent plus…' : canal === 'loups' ? 'La meute ne parle que la nuit' : 'Le village dort : silence !';
}
$('saisie').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('saisie-texte');
  const t = input.value.trim();
  if (!t) return;
  const k = canal;
  if (!R.peutParler(etat, maPlace, k)) { toast('Tu ne peux pas parler maintenant.'); return; }
  input.value = '';
  agir((s) => { if (!R.peutParler(s, maPlace, k)) return false; R.message(s, k, maPlace, t); return true; });
});

function rendreJournal() {
  const z = $('journal');
  z.innerHTML = '';
  [...etat.journal].reverse().forEach((j) => z.appendChild(el('li', '', j.t)));
}

const sansAnimation = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
void de;
