// Moteur de règles du Gwynt, édition Japon (sans affichage).
// Toutes les actions modifient l'état `s` et renvoient false si elles sont interdites.
import { CARTES, CLANS, DECKS_DEFAUT, RANGEES, ALIAS_CHEF, CHEFS_PASSIFS, CHEFS_A_CHOIX, aPlat, erreurDeck } from './cartes.js';

export const TAILLE_MAIN = 10;
export const ECHANGES_MAX = 2;

const melanger = (t) => { for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } return t; };
const def = (carte) => CARTES[carte.c];
const estUnite = (carte) => def(carte).type === 'unite';

// ---------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------
export function normaliser(s) {
  s.players = s.players || [];
  s.players.forEach((p) => {
    p.main = p.main || [];
    p.pioche = p.pioche || [];
    p.defausse = p.defausse || [];
    p.rangees = p.rangees || {};
    p.cors = p.cors || {};
    RANGEES.forEach((r) => { p.rangees[r] = p.rangees[r] || []; p.cors[r] = !!p.cors[r]; });
    p.echanges = p.echanges || 0;
  });
  s.meteo = s.meteo || {};
  RANGEES.forEach((r) => { s.meteo[r] = !!s.meteo[r]; });
  s.resultats = s.resultats || [];
  s.journal = s.journal || [];
  return s;
}

function journal(s, texte) {
  s.journal.push(texte);
  if (s.journal.length > 6) s.journal.shift();
}

const adversaire = (i) => 1 - i;

// Force actuelle d'une carte posée dans la rangée r du camp j
export function forceCarte(s, j, r, carte) {
  const d = def(carte);
  if (d.type !== 'unite') return 0;
  // chef « espions doubles » (pour les deux joueurs)
  const base = d.capacite === 'espion' && s.players.some((p, k) => effetActif(s, k, 'espions-doubles')) ? d.force * 2 : d.force;
  if (d.legende) return base;
  // mauvais temps : la force tombe à 1 (chef « météo à moitié » : elle n'est que divisée par deux)
  let f = !s.meteo[r] ? base : effetActif(s, j, 'meteo-moitie') ? Math.max(1, Math.ceil(base / 2)) : 1;
  const rangee = s.players[j].rangees[r];
  if (d.capacite === 'lien') f *= rangee.filter((x) => def(x).capacite === 'lien' && def(x).groupe === d.groupe).length;
  f += rangee.filter((x) => x.u !== carte.u && def(x).capacite === 'moral').length;
  // cor : carte Taiko sur la rangée, ou une autre unité « Cor » dans la rangée (ne se cumulent pas)
  if (s.players[j].cors[r] || rangee.some((x) => x.u !== carte.u && def(x).capacite === 'cor')) f *= 2;
  return f;
}

export const totalRangee = (s, j, r) => s.players[j].rangees[r].reduce((t, c) => t + forceCarte(s, j, r, c), 0);
export const total = (s, j) => RANGEES.reduce((t, r) => t + totalRangee(s, j, r), 0);

// ---------------------------------------------------------------------
// Mise en place : choix du clan, puis échange de cartes, puis manches
// ---------------------------------------------------------------------
export function nouvellePartie(s) {
  s.players.forEach((p) => {
    Object.assign(p, {
      clan: '', main: [], pioche: [], defausse: [], vies: 2, passe: false, chefUtilise: false, pret: false, echanges: 0,
      rangees: { cac: [], dist: [], siege: [] }, cors: { cac: false, dist: false, siege: false },
    });
  });
  s.meteo = { cac: false, dist: false, siege: false };
  s.status = 'clans';
  s.manche = 1;
  s.resultats = [];
  s.journal = [];
  s.coup = (s.coup || 0) + 1;
  s.gagnant = null;
  s.finManche = null;
  s.revelation = null;
}

// Deck à plat (['samourai', ...]) : celui du joueur s'il est valable, sinon le deck par défaut du clan
function construirePaquet(clan, liste) {
  const cartes = (liste && !erreurDeck(clan, liste) ? liste : aPlat(DECKS_DEFAUT[clan])).map((c) => ({ c }));
  return melanger(cartes);
}

