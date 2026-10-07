// Cartes du Gwynt, édition Japon : bataille de cartes dans le Japon féodal.
// Règles du Gwynt ; toutes les cartes, clans et textes de cette édition sont originaux.

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

// ---------- Catalogue ----------
const U = (nom, force, rangees, opts = {}) => ({ type: 'unite', nom, force, rangees, ...opts });

export const CARTES = {
  // Cartes spéciales (dans tous les paquets)
  neige: { type: 'meteo', nom: 'Neige', kanji: '雪', meteo: 'cac', texte: 'Toutes les unités au corps à corps (des deux camps) tombent à 1 de force.' },
  brume: { type: 'meteo', nom: 'Brume', kanji: '霧', meteo: 'dist', texte: 'Toutes les unités à distance (des deux camps) tombent à 1 de force.' },
  typhon: { type: 'meteo', nom: 'Typhon', kanji: '嵐', meteo: 'siege', texte: 'Toutes les unités de siège (des deux camps) tombent à 1 de force.' },
  soleil: { type: 'eclaircie', nom: 'Éclaircie', kanji: '晴', texte: 'Dissipe toutes les météos.' },
  taiko: { type: 'cor', nom: 'Taiko de guerre', kanji: '鼓', texte: 'Double la force des unités d\'une de tes rangées (hors légendes).' },
  kagemusha: { type: 'leurre', nom: 'Kagemusha', kanji: '影', texte: 'Ce sosie prend la place d\'une de tes unités (hors légendes), qui revient dans ta main.' },
  raijin: { type: 'brasier', nom: 'Colère de Raijin', kanji: '雷', texte: 'Détruit la ou les unités les plus fortes du plateau, dans les deux camps (hors légendes).' },

  // Neutres (utilisables par tous les clans)
  sabre_invaincu: U('Le Sabre invaincu', 15, ['cac'], { legende: true }),
  grue_blanche: U('La Grue blanche', 7, ['dist'], { legende: true, capacite: 'medecin' }),
  kirin: U('Kirin', 8, ['siege'], { legende: true }),
  marchand: U('Marchand ambulant', 4, ['siege'], { capacite: 'espion' }),
  moine_errant: U('Moine errant', 5, ['dist'], { capacite: 'medecin' }),
  ronin_errant: U('Rōnin errant', 6, ['cac', 'dist'], { capacite: 'agile' }),
  maneki_neko: U('Maneki-neko', 2, ['cac'], { capacite: 'moral' }),
  conteuse: U('Conteuse de légendes', 4, ['dist']),

  // Clan du Dragon (samouraïs)
  shogun: U('Shōgun du Dragon', 10, ['cac'], { legende: true, clan: 'dragon' }),
  archere: U('Archère légendaire', 10, ['dist'], { legende: true, clan: 'dragon' }),
  samourai: U('Samouraï du Dragon', 4, ['cac'], { capacite: 'lien', groupe: 'samourai', clan: 'dragon' }),
  cavalier: U('Cavalier lancier', 6, ['cac'], { clan: 'dragon' }),
  hatamoto: U('Porte-étendard', 3, ['cac'], { capacite: 'moral', clan: 'dragon' }),
  ashigaru: U('Ashigaru', 2, ['cac'], { capacite: 'rassemblement', groupe: 'ashigaru', clan: 'dragon' }),
  yumi: U('Archer yumi', 4, ['dist'], { clan: 'dragon' }),
  teppo: U('Arquebusier', 5, ['dist'], { clan: 'dragon' }),
  infiltre: U('Shinobi infiltré', 4, ['dist'], { capacite: 'espion', clan: 'dragon' }),
  bombarde: U('Bombarde', 6, ['siege'], { clan: 'dragon' }),
  catapulte: U('Catapulte', 8, ['siege'], { capacite: 'lien', groupe: 'catapulte', clan: 'dragon' }),
  moine: U('Moine guérisseur', 3, ['siege'], { capacite: 'medecin', clan: 'dragon' }),
  ronin: U('Rōnin', 6, ['cac', 'dist'], { capacite: 'agile', clan: 'dragon' }),
  daimyo: U('Daimyō du Dragon', 8, ['siege'], { legende: true, clan: 'dragon' }),
  garde_chateau: U('Garde du château', 5, ['cac'], { clan: 'dragon' }),
  tour_siege: U('Tour de siège', 7, ['siege'], { clan: 'dragon' }),
  ingenieur: U('Ingénieur de siège', 4, ['siege'], { clan: 'dragon' }),
  archer_monte: U('Archer monté', 5, ['dist'], { clan: 'dragon' }),

  // Shinobi (ninjas)
  maitre_ombres: U('Maître des ombres', 10, ['cac'], { legende: true, clan: 'shinobi' }),
  kunoichi_ecarlate: U('Kunoichi écarlate', 8, ['dist'], { legende: true, clan: 'shinobi' }),
  ninja_ombre: U('Ninja de l\'ombre', 3, ['cac'], { capacite: 'rassemblement', groupe: 'ombre', clan: 'shinobi' }),
  espion_cour: U('Espion à la cour', 1, ['cac'], { capacite: 'espion', clan: 'shinobi' }),
  informatrice: U('Informatrice', 2, ['dist'], { capacite: 'espion', clan: 'shinobi' }),
  kunoichi: U('Kunoichi', 5, ['cac', 'dist'], { capacite: 'agile', clan: 'shinobi' }),
  shuriken: U('Lanceur de shuriken', 4, ['dist'], { clan: 'shinobi' }),
  herboriste: U('Herboriste', 3, ['dist'], { capacite: 'medecin', clan: 'shinobi' }),
  pieges: U('Poseur de pièges', 5, ['siege'], { clan: 'shinobi' }),
  fusees: U('Fusées incendiaires', 6, ['siege'], { clan: 'shinobi' }),
  freres_lame: U('Frères de lame', 4, ['cac'], { capacite: 'lien', groupe: 'lame', clan: 'shinobi' }),
  grimpeur: U('Ninja grimpeur', 5, ['dist'], { clan: 'shinobi' }),
  poisons: U('Maître des poisons', 4, ['siege'], { capacite: 'medecin', clan: 'shinobi' }),
  kusarigama: U('Porteur de kusarigama', 6, ['cac'], { clan: 'shinobi' }),
  guetteuse: U('Guetteuse', 2, ['dist'], { capacite: 'espion', clan: 'shinobi' }),
  cerf_volant: U('Cerf-volant d\'attaque', 7, ['siege'], { clan: 'shinobi' }),
  recrues: U('Jeunes recrues', 3, ['cac'], { clan: 'shinobi' }),

  // Yōkai (créatures du folklore)
  kitsune: U('Kitsune à neuf queues', 10, ['dist'], { legende: true, clan: 'yokai' }),
  gashadokuro: U('Gashadokuro', 10, ['siege'], { legende: true, clan: 'yokai' }),
  oni: U('Oni rouge', 7, ['cac'], { clan: 'yokai' }),
  kappa: U('Kappa', 2, ['cac'], { capacite: 'rassemblement', groupe: 'kappa', clan: 'yokai' }),
  tengu: U('Tengu', 5, ['cac', 'dist'], { capacite: 'agile', clan: 'yokai' }),
  yukionna: U('Yuki-onna', 6, ['dist'], { clan: 'yokai' }),
  jorogumo: U('Jorōgumo', 6, ['cac'], { clan: 'yokai' }),
  kodama: U('Kodama', 2, ['siege'], { capacite: 'rassemblement', groupe: 'kodama', clan: 'yokai' }),
  nue: U('Nue', 7, ['siege'], { clan: 'yokai' }),
  rokurokubi: U('Rokurokubi', 4, ['dist'], { clan: 'yokai' }),
  freres_oni: U('Frères oni', 5, ['cac'], { capacite: 'lien', groupe: 'onis', clan: 'yokai' }),
  bakeneko: U('Bakeneko', 4, ['dist'], { clan: 'yokai' }),
  nurikabe: U('Nurikabe', 7, ['siege'], { clan: 'yokai' }),
  tsuchigumo: U('Tsuchigumo', 6, ['cac'], { clan: 'yokai' }),
  kamaitachi: U('Kamaitachi', 5, ['cac', 'dist'], { capacite: 'agile', clan: 'yokai' }),
  ittan_momen: U('Ittan-momen', 4, ['dist'], { clan: 'yokai' }),
  umibozu: U('Umibōzu', 9, ['cac'], { legende: true, clan: 'yokai' }),

  // Sōhei (moines-guerriers)
  abbe: U('Grand abbé', 11, ['siege'], { legende: true, clan: 'sohei' }),
  colosse: U('Moine colossal', 10, ['cac'], { legende: true, clan: 'sohei' }),
  naginata: U('Sōhei à naginata', 6, ['cac'], { capacite: 'lien', groupe: 'naginata', clan: 'sohei' }),
  tambour: U('Joueur de tambour', 3, ['cac'], { capacite: 'moral', clan: 'sohei' }),
  archer_temple: U('Archer du temple', 5, ['dist'], { clan: 'sohei' }),
  pretre: U('Prêtre guérisseur', 3, ['siege'], { capacite: 'medecin', clan: 'sohei' }),
  novices: U('Novices', 4, ['cac'], { capacite: 'rassemblement', groupe: 'novices', clan: 'sohei' }),
  arbalete: U('Arbalète géante', 7, ['siege'], { clan: 'sohei' }),
  pelerin: U('Pèlerin espion', 3, ['dist'], { capacite: 'espion', clan: 'sohei' }),
  yamabushi: U('Yamabushi', 7, ['cac', 'dist'], { capacite: 'agile', clan: 'sohei' }),
  lanternes: U('Moine aux lanternes', 4, ['dist'], { capacite: 'moral', clan: 'sohei' }),
  gardien_portail: U('Gardien du portail', 6, ['cac'], { clan: 'sohei' }),
  archer_cheval: U('Moine archer à cheval', 5, ['dist'], { clan: 'sohei' }),
  bonze: U('Bonze guérisseur', 3, ['dist'], { capacite: 'medecin', clan: 'sohei' }),
  cloche: U('Gardien de la cloche', 4, ['siege'], { clan: 'sohei' }),
};

