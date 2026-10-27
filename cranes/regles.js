// Skull King : règles (sans affichage), extensions comprises (Kraken, Baleine blanche, Butin).
// Jeu de plis à annonces : 10 manches, à la manche n chacun reçoit n cartes et annonce combien de plis il fera.

export const COULEURS = ['perroquet', 'coffre', 'carte', 'pavillon']; // pavillon (noir) = atout
export const NOMS_COULEURS = { perroquet: 'Perroquet', coffre: 'Coffre', carte: 'Carte au trésor', pavillon: 'Pavillon noir' };
export const NB_MANCHES = 10;

// Cartes spéciales : type, nombre d'exemplaires, nom affiché, fichier d'illustration (dossier cranes/cartes/)
export const SPECIALES = {
  fuite: { n: 5, nom: 'Drapeau blanc', image: (k) => 'drapeau-blanc' },
  pirate: { n: 5, nom: 'Pirate', image: (k) => `pirate-${k}` },
  tigresse: { n: 1, nom: 'La Tigresse', image: () => 'tigresse' },
  sirene: { n: 2, nom: 'Sirène', image: (k) => `sirene-${k}` },
  roi: { n: 1, nom: 'Skull King', image: () => 'roi' },
  kraken: { n: 1, nom: 'Le Kraken', image: () => 'kraken' },
  baleine: { n: 1, nom: 'La Baleine blanche', image: () => 'baleine' },
  butin: { n: 2, nom: 'Butin', image: (k) => 'butin' },
};

// Pouvoirs des pirates (variante, choisie par l'hôte) : ils agissent quand le pirate remporte le pli.
// Le numéro est celui de l'illustration (cartes/pirate-1.jpg … pirate-5.jpg).
export const PIRATES = {
  1: { nom: 'Captain Blood', pouvoir: 'meneur', texte: 'choisit qui commence le pli suivant' },
  2: { nom: 'Quartermaster', pouvoir: 'regarder', texte: 'regarde en secret les cartes qui n\'ont pas été distribuées' },
  3: { nom: 'Rogue', pouvoir: 'pioche', texte: 'pioche 2 cartes dans le paquet, puis en défausse 2' },
  4: { nom: 'Cook', pouvoir: 'ajuste', texte: 'à la fin de la manche, peut changer son annonce de 1 (en plus ou en moins)' },
  5: { nom: 'Gunner', pouvoir: 'pari', texte: 'parie 0, 10 ou 20 points sur son annonce : gagnés si elle est réussie, perdus sinon' },
};
export const nomPirate = (k) => (PIRATES[k] ? PIRATES[k].nom : 'Pirate');
export const PARIS = [0, 10, 20];

export function nouveauPaquet() {
  const p = [];
  COULEURS.forEach((s) => { for (let v = 1; v <= 14; v++) p.push({ id: `${s}${v}`, t: 'n', s, v }); });
  Object.entries(SPECIALES).forEach(([t, d]) => {
    for (let k = 1; k <= d.n; k++) p.push({ id: d.n > 1 ? `${t}${k}` : t, t, k });
  });
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}
export const TAILLE_PAQUET = 56 + Object.values(SPECIALES).reduce((a, d) => a + d.n, 0); // 74

export const cartesPourManche = (manche, n) => Math.min(manche, Math.floor(TAILLE_PAQUET / n));
export const estSpeciale = (c) => c.t !== 'n';

// Firebase supprime les tableaux vides : on les recrée
export function normaliser(s) {
  s.players = s.players || [];
  s.players.forEach((p) => {
    p.main = p.main || [];
    p.allies = p.allies || [];
    p.score = p.score || 0;
    p.plis = p.plis || 0;
    p.bonus = p.bonus || 0;
    if (p.annonce === undefined || p.annonce === null) p.annonce = -1;
    p.pari = p.pari || 0;
    p.details = p.details || [];
    p.ajuste = !!p.ajuste;
  });
  s.reste = s.reste || [];
  s.pouvoir = s.pouvoir || null;
  s.pli = s.pli || [];
  s.scores = s.scores || [];
  s.scores.forEach((m) => { m.lignes = m.lignes || []; });
  if (s.dernierPli) s.dernierPli.cartes = s.dernierPli.cartes || [];
  return s;
}

// ---------- Déroulement ----------
export function nouvellePartie(s) {
  normaliser(s);
  s.players.forEach((p) => { p.score = 0; });
  s.scores = [];
  s.manche = 1;
  s.donneur = Math.floor(Math.random() * s.players.length);
  s.partie = (s.partie || 0) + 1;
  demarrerManche(s);
}