const effetAtout = (p) => (CLANS[p.clan] || {}).effetAtout;
// Chef du joueur : celui qu'il a choisi (sinon le premier de sa faction) et son effet
export function chefDe(p) {
  const chefs = (CLANS[p.clan] || {}).chefs || [];
  return chefs.find((c) => c.id === p.chef) || chefs[0] || null;
}
const effetChef = (p) => { const c = chefDe(p); return c ? (ALIAS_CHEF[c.effet] || c.effet) : null; };
// Chef sans effet : l'adversaire a un chef « annuler-chef » (qui, lui, ne peut pas être annulé)
export function chefAnnule(s, i) {
  const p = s.players[i];
  const q = s.players[adversaire(i)];
  return !!(p && q && p.clan && q.clan && effetChef(q) === 'annuler-chef' && effetChef(p) !== 'annuler-chef');
}
export const chefPassif = (p) => CHEFS_PASSIFS.includes(effetChef(p));
// Le joueur i a-t-il ce chef, et son effet compte-t-il ?
export function effetActif(s, i, effet) {
  const p = s.players[i];
  return !!(p && p.clan && effetChef(p) === effet && !chefAnnule(s, i));
}
// Jeu de la partie : 'kassen' (édition Japon) ou 'gwynt' (anciens noms : 'japon', 'perso')
export const editionDe = (s) => ({ japon: 'kassen', perso: 'gwynt' }[s.edition] || s.edition || 'kassen');
export const clansDeLEdition = (s) => Object.keys(CLANS).filter((c) => CLANS[c].edition === editionDe(s));

// Changer de jeu (Gwynt ou Kassen) : seulement pendant le choix des clans, tant que personne n'a choisi
export function changerEdition(s, i, edition) {
  if (s.status !== 'clans' || s.players.some((p) => p.clan)) return false;
  if (!Object.values(CLANS).some((c) => c.edition === edition) || editionDe(s) === edition) return false;
  s.edition = edition;
  s.coup = (s.coup || 0) + 1;
  return true;
}

export function choisirClan(s, i, clan, deck, chef) {
  const p = s.players[i];
  if (s.status !== 'clans' || p.clan || !CLANS[clan] || !clansDeLEdition(s).includes(clan)) return false;
  if (deck && erreurDeck(clan, deck)) return false;
  p.clan = clan;
  p.chef = (CLANS[clan].chefs || []).some((c) => c.id === chef) ? chef : ((CLANS[clan].chefs || [])[0] || {}).id || '';
  p.tailleDeck = (deck || aPlat(DECKS_DEFAUT[clan])).length;
  // chaque carte reçoit un identifiant unique dans la partie (utile pour le kagemusha)
  const paquet = construirePaquet(clan, deck).map((c, k) => ({ c: c.c, u: 1000 * (i + 1) + k }));
  p.main = paquet.slice(0, TAILLE_MAIN);
  p.pioche = paquet.slice(TAILLE_MAIN);
  s.coup = (s.coup || 0) + 1;
  if (s.players.every((q) => q.clan)) {
    s.status = 'echange';
    // chef « pioche-depart » : une carte de plus dans la main de départ
    s.players.forEach((q, k) => { if (effetActif(s, k, 'pioche-depart')) piocher(s, k, 1); });
  }
  return true;
}

// Avant la partie : échanger jusqu'à 2 cartes de sa main
export function echangerCarte(s, i, u) {
  const p = s.players[i];
  if (s.status !== 'echange' || p.pret || p.echanges >= ECHANGES_MAX || !p.pioche.length) return false;
  const k = p.main.findIndex((c) => c.u === u);
  if (k < 0) return false;
  const [ancienne] = p.main.splice(k, 1, p.pioche.shift());
  p.pioche.splice(Math.floor(Math.random() * (p.pioche.length + 1)), 0, ancienne);
  p.echanges += 1;
  s.coup = (s.coup || 0) + 1;
  return true;
}

