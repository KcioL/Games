// Loup-Garou : règles (sans affichage). Le narrateur est automatique : la nuit se déroule étape par étape,
// chaque joueur agit sur son téléphone. Quand un rôle est dans la partie mais que son joueur est mort,
// l'étape dure quand même quelques secondes (personne ne peut deviner qui est mort).

export const ROLES = {
  loup: { nom: 'Loup-Garou', ico: '🐺', camp: 'loups', texte: 'Chaque nuit, avec les autres loups, tu choisis un villageois à dévorer. Le jour, tu te fais passer pour un innocent.' },
  villageois: { nom: 'Villageois', ico: '🧑‍🌾', camp: 'village', texte: 'Tu n\'as aucun pouvoir, mais ton vote compte : démasque les loups-garous et élimine-les.' },
  voyante: { nom: 'Voyante', ico: '🔮', camp: 'village', texte: 'Chaque nuit, tu découvres le rôle d\'un joueur de ton choix.' },
  sorciere: { nom: 'Sorcière', ico: '🧪', camp: 'village', texte: 'Tu as deux potions, une seule fois chacune dans la partie : une pour sauver la victime des loups, une pour éliminer un joueur.' },
  chasseur: { nom: 'Chasseur', ico: '🏹', camp: 'village', texte: 'Quand tu meurs, tu tires une dernière balle et tu emportes un joueur de ton choix avec toi.' },
  cupidon: { nom: 'Cupidon', ico: '💘', camp: 'village', texte: 'La première nuit, tu désignes deux amoureux. Si l\'un meurt, l\'autre meurt de chagrin. Si ce sont un loup et un villageois, ils gagnent ensemble s\'ils sont les deux derniers.' },
  petitefille: { nom: 'Petite fille', ico: '👧', camp: 'village', texte: 'Pendant que les loups choisissent leur victime, tu peux les espionner pour voir qui ils visent. Mais attention : ils peuvent te surprendre.' },
  salvateur: { nom: 'Salvateur', ico: '🛡️', camp: 'village', texte: 'Chaque nuit, tu protèges un joueur des loups (toi compris), mais jamais deux nuits de suite le même.' },
  loupblanc: { nom: 'Loup blanc', ico: '🤍', camp: 'loups', texte: 'Tu chasses avec les loups, mais tu joues pour toi seul : une nuit sur deux, tu peux dévorer un autre loup. Tu gagnes si tu es le dernier survivant.' },
  ancien: { nom: 'Ancien', ico: '👴', camp: 'village', texte: 'Tu résistes à la première attaque des loups. Mais si le village t\'élimine (vote, sorcière, chasseur), tous les villageois perdent leurs pouvoirs.' },
  idiot: { nom: 'Idiot du village', ico: '🤪', camp: 'village', texte: 'Si le village vote contre toi, tu es épargné : on découvre que tu es l\'idiot, mais tu ne pourras plus voter.' },
};
export const SPECIAUX = ['voyante', 'sorciere', 'chasseur', 'cupidon', 'petitefille', 'salvateur', 'loupblanc', 'ancien', 'idiot'];
export const ETAPES = ['cupidon', 'salvateur', 'voyante', 'loups', 'loupblanc', 'sorciere'];
export const NARRATION = {
  cupidon: 'Cupidon se réveille et désigne deux amoureux…',
  salvateur: 'Le Salvateur se réveille et choisit qui protéger…',
  voyante: 'La Voyante se réveille et sonde l\'âme d\'un joueur…',
  loups: 'Les Loups-Garous se réveillent et choisissent leur victime…',
  loupblanc: 'Le Loup blanc se réveille… va-t-il trahir un loup ?',
  sorciere: 'La Sorcière se réveille et se penche sur ses potions…',
};
export const ATTENTE_FACTICE = [5000, 9000];   // durée d'une étape dont le joueur est mort
export const DELAI_LOUPS = 20000;              // loups en désaccord : on tranche au bout de 20 s
export const DELAI_FORCER = 45000;             // l'hôte peut passer une étape bloquée au bout de 45 s
const MAX_MESSAGES = 80;