// ---------- Clans : atout permanent et chef (une fois par partie) ----------
export const CLANS = {
  dragon: {
    nom: 'Clan du Dragon', kanji: '龍', couleur: '#B5301D', edition: 'japon', effetAtout: 'pioche-victoire', effetChef: 'cri',
    atout: 'Victoire honorable : pioche 1 carte à chaque manche gagnée.',
    chef: 'Cri de guerre', chefTexte: 'Double la force de ta rangée de corps à corps (comme un taiko).',
  },
  shinobi: {
    nom: 'Shinobi', kanji: '忍', couleur: '#3B3F58', edition: 'japon', effetAtout: 'egalites', effetChef: 'assassinat',
    atout: 'Insaisissables : remportent les manches à égalité.',
    chef: 'Assassinat', chefTexte: 'Détruit l\'unité la plus forte de la rangée à distance adverse, si cette rangée vaut 10 ou plus.',
  },
  yokai: {
    nom: 'Yōkai', kanji: '妖', couleur: '#5B3A7A', edition: 'japon', effetAtout: 'hantise', effetChef: 'resurrection',
    atout: 'Hantise : à la fin de chaque manche, une de tes unités (au hasard) reste sur le plateau.',
    chef: 'Résurrection', chefTexte: 'Ramène en jeu l\'unité la plus forte de ta défausse (hors légendes et espions).',
  },
  sohei: {
    nom: 'Sōhei', kanji: '僧', couleur: '#B07A1E', edition: 'japon', effetAtout: 'patience', effetChef: 'eclaircie',
    atout: 'Patience : l\'adversaire commence toujours la première manche (et dévoile son jeu le premier).',
    chef: 'Prière du soleil', chefTexte: 'Dissipe toutes les météos.',
  },
};

