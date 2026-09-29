// Moteur de règles du Monopoly, édition Tokyo (sans affichage).
// Toutes les fonctions modifient l'état `s` et renvoient false si l'action est interdite.
import { CASES, GROUPES, KOBAN, TRANSPORTS, COMPAGNIES, OMIKUJI, MATSURI, casesDuGroupe } from './plateau.js';

export const ARGENT_DEPART = 150000;
export const SALAIRE = 20000;
export const AMENDE = 5000;
export const MISE_MIN = 1000;

const melanger = (t) => { for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } return t; };
export const yens = (n) => `${Math.round(n).toLocaleString('fr-FR')}\u00a0¥`;

// ---------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------
export function normaliser(s) {
  s.players = s.players || [];
  s.players.forEach((p) => { p.sortie = p.sortie || []; p.argent = p.argent || 0; p.prison = p.prison || 0; });
  if (!Array.isArray(s.cases) || s.cases.length !== 40) s.cases = CASES.map(() => ({ p: -1, m: 0, b: 0 }));
  s.journal = s.journal || [];
  s.des = s.des || [0, 0];
  s.pioches = s.pioches || {};
  s.pioches.omikuji = s.pioches.omikuji || [];
  s.pioches.matsuri = s.pioches.matsuri || [];
  s.mouvements = s.mouvements || [];
  s.aAvancer = s.aAvancer || 0;
  if (s.enchere) s.enchere.passes = s.enchere.passes || s.players.map(() => false);
  if (s.offre) { s.offre.donne = s.offre.donne || []; s.offre.recoit = s.offre.recoit || []; }
  return s;
}

export const vivants = (s) => s.players.map((p, i) => (p.faillite ? -1 : i)).filter((i) => i >= 0);
export const achetable = (i) => ['propriete', 'transport', 'compagnie'].includes(CASES[i].type);

function journal(s, texte) {
  s.journal.push(texte.replace(/([!?])\.$/, '$1'));
  if (s.journal.length > 8) s.journal.splice(0, s.journal.length - 8);
}

export function possedeGroupe(s, i, groupe) {
  return casesDuGroupe(groupe).every((c) => s.cases[c].p === i);
}

const batimentsDuGroupe = (s, groupe) => casesDuGroupe(groupe).map((c) => s.cases[c].b);
const groupeSansBatiment = (s, c) => !CASES[c].groupe || batimentsDuGroupe(s, CASES[c].groupe).every((b) => b === 0);

export function loyer(s, c, { doubleTransport = false, compagnie10 = false } = {}) {
  const def = CASES[c];
  const etat = s.cases[c];
  if (etat.p < 0 || etat.m) return 0;
  const somme = s.des[0] + s.des[1];
  if (def.type === 'propriete') {
    if (etat.b > 0) return def.loyers[etat.b];
    return def.loyers[0] * (possedeGroupe(s, etat.p, def.groupe) ? 2 : 1);
  }
  if (def.type === 'transport') {
    const n = TRANSPORTS.filter((t) => s.cases[t].p === etat.p).length;
    return 2500 * 2 ** (n - 1) * (doubleTransport ? 2 : 1);
  }
  const n = COMPAGNIES.filter((t) => s.cases[t].p === etat.p).length;
  return somme * 100 * (compagnie10 || n === 2 ? 10 : 4);
}

// Valeur totale d'un joueur (pour la fin à durée limitée)
export function patrimoine(s, i) {
  let v = s.players[i].argent;
  s.cases.forEach((e, c) => {
    if (e.p !== i) return;
    v += e.m ? CASES[c].prix / 2 : CASES[c].prix;
    if (e.b) v += e.b * GROUPES[CASES[c].groupe].maison;
  });
  return v;
}

// ---------------------------------------------------------------------
// Mise en place
// ---------------------------------------------------------------------
export function nouvellePartie(s) {
  s.players.forEach((p, k) => {
    Object.assign(p, { argent: ARGENT_DEPART, pos: 0, prison: 0, sortie: [], faillite: false, couleur: k });
  });
  s.cases = CASES.map(() => ({ p: -1, m: 0, b: 0 }));
  s.pioches = { omikuji: melanger([...OMIKUJI.keys()]), matsuri: melanger([...MATSURI.keys()]) };
  s.active = Math.floor(Math.random() * s.players.length);
  s.phase = 'lancer';
  s.des = [0, 0];
  s.doubles = 0;
  s.rejoue = false;
  s.tour = 1;
  s.coup = 0;
  s.journal = [];
  s.carte = null;
  s.enchere = null;
  s.dette = null;
  s.offre = null;
  s.classement = null;
  s.status = 'jeu';
  journal(s, `${s.players[s.active].name} commence.`);
}