const melanger = (t) => { for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } return t; };
export const estLoup = (p) => p.role === 'loup' || p.role === 'loupblanc';
export const vivants = (s) => s.players.map((_, i) => i).filter((i) => s.players[i].vivant);

export function loupsConseilles(n) { return n <= 6 ? 1 : n <= 11 ? 2 : n <= 15 ? 3 : 4; }
export function compositionListe(c, n) {
  const roles = [];
  for (let k = 0; k < (c.loups || 1); k++) roles.push('loup');
  SPECIAUX.forEach((r) => { if (c[r]) roles.push(r); });
  while (roles.length < n) roles.push('villageois');
  return roles;
}
export function erreurComposition(c, n) {
  if (n < 4) return 'Il faut au moins 4 joueurs.';
  const speciaux = SPECIAUX.filter((r) => c[r]).length;
  const loups = (c.loups || 1) + (c.loupblanc ? 1 : 0);
  if ((c.loups || 1) + speciaux > n) return `Trop de rôles pour ${n} joueurs : enlève des rôles ou des loups.`;
  if (loups * 2 >= n) return 'Trop de loups : ils doivent être moins nombreux que les villageois.';
  return '';
}

export function normaliser(s) {
  s.players = s.players || [];
  s.players.forEach((p) => {
    if (p.amoureux === undefined || p.amoureux === null) p.amoureux = -1;
    p.visions = p.visions || [];
  });
  s.chat = s.chat || [];
  s.chatLoups = s.chatLoups || [];
  s.journal = s.journal || [];
  s.morts = s.morts || [];
  s.votes = s.votes || {};
  s.act = s.act || {};
  s.act.loups = s.act.loups || {};
  s.potions = s.potions || { vie: true, mort: true };
  s.chasseurs = s.chasseurs ? Object.values(s.chasseurs) : [];
  if (s.dernierTir) s.dernierTir.morts = s.dernierTir.morts || [];
  if (s.elimine) s.elimine.morts = s.elimine.morts || [];
  if (s.vainqueur) s.vainqueur.gagnants = s.vainqueur.gagnants || [];
  if (s.dernierVote) { s.dernierVote.tete = s.dernierVote.tete || []; s.dernierVote.votes = s.dernierVote.votes || {}; }
  if (s.act.amoureux) s.act.amoureux = Object.values(s.act.amoureux);
  if (s.candidats) s.candidats = Object.values(s.candidats);
  s.options = s.options || { roles: { loups: 1, voyante: true } };
  return s;
}

// ---------- Début de partie ----------
export function nouvellePartie(s) {
  normaliser(s);
  const roles = melanger(compositionListe(s.options.roles, s.players.length));
  s.players.forEach((p, i) => Object.assign(p, {
    role: roles[i], vivant: true, pret: false, amoureux: -1, visions: [], ancienVies: roles[i] === 'ancien' ? 2 : 0,
    sansVote: false, revele: false,
  }));
  Object.assign(s, {
    status: 'roles', nuit: 0, jour: 0, etape: null, etapeDebut: 0, etapeFin: 0,
    act: { loups: {} }, potions: { vie: true, mort: true }, dernierProtege: -1, pouvoirsPerdus: false,
    morts: [], votes: {}, candidats: null, chasseurs: [], apres: null, vainqueur: null,
    chat: [], chatLoups: [], journal: [], partie: (s.partie || 0) + 1, coup: (s.coup || 0) + 1,
  });
}
export function pret(s, i) {
  if (s.status !== 'roles' || !s.players[i] || s.players[i].pret) return false;
  s.players[i].pret = true;
  if (s.players.every((p) => p.pret)) commencerNuit(s, Date.now());
  s.coup++;
  return true;
}