export function pret(s, i) {
  const p = s.players[i];
  if (s.status !== 'echange' || p.pret) return false;
  p.pret = true;
  s.coup = (s.coup || 0) + 1;
  if (s.players.every((q) => q.pret)) {
    s.status = 'jeu';
    // Première manche : face à un clan « patience » (Sōhei), c'est l'adversaire qui commence ; sinon au hasard
    const patients = s.players.map((q, k) => (effetAtout(q) === 'patience' ? k : -1)).filter((k) => k >= 0);
    s.active = patients.length === 1 ? adversaire(patients[0]) : Math.floor(Math.random() * 2);
    s.premier = s.active;
    journal(s, `${s.players[s.active].name} commence la manche 1.`);
    passerSiBloque(s);
  }
  return true;
}

// ---------------------------------------------------------------------
// Jouer une carte
// ---------------------------------------------------------------------
function piocher(s, i, n) {
  const p = s.players[i];
  for (let k = 0; k < n && p.pioche.length; k++) p.main.push(p.pioche.shift());
}

// Pose une unité dans le bon camp (espion : chez l'adversaire) avec ses effets immédiats
function poserUnite(s, i, carte, r, { effets = true } = {}) {
  const d = def(carte);
  const camp = d.capacite === 'espion' ? adversaire(i) : i;
  s.players[camp].rangees[r].push(carte);
  if (!effets) return;
  if (d.capacite === 'espion') piocher(s, i, 2);
  if (d.capacite === 'rassemblement') {
    const p = s.players[i];
    const copies = p.pioche.filter((x) => def(x).capacite === 'rassemblement' && def(x).groupe === d.groupe);
    p.pioche = p.pioche.filter((x) => !copies.includes(x));
    copies.forEach((x) => s.players[i].rangees[def(x).rangees[0]].push(x));
  }
  if (d.capacite === 'medecin') ressusciter(s, i);
  // Brûlure : détruit l'unité la plus forte de la même rangée adverse, si cette rangée vaut 10 ou plus
  if (d.capacite === 'brasier_rangee') bruler(s, adversaire(camp), r);
}

function bruler(s, j, r) {
  if (totalRangee(s, j, r) < 10) return 0;
  const cibles = s.players[j].rangees[r].filter((c) => estUnite(c) && !def(c).legende);
  if (!cibles.length) return 0;
  const max = Math.max(...cibles.map((c) => forceCarte(s, j, r, c)));
  const garder = [];
  let n = 0;
  s.players[j].rangees[r].forEach((c) => {
    if (estUnite(c) && !def(c).legende && forceCarte(s, j, r, c) === max) { s.players[j].defausse.push(c); n++; } else garder.push(c);
  });
  s.players[j].rangees[r] = garder;
  return n;
}

// Ramène l'unité la plus forte de la défausse (hors légendes et espions)
function ressusciter(s, i) {
  const p = s.players[i];
  const candidates = p.defausse.filter((x) => estUnite(x) && !def(x).legende && def(x).capacite !== 'espion');
  if (!candidates.length) return false;
  // chef « medecins-hasard » (pour les deux joueurs) : l'unité ramenée est tirée au hasard
  const auHasard = s.players.some((x, k) => effetActif(s, k, 'medecins-hasard'));
  const meilleure = auHasard ? candidates[Math.floor(Math.random() * candidates.length)]
    : candidates.reduce((a, b) => (def(b).force > def(a).force ? b : a));
  p.defausse = p.defausse.filter((x) => x.u !== meilleure.u);
  poserUnite(s, i, meilleure, def(meilleure).rangees[0], { effets: false });
  journal(s, `${p.name} ramène ${def(meilleure).nom} en jeu.`);
  return true;
}

// Colère de Raijin : détruit les unités les plus fortes (hors légendes) des deux camps
function brasier(s) {
  let max = 0;
  s.players.forEach((p, j) => RANGEES.forEach((r) => p.rangees[r].forEach((c) => {
    if (estUnite(c) && !def(c).legende) max = Math.max(max, forceCarte(s, j, r, c));
  })));
  if (max <= 0) return 0;
  let detruites = 0;
  s.players.forEach((p, j) => RANGEES.forEach((r) => {
    const garder = [];
    p.rangees[r].forEach((c) => {
      if (estUnite(c) && !def(c).legende && forceCarte(s, j, r, c) === max) { p.defausse.push(c); detruites++; } else garder.push(c);
    });
    p.rangees[r] = garder;
  }));
  return detruites;
}