// ---------------------------------------------------------------------
// Déroulement d'un tour
// ---------------------------------------------------------------------
const EN_ATTENTE = ['acheter', 'enchere', 'dette'];

// Fin de la résolution d'une case : rejouer après un double, sinon fin du tour
function terminer(s) {
  if (EN_ATTENTE.includes(s.phase)) return;
  const p = s.players[s.active];
  if (p.faillite) return;
  s.phase = p.prison === 0 && s.rejoue ? 'lancer' : 'fin-tour';
}

// Chaque déplacement est noté pour que l'écran puisse le rejouer case par case.
// sens : 1 = avance, -1 = recule, 0 = saut direct (kōban)
function noterMouvement(s, i, de, a, sens) {
  s.mouvements = s.mouvements || [];
  s.mouvements.push({ i, de, a, sens });
}

function nouveauxMouvements(s) {
  s.mouvements = [];
  s.mvtId = (s.mvtId || 0) + 1;
}

function avancer(s, i, cible, salaire = true) {
  const p = s.players[i];
  noterMouvement(s, i, p.pos, cible, 1);
  if (salaire && cible <= p.pos && cible !== p.pos) {
    p.argent += SALAIRE;
    journal(s, `${p.name} passe par le Départ : +${yens(SALAIRE)}.`);
  } else if (salaire && cible === 0 && p.pos !== 0) {
    p.argent += SALAIRE;
  }
  p.pos = cible;
}

function allerAuKoban(s, i) {
  const p = s.players[i];
  noterMouvement(s, i, p.pos, KOBAN, 0);
  p.pos = KOBAN;
  p.prison = 1;
  s.rejoue = false;
  s.doubles = 0;
  journal(s, `${p.name} est emmené au kōban.`);
  s.phase = 'fin-tour';
}

// Paiement ; si l'argent manque, le joueur entre en « dette » et doit vendre ou hypothéquer.
// creancier : indice d'un joueur, -1 pour la banque, -2 pour « chaque autre joueur »
function payer(s, i, montant, creancier, motif) {
  const p = s.players[i];
  const autres = vivants(s).filter((k) => k !== i);
  const total = creancier === -2 ? montant * autres.length : montant;
  if (p.argent < total) {
    s.dette = { montant: total, creancier, motif, parJoueur: montant };
    s.phase = 'dette';
    journal(s, `${p.name} doit ${yens(total)} (${motif}) mais n'a que ${yens(p.argent)}.`);
    return false;
  }
  p.argent -= total;
  if (creancier >= 0) s.players[creancier].argent += total;
  if (creancier === -2) autres.forEach((k) => { s.players[k].argent += montant; });
  journal(s, `${p.name} paie ${yens(total)} (${motif}).`);
  return true;
}

function resoudreCase(s, i, options = {}) {
  const p = s.players[i];
  const c = p.pos;
  const def = CASES[c];
  if (achetable(c)) {
    const etat = s.cases[c];
    if (etat.p < 0) { s.phase = 'acheter'; return; }
    if (etat.p === i || etat.m) return;
    const montant = loyer(s, c, options);
    payer(s, i, montant, etat.p, `loyer de ${def.nom} à ${s.players[etat.p].name}`);
    return;
  }
  if (def.type === 'taxe') { payer(s, i, def.montant, -1, def.nom.toLowerCase()); return; }
  if (def.type === 'police') { allerAuKoban(s, i); return; }
  if (def.type === 'omikuji' || def.type === 'matsuri') tirerCarte(s, i, def.type);
}