// ---------- La nuit ----------
const dansLaPartie = (s, role) => s.players.some((p) => p.role === role);
// joueurs qui agissent à une étape (vide : étape « factice » ou sautée)
export function acteurs(s, etape) {
  const vivantsRole = (r) => s.players.map((_, i) => i).filter((i) => s.players[i].vivant && s.players[i].role === r);
  const pouvoir = !s.pouvoirsPerdus;
  switch (etape) {
    case 'cupidon': return s.nuit === 1 ? vivantsRole('cupidon') : [];
    case 'salvateur': return pouvoir ? vivantsRole('salvateur') : [];
    case 'voyante': return pouvoir ? vivantsRole('voyante') : [];
    case 'loups': return s.players.map((_, i) => i).filter((i) => s.players[i].vivant && estLoup(s.players[i]));
    case 'loupblanc': {
      const autres = s.players.filter((p) => p.vivant && p.role === 'loup').length;
      return s.nuit % 2 === 0 && autres ? vivantsRole('loupblanc') : [];
    }
    case 'sorciere': return pouvoir && (s.potions.vie || s.potions.mort) ? vivantsRole('sorciere') : [];
    default: return [];
  }
}
// l'étape existe-t-elle ce soir (même jouée « à vide ») ?
function etapeAuProgramme(s, etape) {
  if (etape === 'cupidon') return s.nuit === 1 && dansLaPartie(s, 'cupidon');
  if (etape === 'loupblanc') return s.nuit % 2 === 0 && dansLaPartie(s, 'loupblanc');
  if (etape === 'loups') return true;
  return dansLaPartie(s, etape);
}

function commencerNuit(s, maintenant) {
  s.nuit += 1;
  s.status = 'nuit';
  s.act = { loups: {} };
  s.morts = [];
  s.votes = {};
  s.candidats = null;
  s.etape = null;
  allerEtape(s, 0, maintenant);
  journal(s, `🌙 Nuit ${s.nuit}`);
}
function allerEtape(s, k, maintenant) {
  for (; k < ETAPES.length; k++) {
    const e = ETAPES[k];
    if (!etapeAuProgramme(s, e)) continue;
    s.etape = e;
    s.etapeDebut = maintenant;
    let qui = acteurs(s, e);
    // plus aucune proie pour les loups (il ne reste que des loups) : l'étape se joue à vide
    if (e === 'loups' && !s.players.some((p) => p.vivant && !estLoup(p))) qui = [];
    s.etapeFin = qui.length ? 0 : maintenant + ATTENTE_FACTICE[0] + Math.random() * (ATTENTE_FACTICE[1] - ATTENTE_FACTICE[0]);
    if (e === 'sorciere') s.act.victimeVue = s.act.victime; // ce que la sorcière voit
    s.coup++;
    return;
  }
  finNuit(s, maintenant);
}
const etapeSuivante = (s, maintenant) => allerEtape(s, ETAPES.indexOf(s.etape) + 1, maintenant);