// Cibles possibles d'une carte de la main : liste de { rangee } ou { cible: uid }
export function ciblesPossibles(s, i, u) {
  const p = s.players[i];
  const carte = p.main.find((c) => c.u === u);
  if (!carte) return [];
  const d = def(carte);
  if (d.type === 'unite') return d.rangees.map((r) => ({ rangee: r }));
  if (d.type === 'cor') return RANGEES.filter((r) => !p.cors[r]).map((r) => ({ rangee: r }));
  if (d.type === 'leurre') {
    const cibles = [];
    RANGEES.forEach((r) => p.rangees[r].forEach((c) => { if (estUnite(c) && !def(c).legende) cibles.push({ rangee: r, cible: c.u }); }));
    return cibles;
  }
  return [{}]; // météo, éclaircie, Raijin : pas de cible
}

export function jouerCarte(s, i, u, choix = {}) {
  if (s.status !== 'jeu' || s.active !== i) return false;
  const p = s.players[i];
  if (p.passe) return false;
  const k = p.main.findIndex((c) => c.u === u);
  if (k < 0) return false;
  const carte = p.main[k];
  const d = def(carte);
  const possibles = ciblesPossibles(s, i, u);
  const valide = possibles.some((c) => (c.rangee || '') === (choix.rangee || '') && (c.cible || 0) === (choix.cible || 0))
    || (d.type === 'unite' && possibles.length === 1 && !choix.rangee);
  if (!valide) return false;
  p.main.splice(k, 1);

  switch (d.type) {
    case 'unite': {
      const r = choix.rangee || d.rangees[0];
      poserUnite(s, i, carte, r);
      journal(s, `${p.name} joue ${d.nom}${d.capacite === 'espion' ? ' (espion, il pioche 2 cartes)' : ''}.`);
      break;
    }
    case 'meteo':
      s.meteo[d.meteo] = true;
      p.defausse.push(carte);
      journal(s, `${p.name} déclenche : ${d.nom}.`);
      break;
    case 'eclaircie':
      RANGEES.forEach((r) => { s.meteo[r] = false; });
      p.defausse.push(carte);
      journal(s, `${p.name} dissipe les météos.`);
      break;
    case 'cor':
      p.cors[choix.rangee] = true;
      p.defausse.push(carte);
      journal(s, `${p.name} bat le taiko sur sa rangée ${choix.rangee === 'cac' ? 'de corps à corps' : choix.rangee === 'dist' ? 'à distance' : 'de siège'}.`);
      break;
    case 'leurre': {
      const r = choix.rangee;
      const n = p.rangees[r].findIndex((c) => c.u === choix.cible);
      const [reprise] = p.rangees[r].splice(n, 1, carte);
      p.main.push(reprise);
      journal(s, `${p.name} remplace ${def(reprise).nom} par un kagemusha.`);
      break;
    }
    case 'brasier': {
      const n = brasier(s);
      p.defausse.push(carte);
      journal(s, `${p.name} invoque la Colère de Raijin : ${n} unité${n > 1 ? 's' : ''} détruite${n > 1 ? 's' : ''}.`);
      break;
    }
    default: return false;
  }
  apresAction(s, i);
  return true;
}

// ---------------------------------------------------------------------
// Chef de clan (une fois par partie)
// ---------------------------------------------------------------------
const meteoEnPioche = (p, r) => p.pioche.find((c) => def(c).type === 'meteo' && def(c).meteo === r);
const famille = (effet) => (CHEFS_A_CHOIX.includes(effet) || effet.includes('-defausse') || effet.startsWith('melanger') ? effet : effet.split('-')[0]);
const sansDoublon = (cartes) => cartes.filter((c, k) => cartes.findIndex((x) => x.c === c.c) === k);