function tirerCarte(s, i, type) {
  const p = s.players[i];
  const paquet = type === 'omikuji' ? OMIKUJI : MATSURI;
  if (!s.pioches[type].length) s.pioches[type] = melanger([...paquet.keys()].filter((k) => !s.players.some((q) => q.sortie.includes(`${type}:${k}`))));
  const id = s.pioches[type].shift();
  const carte = paquet[id];
  s.carte = { type, texte: carte.texte, ts: Date.now(), joueur: i };
  // La carte prend place dans la suite des déplacements : l'écran la montre avant un éventuel trajet
  s.mouvements = s.mouvements || [];
  s.mouvements.push({ carte: 1, i, type, texte: carte.texte });
  journal(s, `${p.name} tire ${type === 'omikuji' ? 'un omikuji' : 'une carte matsuri'}.`);
  if (carte.effet === 'sortie') p.sortie.push(`${type}:${id}`);
  else s.pioches[type].push(id);

  switch (carte.effet) {
    case 'aller': avancer(s, i, carte.cible); resoudreCase(s, i); break;
    case 'transport': {
      const cible = TRANSPORTS.find((t) => t > p.pos) ?? TRANSPORTS[0];
      avancer(s, i, cible); resoudreCase(s, i, { doubleTransport: true }); break;
    }
    case 'compagnie': {
      const cible = COMPAGNIES.find((t) => t > p.pos) ?? COMPAGNIES[0];
      avancer(s, i, cible); resoudreCase(s, i, { compagnie10: true }); break;
    }
    case 'reculer': {
      const cible = (p.pos - carte.montant + 40) % 40;
      noterMouvement(s, i, p.pos, cible, -1);
      p.pos = cible;
      resoudreCase(s, i);
      break;
    }
    case 'prison': allerAuKoban(s, i); break;
    case 'gain': p.argent += carte.montant; break;
    case 'perte': payer(s, i, carte.montant, -1, 'carte'); break;
    case 'reparations': {
      let total = 0;
      s.cases.forEach((e) => { if (e.p === i && e.b) total += e.b === 5 ? carte.hotel : e.b * carte.maison; });
      if (total > 0) payer(s, i, total, -1, 'travaux');
      break;
    }
    case 'payerChacun': payer(s, i, carte.montant, -2, 'carte'); break;
    case 'recevoirDeChacun':
      vivants(s).filter((k) => k !== i).forEach((k) => {
        const m = Math.min(carte.montant, s.players[k].argent);
        s.players[k].argent -= m;
        p.argent += m;
      });
      break;
    default: break;
  }
}

