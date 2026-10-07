// Éditions du Gwynt : « Édition Japon » (cartes.js) et le jeu personnalisé (jeu-perso.js).
// Ce module vérifie le jeu personnalisé et, s'il est valable, ajoute ses factions et ses cartes
// aux catalogues communs (les identifiants sont préfixés par « p_ » pour éviter tout mélange).
import {
  CARTES, CLANS, COLLECTIONS, DECKS_DEFAUT, CAPACITES, RANGEES, EFFETS_ATOUT, EFFETS_CHEF,
  DECK_MIN_UNITES, DECK_MAX_SPECIALES,
} from './cartes.js';
// Le jeu personnalisé est chargé à part : une faute de frappe dans jeu-perso.js ne doit pas
// empêcher de jouer à l'Édition Japon.
let JEU_PERSO = null;
let erreurLecture = '';
try {
  ({ JEU_PERSO } = await import('./jeu-perso.js'));
} catch (err) {
  erreurLecture = `jeu-perso.js contient une faute d'écriture (souvent une virgule, une accolade ou un guillemet oublié) : ${err.message}`;
}

const TYPES_SPECIAUX = {
  meteo: { kanji: { cac: '雪', dist: '霧', siege: '嵐' } },
  eclaircie: { kanji: '晴', texte: 'Dissipe toutes les météos.' },
  cor: { kanji: '鼓', texte: 'Double la force des unités d\'une de tes rangées (hors légendes).' },
  leurre: { kanji: '影', texte: 'Prend la place d\'une de tes unités (hors légendes), qui revient dans ta main.' },
  brasier: { kanji: '雷', texte: 'Détruit la ou les unités les plus fortes du plateau, dans les deux camps (hors légendes).' },
};
const NOMS_METEO = { cac: 'corps à corps', dist: 'distance', siege: 'siège' };

// Vérifie le jeu personnalisé ; renvoie la liste des problèmes (vide si tout va bien)
export function verifierJeuPerso(jeu) {
  const erreurs = [];
  if (!jeu || typeof jeu !== 'object') return ['Le fichier jeu-perso.js est illisible.'];
  const factions = jeu.factions || {};
  const cartes = Array.isArray(jeu.cartes) ? jeu.cartes : [];
  if (!Object.keys(factions).length) erreurs.push('Aucune faction.');
  Object.entries(factions).forEach(([cle, f]) => {
    if (!/^[a-z0-9_-]+$/.test(cle)) erreurs.push(`Faction « ${cle} » : la clé doit être en minuscules, sans accents ni espaces.`);
    if (!f.nom) erreurs.push(`Faction « ${cle} » : il manque le nom.`);
    if (!EFFETS_ATOUT[f.atout]) erreurs.push(`Faction « ${cle} » : atout inconnu (« ${f.atout} »).`);
    if (!EFFETS_CHEF[f.chef]) erreurs.push(`Faction « ${cle} » : chef inconnu (« ${f.chef} »).`);
  });
  const vus = new Set();
  cartes.forEach((c, n) => {
    const ou = `Carte ${n + 1}${c && c.nom ? ` (« ${c.nom} »)` : ''}`;
    if (!c || typeof c !== 'object') { erreurs.push(`${ou} : ligne illisible.`); return; }
    if (!c.id || !/^[a-z0-9_-]+$/.test(c.id)) erreurs.push(`${ou} : « id » doit être en minuscules, sans accents ni espaces.`);
    else if (vus.has(c.id)) erreurs.push(`${ou} : l'id « ${c.id} » est déjà utilisé.`);
    vus.add(c.id);
    if (!c.nom) erreurs.push(`${ou} : il manque le nom.`);
    if (c.faction !== 'neutre' && !factions[c.faction]) erreurs.push(`${ou} : faction inconnue (« ${c.faction} »).`);
    const ex = Number(c.exemplaires === undefined ? 1 : c.exemplaires);
    if (!Number.isInteger(ex) || ex < 1 || ex > 9) erreurs.push(`${ou} : « exemplaires » doit être un nombre de 1 à 9.`);
    if (c.type === 'unite') {
      if (!Number.isInteger(c.force) || c.force < 0) erreurs.push(`${ou} : « force » doit être un nombre entier.`);
      if (!['cac', 'dist', 'siege', 'cac+dist'].includes(c.rangee)) erreurs.push(`${ou} : rangée inconnue (« ${c.rangee} »).`);
      if (c.capacite && !CAPACITES[c.capacite]) erreurs.push(`${ou} : capacité inconnue (« ${c.capacite} »).`);
      if (['lien', 'rassemblement'].includes(c.capacite) && !c.groupe) erreurs.push(`${ou} : la capacité « ${c.capacite} » demande un « groupe ».`);
    } else if (TYPES_SPECIAUX[c.type]) {
      if (c.type === 'meteo' && !RANGEES.includes(c.meteo)) erreurs.push(`${ou} : précise « meteo » ('cac', 'dist' ou 'siege').`);
    } else {
      erreurs.push(`${ou} : type inconnu (« ${c.type} »).`);
    }
  });
  // Chaque faction doit pouvoir former un deck d'au moins 22 unités
  if (!erreurs.length) {
    Object.entries(factions).forEach(([cle, f]) => {
      const unites = cartes.filter((c) => c.type === 'unite' && (c.faction === cle || c.faction === 'neutre'))
        .reduce((t, c) => t + Number(c.exemplaires || 1), 0);
      if (unites < DECK_MIN_UNITES) erreurs.push(`Faction « ${f.nom} » : seulement ${unites} unités disponibles (cartes de la faction + neutres), il en faut au moins ${DECK_MIN_UNITES}.`);
    });
  }
  return erreurs;
}