function demarrerManche(s) {
  const n = s.players.length;
  const nb = cartesPourManche(s.manche, n);
  const paquet = nouveauPaquet();
  s.players.forEach((p) => Object.assign(p, { main: [], annonce: -1, plis: 0, bonus: 0, allies: [], pari: 0, ajuste: false, annonceDepart: null, details: [] }));
  for (let k = 0; k < nb; k++) {
    for (let o = 1; o <= n; o++) s.players[(s.donneur + o) % n].main.push(paquet.pop());
  }
  s.reste = paquet; // cartes non distribuées (pour les pouvoirs du Rogue et du Quartermaster)
  s.pouvoir = null;
  s.dernierPouvoir = null;
  s.cartesManche = nb;
  s.status = 'annonces';
  s.pli = [];
  s.numPli = 0;
  s.dernierPli = null;
  s.bilan = null;
  s.entame = (s.donneur + 1) % n;
  s.active = s.entame;
  s.coup = (s.coup || 0) + 1;
}

export function annoncer(s, i, x) {
  const p = s.players[i];
  if (s.status !== 'annonces' || !p || p.annonce >= 0) return false;
  if (!Number.isInteger(x) || x < 0 || x > s.cartesManche) return false;
  p.annonce = x;
  if (s.players.every((q) => q.annonce >= 0)) {
    s.status = 'jeu';
    s.active = s.entame;
  }
  s.coup = (s.coup || 0) + 1;
  return true;
}

// Type « effectif » d'une carte jouée (la Tigresse est pirate ou drapeau blanc ; le Butin compte comme un drapeau blanc)
export function typeJoue(e) {
  if (e.c.t === 'tigresse') return e.choix === 'pirate' ? 'pirate' : 'fuite';
  if (e.c.t === 'butin') return 'fuite';
  return e.c.t;
}
const commeFuite = (e) => ['fuite', 'kraken', 'baleine'].includes(typeJoue(e));

// Couleur à suivre : celle de la première carte numérotée, sauf si un personnage a ouvert le pli
export function couleurDemandee(pli) {
  for (const e of pli) {
    if (commeFuite(e)) continue;
    if (e.c.t === 'n') return e.c.s;
    return null; // pirate, sirène, roi (ou Tigresse pirate) en tête : pas de couleur imposée
  }
  return null;
}

// atoutLibre (variante, choisie par l'hôte) : le Pavillon noir peut couper à tout moment, comme une carte spéciale
export function jouable(main, carte, pli, atoutLibre = false) {
  if (estSpeciale(carte)) return true;
  if (atoutLibre && carte.s === 'pavillon') return true;
  const couleur = couleurDemandee(pli);
  if (!couleur || carte.s === couleur) return true;
  return !main.some((c) => c.t === 'n' && c.s === couleur);
}

// Qui remporte un pli (complet ou non) sans Kraken ni Baleine ; renvoie l'index dans le pli
function gagnantNormal(pli) {
  const idx = (t) => pli.findIndex((e) => typeJoue(e) === t);
  const roi = idx('roi'); const sir = idx('sirene'); const pir = idx('pirate');
  if (roi >= 0 && sir >= 0) return { k: sir, motif: 'sirene-roi' };
  if (roi >= 0) return { k: roi, motif: 'roi' };
  if (pir >= 0) return { k: pir, motif: 'pirate' };
  if (sir >= 0) return { k: sir, motif: 'sirene' };
  const nums = pli.map((e, k) => [e, k]).filter(([e]) => e.c.t === 'n');
  if (!nums.length) return { k: 0, motif: 'fuite' }; // que des drapeaux blancs : le premier gagne
  const noirs = nums.filter(([e]) => e.c.s === 'pavillon');
  const couleur = couleurDemandee(pli);
  const candidats = noirs.length ? noirs : nums.filter(([e]) => e.c.s === couleur);
  const liste = candidats.length ? candidats : nums;
  let meilleur = liste[0];
  liste.forEach((x) => { if (x[0].c.v > meilleur[0].c.v) meilleur = x; });
  return { k: meilleur[1], motif: noirs.length ? 'atout' : 'couleur' };
}

