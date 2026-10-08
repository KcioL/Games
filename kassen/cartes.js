// Règles communes du Gwynt et de Kassen : rangées, capacités, effets des clans, construction des decks.
// Les cartes et les clans des deux jeux sont dans kassen/kassen/jeu.js et kassen/gwynt/jeu.js ;
// editions.js les charge dans les catalogues ci-dessous.

export const RANGEES = ['cac', 'dist', 'siege'];
export const NOMS_RANGEES = { cac: 'Corps à corps', dist: 'Distance', siege: 'Siège' };
export const KANJI_RANGEES = { cac: '刀', dist: '弓', siege: '砲' };

export const CAPACITES = {
  legende: { kanji: '雄', nom: 'Légende', texte: 'Insensible aux météos, au taiko, aux porte-étendards et à la Colère de Raijin.' },
  espion: { kanji: '密', nom: 'Espion', texte: 'Se pose dans le camp adverse (sa force compte pour l\'adversaire) et te fait piocher 2 cartes.' },
  medecin: { kanji: '医', nom: 'Médecin', texte: 'Ramène en jeu l\'unité la plus forte de ta défausse (hors légendes et espions).' },
  lien: { kanji: '絆', nom: 'Lien', texte: 'Force multipliée par le nombre de cartes identiques dans la même rangée.' },
  moral: { kanji: '旗', nom: 'Porte-étendard', texte: '+1 de force à toutes les autres unités de sa rangée.' },
  rassemblement: { kanji: '群', nom: 'Rassemblement', texte: 'Quand tu la joues, toutes ses copies restées dans ta pioche arrivent aussi.' },
  agile: { kanji: '浪', nom: 'Rōnin', texte: 'Se joue au corps à corps ou à distance, au choix.' },
  cor: { kanji: '鼓', nom: 'Cor', texte: 'Double la force des autres unités de sa rangée (hors légendes).' },
  brasier_rangee: { kanji: '焔', nom: 'Brûlure', texte: 'Quand elle arrive : détruit l\'unité la plus forte de la même rangée adverse, si cette rangée vaut 10 ou plus.' },
};

export const EFFETS_ATOUT = {
  'pioche-victoire': 'pioche 1 carte à chaque manche gagnée.',
  egalites: 'remporte les manches à égalité.',
  hantise: 'à la fin de chaque manche, une de ses unités (au hasard) reste sur le plateau.',
  patience: 'l\'adversaire commence toujours la première manche.',
};
export const EFFETS_CHEF = {
  'cor-cac': 'double la force de sa rangée de corps à corps.',
  'cor-dist': 'double la force de sa rangée à distance.',
  'cor-siege': 'double la force de sa rangée de siège.',
  'bruler-cac': 'détruit l\'unité la plus forte de la rangée de corps à corps adverse, si cette rangée vaut 10 ou plus.',
  'bruler-dist': 'détruit l\'unité la plus forte de la rangée à distance adverse, si cette rangée vaut 10 ou plus.',
  'bruler-siege': 'détruit l\'unité la plus forte de la rangée de siège adverse, si cette rangée vaut 10 ou plus.',
  'meteo-cac': 'joue depuis sa pioche une météo qui touche le corps à corps.',
  'meteo-dist': 'joue depuis sa pioche une météo qui touche la distance.',
  'meteo-siege': 'joue depuis sa pioche une météo qui touche le siège.',
  eclaircie: 'dissipe toutes les météos.',
  resurrection: 'ramène en jeu l\'unité la plus forte de sa défausse (hors légendes et espions).',
  pioche: 'pioche une carte.',
  meteo: 'choisit une carte météo dans sa pioche et la joue.',
  espionner: 'regarde 3 cartes au hasard dans la main de l\'adversaire.',
  'voler-defausse': 'choisit une carte dans la défausse adverse et la prend dans sa main.',
  recuperer: 'choisit une carte de sa défausse et la reprend dans sa main.',
  echanger: 'défausse ses 2 cartes les plus faibles, puis choisit une carte de sa pioche et la prend dans sa main.',
  agiles: 'déplace ses unités agiles (deux rangées possibles) vers la rangée où elles comptent le plus.',
  'melanger-defausses': 'remélange la défausse de chaque joueur dans sa pioche.',
  'annuler-chef': '(passif) le chef de l\'adversaire est sans effet.',
  'garder-unite': '(passif) à la fin de chaque manche, chaque joueur garde une unité au hasard sur le plateau.',
  'pioche-depart': '(passif) commence la partie avec une carte de plus.',
  'espions-doubles': '(passif) la force des espions est doublée, pour les deux joueurs.',
  'meteo-moitie': '(passif) par mauvais temps, ses unités ne perdent que la moitié de leur force.',
};
// effets permanents : le chef n'a pas de bouton à utiliser
export const CHEFS_PASSIFS = ['annuler-chef', 'garder-unite', 'pioche-depart', 'espions-doubles', 'meteo-moitie'];
// effets où le joueur choisit une carte (le bot prend la meilleure)
export const CHEFS_A_CHOIX = ['meteo', 'voler-defausse', 'recuperer', 'echanger'];
// anciens noms d'effets, toujours acceptés
export const ALIAS_CHEF = { cri: 'cor-cac', assassinat: 'bruler-dist' };

// Catalogues remplis par editions.js (identifiants des cartes et des clans)
export const CARTES = {};
export const CLANS = {};
export const COLLECTIONS = {};   // clan → [[carte, exemplaires disponibles], …]
export const DECKS_DEFAUT = {};  // clan → [[carte, exemplaires], …]

// Règles de construction (comme dans The Witcher 3)
export const DECK_MIN_UNITES = 22;
export const DECK_MAX_SPECIALES = 10;
export const DECK_MAX_CARTES = 40;

// Liste « à plat » d'un deck : ['samourai', 'samourai', ...]
export const aPlat = (deck) => deck.flatMap(([c, n]) => Array(n).fill(c));

// Vérifie un deck (liste à plat) pour un clan ; renvoie '' s'il est valable, sinon la raison
export function erreurDeck(clan, liste) {
  if (!COLLECTIONS[clan] || !Array.isArray(liste)) return 'Deck inconnu.';
  const dispo = Object.fromEntries(COLLECTIONS[clan]);
  const compte = {};
  for (const c of liste) {
    if (!CARTES[c]) return 'Carte inconnue.';
    compte[c] = (compte[c] || 0) + 1;
    if (compte[c] > (dispo[c] || 0)) return `Trop d'exemplaires de « ${CARTES[c].nom} ».`;
  }
  const unites = liste.filter((c) => CARTES[c].type === 'unite').length;
  const speciales = liste.length - unites;
  if (unites < DECK_MIN_UNITES) return `Il faut au moins ${DECK_MIN_UNITES} unités (tu en as ${unites}).`;
  if (speciales > DECK_MAX_SPECIALES) return `${DECK_MAX_SPECIALES} cartes spéciales au maximum (tu en as ${speciales}).`;
  if (liste.length > DECK_MAX_CARTES) return `${DECK_MAX_CARTES} cartes au maximum.`;
  return '';
}