const prefixe = (id) => `p_${id}`;

function chargerJeuPerso(jeu) {
  const dossier = jeu.dossierImages || 'illustrations-perso/';
  // Cartes
  jeu.cartes.forEach((c) => {
    const base = { nom: c.nom, image: c.image ? dossier + c.image : '' };
    if (c.faction !== 'neutre') base.clan = prefixe(c.faction);
    if (c.type === 'unite') {
      Object.assign(base, {
        type: 'unite',
        force: c.force,
        rangees: c.rangee === 'cac+dist' ? ['cac', 'dist'] : [c.rangee],
        legende: !!c.legende,
      });
      if (c.rangee === 'cac+dist') base.capacite = 'agile';
      if (c.capacite) base.capacite = c.capacite;
      if (c.groupe) base.groupe = `p_${c.groupe}`;
    } else if (c.type === 'meteo') {
      Object.assign(base, { type: 'meteo', meteo: c.meteo, kanji: c.symbole || TYPES_SPECIAUX.meteo.kanji[c.meteo],
        texte: c.texte || `Toutes les unités ${c.meteo === 'cac' ? 'au' : c.meteo === 'dist' ? 'à' : 'de'} ${NOMS_METEO[c.meteo]} (des deux camps) tombent à 1 de force.` });
    } else {
      Object.assign(base, { type: c.type, kanji: c.symbole || TYPES_SPECIAUX[c.type].kanji, texte: c.texte || TYPES_SPECIAUX[c.type].texte });
    }
    CARTES[prefixe(c.id)] = base;
  });
  // Factions, collections et decks par défaut
  Object.entries(jeu.factions).forEach(([cle, f]) => {
    const id = prefixe(cle);
    CLANS[id] = {
      nom: f.nom, kanji: f.symbole || f.nom.charAt(0), couleur: f.couleur || '#3A3A3A', edition: 'perso',
      effetAtout: f.atout, effetChef: f.chef,
      atout: `${EFFETS_ATOUT[f.atout].charAt(0).toUpperCase()}${EFFETS_ATOUT[f.atout].slice(1)}`,
      chef: f.chefNom || 'Chef', chefTexte: `${EFFETS_CHEF[f.chef].charAt(0).toUpperCase()}${EFFETS_CHEF[f.chef].slice(1)}`,
      chefImage: f.chefImage ? dossier + f.chefImage : '',
    };
    const siennes = jeu.cartes.filter((c) => c.faction === cle || c.faction === 'neutre');
    COLLECTIONS[id] = siennes.map((c) => [prefixe(c.id), Number(c.exemplaires || 1)]);
    const fourni = jeu.decksParDefaut && jeu.decksParDefaut[cle];
    DECKS_DEFAUT[id] = fourni ? fourni.map(([c, n]) => [prefixe(c), n]) : deckAutomatique(COLLECTIONS[id]);
  });
}

// Deck composé automatiquement : les unités les plus fortes (jusqu'à 30), puis 8 spéciales au plus
function deckAutomatique(collection) {
  const aPlat = collection.flatMap(([c, n]) => Array(n).fill(c));
  const unites = aPlat.filter((c) => CARTES[c].type === 'unite').sort((a, b) => CARTES[b].force - CARTES[a].force).slice(0, 30);
  const speciales = aPlat.filter((c) => CARTES[c].type !== 'unite').slice(0, Math.min(8, DECK_MAX_SPECIALES));
  const compte = {};
  [...unites, ...speciales].forEach((c) => { compte[c] = (compte[c] || 0) + 1; });
  return Object.entries(compte);
}

// ---------------------------------------------------------------------
export const ERREURS_JEU_PERSO = erreurLecture ? [erreurLecture] : (JEU_PERSO && JEU_PERSO.actif ? verifierJeuPerso(JEU_PERSO) : []);
export const JEU_PERSO_ACTIF = !!(JEU_PERSO && JEU_PERSO.actif) && !ERREURS_JEU_PERSO.length;
if (JEU_PERSO_ACTIF) chargerJeuPerso(JEU_PERSO);

export const EDITIONS = {
  japon: { nom: 'Édition Japon' },
  ...(JEU_PERSO_ACTIF ? { perso: { nom: JEU_PERSO.nom || 'Mon Gwynt' } } : {}),
};
export const JEU_PERSO_DEMANDE = !!erreurLecture || !!(JEU_PERSO && JEU_PERSO.actif);