// Valeur approximative d'une carte en main (pour le bot et les choix automatiques)
export function valeurCarte(carte) {
  const d = def(carte);
  if (d.type === 'unite') return d.capacite === 'espion' ? 15 : d.force + (d.capacite === 'medecin' ? 5 : 0) + (d.capacite === 'rassemblement' ? 3 : 0);
  return { brasier: 7, cor: 6, leurre: 6 }[d.type] || 3;
}

// Cartes parmi lesquelles le joueur choisit pour son chef ([] si l'effet ne demande pas de choix)
function cartesChef(s, i) {
  const p = s.players[i];
  const q = s.players[adversaire(i)];
  switch (effetChef(p)) {
    case 'meteo': return p.pioche.filter((c) => (def(c).type === 'meteo' && !s.meteo[def(c).meteo])
      || (def(c).type === 'eclaircie' && RANGEES.some((r) => s.meteo[r])));
    case 'voler-defausse': return q.defausse.slice();
    case 'recuperer': return p.defausse.slice();
    case 'echanger': return p.pioche.slice();
    default: return [];
  }
}
// (une seule carte par sorte : deux exemplaires identiques reviennent au même)
export const choixChef = (s, i) => sansDoublon(cartesChef(s, i));

export function chefUtilisable(s, i) {
  const p = s.players[i];
  if (p.chefUtilise || s.status !== 'jeu' || !p.clan || chefPassif(p) || chefAnnule(s, i)) return false;
  const j = adversaire(i);
  const effet = effetChef(p) || '';
  const r = effet.split('-')[1];
  switch (famille(effet)) {
    case 'cor': return !p.cors[r];
    case 'bruler': return totalRangee(s, j, r) >= 10 && s.players[j].rangees[r].some((c) => estUnite(c) && !def(c).legende);
    case 'meteo': return r ? !s.meteo[r] && !!meteoEnPioche(p, r) : choixChef(s, i).length > 0;
    case 'eclaircie': return RANGEES.some((x) => s.meteo[x]);
    case 'resurrection': return p.defausse.some((x) => estUnite(x) && !def(x).legende && def(x).capacite !== 'espion');
    case 'pioche': return p.pioche.length > 0;
    case 'espionner': return s.players[j].main.length > 0;
    case 'voler-defausse': case 'recuperer': return choixChef(s, i).length > 0;
    case 'echanger': return p.main.length >= 2 && p.pioche.length > 0;
    case 'agiles': return RANGEES.some((x) => p.rangees[x].some((c) => estUnite(c) && def(c).rangees.length > 1));
    case 'melanger-defausses': return s.players.some((x) => x.defausse.length > 0);
    default: return false;
  }
}

// Déplace chaque unité agile vers la rangée où le camp compte le plus
function placerAgiles(s, i) {
  const p = s.players[i];
  const agiles = [];
  RANGEES.forEach((r) => p.rangees[r].forEach((c) => { if (estUnite(c) && def(c).rangees.length > 1) agiles.push(c); }));
  let n = 0;
  agiles.forEach((carte) => {
    const depart = RANGEES.find((r) => p.rangees[r].includes(carte));
    p.rangees[depart] = p.rangees[depart].filter((c) => c !== carte);
    let meilleure = depart;
    let meilleurTotal = -1;
    def(carte).rangees.forEach((r) => {
      p.rangees[r].push(carte);
      const t = total(s, i);
      if (t > meilleurTotal || (t === meilleurTotal && r === depart)) { meilleurTotal = t; meilleure = r; }
      p.rangees[r].pop();
    });
    p.rangees[meilleure].push(carte);
    if (meilleure !== depart) n++;
  });
  return n;
}

