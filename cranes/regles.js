// Le Roi des Crânes : règles (sans affichage), extensions comprises (Kraken, Baleine blanche, Butin).
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
  roi: { n: 1, nom: 'Le Roi des Crânes', image: () => 'roi' },
  kraken: { n: 1, nom: 'Le Kraken', image: () => 'kraken' },
  baleine: { n: 1, nom: 'La Baleine blanche', image: () => 'baleine' },
  butin: { n: 2, nom: 'Butin', image: (k) => 'butin' },
};

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
  });
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
  s.players.forEach((p) => Object.assign(p, { main: [], annonce: -1, plis: 0, bonus: 0, allies: [] }));
  for (let k = 0; k < nb; k++) {
    for (let o = 1; o <= n; o++) s.players[(s.donneur + o) % n].main.push(paquet.pop());
  }
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

export function jouable(main, carte, pli) {
  if (estSpeciale(carte)) return true;
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
    return { gagnant, meneur: gagnant, detruit: false, raison: 'baleine', bonus: bonus14(pli), allies: alliesButin(pli, gagnant), k: m[1] };
  }
  const g = gagnantNormal(pli);
  const gagnant = pli[g.k].j;
  let bonus = bonus14(pli);
  const nb = (t) => pli.filter((e) => typeJoue(e) === t).length;
  if (g.motif === 'sirene-roi') bonus += 40;          // la Sirène capture le Roi des Crânes
  else if (g.motif === 'roi') bonus += 30 * nb('pirate'); // le Roi capture les pirates
  else if (g.motif === 'pirate') bonus += 20 * nb('sirene'); // un pirate capture les sirènes
  return { gagnant, meneur: gagnant, detruit: false, raison: g.motif, bonus, allies: alliesButin(pli, gagnant), k: g.k };
}
function bonus14(pli) {
  return pli.reduce((a, e) => a + (e.c.t === 'n' && e.c.v === 14 ? (e.c.s === 'pavillon' ? 20 : 10) : 0), 0);
}
function alliesButin(pli, gagnant) {
  return pli.filter((e) => e.c.t === 'butin' && e.j !== gagnant).map((e) => e.j);
}

export function jouer(s, i, id, choix) {
  if (s.status !== 'jeu' || s.active !== i) return false;
  const p = s.players[i];
  const k = p.main.findIndex((c) => c.id === id);
  if (k < 0) return false;
  const carte = p.main[k];
  if (!jouable(p.main, carte, s.pli)) return false;
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
    r.allies.forEach((b) => {
      s.players[b].allies.push(r.gagnant);
      g.allies.push(b);
    });
  }
  s.dernierPli = { cartes: s.pli, gagnant: r.gagnant, detruit: r.detruit, raison: r.raison, bonus: r.bonus, num: s.numPli, k: r.k, allies: r.allies };
  s.numPli += 1;
  s.pli = [];
  if (s.numPli >= s.cartesManche) finManche(s);
  else { s.entame = r.meneur; s.active = r.meneur; }
  return true;
}

// Points d'une manche pour chaque joueur
export function pointsManche(s) {
  const cartes = s.cartesManche;
  const reussi = s.players.map((p) => p.annonce === p.plis);
  return s.players.map((p, i) => {
    // alliances du Butin : +20 chacun si les deux ont réussi leur annonce
    const allies = reussi[i] ? p.allies.filter((b) => reussi[b]).length * 20 : 0;
    if (p.annonce === 0) {
      const base = p.plis === 0 ? 10 * cartes : -10 * cartes;
      return { annonce: 0, plis: p.plis, bonus: p.plis === 0 ? allies : 0, points: base + (p.plis === 0 ? allies : 0), reussi: reussi[i] };
    }
    if (reussi[i]) {
      const bonus = p.bonus + allies;
      return { annonce: p.annonce, plis: p.plis, bonus, points: 20 * p.annonce + bonus, reussi: true };
    }
    return { annonce: p.annonce, plis: p.plis, bonus: 0, points: -10 * Math.abs(p.plis - p.annonce), reussi: false };
  });
}

function finManche(s) {
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
  p.main.filter((c) => jouable(p.main, c, pli)).forEach((c) => {
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
