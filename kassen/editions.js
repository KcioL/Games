// Chargement des deux jeux : Kassen (kassen/kassen/jeu.js) et le Gwynt (kassen/gwynt/jeu.js).
// Les deux fichiers ont le même format. Chacun est vérifié, puis ses clans et ses cartes sont ajoutés
// aux catalogues communs (cartes.js). Les images sont dans <jeu>/cartes/<id>.jpg.
import {
  CARTES, CLANS, COLLECTIONS, DECKS_DEFAUT, CAPACITES, RANGEES, EFFETS_ATOUT, EFFETS_CHEF, ALIAS_CHEF,
  DECK_MIN_UNITES, DECK_MAX_SPECIALES,
} from './cartes.js';

const SPECIAUX = {
  meteo: { symbole: { cac: '雪', dist: '霧', siege: '嵐' } },
  eclaircie: { symbole: '晴', texte: 'Dissipe toutes les météos.' },
  cor: { symbole: '鼓', texte: 'Double la force des unités d\'une de tes rangées (hors légendes).' },
  leurre: { symbole: '影', texte: 'Prend la place d\'une de tes unités (hors légendes), qui revient dans ta main.' },
  brasier: { symbole: '雷', texte: 'Détruit la ou les unités les plus fortes du plateau, dans les deux camps (hors légendes).' },
};
const NOMS_METEO = { cac: 'au corps à corps', dist: 'à distance', siege: 'de siège' };
// Rangées touchées par une météo : 'cac', 'dist', 'siege', ou plusieurs ('dist+siege')
const zones = (m) => String(m || '').split('+');
const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const effetValide = (e) => !!EFFETS_CHEF[ALIAS_CHEF[e] || e];

// Chefs d'une faction : la liste « chefs », ou l'ancien format (un seul « chef » + « chefNom »)
const chefsDe = (cle, f) => (Array.isArray(f.chefs) ? f.chefs : (f.chef ? [{ id: `chef_${cle}`, nom: f.chefNom || 'Chef', effet: f.chef }] : []));

// Vérifie un jeu ; renvoie la liste des problèmes (vide si tout va bien)
export function verifierJeu(jeu) {
  const erreurs = [];
  if (!jeu || typeof jeu !== 'object') return ['Le fichier jeu.js est illisible.'];
  const factions = jeu.factions || {};
  const cartes = Array.isArray(jeu.cartes) ? jeu.cartes : [];
  if (!Object.keys(factions).length) erreurs.push('Aucune faction.');
  if (!cartes.length) erreurs.push('Aucune carte pour l\'instant.');
  Object.entries(factions).forEach(([cle, f]) => {
    if (!/^[a-z0-9_-]+$/.test(cle)) erreurs.push(`Faction « ${cle} » : la clé doit être en minuscules, sans accents ni espaces.`);
    if (!f.nom) erreurs.push(`Faction « ${cle} » : il manque le nom.`);
    if (!EFFETS_ATOUT[f.atout]) erreurs.push(`Faction « ${cle} » : atout inconnu (« ${f.atout} »).`);
    const chefs = chefsDe(cle, f);
    if (!chefs.length) erreurs.push(`Faction « ${cle} » : il faut au moins un chef (liste « chefs »).`);
    chefs.forEach((c, n) => {
      const ou = `Faction « ${cle} », chef ${n + 1}${c && c.nom ? ` (« ${c.nom} »)` : ''}`;
      if (!c || !c.id || !/^[a-z0-9_-]+$/.test(c.id)) erreurs.push(`${ou} : « id » doit être en minuscules, sans accents ni espaces.`);
      if (!c || !c.nom) erreurs.push(`${ou} : il manque le nom.`);
      if (!c || !effetValide(c.effet)) erreurs.push(`${ou} : effet inconnu (« ${c && c.effet} »).`);
    });
  });
  // identifiants des chefs : uniques, et différents de ceux des cartes (leurs images sont dans le même dossier)
  const idsChefs = Object.entries(factions).flatMap(([cle, f]) => chefsDe(cle, f).map((c) => c && c.id)).filter(Boolean);
  const idsCartes = new Set(cartes.map((c) => c && c.id));
  idsChefs.forEach((id, n) => {
    if (idsChefs.indexOf(id) !== n) erreurs.push(`Chef « ${id} » : cet id est utilisé par deux chefs.`);
    if (idsCartes.has(id)) erreurs.push(`Chef « ${id} » : cet id est déjà celui d'une carte.`);
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
    if (c.images !== undefined && !(Number.isInteger(c.images) && c.images >= 1 && c.images <= 9)) erreurs.push(`${ou} : « images » doit être un nombre de 1 à 9.`);
    const ex = Number(c.exemplaires === undefined ? 1 : c.exemplaires);
    if (!Number.isInteger(ex) || ex < 1 || ex > 9) erreurs.push(`${ou} : « exemplaires » doit être un nombre de 1 à 9.`);
    if (c.type === 'unite') {
      if (!Number.isInteger(c.force) || c.force < 0) erreurs.push(`${ou} : « force » doit être un nombre entier.`);
      if (!['cac', 'dist', 'siege', 'cac+dist'].includes(c.rangee)) erreurs.push(`${ou} : rangée inconnue (« ${c.rangee} »).`);
      if (c.capacite && !CAPACITES[c.capacite]) erreurs.push(`${ou} : capacité inconnue (« ${c.capacite} »).`);
      if (['lien', 'rassemblement'].includes(c.capacite) && !c.groupe) erreurs.push(`${ou} : la capacité « ${c.capacite} » demande un « groupe ».`);
    } else if (SPECIAUX[c.type]) {
      if (c.type === 'meteo' && !zones(c.meteo).every((r) => RANGEES.includes(r))) erreurs.push(`${ou} : précise « meteo » ('cac', 'dist', 'siege', ou plusieurs comme 'dist+siege').`);
    } else {
      erreurs.push(`${ou} : type inconnu (« ${c.type} »).`);
    }
  });
  if (!erreurs.length) {
    Object.entries(factions).forEach(([cle, f]) => {
      const unites = cartes.filter((c) => c.collection !== false && c.type === 'unite' && (c.faction === cle || c.faction === 'neutre'))
        .reduce((t, c) => t + Number(c.exemplaires || 1), 0);
      if (unites < DECK_MIN_UNITES) erreurs.push(`Faction « ${f.nom} » : seulement ${unites} unités disponibles (cartes de la faction + neutres), il en faut au moins ${DECK_MIN_UNITES}.`);
    });
  }
  return erreurs;
}