// Actions de la nuit (renvoient false si elles ne sont pas permises)
export function actionNuit(s, i, a, maintenant = Date.now()) {
  if (s.status !== 'nuit' || !acteurs(s, s.etape).includes(i)) return false;
  const vivant = (j) => s.players[j] && s.players[j].vivant;
  switch (s.etape) {
    case 'cupidon': {
      const [x, y] = a.cibles || [];
      if (x === y || !vivant(x) || !vivant(y)) return false;
      s.players[x].amoureux = y;
      s.players[y].amoureux = x;
      s.act.amoureux = [x, y];
      etapeSuivante(s, maintenant);
      return true;
    }
    case 'salvateur':
      if (!vivant(a.cible) || a.cible === s.dernierProtege) return false;
      s.act.protege = a.cible;
      s.dernierProtege = a.cible;
      etapeSuivante(s, maintenant);
      return true;
    case 'voyante':
      if (!vivant(a.cible) || a.cible === i) return false;
      s.players[i].visions.push({ nuit: s.nuit, cible: a.cible, role: s.players[a.cible].role });
      etapeSuivante(s, maintenant);
      return true;
    case 'loups': {
      if (!vivant(a.cible) || estLoup(s.players[a.cible])) return false;
      s.act.loups[i] = a.cible;
      const loups = acteurs(s, 'loups');
      const votes = loups.map((l) => s.act.loups[l]);
      if (votes.every((v) => v !== undefined)) {
        if (votes.every((v) => v === votes[0])) { s.act.victime = votes[0]; etapeSuivante(s, maintenant); }
        else s.etapeFin = maintenant + DELAI_LOUPS; // désaccord : on tranche bientôt
      }
      s.coup++;
      return true;
    }
    case 'loupblanc':
      if (a.cible !== -1 && (!vivant(a.cible) || s.players[a.cible].role !== 'loup')) return false;
      s.act.blanc = a.cible;
      etapeSuivante(s, maintenant);
      return true;
    case 'sorciere': {
      if (a.sauver) {
        if (!s.potions.vie || s.act.victime === undefined || s.act.victime < 0 || s.act.sauve) return false;
        s.act.sauve = true;
        s.potions.vie = false;
        s.coup++;
        return true;
      }
      if (a.tuer !== undefined) {
        if (!s.potions.mort || !vivant(a.tuer) || s.act.poison !== undefined) return false;
        s.act.poison = a.tuer;
        s.potions.mort = false;
        s.coup++;
        return true;
      }
      if (a.fini) { etapeSuivante(s, maintenant); return true; }
      return false;
    }
    default: return false;
  }
}

// La petite fille espionne les loups (une fois par nuit) : elle voit leurs votes, mais peut être surprise
export function espionner(s, i, hasard = Math.random()) {
  const p = s.players[i];
  if (s.status !== 'nuit' || s.etape !== 'loups' || !p || !p.vivant || p.role !== 'petitefille' || s.pouvoirsPerdus || s.act.espion) return false;
  s.act.espion = { surprise: hasard < 0.2 };
  if (s.act.espion.surprise) message(s, 'loups', -1, `👧 Vous avez surpris la petite fille qui vous espionne : c'est ${p.name} !`);
  s.coup++;
  return true;
}

// Les étapes qui attendent un délai (joueur mort, loups en désaccord) avancent quand l'heure est passée
export function tic(s, maintenant = Date.now()) {
  if (s.status !== 'nuit' || !s.etapeFin || maintenant < s.etapeFin) return false;
  if (s.etape === 'loups') trancherLoups(s);
  etapeSuivante(s, maintenant);
  return true;
}
function trancherLoups(s) {
  const compte = {};
  Object.values(s.act.loups).forEach((c) => { if (s.players[c] && s.players[c].vivant) compte[c] = (compte[c] || 0) + 1; });
  const max = Math.max(0, ...Object.values(compte));
  const tete = Object.keys(compte).filter((c) => compte[c] === max).map(Number);
  s.act.victime = tete.length ? tete[Math.floor(Math.random() * tete.length)] : -1;
}
// L'hôte peut faire avancer une étape bloquée (joueur absent)
export function forcer(s, i, maintenant = Date.now()) {
  if (i !== 0) return false;
  if (s.status === 'nuit') {
    if (maintenant - s.etapeDebut < DELAI_FORCER) return false;
    if (s.etape === 'loups') trancherLoups(s);
    etapeSuivante(s, maintenant);
    return true;
  }
  if (s.status === 'jour') { resoudreVote(s, maintenant); return true; }
  if (s.status === 'chasseur') {
    if (maintenant - s.etapeDebut < DELAI_FORCER) return false;
    s.chasseurs.shift();
    continuerApresMorts(s, maintenant);
    return true;
  }
  return false;
}