// Lancer les dés (avec la règle du kōban et des doubles).
// Le pion n'avance pas encore : le joueur voit le résultat, puis choisit « Avancer » (phase 'avancer').
export function lancer(s, i, des) {
  if (s.status !== 'jeu' || s.active !== i || s.phase !== 'lancer' || s.offre) return false;
  const p = s.players[i];
  const [d1, d2] = des || [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
  s.des = [d1, d2];
  s.desId = (s.desId || 0) + 1;
  s.coup = (s.coup || 0) + 1;
  s.carte = null;
  s.aAvancer = 0;
  nouveauxMouvements(s);
  const double = d1 === d2;
  const total = d1 + d2;

  if (p.prison > 0) {
    s.rejoue = false;
    if (double) {
      p.prison = 0;
      journal(s, `${p.name} fait un double (${d1}+${d2}) et sort du kōban.`);
      s.lastEvent = { ts: Date.now(), texte: `${p.name} fait un double (${d1}+${d2}) et sort du kōban !` };
    } else if (p.prison >= 3) {
      journal(s, `${p.name} rate son 3e essai (${d1}+${d2}) : il paie ${yens(AMENDE)} et sort.`);
      s.lastEvent = { ts: Date.now(), texte: `Pas de double au 3e essai (${d1}+${d2}) : ${p.name} paie ${yens(AMENDE)} et sort du kōban.` };
      p.prison = 0;
      if (!payer(s, i, AMENDE, -1, 'amende du kōban')) {
        // il devra d'abord régler l'amende ; il pourra ensuite avancer
        s.dette.deplacement = total;
        return true;
      }
    } else {
      p.prison += 1;
      journal(s, `${p.name} fait ${d1}+${d2} : pas de double, il reste au kōban.`);
      s.phase = 'fin-tour';
      return true;
    }
    s.aAvancer = total;
    s.phase = 'avancer';
    return true;
  }

  s.rejoue = double;
  if (double) {
    s.doubles = (s.doubles || 0) + 1;
    if (s.doubles >= 3) {
      journal(s, `${p.name} fait ${d1}+${d2} : 3 doubles de suite !`);
      allerAuKoban(s, i);
      return true;
    }
  }
  journal(s, `${p.name} fait ${d1}+${d2}${double ? ' (double)' : ''}.`);
  s.aAvancer = total;
  s.phase = 'avancer';
  return true;
}

// Déplacement du pion après le lancer
export function avancerPion(s, i) {
  if (s.status !== 'jeu' || s.active !== i || s.phase !== 'avancer' || !s.aAvancer || s.offre) return false;
  const p = s.players[i];
  const total = s.aAvancer;
  s.aAvancer = 0;
  s.coup = (s.coup || 0) + 1;
  nouveauxMouvements(s);
  avancer(s, i, (p.pos + total) % 40);
  journal(s, `${p.name} avance jusqu'à ${CASES[p.pos].nom}.`);
  s.phase = 'resolu';
  resoudreCase(s, i);
  terminer(s);
  return true;
}

export function payerAmende(s, i) {
  const p = s.players[i];
  if (s.active !== i || s.phase !== 'lancer' || p.prison === 0 || p.argent < AMENDE || s.offre) return false;
  p.argent -= AMENDE;
  p.prison = 0;
  journal(s, `${p.name} paie ${yens(AMENDE)} pour sortir du kōban.`);
  return true;
}

export function utiliserOmamori(s, i) {
  const p = s.players[i];
  if (s.active !== i || s.phase !== 'lancer' || p.prison === 0 || !p.sortie.length || s.offre) return false;
  const [type, id] = p.sortie.shift().split(':');
  s.pioches[type].push(Number(id));
  p.prison = 0;
  journal(s, `${p.name} utilise son omamori et sort du kōban.`);
  return true;
}

// ---------------------------------------------------------------------
// Achat et enchères
// ---------------------------------------------------------------------
export function acheter(s, i) {
  const p = s.players[i];
  const c = p.pos;
  if (s.active !== i || s.phase !== 'acheter' || p.argent < CASES[c].prix) return false;
  p.argent -= CASES[c].prix;
  s.cases[c].p = i;
  s.coup = (s.coup || 0) + 1;
  journal(s, `${p.name} achète ${CASES[c].nom} pour ${yens(CASES[c].prix)}.`);
  s.phase = 'resolu';
  terminer(s);
  return true;
}

// Ne pas acheter, sans enchères : le quartier reste libre.
// Après un double, le joueur doit encore relancer ; sinon son tour se termine directement.
export function refuserAchat(s, i) {
  if (s.active !== i || s.phase !== 'acheter') return false;
  const c = s.players[i].pos;
  journal(s, `${s.players[i].name} n'achète pas ${CASES[c].nom}.`);
  if (s.rejoue && s.players[i].prison === 0) { s.phase = 'lancer'; return true; }
  joueurSuivant(s);
  return true;
}

export function mettreAuxEncheres(s, i) {
  if (s.active !== i || s.phase !== 'acheter') return false;
  const c = s.players[i].pos;
  s.enchere = { case: c, mise: 0, meneur: -1, actif: i, passes: s.players.map((p) => !!p.faillite) };
  s.phase = 'enchere';
  s.coup = (s.coup || 0) + 1;
  journal(s, `${CASES[c].nom} est mis aux enchères.`);
  return true;
}

function enchereSuivante(s) {
  const e = s.enchere;
  const restants = s.players.map((_, k) => k).filter((k) => !e.passes[k]);
  if (e.meneur >= 0 && restants.length === 1 && restants[0] === e.meneur) { finirEnchere(s); return; }
  if (restants.length === 0) { finirEnchere(s); return; }
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const j = (e.actif + k) % n;
    if (!e.passes[j] && j !== e.meneur) { e.actif = j; return; }
  }
  finirEnchere(s);
}

function finirEnchere(s) {
  const e = s.enchere;
  if (e.meneur >= 0) {
    const g = s.players[e.meneur];
    g.argent -= e.mise;
    s.cases[e.case].p = e.meneur;
    journal(s, `${g.name} remporte ${CASES[e.case].nom} aux enchères pour ${yens(e.mise)}.`);
  } else {
    journal(s, `Personne n'a enchéri : ${CASES[e.case].nom} reste à vendre.`);
  }
  s.enchere = null;
  s.phase = 'resolu';
  terminer(s);
}

export function encherir(s, i, montant) {
  const e = s.enchere;
  if (s.phase !== 'enchere' || !e || e.actif !== i || e.passes[i]) return false;
  const nouvelle = e.mise + montant;
  if (montant < MISE_MIN || nouvelle > s.players[i].argent) return false;
  e.mise = nouvelle;
  e.meneur = i;
  s.coup = (s.coup || 0) + 1;
  journal(s, `${s.players[i].name} enchérit à ${yens(nouvelle)}.`);
  enchereSuivante(s);
  return true;
}

export function passerEnchere(s, i) {
  const e = s.enchere;
  if (s.phase !== 'enchere' || !e || e.actif !== i) return false;
  e.passes[i] = true;
  s.coup = (s.coup || 0) + 1;
  enchereSuivante(s);
  return true;
}

