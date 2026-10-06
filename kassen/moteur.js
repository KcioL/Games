// Moteur de règles de « Kassen » (sans affichage). Règles inspirées du Gwynt.
// Toutes les actions modifient l'état `s` et renvoient false si elles sont interdites.
import { CARTES, CLANS, PAQUETS, RANGEES } from './cartes.js';

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
  if (d.legende) return d.force;
  let f = s.meteo[r] ? 1 : d.force;
  const rangee = s.players[j].rangees[r];
  if (d.capacite === 'lien') f *= rangee.filter((x) => def(x).capacite === 'lien' && def(x).groupe === d.groupe).length;
  f += rangee.filter((x) => x.u !== carte.u && def(x).capacite === 'moral').length;
  if (s.players[j].cors[r]) f *= 2;
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
}

function construirePaquet(clan) {
  const cartes = [];
  PAQUETS[clan].forEach(([c, n]) => { for (let k = 0; k < n; k++) cartes.push({ c }); });
  return melanger(cartes);
}

export function choisirClan(s, i, clan) {
  const p = s.players[i];
  if (s.status !== 'clans' || p.clan || !CLANS[clan]) return false;
  p.clan = clan;
  // chaque carte reçoit un identifiant unique dans la partie (utile pour le kagemusha)
  const paquet = construirePaquet(clan).map((c, k) => ({ c: c.c, u: 1000 * (i + 1) + k }));
  p.main = paquet.slice(0, TAILLE_MAIN);
  p.pioche = paquet.slice(TAILLE_MAIN);
  s.coup = (s.coup || 0) + 1;
  if (s.players.every((q) => q.clan)) s.status = 'echange';
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
    // Première manche : face aux Sōhei, c'est l'adversaire qui commence ; sinon au hasard
    const sohei = s.players.map((q, k) => (q.clan === 'sohei' ? k : -1)).filter((k) => k >= 0);
    s.active = sohei.length === 1 ? adversaire(sohei[0]) : Math.floor(Math.random() * 2);
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
}

// Ramène l'unité la plus forte de la défausse (hors légendes et espions)
function ressusciter(s, i) {
  const p = s.players[i];
  const candidates = p.defausse.filter((x) => estUnite(x) && !def(x).legende && def(x).capacite !== 'espion');
  if (!candidates.length) return false;
  const meilleure = candidates.reduce((a, b) => (def(b).force > def(a).force ? b : a));
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
export function chefUtilisable(s, i) {
  const p = s.players[i];
  if (p.chefUtilise || s.status !== 'jeu' || !p.clan) return false;
  const j = adversaire(i);
  switch (p.clan) {
    case 'dragon': return !p.cors.cac;
    case 'shinobi': return totalRangee(s, j, 'dist') >= 10 && s.players[j].rangees.dist.some((c) => estUnite(c) && !def(c).legende);
    case 'yokai': return p.defausse.some((x) => estUnite(x) && !def(x).legende && def(x).capacite !== 'espion');
    case 'sohei': return RANGEES.some((r) => s.meteo[r]);
    default: return false;
  }
}

export function utiliserChef(s, i) {
  if (s.status !== 'jeu' || s.active !== i || s.players[i].passe || !chefUtilisable(s, i)) return false;
  const p = s.players[i];
  const j = adversaire(i);
  switch (p.clan) {
    case 'dragon': p.cors.cac = true; break;
    case 'shinobi': {
      const rangee = s.players[j].rangees.dist;
      const max = Math.max(...rangee.filter((c) => estUnite(c) && !def(c).legende).map((c) => forceCarte(s, j, 'dist', c)));
      const garder = [];
      rangee.forEach((c) => { if (estUnite(c) && !def(c).legende && forceCarte(s, j, 'dist', c) === max) s.players[j].defausse.push(c); else garder.push(c); });
      s.players[j].rangees.dist = garder;
      break;
    }
    case 'yokai': ressusciter(s, i); break;
    case 'sohei': RANGEES.forEach((r) => { s.meteo[r] = false; }); break;
    default: return false;
  }
  p.chefUtilise = true;
  journal(s, `${p.name} utilise son chef : ${CLANS[p.clan].chef}.`);
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
  // Atout Shinobi : les égalités leur reviennent
  if (gagnant === -1) {
    const shinobi = s.players.map((p, k) => (p.clan === 'shinobi' ? k : -1)).filter((k) => k >= 0);
    if (shinobi.length === 1) gagnant = shinobi[0];
  }
  if (gagnant === -1) s.players.forEach((p) => { p.vies -= 1; });
  else s.players[adversaire(gagnant)].vies -= 1;
  // Atout Dragon : une carte piochée à chaque manche gagnée
  if (gagnant >= 0 && s.players[gagnant].clan === 'dragon') piocher(s, gagnant, 1);

  // Le plateau est vidé (atout Yōkai : une unité au hasard reste)
  s.players.forEach((p) => {
    let reste = null;
    if (p.clan === 'yokai') {
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
    const t = cloner(s);
    if (utiliserChef(t, i)) coups.push({ action: { type: 'chef' }, gain: (total(t, i) - total(t, j)) - ecart0 + 3, cout: 0 });
  }
  return coups;
}

export function decisionBot(s, i) {
  if (s.status === 'clans') {
    const clans = Object.keys(CLANS);
    return { type: 'clan', clan: clans[Math.floor(Math.random() * clans.length)] };
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
    case 'clan': return choisirClan(s, i, a.clan);
    case 'echanger': return echangerCarte(s, i, a.u);
    case 'pret': return pret(s, i);
    case 'jouer': return jouerCarte(s, i, a.u, a.choix || {});
    case 'chef': return utiliserChef(s, i);
    case 'passer': return passer(s, i);
    default: return false;
  }
}