// Résultat d'un pli : gagnant (index de joueur, -1 si le pli est détruit), joueur qui ouvre le suivant, bonus
export function resultatPli(pli) {
  const iK = pli.findIndex((e) => e.c.t === 'kraken');
  const iB = pli.findIndex((e) => e.c.t === 'baleine');
  let mode = 'normal';
  // Kraken et Baleine dans le même pli : c'est le dernier joué des deux qui agit
  if (iK >= 0 && iB >= 0) mode = iK > iB ? 'kraken' : 'baleine';
  else if (iK >= 0) mode = 'kraken';
  else if (iB >= 0) mode = 'baleine';

  if (mode === 'kraken') {
    // le pli est englouti ; celui qui l'aurait remporté ouvre le suivant
    const g = gagnantNormal(pli.map((e) => (e.c.t === 'kraken' || e.c.t === 'baleine' ? { ...e, choix: 'fuite', c: { ...e.c, t: 'fuite' } } : e)));
    return { gagnant: -1, meneur: pli[g.k].j, detruit: true, raison: 'kraken', bonus: 0, allies: [], k: -1 };
  }
  if (mode === 'baleine') {
    // tous les personnages perdent leurs pouvoirs : le plus gros chiffre gagne, quelle que soit sa couleur
    const nums = pli.map((e, k) => [e, k]).filter(([e]) => e.c.t === 'n');
    if (!nums.length) return { gagnant: -1, meneur: pli[iB].j, detruit: true, raison: 'baleine', bonus: 0, allies: [], k: -1 };
    let m = nums[0];
    nums.forEach((x) => { if (x[0].c.v > m[0].c.v) m = x; });
    const gagnant = pli[m[1]].j;
    const d14 = details14(pli);
    return { gagnant, meneur: gagnant, detruit: false, raison: 'baleine', bonus: somme(d14), details: d14, allies: alliesButin(pli, gagnant), k: m[1] };
  }
  const g = gagnantNormal(pli);
  const gagnant = pli[g.k].j;
  const details = details14(pli);
  const nb = (t) => pli.filter((e) => typeJoue(e) === t).length;
  const pl = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  if (g.motif === 'sirene-roi') details.push({ t: 'La Sirène capture le Skull King', pts: 40 });
  else if (g.motif === 'roi' && nb('pirate')) details.push({ t: `Le Skull King capture ${pl(nb('pirate'), 'pirate')}`, pts: 30 * nb('pirate') });
  else if (g.motif === 'pirate' && nb('sirene')) details.push({ t: `Le pirate capture ${pl(nb('sirene'), 'sirène')}`, pts: 20 * nb('sirene') });
  return { gagnant, meneur: gagnant, detruit: false, raison: g.motif, bonus: somme(details), details, allies: alliesButin(pli, gagnant), k: g.k };
}
const somme = (d) => d.reduce((a, x) => a + x.pts, 0);
const NOMS_14 = { perroquet: 'Perroquet', coffre: 'Coffre', carte: 'Carte au trésor', pavillon: 'Pavillon noir' };
// les 14 remportés : +10 (couleur), +20 (Pavillon noir)
function details14(pli) {
  return pli.filter((e) => e.c.t === 'n' && e.c.v === 14)
    .map((e) => ({ t: `14 ${NOMS_14[e.c.s]}`, pts: e.c.s === 'pavillon' ? 20 : 10 }));
}
function alliesButin(pli, gagnant) {
  return pli.filter((e) => e.c.t === 'butin' && e.j !== gagnant).map((e) => e.j);
}