// ---------- Morts ----------
function tuer(s, j, cause) {
  const p = s.players[j];
  if (!p || !p.vivant) return;
  p.vivant = false;
  s.morts.push({ j, role: p.role, cause });
  if (p.role === 'ancien' && ['vote', 'sorciere', 'chasseur'].includes(cause)) s.pouvoirsPerdus = true;
  if (p.role === 'chasseur' && !s.pouvoirsPerdus) s.chasseurs.push(j);
  if (p.amoureux >= 0 && s.players[p.amoureux].vivant) tuer(s, p.amoureux, 'chagrin');
}
function finNuit(s, maintenant) {
  s.etape = null;
  const v = s.act.victime;
  if (v !== undefined && v >= 0 && s.players[v].vivant) {
    const protege = s.act.protege === v;
    if (!protege && !s.act.sauve) {
      if (s.players[v].role === 'ancien' && s.players[v].ancienVies > 1) s.players[v].ancienVies -= 1;
      else tuer(s, v, 'loups');
    }
  }
  if (s.act.poison !== undefined) tuer(s, s.act.poison, 'sorciere');
  if (s.act.blanc !== undefined && s.act.blanc >= 0) tuer(s, s.act.blanc, 'loupblanc');
  s.jour = s.nuit;
  journal(s, s.morts.length ? `☀️ Jour ${s.jour} : cette nuit, le village a perdu ${s.morts.map((m) => `${s.players[m.j].name} (${ROLES[m.role].nom})`).join(', ')}.` : `☀️ Jour ${s.jour} : personne n'est mort cette nuit.`);
  s.apres = 'jour';
  continuerApresMorts(s, maintenant);
}
// après des morts : le chasseur tire, puis on vérifie la victoire, puis on enchaîne
function continuerApresMorts(s, maintenant) {
  if (verifierVictoire(s)) return;
  if (s.chasseurs.length) {
    s.status = 'chasseur';
    s.etapeDebut = maintenant;
    s.coup++;
    return;
  }
  if (s.apres === 'jour') {
    s.status = 'jour';
    s.elimine = null;
    s.dernierVote = null;
    s.votes = {};
    s.candidats = null;
    s.etapeDebut = maintenant;
    s.coup++;
  } else commencerNuit(s, maintenant);
}
export function tirer(s, i, cible, maintenant = Date.now()) {
  if (s.status !== 'chasseur' || s.chasseurs[0] !== i || !s.players[cible] || !s.players[cible].vivant) return false;
  s.chasseurs.shift();
  const avant = s.morts.length;
  tuer(s, cible, 'chasseur');
  journal(s, `🏹 ${s.players[i].name} tire sur ${s.players[cible].name} (${ROLES[s.players[cible].role].nom}).`);
  s.dernierTir = { de: i, sur: cible, morts: s.morts.slice(avant), jour: s.jour };
  continuerApresMorts(s, maintenant);
  return true;
}

// ---------- Le jour : le vote ----------
export const peutVoter = (s, i) => s.players[i] && s.players[i].vivant && !s.players[i].sansVote;
export function voter(s, i, cible, maintenant = Date.now()) {
  if (s.status !== 'jour' || !peutVoter(s, i)) return false;
  if (cible !== -1 && (!s.players[cible] || !s.players[cible].vivant || cible === i)) return false;
  if (s.candidats && cible !== -1 && !s.candidats.includes(cible)) return false;
  s.votes[i] = cible;
  s.coup++;
  const votants = vivants(s).filter((k) => peutVoter(s, k));
  if (votants.every((k) => s.votes[k] !== undefined)) resoudreVote(s, maintenant);
  return true;
}
function resoudreVote(s, maintenant) {
  const compte = {};
  Object.entries(s.votes).forEach(([k, c]) => { if (c >= 0 && peutVoter(s, Number(k))) compte[c] = (compte[c] || 0) + 1; });
  const max = Math.max(0, ...Object.values(compte));
  const tete = Object.keys(compte).filter((c) => compte[c] === max).map(Number);
  s.dernierVote = { votes: { ...s.votes }, tete, revote: !!s.candidats };
  if (!max) { journal(s, '🗳️ Le village n\'a éliminé personne.'); return nuitSuivante(s, maintenant); }
  if (tete.length > 1) {
    if (!s.candidats) { // égalité : on revote entre les ex æquo
      s.candidats = tete;
      s.votes = {};
      journal(s, `🗳️ Égalité entre ${tete.map((c) => s.players[c].name).join(' et ')} : on revote.`);
      s.coup++;
      return;
    }
    journal(s, '🗳️ Nouvelle égalité : personne n\'est éliminé.');
    return nuitSuivante(s, maintenant);
  }
  const e = tete[0];
  const p = s.players[e];
  if (p.role === 'idiot' && !p.revele) {
    p.revele = true;
    p.sansVote = true;
    journal(s, `🤪 ${p.name} est l'Idiot du village : il est épargné, mais ne votera plus.`);
    s.elimine = { j: e, idiot: true };
    return nuitSuivante(s, maintenant);
  }
  s.morts = [];
  tuer(s, e, 'vote');
  s.elimine = { j: e, morts: [...s.morts] };
  journal(s, `🗳️ Le village élimine ${p.name} : ${ROLES[p.role].nom}.${s.morts.length > 1 ? ` ${s.morts.slice(1).map((m) => `${s.players[m.j].name} ne survit pas à son amour perdu.`).join(' ')}` : ''}`);
  s.apres = 'nuit';
  continuerApresMorts(s, maintenant);
}
function nuitSuivante(s, maintenant) {
  s.apres = 'nuit';
  continuerApresMorts(s, maintenant);
}