// ---------------------------------------------------------------------
// Gestion des biens : construire, vendre, hypothéquer
// ---------------------------------------------------------------------
export const peutGerer = (s, i) => s.status === 'jeu' && s.active === i && !s.offre && ['lancer', 'fin-tour', 'dette', 'acheter'].includes(s.phase);

export function peutConstruire(s, i, c) {
  const def = CASES[c];
  const e = s.cases[c];
  if (def.type !== 'propriete' || e.p !== i || e.b >= 5) return false;
  if (!possedeGroupe(s, i, def.groupe)) return false;
  const groupe = casesDuGroupe(def.groupe);
  if (groupe.some((k) => s.cases[k].m)) return false;
  if (e.b !== Math.min(...batimentsDuGroupe(s, def.groupe))) return false; // construction équilibrée
  return s.players[i].argent >= GROUPES[def.groupe].maison;
}

export function construire(s, i, c) {
  if (!peutGerer(s, i) || s.phase === 'dette' || !peutConstruire(s, i, c)) return false;
  const def = CASES[c];
  s.players[i].argent -= GROUPES[def.groupe].maison;
  s.cases[c].b += 1;
  s.coup = (s.coup || 0) + 1;
  journal(s, `${s.players[i].name} construit ${s.cases[c].b === 5 ? 'un hôtel' : 'une maison'} à ${def.nom}.`);
  return true;
}

export function peutVendre(s, i, c) {
  const def = CASES[c];
  const e = s.cases[c];
  return def.type === 'propriete' && e.p === i && e.b > 0 && e.b === Math.max(...batimentsDuGroupe(s, def.groupe));
}

export function vendre(s, i, c) {
  if (!peutGerer(s, i) || !peutVendre(s, i, c)) return false;
  const def = CASES[c];
  s.cases[c].b -= 1;
  s.players[i].argent += GROUPES[def.groupe].maison / 2;
  s.coup = (s.coup || 0) + 1;
  journal(s, `${s.players[i].name} revend un bâtiment à ${def.nom}.`);
  return true;
}

export const peutHypothequer = (s, i, c) => achetable(c) && s.cases[c].p === i && !s.cases[c].m && groupeSansBatiment(s, c);
export const coutLevee = (c) => Math.ceil((CASES[c].prix / 2) * 1.1 / 100) * 100;

export function hypothequer(s, i, c) {
  if (!peutGerer(s, i) || !peutHypothequer(s, i, c)) return false;
  s.cases[c].m = 1;
  s.players[i].argent += CASES[c].prix / 2;
  s.coup = (s.coup || 0) + 1;
  journal(s, `${s.players[i].name} hypothèque ${CASES[c].nom} (+${yens(CASES[c].prix / 2)}).`);
  return true;
}

export function leverHypotheque(s, i, c) {
  if (!peutGerer(s, i) || s.phase === 'dette' || s.cases[c].p !== i || !s.cases[c].m) return false;
  if (s.players[i].argent < coutLevee(c)) return false;
  s.players[i].argent -= coutLevee(c);
  s.cases[c].m = 0;
  s.coup = (s.coup || 0) + 1;
  journal(s, `${s.players[i].name} lève l'hypothèque de ${CASES[c].nom}.`);
  return true;
}

// ---------------------------------------------------------------------
// Dettes et faillite
// ---------------------------------------------------------------------
export function reglerDette(s, i) {
  const d = s.dette;
  if (s.phase !== 'dette' || s.active !== i || !d || s.players[i].argent < d.montant) return false;
  const p = s.players[i];
  p.argent -= d.montant;
  if (d.creancier >= 0) s.players[d.creancier].argent += d.montant;
  if (d.creancier === -2) vivants(s).filter((k) => k !== i).forEach((k) => { s.players[k].argent += d.parJoueur; });
  journal(s, `${p.name} règle sa dette de ${yens(d.montant)}.`);
  const deplacement = d.deplacement || 0;
  s.dette = null;
  s.phase = 'resolu';
  s.coup = (s.coup || 0) + 1;
  if (deplacement) {
    // après l'amende forcée du kōban, le joueur choisit lui aussi quand avancer
    s.aAvancer = deplacement;
    s.phase = 'avancer';
    return true;
  }
  terminer(s);
  return true;
}