export function jouer(s, i, id, choix) {
  if (s.status !== 'jeu' || s.active !== i || s.pouvoir) return false;
  const p = s.players[i];
  const k = p.main.findIndex((c) => c.id === id);
  if (k < 0) return false;
  const carte = p.main[k];
  if (!jouable(p.main, carte, s.pli, !!s.atoutLibre)) return false;
  if (carte.t === 'tigresse' && choix !== 'pirate' && choix !== 'fuite') return false;
  p.main.splice(k, 1);
  const e = { j: i, c: carte };
  if (carte.t === 'tigresse') e.choix = choix;
  s.pli.push(e);
  s.coup = (s.coup || 0) + 1;
  if (s.pli.length < s.players.length) {
    s.active = (i + 1) % s.players.length;
    return true;
  }
  // pli complet
  const r = resultatPli(s.pli);
  if (!r.detruit) {
    const g = s.players[r.gagnant];
    g.plis += 1;
    g.bonus += r.bonus;
    g.details.push(...(r.details || []));
    r.allies.forEach((b) => {
      s.players[b].allies.push(r.gagnant);
      g.allies.push(b);
    });
  }
  s.dernierPli = { cartes: s.pli, gagnant: r.gagnant, detruit: r.detruit, raison: r.raison, bonus: r.bonus, num: s.numPli, k: r.k, allies: r.allies };
  s.numPli += 1;
  s.pli = [];
  const finie = s.numPli >= s.cartesManche;
  s.entame = r.meneur;
  s.active = r.meneur;
  s.dernierPouvoir = null;
  // pouvoir du pirate qui a remporté le pli
  const pv = pouvoirDuPli(s, r, finie);
  if (pv) {
    s.pouvoir = { type: pv.pouvoir, j: r.gagnant, k: pv.k, finie };
    if (pv.pouvoir === 'pioche') {
      const pioche = s.reste.splice(-2, 2);
      s.players[r.gagnant].main.push(...pioche);
      s.pouvoir.nb = pioche.length;
      s.pouvoir.pioche = pioche.map((c) => c.id);
    }
    s.active = r.gagnant;
    return true;
  }
  if (finie) finManche(s);
  return true;
}

function pouvoirDuPli(s, r, finie) {
  if (!s.pouvoirs || r.detruit || r.raison === 'baleine' || r.k < 0) return null;
  const e = s.dernierPli.cartes[r.k];
  if (!e || e.c.t !== 'pirate') return null; // la Tigresse jouée en pirate n'a pas de pouvoir
  const def = PIRATES[e.c.k];
  if (!def) return null;
  const g = s.players[r.gagnant];
  if (def.pouvoir === 'ajuste') { g.ajuste = true; s.dernierPouvoir = { type: 'ajuste', j: r.gagnant, k: e.c.k }; return null; }
  // inutiles quand la manche est finie
  if (finie && ['pioche', 'regarder', 'meneur'].includes(def.pouvoir)) return null;
  if (def.pouvoir === 'pioche' && !s.reste.length) return null;
  if (def.pouvoir === 'regarder' && !s.reste.length) return null;
  return { pouvoir: def.pouvoir, k: e.c.k };
}

// Le joueur utilise le pouvoir de son pirate
//   pari : 0, 10 ou 20 ; meneur : index du joueur qui commence ; pioche : les ids des cartes défaussées ; regarder : rien
export function utiliserPouvoir(s, i, choix) {
  const pv = s.pouvoir;
  if (s.status !== 'jeu' || !pv || pv.j !== i) return false;
  const p = s.players[i];
  const trace = { type: pv.type, j: i, k: pv.k };
  if (pv.type === 'pari') {
    if (!PARIS.includes(choix)) return false;
    p.pari = choix;
    trace.pari = choix;
  } else if (pv.type === 'meneur') {
    if (!Number.isInteger(choix) || !s.players[choix]) return false;
    s.entame = choix;
    trace.meneur = choix;
  } else if (pv.type === 'pioche') {
    const ids = Array.isArray(choix) ? choix : [];
    if (ids.length !== pv.nb || new Set(ids).size !== ids.length || !ids.every((id) => p.main.some((c) => c.id === id))) return false;
    p.main = p.main.filter((c) => !ids.includes(c.id));
    trace.nb = pv.nb;
  }
  s.pouvoir = null;
  s.dernierPouvoir = trace;
  s.active = s.entame;
  s.coup = (s.coup || 0) + 1;
  if (pv.finie) finManche(s);
  return true;
}

// Cook : en fin de manche, changer son annonce de −1, 0 ou +1
export function ajuster(s, i, delta) {
  const p = s.players[i];
  if (s.status !== 'ajustement' || !p || !p.ajuste || ![-1, 0, 1].includes(delta)) return false;
  const nouvelle = p.annonce + delta;
  if (nouvelle < 0 || nouvelle > s.cartesManche) return false;
  p.annonceDepart = p.annonce;
  p.annonce = nouvelle;
  p.ajuste = false;
  s.dernierPouvoir = { type: 'ajuste', j: i, de: p.annonceDepart, a: nouvelle };
  s.coup = (s.coup || 0) + 1;
  finManche(s);
  return true;
}