// Ajoute un jeu valable aux catalogues. `prefixe` évite tout mélange entre les deux jeux.
function charger(edition, jeu, prefixe) {
  const id = (x) => `${prefixe}${x}`;
  // format des images et position du rond de force imprimé (pour le rond de la force modifiée)
  const apparence = {};
  if (Array.isArray(jeu.format) && jeu.format.length === 2) apparence.format = jeu.format;
  if (jeu.rondForce) apparence.rond = jeu.rondForce;
  jeu.cartes.forEach((c) => {
    // une image par exemplaire possible : <id>.jpg, <id>_2.jpg, <id>_3.jpg…
    const images = Array.from({ length: c.images || 1 }, (_, k) => `${edition}/cartes/${c.id}${k ? `_${k + 1}` : ''}.jpg`);
    const base = { nom: c.nom, edition, image: images[0], images, ...apparence };
    if (c.faction !== 'neutre') base.clan = id(c.faction);
    if (c.type === 'unite') {
      Object.assign(base, { type: 'unite', force: c.force, rangees: c.rangee === 'cac+dist' ? ['cac', 'dist'] : [c.rangee], legende: !!c.legende });
      if (c.rangee === 'cac+dist') base.capacite = 'agile';
      if (c.capacite) base.capacite = c.capacite;
      if (c.groupe) base.groupe = id(c.groupe);
    } else if (c.type === 'meteo') {
      Object.assign(base, { type: 'meteo', meteo: c.meteo, kanji: c.symbole || SPECIAUX.meteo.symbole[zones(c.meteo)[0]],
        texte: c.texte || `Toutes les unités ${zones(c.meteo).map((r) => NOMS_METEO[r]).join(' et ')} (des deux camps) tombent à 1 de force.` });
    } else {
      Object.assign(base, { type: c.type, kanji: c.symbole || SPECIAUX[c.type].symbole, texte: c.texte || SPECIAUX[c.type].texte });
      if (c.meteo) base.meteo = c.meteo;
      if (c.rangee) base.rangee = c.rangee;
    }
    CARTES[id(c.id)] = base;
  });
  Object.entries(jeu.factions).forEach(([cle, f]) => {
    const clan = id(cle);
    CLANS[clan] = {
      nom: f.nom, kanji: f.symbole || f.nom.charAt(0), couleur: f.couleur || '#3A3A3A', edition,
      // logo du clan : <jeu>/logos/<clé du clan>.jpg (sinon, le symbole est affiché)
      logo: f.logo ? `${edition}/logos/${f.logo}` : `${edition}/logos/${cle}.jpg`,
      effetAtout: f.atout,
      atout: `${f.atoutNom ? `${f.atoutNom} : ` : ''}${f.atoutNom ? EFFETS_ATOUT[f.atout] : majuscule(EFFETS_ATOUT[f.atout])}`,
      // chefs au choix (image : <jeu>/cartes/<id>.jpg)
      chefs: chefsDe(cle, f).map((c) => {
        const effet = ALIAS_CHEF[c.effet] || c.effet;
        return { id: id(c.id), nom: c.nom, effet, texte: majuscule(EFFETS_CHEF[effet]), image: `${edition}/cartes/${c.id}.jpg`, ...apparence };
      }),
    };
    COLLECTIONS[clan] = jeu.cartes.filter((c) => (c.faction === cle || c.faction === 'neutre') && c.collection !== false).map((c) => [id(c.id), Number(c.exemplaires || 1)]);
    const fourni = jeu.decksParDefaut && jeu.decksParDefaut[cle];
    DECKS_DEFAUT[clan] = fourni ? fourni.map(([c, n]) => [id(c), n]) : deckAutomatique(COLLECTIONS[clan]);
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

// Lecture d'un fichier jeu.js : une faute de frappe ne doit pas empêcher de jouer à l'autre jeu
async function lire(chemin) {
  try {
    const { JEU } = await import(chemin);
    return { jeu: JEU, erreurs: verifierJeu(JEU) };
  } catch (err) {
    return { jeu: null, erreurs: [`Le fichier ${chemin.replace('./', 'kassen/')} contient une faute d'écriture (souvent une virgule, une accolade ou un guillemet oublié) : ${err.message}`] };
  }
}

const kassen = await lire('./kassen/jeu.js');
const gwynt = await lire('./gwynt/jeu.js');
if (!kassen.erreurs.length) charger('kassen', kassen.jeu, '');
if (!gwynt.erreurs.length) charger('gwynt', gwynt.jeu, 'g_');

// Les deux jeux, et s'ils sont prêts à être joués
export const EDITIONS = {
  gwynt: { nom: (gwynt.jeu && gwynt.jeu.nom) || 'Gwynt', pret: !gwynt.erreurs.length, erreurs: gwynt.erreurs },
  kassen: { nom: (kassen.jeu && kassen.jeu.nom) || 'Kassen', pret: !kassen.erreurs.length, erreurs: kassen.erreurs },
};