// Effets disponibles pour l'atout et le chef d'un clan ou d'une faction
export const EFFETS_ATOUT = {
  'pioche-victoire': 'pioche 1 carte à chaque manche gagnée.',
  egalites: 'remporte les manches à égalité.',
  hantise: 'à la fin de chaque manche, une de ses unités (au hasard) reste sur le plateau.',
  patience: 'l\'adversaire commence toujours la première manche.',
};
export const EFFETS_CHEF = {
  cri: 'double la force de sa rangée de corps à corps.',
  assassinat: 'détruit l\'unité la plus forte de la rangée à distance adverse, si cette rangée vaut 10 ou plus.',
  resurrection: 'ramène en jeu l\'unité la plus forte de sa défausse (hors légendes et espions).',
  eclaircie: 'dissipe toutes les météos.',
};

// Cartes spéciales de l'édition Japon (3 exemplaires de chacune dans la collection)
export const SPECIALES = ['neige', 'brume', 'typhon', 'soleil', 'taiko', 'kagemusha', 'raijin'];
const SPECIALES_COLLECTION = SPECIALES.map((c) => [c, 3]);
export const NEUTRES = ['sabre_invaincu', 'grue_blanche', 'kirin', 'marchand', 'moine_errant', 'ronin_errant', 'maneki_neko', 'conteuse'];