// Points d'une manche pour chaque joueur
export function pointsManche(s) {
  const cartes = s.cartesManche;
  const reussi = s.players.map((p) => p.annonce === p.plis);
  return s.players.map((p, i) => {
    const pl = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
    const detail = [];
    // alliances du Butin : +20 chacun si les deux ont réussi leur annonce
    const alliesOk = reussi[i] ? p.allies.filter((b) => reussi[b]) : [];
    const allies = alliesOk.length * 20;
    alliesOk.forEach((b) => detail.push({ t: `Alliance du Butin avec ${s.players[b].name}`, pts: 20 }));
    // pari du Gunner : gagné si l'annonce est réussie, perdu sinon
    const pari = p.pari ? (reussi[i] ? p.pari : -p.pari) : 0;
    if (p.pari) detail.push({ t: `Pari du Gunner ${reussi[i] ? 'gagné' : 'perdu'}`, pts: pari });
    const extra = { pari, ajustee: p.annonceDepart !== null && p.annonceDepart !== undefined && p.annonceDepart !== p.annonce ? p.annonceDepart : null };
    if (extra.ajustee !== null) detail.unshift({ t: `Annonce changée par le Cook (${extra.ajustee} → ${p.annonce})`, pts: 0 });
    const bonusPlis = p.details || [];
    if (p.annonce === 0) {
      const base = p.plis === 0 ? 10 * cartes : -10 * cartes;
      detail.unshift({ t: p.plis === 0 ? `Annonce de 0 réussie (10 × ${pl(cartes, 'carte')})` : `Annonce de 0 ratée (−10 × ${pl(cartes, 'carte')})`, pts: base });
      if (p.plis !== 0 && bonusPlis.length) detail.push({ t: `Bonus perdus : ${somme(bonusPlis)} pts (annonce ratée)`, pts: 0 });
      return { annonce: 0, plis: p.plis, bonus: (p.plis === 0 ? allies : 0) + pari, points: base + (p.plis === 0 ? allies : 0) + pari, reussi: reussi[i], detail, ...extra };
    }
    if (reussi[i]) {
      const bonus = p.bonus + allies + pari;
      detail.unshift(...bonusPlis);
      detail.unshift({ t: `Annonce de ${p.annonce} réussie (20 × ${pl(p.annonce, 'pli')})`, pts: 20 * p.annonce });
      return { annonce: p.annonce, plis: p.plis, bonus, points: 20 * p.annonce + bonus, reussi: true, detail, ...extra };
    }
    const ecart = Math.abs(p.plis - p.annonce);
    detail.unshift({ t: `Annonce ratée de ${pl(ecart, 'pli')} (−10 × ${ecart})`, pts: -10 * ecart });
    if (bonusPlis.length) detail.push({ t: `Bonus perdus : ${somme(bonusPlis)} pts (annonce ratée)`, pts: 0 });
    return { annonce: p.annonce, plis: p.plis, bonus: pari, points: -10 * ecart + pari, reussi: false, detail, ...extra };
  });
}

function finManche(s) {
  // Cook : ceux qui peuvent encore changer leur annonce le font d'abord
  if (s.players.some((p) => p.ajuste)) {
    s.status = 'ajustement';
    s.active = -1;
    s.coup = (s.coup || 0) + 1;
    return;
  }
  const lignes = pointsManche(s);
  lignes.forEach((l, i) => { s.players[i].score += l.points; });
  s.scores.push({ manche: s.manche, cartes: s.cartesManche, lignes });
  s.bilan = { manche: s.manche, lignes };
  s.status = 'bilan';
  s.active = -1;
}

export function mancheSuivante(s) {
  if (s.status !== 'bilan') return false;
  if (s.manche >= NB_MANCHES) {
    s.status = 'termine';
    s.coup = (s.coup || 0) + 1;
    return true;
  }
  s.manche += 1;
  s.donneur = (s.donneur + 1) % s.players.length;
  demarrerManche(s);
  return true;
}

export function classement(s) {
  return s.players.map((p, i) => ({ i, nom: p.name, score: p.score })).sort((a, b) => b.score - a.score);
}