export function faireFaillite(s, i) {
  if (s.phase !== 'dette' || s.active !== i || !s.dette) return false;
  const p = s.players[i];
  const creancier = s.dette.creancier;
  // les bâtiments sont revendus à la banque
  s.cases.forEach((e, c) => { if (e.p === i && e.b) { p.argent += (e.b * GROUPES[CASES[c].groupe].maison) / 2; e.b = 0; } });
  if (creancier >= 0) {
    s.players[creancier].argent += p.argent;
    s.cases.forEach((e) => { if (e.p === i) e.p = creancier; });
    p.sortie.forEach((x) => s.players[creancier].sortie.push(x));
    journal(s, `${p.name} fait faillite : tous ses biens reviennent à ${s.players[creancier].name}.`);
  } else {
    s.cases.forEach((e) => { if (e.p === i) { e.p = -1; e.m = 0; } });
    p.sortie.forEach((x) => { const [t, k] = x.split(':'); s.pioches[t].push(Number(k)); });
    journal(s, `${p.name} fait faillite : ses biens retournent à la banque.`);
  }
  p.argent = 0;
  p.sortie = [];
  p.faillite = true;
  s.dette = null;
  s.coup = (s.coup || 0) + 1;
  s.lastEvent = { ts: Date.now(), texte: `${p.name} fait faillite !` };
  if (vivants(s).length <= 1) { finPartie(s); return true; }
  joueurSuivant(s);
  return true;
}

// ---------------------------------------------------------------------
// Fin du tour et fin de partie
// ---------------------------------------------------------------------
function joueurSuivant(s) {
  const n = s.players.length;
  const avant = s.active;
  for (let k = 1; k <= n; k++) {
    const j = (avant + k) % n;
    if (!s.players[j].faillite) {
      if (j <= avant) s.tour = (s.tour || 1) + 1;
      s.active = j;
      break;
    }
  }
  s.phase = 'lancer';
  s.doubles = 0;
  s.rejoue = false;
  if (s.finMode === 'tours' && s.tour > s.toursMax) finPartie(s);
}

export function finTour(s, i) {
  if (s.status !== 'jeu' || s.active !== i || s.phase !== 'fin-tour' || s.offre) return false;
  s.coup = (s.coup || 0) + 1;
  joueurSuivant(s);
  return true;
}

export function finPartie(s) {
  const ordre = s.players.map((_, k) => k).sort((a, b) => {
    const fa = s.players[a].faillite ? 1 : 0;
    const fb = s.players[b].faillite ? 1 : 0;
    return fa - fb || patrimoine(s, b) - patrimoine(s, a);
  });
  s.classement = ordre.map((k) => ({ i: k, valeur: patrimoine(s, k) }));
  s.status = 'fin';
  s.phase = 'fin';
  journal(s, `Partie terminée : ${s.players[ordre[0]].name} l'emporte !`);
}

// ---------------------------------------------------------------------
// Échanges entre joueurs
// ---------------------------------------------------------------------
export const echangeable = (s, i, c) => achetable(c) && s.cases[c].p === i && groupeSansBatiment(s, c);

export function proposer(s, i, o) {
  if (s.status !== 'jeu' || s.active !== i || !['lancer', 'fin-tour'].includes(s.phase) || s.offre) return false;
  const a = o.a;
  if (a === i || !s.players[a] || s.players[a].faillite) return false;
  const donne = o.donne || [];
  const recoit = o.recoit || [];
  const donneArgent = Math.max(0, Math.round(o.donneArgent || 0));
  const recoitArgent = Math.max(0, Math.round(o.recoitArgent || 0));
  if (!donne.length && !recoit.length && !donneArgent && !recoitArgent) return false;
  if (!donne.every((c) => echangeable(s, i, c)) || !recoit.every((c) => echangeable(s, a, c))) return false;
  if (donneArgent > s.players[i].argent || recoitArgent > s.players[a].argent) return false;
  s.offre = { de: i, a, donne, recoit, donneArgent, recoitArgent };
  s.coup = (s.coup || 0) + 1;
  journal(s, `${s.players[i].name} propose un échange à ${s.players[a].name}.`);
  return true;
}