// u : carte choisie (effets à choix) ; sans choix, la meilleure est prise automatiquement
// defausse : pour « echanger », les 2 cartes de la main à défausser (sinon les 2 plus faibles)
export function utiliserChef(s, i, u, defausse) {
  if (s.status !== 'jeu' || s.active !== i || s.players[i].passe || !chefUtilisable(s, i)) return false;
  const p = s.players[i];
  const j = adversaire(i);
  const q = s.players[j];
  const effet = effetChef(p);
  const r = effet.split('-')[1];
  let detail = '';
  let choisie = null;
  if (CHEFS_A_CHOIX.includes(effet)) {
    const options = choixChef(s, i);
    choisie = u === undefined || u === null ? options.reduce((a, b) => (valeurCarte(b) > valeurCarte(a) ? b : a), options[0])
      : cartesChef(s, i).find((c) => c.u === u);
    if (!choisie) return false;
  }
  const retirer = (liste, c) => liste.filter((x) => x.u !== c.u);
  switch (famille(effet)) {
    case 'cor': p.cors[r] = true; break;
    case 'bruler': bruler(s, j, r); break;
    case 'meteo': {
      const carte = r ? meteoEnPioche(p, r) : choisie;
      p.pioche = retirer(p.pioche, carte);
      p.defausse.push(carte);
      if (def(carte).type === 'eclaircie') RANGEES.forEach((x) => { s.meteo[x] = false; });
      else s.meteo[def(carte).meteo] = true;
      detail = ` (${def(carte).nom})`;
      break;
    }
    case 'eclaircie': RANGEES.forEach((x) => { s.meteo[x] = false; }); break;
    case 'resurrection': ressusciter(s, i); break;
    case 'pioche': piocher(s, i, 1); break;
    case 'espionner': {
      const vues = melanger(q.main.slice()).slice(0, 3).map((c) => c.c);
      s.revelation = { joueur: i, cartes: vues, ts: Date.now() + Math.random() };
      break;
    }
    case 'voler-defausse':
      q.defausse = retirer(q.defausse, choisie);
      p.main.push({ c: choisie.c, u: choisie.u });
      detail = ` (il prend ${def(choisie).nom})`;
      break;
    case 'recuperer':
      p.defausse = retirer(p.defausse, choisie);
      p.main.push(choisie);
      detail = ` (il reprend ${def(choisie).nom})`;
      break;
    case 'echanger': {
      let faibles = p.main.slice().sort((a, b) => valeurCarte(a) - valeurCarte(b)).slice(0, 2);
      if (Array.isArray(defausse) && defausse.length) {
        faibles = p.main.filter((c) => defausse.includes(c.u));
        if (faibles.length !== 2 || defausse.length !== 2) return false;
      }
      p.main = p.main.filter((c) => !faibles.includes(c));
      p.defausse.push(...faibles);
      p.pioche = retirer(p.pioche, choisie);
      p.main.push(choisie);
      break;
    }
    case 'agiles': {
      const n = placerAgiles(s, i);
      detail = ` (${n} unité${n > 1 ? 's' : ''} déplacée${n > 1 ? 's' : ''})`;
      break;
    }
    case 'melanger-defausses':
      s.players.forEach((x) => { x.pioche = melanger([...x.pioche, ...x.defausse]); x.defausse = []; });
      break;
    default: return false;
  }
  p.chefUtilise = true;
  journal(s, `${p.name} utilise son chef : ${chefDe(p).nom}${detail}.`);
  apresAction(s, i);
  return true;
}

// ---------------------------------------------------------------------
// Tours, passes et manches
// ---------------------------------------------------------------------
function apresAction(s, i) {
  s.coup = (s.coup || 0) + 1;
  const j = adversaire(i);
  s.active = s.players[j].passe ? i : j;
  passerSiBloque(s);
}

// Un joueur sans carte (et sans chef utilisable) passe automatiquement
function passerSiBloque(s) {
  if (s.status !== 'jeu') return;
  const p = s.players[s.active];
  if (!p.passe && p.main.length === 0 && !chefUtilisable(s, s.active)) passer(s, s.active);
}

export function passer(s, i) {
  if (s.status !== 'jeu' || s.active !== i || s.players[i].passe) return false;
  s.players[i].passe = true;
  s.coup = (s.coup || 0) + 1;
  journal(s, `${s.players[i].name} passe.`);
  const j = adversaire(i);
  if (s.players[j].passe) { finManche(s); return true; }
  s.active = j;
  passerSiBloque(s);
  return true;
}