// ---------- Bots ----------
// chance qu'une carte remporte un pli (pour annoncer)
function chanceCarte(c, n) {
  const moins = n >= 6 ? 0.8 : 1;
  switch (c.t) {
    case 'roi': return 0.92;
    case 'pirate': return 0.8 * moins;
    case 'tigresse': return 0.75 * moins;
    case 'sirene': return 0.55 * moins;
    case 'baleine': return 0.3;
    case 'kraken': case 'fuite': case 'butin': return 0;
    default:
      if (c.s === 'pavillon') return (c.v >= 12 ? 0.8 : c.v >= 9 ? 0.6 : c.v >= 6 ? 0.38 : 0.18) * moins;
      return (c.v >= 13 ? 0.5 : c.v >= 11 ? 0.32 : c.v >= 9 ? 0.15 : 0.04) * moins;
  }
}
export function annonceBot(s, i) {
  const p = s.players[i];
  const n = s.players.length;
  let total = p.main.reduce((a, c) => a + chanceCarte(c, n), 0);
  total += (Math.random() - 0.5) * 0.6;
  return Math.max(0, Math.min(s.cartesManche, Math.round(total)));
}
// force d'une carte (pour choisir laquelle sacrifier ou garder)
function force(c) {
  switch (c.t) {
    case 'roi': return 100;
    case 'pirate': return 90;
    case 'tigresse': return 88;
    case 'sirene': return 80;
    case 'baleine': return 30;
    case 'kraken': return 5;
    case 'fuite': case 'butin': return 0;
    default: return (c.s === 'pavillon' ? 50 : 10) + c.v;
  }
}
export function coupBot(s, i) {
  const p = s.players[i];
  const pli = s.pli;
  const besoin = p.annonce - p.plis;
  const options = [];
  p.main.filter((c) => jouable(p.main, c, pli, !!s.atoutLibre)).forEach((c) => {
    if (c.t === 'tigresse') { options.push({ c, choix: 'pirate' }); options.push({ c, choix: 'fuite' }); } else options.push({ c });
  });
  const valeur = (o) => (o.c.t === 'tigresse' ? (o.choix === 'pirate' ? 88 : 0) : force(o.c));
  const parValeur = [...options].sort((a, b) => valeur(a) - valeur(b));
  const resultat = (o) => {
    const essai = [...pli, { j: i, c: o.c, choix: o.choix }];
    const r = resultatPli(essai);
    return r.gagnant === i;
  };
  const choisir = (o) => ({ id: o.c.id, choix: o.choix });

  if (!pli.length) {
    // on ouvre le pli
    if (besoin > 0) {
      const fort = [...parValeur].reverse().find((o) => valeur(o) >= 60);
      if (fort && (besoin >= p.main.length - 1 || Math.random() < 0.7)) return choisir(fort);
      const moyen = parValeur.find((o) => o.c.t === 'n' && o.c.s !== 'pavillon' && o.c.v >= 10);
      return choisir(moyen || parValeur[parValeur.length - 1]);
    }
    const faible = parValeur.find((o) => o.c.t === 'n' && o.c.v <= 6) || parValeur[0];
    return choisir(faible);
  }
  const dernier = pli.length === s.players.length - 1;
  const gagnants = parValeur.filter(resultat);
  const perdants = parValeur.filter((o) => !resultat(o));
  if (besoin > 0) {
    if (gagnants.length) {
      if (dernier) return choisir(gagnants[0]); // le plus petit qui suffit
      const sur = gagnants.find((o) => valeur(o) >= 55);
      return choisir(sur || gagnants[gagnants.length - 1]);
    }
    return choisir(parValeur[0]); // on ne peut pas gagner : on se débarrasse du plus faible
  }
  // on ne veut plus de pli : on se débarrasse de la plus forte carte qui perd
  if (perdants.length) return choisir(perdants[perdants.length - 1]);
  return choisir(parValeur[0]);
}

// ---------- Pouvoirs des pirates : les bots ----------
export function pouvoirBot(s, i) {
  const pv = s.pouvoir;
  const p = s.players[i];
  const reste = s.cartesManche - s.numPli; // plis encore à jouer
  const besoin = p.annonce - p.plis;
  if (pv.type === 'pari') {
    if (besoin < 0 || besoin > reste) return 0;          // annonce déjà ratée
    return besoin === 0 || reste <= 2 ? 20 : 10;
  }
  if (pv.type === 'meneur') {
    // besoin de plis : on ouvre soi-même ; sinon on fait ouvrir le voisin pour jouer en dernier
    return besoin > 0 ? i : (i + 1) % s.players.length;
  }
  if (pv.type === 'pioche') {
    const tri = [...p.main].sort((a, b) => force(a) - force(b));
    const jete = besoin > 0 ? tri.slice(0, pv.nb) : tri.slice(-pv.nb);
    return jete.map((c) => c.id);
  }
  return null; // regarder
}
export function ajusteBot(s, i) {
  const p = s.players[i];
  const d = p.plis - p.annonce;
  if (d === 0 || Math.abs(d) > 1) return 0;
  return d;
}