export function repondre(s, j, accepte) {
  const o = s.offre;
  if (!o || o.a !== j) return false;
  const i = o.de;
  s.offre = null;
  s.coup = (s.coup || 0) + 1;
  if (!accepte) { journal(s, `${s.players[j].name} refuse l'échange.`); return true; }
  // on revérifie : la situation a pu changer
  const ok = o.donne.every((c) => echangeable(s, i, c)) && o.recoit.every((c) => echangeable(s, j, c))
    && o.donneArgent <= s.players[i].argent && o.recoitArgent <= s.players[j].argent;
  if (!ok) { journal(s, 'Échange impossible : la situation a changé.'); return true; }
  o.donne.forEach((c) => { s.cases[c].p = j; });
  o.recoit.forEach((c) => { s.cases[c].p = i; });
  s.players[i].argent += o.recoitArgent - o.donneArgent;
  s.players[j].argent += o.donneArgent - o.recoitArgent;
  journal(s, `${s.players[j].name} accepte l'échange avec ${s.players[i].name}.`);
  return true;
}

export function annulerOffre(s, i) {
  if (!s.offre || s.offre.de !== i) return false;
  s.offre = null;
  s.coup = (s.coup || 0) + 1;
  return true;
}

// Qui doit agir maintenant (réponse à un échange, enchère, ou joueur actif)
export function acteur(s) {
  if (s.status !== 'jeu') return -1;
  if (s.offre) return s.offre.a;
  if (s.phase === 'enchere' && s.enchere) return s.enchere.actif;
  return s.active;
}

// ---------------------------------------------------------------------
// Bots : une action à la fois
// ---------------------------------------------------------------------
const RESERVE = 25000;

function valeurPour(s, i, c, gagne) {
  const def = CASES[c];
  let v = s.cases[c].m ? def.prix / 2 : def.prix;
  if (def.groupe) {
    const groupe = casesDuGroupe(def.groupe);
    const miens = groupe.filter((k) => s.cases[k].p === i || (gagne && k === c)).length;
    if (gagne && miens === groupe.length) v *= 2.2;          // me permet de compléter un groupe
    if (!gagne && groupe.every((k) => k === c || s.cases[k].p === i)) v *= 2.2; // je casserais mon groupe
  }
  return v;
}

// Un bot cherche à compléter un groupe dont il possède déjà une partie, auprès d'un seul autre joueur :
// d'abord un troc où chacun complète un groupe, sinon un rachat au-dessus du prix.
function propositionBot(s, i) {
  const dernier = (s.offresBot || {})[i];
  if (dernier !== undefined && (s.tour || 1) - dernier < 6) return null;
  const p = s.players[i];
  for (const g of Object.keys(GROUPES)) {
    const groupe = casesDuGroupe(g);
    const miens = groupe.filter((c) => s.cases[c].p === i);
    const manquants = groupe.filter((c) => s.cases[c].p !== i);
    if (!miens.length || !manquants.length) continue;
    const proprios = [...new Set(manquants.map((c) => s.cases[c].p))];
    if (proprios.length !== 1 || proprios[0] < 0) continue;
    const j = proprios[0];
    if (s.players[j].faillite || !manquants.every((c) => echangeable(s, j, c)) || !miens.every((c) => echangeable(s, i, c))) continue;
    // troc : un groupe que j pourrait compléter avec mes cases
    for (const h of Object.keys(GROUPES)) {
      if (h === g) continue;
      const gh = casesDuGroupe(h);
      const pourLui = gh.filter((c) => s.cases[c].p !== j);
      if (pourLui.length && gh.some((c) => s.cases[c].p === j) && pourLui.every((c) => s.cases[c].p === i && echangeable(s, i, c))) {
        return { type: 'proposer', offre: { a: j, donne: pourLui, recoit: manquants, donneArgent: 0, recoitArgent: 0 } };
      }
    }
    const prix = Math.ceil(manquants.reduce((a, c) => a + CASES[c].prix, 0) * 1.6 / 1000) * 1000;
    if (p.argent - prix >= RESERVE) {
      return { type: 'proposer', offre: { a: j, donne: [], recoit: manquants, donneArgent: prix, recoitArgent: 0 } };
    }
  }
  return null;
}