function finManche(s) {
  const scores = [total(s, 0), total(s, 1)];
  let gagnant = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : -1;
  // Atout « égalités » (Shinobi) : les égalités leur reviennent
  if (gagnant === -1) {
    const elus = s.players.map((p, k) => (effetAtout(p) === 'egalites' ? k : -1)).filter((k) => k >= 0);
    if (elus.length === 1) gagnant = elus[0];
  }
  if (gagnant === -1) s.players.forEach((p) => { p.vies -= 1; });
  else s.players[adversaire(gagnant)].vies -= 1;
  // Atout « pioche » (Dragon) : une carte piochée à chaque manche gagnée
  if (gagnant >= 0 && effetAtout(s.players[gagnant]) === 'pioche-victoire') piocher(s, gagnant, 1);

  // Le plateau est vidé (atout « hantise », ou chef « garder-unite » : une unité au hasard reste)
  const garderTous = s.players.some((p, k) => effetActif(s, k, 'garder-unite'));
  s.players.forEach((p) => {
    let reste = null;
    if (effetAtout(p) === 'hantise' || garderTous) {
      const unites = [];
      RANGEES.forEach((r) => p.rangees[r].forEach((c) => { if (estUnite(c)) unites.push([r, c]); }));
      if (unites.length) reste = unites[Math.floor(Math.random() * unites.length)];
    }
    RANGEES.forEach((r) => {
      p.rangees[r].forEach((c) => { if (!reste || c.u !== reste[1].u) p.defausse.push(c); });
      p.rangees[r] = reste && reste[0] === r ? [reste[1]] : [];
      p.cors[r] = false;
    });
    p.passe = false;
  });
  RANGEES.forEach((r) => { s.meteo[r] = false; });

  s.resultats.push({ gagnant, scores });
  const nom = gagnant >= 0 ? s.players[gagnant].name : null;
  s.finManche = { ts: Date.now(), manche: s.manche, gagnant, scores, texte: nom ? `${nom} remporte la manche ${s.manche} (${Math.max(...scores)} à ${Math.min(...scores)}).` : `Manche ${s.manche} : égalité à ${scores[0]}, chacun perd une vie.` };
  journal(s, s.finManche.texte);

  const vivants = s.players.map((p, k) => (p.vies > 0 ? k : -1)).filter((k) => k >= 0);
  if (vivants.length < 2) {
    s.status = 'fin';
    s.gagnant = vivants.length === 1 ? vivants[0] : -1;
    return;
  }
  // Manche suivante : le perdant commence (égalité : celui qui n'avait pas commencé)
  s.manche += 1;
  s.active = gagnant >= 0 ? adversaire(gagnant) : adversaire(s.premier);
  s.premier = s.active;
  passerSiBloque(s);
}

// Qui doit agir maintenant
export function acteur(s) {
  if (s.status === 'clans') return s.players.findIndex((p) => !p.clan);
  if (s.status === 'echange') return s.players.findIndex((p) => !p.pret);
  if (s.status === 'jeu') return s.active;
  return -1;
}

// ---------------------------------------------------------------------
// Bot
// ---------------------------------------------------------------------
const cloner = (s) => JSON.parse(JSON.stringify(s));