// ---------- Victoire ----------
export function verifierVictoire(s) {
  const viv = vivants(s);
  const loups = viv.filter((i) => estLoup(s.players[i]));
  const autres = viv.filter((i) => !estLoup(s.players[i]));
  let v = null;
  const [a, b] = viv;
  if (viv.length === 2 && s.players[a].amoureux === b && estLoup(s.players[a]) !== estLoup(s.players[b])) {
    v = { camp: 'amoureux', texte: 'Les amoureux gagnent ! Ils sont les deux derniers survivants.', gagnants: [a, b] };
  } else if (!viv.length) {
    v = { camp: 'personne', texte: 'Tout le monde est mort… personne ne gagne.', gagnants: [] };
  } else if (!loups.length) {
    v = { camp: 'village', texte: 'Le village gagne ! Tous les loups-garous sont morts.', gagnants: s.players.map((_, i) => i).filter((i) => !estLoup(s.players[i])) };
  } else if (!autres.length) {
    if (loups.length === 1 && s.players[loups[0]].role === 'loupblanc') {
      v = { camp: 'loupblanc', texte: 'Le Loup blanc gagne : il est le dernier survivant !', gagnants: loups };
    } else if (!loups.some((i) => s.players[i].role === 'loupblanc')) {
      v = { camp: 'loups', texte: 'Les loups-garous gagnent ! Il n\'y a plus de villageois.', gagnants: s.players.map((_, i) => i).filter((i) => s.players[i].role === 'loup') };
    }
  }
  if (!v) return false;
  s.vainqueur = v;
  s.status = 'fin';
  s.etape = null;
  journal(s, `🏁 ${v.texte}`);
  s.coup++;
  return true;
}

// ---------- Chat et journal ----------
export function message(s, canal, i, texte) {
  const liste = canal === 'loups' ? s.chatLoups : s.chat;
  liste.push({ j: i, t: String(texte).slice(0, 200), ts: Date.now() });
  if (liste.length > MAX_MESSAGES) liste.splice(0, liste.length - MAX_MESSAGES);
  s.coup = (s.coup || 0) + 1;
}
export function peutParler(s, i, canal) {
  const p = s.players[i];
  if (!p || !p.vivant || s.status === 'fin') return canal === 'village' && s.status === 'fin';
  if (canal === 'loups') return estLoup(p) && s.status === 'nuit';
  return s.status === 'jour' || s.status === 'chasseur' || s.status === 'roles';
}
function journal(s, texte) {
  s.journal.push({ t: texte, ts: Date.now() });
  if (s.journal.length > 60) s.journal.splice(0, s.journal.length - 60);
}