export function decisionBot(s, i) {
  const p = s.players[i];
  if (s.offre && s.offre.a === i) {
    const o = s.offre;
    const gain = o.donne.reduce((a, c) => a + valeurPour(s, i, c, true), 0) + o.donneArgent
      - o.recoit.reduce((a, c) => a + valeurPour(s, i, c, false), 0) - o.recoitArgent;
    // ne pas offrir un groupe complet à l'adversaire… sauf si l'échange m'en complète un aussi
    const completeGroupe = (cases, pour) => cases.some((c) => CASES[c].groupe
      && casesDuGroupe(CASES[c].groupe).every((k) => cases.includes(k) || s.cases[k].p === pour));
    const donneGroupe = completeGroupe(o.recoit, o.de);
    const recoitGroupe = completeGroupe(o.donne, i);
    return { type: 'repondre', accepte: gain > 0 && (!donneGroupe || recoitGroupe) };
  }
  if (s.phase === 'enchere' && s.enchere && s.enchere.actif === i) {
    const c = s.enchere.case;
    const max = Math.min(p.argent - 10000, valeurPour(s, i, c, true) * (0.85 + Math.random() * 0.3));
    const pas = s.enchere.mise < CASES[c].prix * 0.5 ? 5000 : 1000;
    return s.enchere.mise + pas <= max ? { type: 'encherir', montant: pas } : { type: 'passer' };
  }
  if (s.active !== i) return null;
  if (s.phase === 'avancer') return { type: 'avancer' };

  if (s.phase === 'dette') {
    if (p.argent >= s.dette.montant) return { type: 'regler' };
    const vendable = s.cases.map((_, c) => c).filter((c) => peutVendre(s, i, c));
    if (vendable.length) return { type: 'vendre', c: vendable[vendable.length - 1] };
    const hyp = s.cases.map((_, c) => c).filter((c) => peutHypothequer(s, i, c)).sort((a, b) => CASES[a].prix - CASES[b].prix);
    if (hyp.length) return { type: 'hypothequer', c: hyp[0] };
    return { type: 'faillite' };
  }
  if (s.phase === 'acheter') {
    const c = p.pos;
    const complete = CASES[c].groupe && casesDuGroupe(CASES[c].groupe).every((k) => k === c || s.cases[k].p === i);
    if (p.argent - CASES[c].prix >= RESERVE || (complete && p.argent >= CASES[c].prix)) return { type: 'acheter' };
    return { type: 'encheres' };
  }
  if (s.phase === 'lancer' || s.phase === 'fin-tour') {
    // proposer un échange pour compléter un groupe (au plus une fois tous les 6 tours)
    const proposition = propositionBot(s, i);
    if (proposition) return proposition;
    // gestion : lever une hypothèque, puis construire, si les finances le permettent
    const levable = s.cases.map((_, c) => c).filter((c) => s.cases[c].p === i && s.cases[c].m && p.argent - coutLevee(c) > RESERVE * 2);
    if (levable.length) return { type: 'lever', c: levable[0] };
    const constructibles = s.cases.map((_, c) => c).filter((c) => peutConstruire(s, i, c)
      && p.argent - GROUPES[CASES[c].groupe].maison > RESERVE);
    if (constructibles.length) return { type: 'construire', c: constructibles[constructibles.length - 1] };
    if (s.phase === 'fin-tour') return { type: 'fin' };
    if (p.prison > 0) {
      if (p.sortie.length) return { type: 'omamori' };
      if (p.argent > 60000 && (s.tour || 1) < 25) return { type: 'amende' };
    }
    return { type: 'lancer' };
  }
  return null;
}

// Exécute une action (humain ou bot) pour le joueur i.
// Toute action réussie fait avancer le compteur `coup` (utile pour enchaîner les coups des bots).
export function jouerAction(s, i, a) {
  const ok = executer(s, i, a);
  if (ok) s.coup = (s.coup || 0) + 1;
  return ok;
}

function executer(s, i, a) {
  if (!a) return false;
  switch (a.type) {
    case 'lancer': return lancer(s, i);
    case 'avancer': return avancerPion(s, i);
    case 'amende': return payerAmende(s, i);
    case 'omamori': return utiliserOmamori(s, i);
    case 'acheter': return acheter(s, i);
    case 'encheres': return mettreAuxEncheres(s, i);
    case 'refuser': return refuserAchat(s, i);
    case 'encherir': return encherir(s, i, a.montant);
    case 'passer': return passerEnchere(s, i);
    case 'construire': return construire(s, i, a.c);
    case 'vendre': return vendre(s, i, a.c);
    case 'hypothequer': return hypothequer(s, i, a.c);
    case 'lever': return leverHypotheque(s, i, a.c);
    case 'regler': return reglerDette(s, i);
    case 'faillite': return faireFaillite(s, i);
    case 'fin': return finTour(s, i);
    case 'proposer': {
      const ok = proposer(s, i, a.offre);
      if (ok && s.players[i].bot) { s.offresBot = s.offresBot || {}; s.offresBot[i] = s.tour || 1; }
      return ok;
    }
    case 'repondre': return repondre(s, i, a.accepte);
    case 'annuler': return annulerOffre(s, i);
    default: return false;
  }
}