// Toutes les actions possibles du joueur i, avec l'écart de score qu'elles produisent
function evaluerCoups(s, i) {
  const j = adversaire(i);
  const ecart0 = total(s, i) - total(s, j);
  const coups = [];
  s.players[i].main.forEach((carte) => {
    ciblesPossibles(s, i, carte.u).forEach((choix) => {
      const t = cloner(s);
      if (!jouerCarte(t, i, carte.u, choix)) return;
      const d = def(carte);
      let gain = (total(t, i) - total(t, j)) - ecart0;
      // une carte piochée vaut cher : les espions sont de bonnes affaires
      gain += (t.players[i].main.length - (s.players[i].main.length - 1)) * 6;
      if (d.type === 'leurre') {
        const reprise = def(s.players[i].rangees[choix.rangee].find((c) => c.u === choix.cible));
        gain += reprise.capacite === 'espion' ? 9 : reprise.capacite === 'medecin' ? 5 : 1;
      }
      coups.push({ action: { type: 'jouer', u: carte.u, choix }, gain, cout: d.type === 'unite' ? d.force : 4, carte: d });
    });
  });
  if (chefUtilisable(s, i)) {
    const options = choixChef(s, i);
    (options.length ? options.map((c) => c.u) : [undefined]).forEach((u) => {
      const t = cloner(s);
      if (!utiliserChef(t, i, u)) return;
      const mainAvant = s.players[i].main.reduce((v, c) => v + valeurCarte(c), 0);
      const mainApres = t.players[i].main.reduce((v, c) => v + valeurCarte(c), 0);
      const bonus = effetChef(s.players[i]) === 'espionner' ? 0.5 : 3;
      coups.push({ action: u === undefined ? { type: 'chef' } : { type: 'chef', u }, gain: (total(t, i) - total(t, j)) - ecart0 + bonus + (mainApres - mainAvant) * 0.6, cout: 0 });
    });
  }
  return coups;
}

export function decisionBot(s, i) {
  if (s.status === 'clans') {
    const clans = clansDeLEdition(s);
    const clan = clans[Math.floor(Math.random() * clans.length)];
    const chefs = CLANS[clan].chefs || [];
    return { type: 'clan', clan, chef: chefs.length ? chefs[Math.floor(Math.random() * chefs.length)].id : '' };
  }
  if (s.status === 'echange') return { type: 'pret' };
  if (s.status !== 'jeu' || s.active !== i) return null;

  const p = s.players[i];
  const j = adversaire(i);
  const q = s.players[j];
  const ecart = total(s, i) - total(s, j);
  const coups = evaluerCoups(s, i).filter((c) => c.gain > 0);

  // L'adversaire a passé : gagner la manche au moindre coût, ou abandonner si c'est sans espoir
  if (q.passe) {
    if (ecart > 0) return { type: 'passer' };
    const gagnants = coups.filter((c) => ecart + c.gain - (c.carte && c.carte.capacite === 'espion' ? 12 : 0) > 0);
    if (gagnants.length) return gagnants.sort((a, b) => a.cout - b.cout)[0].action;
    // pas de victoire en un coup : continuer seulement si la manche est décisive et l'écart rattrapable
    const potentiel = coups.reduce((t, c) => t + Math.max(0, c.gain), 0);
    if (p.vies === 1 && coups.length && ecart + potentiel > 0) return coups.sort((a, b) => b.gain - a.gain)[0].action;
    return { type: 'passer' };
  }

  // Les espions d'abord : piocher des cartes vaut presque toujours le coup
  const espion = coups.find((c) => c.carte && c.carte.capacite === 'espion');
  if (espion) return espion.action;

  // Économiser ses cartes : passer avec une bonne avance, si ce n'est pas la manche décisive
  const avanceConfortable = s.manche === 1 ? 14 : 20;
  if (ecart >= avanceConfortable && q.vies > 1 && p.main.length <= q.main.length + 2) return { type: 'passer' };
  if (!coups.length) return { type: 'passer' };

  // En tête : le coup le moins cher qui garde l'avance ; sinon : le coup le plus efficace
  if (ecart > 5) return coups.sort((a, b) => a.cout - b.cout)[0].action;
  return coups.sort((a, b) => (b.gain / (1 + b.cout * 0.15)) - (a.gain / (1 + a.cout * 0.15)))[0].action;
}

// Exécute une action (humain ou bot) pour le joueur i
export function jouerAction(s, i, a) {
  if (!a) return false;
  switch (a.type) {
    case 'clan': return choisirClan(s, i, a.clan, a.deck, a.chef);
    case 'edition': return changerEdition(s, i, a.edition);
    case 'echanger': return echangerCarte(s, i, a.u);
    case 'pret': return pret(s, i);
    case 'jouer': return jouerCarte(s, i, a.u, a.choix || {});
    case 'chef': return utiliserChef(s, i, a.u, a.defausse);
    case 'passer': return passer(s, i);
    default: return false;
  }
}
