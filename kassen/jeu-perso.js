// =====================================================================
//  GWYNT : TON JEU PERSONNALISÉ
// =====================================================================
//  Ce fichier te permet de jouer avec tes propres cartes : tu choisis
//  leurs noms, leurs forces, leurs capacités et leurs illustrations.
//
//  1. Remplis les factions et les cartes ci-dessous (en t'aidant des
//     exemples en commentaire, les lignes qui commencent par //).
//  2. Mets tes images dans le dossier kassen/illustrations-perso/
//     (cartes complètes, format portrait 3 × 4, par exemple 765 × 1024 pixels, en JPG).
//  3. Passe « actif » à true.
//
//  Au moment de créer une partie, tu pourras alors choisir entre
//  l'« Édition Japon » et ce jeu. S'il manque quelque chose, l'écran
//  d'accueil du Gwynt t'indique précisément quoi corriger.
//
//  Règle de construction des decks : au moins 22 unités (cartes de la
//  faction + cartes neutres) et au plus 10 cartes spéciales.
// =====================================================================

export const JEU_PERSO = {
  // Passe à true quand le jeu est prêt
  actif: false,

  // Nom affiché dans le choix de l'édition
  nom: 'Mon Gwynt',

  // Dossier des illustrations (à l'intérieur du dossier kassen/)
  dossierImages: 'illustrations-perso/',

  // ---------------------------------------------------------------
  //  FACTIONS
  // ---------------------------------------------------------------
  //  Une entrée par faction. La clé (faction1, faction2…) sert à
  //  rattacher les cartes à leur faction.
  //
  //  nom      : nom de la faction
  //  couleur  : couleur des cartes (code couleur, ex. '#2B4A7A')
  //  symbole  : 1 ou 2 caractères affichés dans l'emblème (ex. 'N')
  //  atout    : effet permanent, au choix :
  //               'pioche-victoire' : pioche 1 carte à chaque manche gagnée
  //               'egalites'        : remporte les manches à égalité
  //               'hantise'         : une unité au hasard reste sur le plateau après chaque manche
  //               'patience'        : l'adversaire commence toujours la première manche
  //  chef     : effet du chef (une fois par partie), au choix :
  //               'cri'          : double la rangée de corps à corps
  //               'assassinat'   : détruit l'unité la plus forte de la rangée à distance adverse (si elle vaut 10 ou plus)
  //               'resurrection' : ramène en jeu l'unité la plus forte de la défausse
  //               'eclaircie'    : dissipe toutes les météos
  //  chefNom  : nom du chef (affiché sur le bouton)
  //  chefImage: (facultatif) image du chef, dans le dossier des illustrations
  factions: {
    faction1: { nom: 'Faction 1', couleur: '#2B4A7A', symbole: '1', atout: 'pioche-victoire', chef: 'cri', chefNom: 'Chef de la faction 1' },
    faction2: { nom: 'Faction 2', couleur: '#7A5A1E', symbole: '2', atout: 'egalites', chef: 'assassinat', chefNom: 'Chef de la faction 2' },
    faction3: { nom: 'Faction 3', couleur: '#5A2A2A', symbole: '3', atout: 'hantise', chef: 'resurrection', chefNom: 'Chef de la faction 3' },
    faction4: { nom: 'Faction 4', couleur: '#2E5A3A', symbole: '4', atout: 'patience', chef: 'eclaircie', chefNom: 'Chef de la faction 4' },
  },

  // ---------------------------------------------------------------
  //  CARTES
  // ---------------------------------------------------------------
  //  Une ligne par carte (pas par exemplaire : utilise « exemplaires »).
  //
  //  id          : identifiant unique, en minuscules sans accents ni espaces (ex. 'chevalier_bleu')
  //  nom         : nom affiché sur la carte
  //  faction     : clé de la faction (ex. 'faction1'), ou 'neutre' pour une carte utilisable par toutes
  //  type        : 'unite', ou une carte spéciale :
  //                  'meteo'     : une météo (préciser « meteo » : la rangée touchée)
  //                  'eclaircie' : dissipe toutes les météos
  //                  'cor'       : double une de tes rangées
  //                  'leurre'    : reprend une de tes unités en main
  //                  'brasier'   : détruit les unités les plus fortes du plateau
  //  force       : force de l'unité (nombre)
  //  rangee      : 'cac' (corps à corps), 'dist' (distance), 'siege', ou 'cac+dist' (au choix)
  //  meteo       : pour une météo seulement : 'cac', 'dist' ou 'siege'
  //  legende     : true pour une légende (insensible aux effets), sinon false
  //  capacite    : '' (aucune), ou :
  //                  'espion'         : se pose chez l'adversaire et fait piocher 2 cartes
  //                  'medecin'        : ramène l'unité la plus forte de la défausse
  //                  'lien'           : force multipliée par le nombre de cartes du même « groupe » dans la rangée
  //                  'moral'          : +1 à toutes les autres unités de la rangée
  //                  'rassemblement'  : les cartes du même « groupe » restées dans la pioche arrivent aussi
  //                  'cor'            : double les autres unités de sa rangée
  //                  'brasier_rangee' : détruit l'unité la plus forte de la même rangée adverse (si elle vaut 10 ou plus)
  //  groupe      : pour 'lien' et 'rassemblement' : nom commun aux cartes liées (ex. 'freres')
  //  exemplaires : nombre d'exemplaires disponibles dans la collection (1 à 9)
  //  image       : nom du fichier image (ex. 'chevalier_bleu.jpg') ; facultatif
  cartes: [
    // Exemples (enlève les // au début d'une ligne pour l'activer) :
    //
    // { id: 'roi', nom: 'Le Roi', faction: 'faction1', type: 'unite', force: 10, rangee: 'cac', legende: true, capacite: '', exemplaires: 1, image: 'roi.jpg' },
    // { id: 'archer', nom: 'Archer', faction: 'faction1', type: 'unite', force: 4, rangee: 'dist', legende: false, capacite: '', exemplaires: 2, image: 'archer.jpg' },
    // { id: 'freres', nom: 'Frères d\'armes', faction: 'faction1', type: 'unite', force: 4, rangee: 'cac', legende: false, capacite: 'lien', groupe: 'freres', exemplaires: 3, image: 'freres.jpg' },
    // { id: 'eclaireur', nom: 'Éclaireur', faction: 'faction1', type: 'unite', force: 5, rangee: 'cac+dist', legende: false, capacite: '', exemplaires: 1, image: 'eclaireur.jpg' },
    // { id: 'barde', nom: 'Le Barde', faction: 'neutre', type: 'unite', force: 2, rangee: 'cac', legende: false, capacite: 'cor', exemplaires: 1, image: 'barde.jpg' },
    // { id: 'gel', nom: 'Gel mordant', faction: 'neutre', type: 'meteo', meteo: 'cac', exemplaires: 3, image: 'gel.jpg' },
    // { id: 'soleil', nom: 'Temps clair', faction: 'neutre', type: 'eclaircie', exemplaires: 3, image: 'soleil.jpg' },
    // { id: 'cor_guerre', nom: 'Cor de guerre', faction: 'neutre', type: 'cor', exemplaires: 3, image: 'cor_guerre.jpg' },
    // { id: 'leurre', nom: 'Leurre', faction: 'neutre', type: 'leurre', exemplaires: 3, image: 'leurre.jpg' },
    // { id: 'brasier', nom: 'Brasier', faction: 'neutre', type: 'brasier', exemplaires: 3, image: 'brasier.jpg' },
  ],

  // ---------------------------------------------------------------
  //  DECKS PAR DÉFAUT (facultatif)
  // ---------------------------------------------------------------
  //  Deck utilisé par les bots et proposé au départ dans l'atelier.
  //  Si tu ne mets rien, le jeu en compose un automatiquement
  //  (les unités les plus fortes de la faction, plus quelques spéciales).
  //  Format : faction1: [['roi', 1], ['archer', 2], …]
  decksParDefaut: {},
};