// Collection de chaque clan : [carte, exemplaires disponibles]
export const COLLECTIONS = {
  dragon: [['shogun', 1], ['archere', 1], ['daimyo', 1], ['samourai', 3], ['cavalier', 1], ['hatamoto', 1], ['ashigaru', 3],
    ['yumi', 2], ['teppo', 2], ['infiltre', 1], ['bombarde', 1], ['catapulte', 2], ['moine', 1], ['ronin', 1],
    ['garde_chateau', 2], ['tour_siege', 1], ['ingenieur', 1], ['archer_monte', 1]],
  shinobi: [['maitre_ombres', 1], ['kunoichi_ecarlate', 1], ['ninja_ombre', 3], ['espion_cour', 2], ['informatrice', 1],
    ['kunoichi', 2], ['shuriken', 2], ['herboriste', 1], ['pieges', 2], ['fusees', 1], ['freres_lame', 2],
    ['grimpeur', 2], ['poisons', 1], ['kusarigama', 1], ['guetteuse', 1], ['cerf_volant', 1], ['recrues', 2]],
  yokai: [['kitsune', 1], ['gashadokuro', 1], ['umibozu', 1], ['oni', 1], ['kappa', 3], ['tengu', 2], ['yukionna', 1],
    ['jorogumo', 1], ['kodama', 3], ['nue', 1], ['rokurokubi', 2], ['freres_oni', 2], ['bakeneko', 2], ['nurikabe', 1],
    ['tsuchigumo', 1], ['kamaitachi', 1], ['ittan_momen', 1]],
  sohei: [['abbe', 1], ['colosse', 1], ['naginata', 3], ['tambour', 1], ['archer_temple', 3], ['pretre', 2], ['novices', 3],
    ['arbalete', 1], ['pelerin', 2], ['yamabushi', 1], ['lanternes', 1], ['gardien_portail', 2], ['archer_cheval', 1],
    ['bonze', 1], ['cloche', 1]],
};
// Les neutres et les spéciales s'ajoutent à chaque collection
Object.keys(COLLECTIONS).forEach((clan) => {
  COLLECTIONS[clan] = [...COLLECTIONS[clan], ...NEUTRES.map((c) => [c, 1]), ...SPECIALES_COLLECTION];
});

// Règles de construction (comme dans The Witcher 3)
export const DECK_MIN_UNITES = 22;
export const DECK_MAX_SPECIALES = 10;
export const DECK_MAX_CARTES = 40;

// Decks par défaut : ceux qu'utilisent les bots, et le point de départ de l'atelier
export const DECKS_DEFAUT = {
  dragon: [['shogun', 1], ['archere', 1], ['samourai', 3], ['cavalier', 1], ['hatamoto', 1], ['ashigaru', 3], ['yumi', 2],
    ['teppo', 2], ['infiltre', 1], ['bombarde', 1], ['catapulte', 2], ['moine', 1], ['ronin', 1], ['garde_chateau', 2],
    ['neige', 1], ['brume', 1], ['typhon', 1], ['soleil', 1], ['taiko', 2], ['kagemusha', 1], ['raijin', 1]],
  shinobi: [['maitre_ombres', 1], ['kunoichi_ecarlate', 1], ['ninja_ombre', 3], ['espion_cour', 2], ['informatrice', 1],
    ['kunoichi', 2], ['shuriken', 2], ['herboriste', 1], ['pieges', 2], ['fusees', 1], ['freres_lame', 2], ['grimpeur', 2],
    ['kusarigama', 1], ['cerf_volant', 1],
    ['neige', 1], ['brume', 1], ['typhon', 1], ['soleil', 1], ['taiko', 2], ['kagemusha', 1], ['raijin', 1]],
  yokai: [['kitsune', 1], ['gashadokuro', 1], ['oni', 1], ['kappa', 3], ['tengu', 2], ['yukionna', 1], ['jorogumo', 1],
    ['kodama', 3], ['nue', 1], ['rokurokubi', 2], ['freres_oni', 2], ['bakeneko', 2], ['tsuchigumo', 1], ['nurikabe', 1],
    ['neige', 1], ['brume', 1], ['typhon', 1], ['soleil', 1], ['taiko', 2], ['kagemusha', 1], ['raijin', 1]],
  sohei: [['abbe', 1], ['colosse', 1], ['naginata', 3], ['tambour', 1], ['archer_temple', 3], ['pretre', 2], ['novices', 3],
    ['arbalete', 1], ['pelerin', 2], ['yamabushi', 1], ['lanternes', 1], ['gardien_portail', 2], ['archer_cheval', 1],
    ['neige', 1], ['brume', 1], ['typhon', 1], ['soleil', 1], ['taiko', 2], ['kagemusha', 1], ['raijin', 1]],
};
export const PAQUETS = DECKS_DEFAUT; // ancien nom, gardé pour compatibilité

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
