// =====================================================================
//  GWYNT : TES CARTES
// =====================================================================
//  Remplis ce fichier avec tes factions et tes cartes, puis mets les
//  images dans kassen/gwynt/cartes/ : une image par carte, nommée
//  <id>.jpg (par exemple 'archer' → kassen/gwynt/cartes/archer.jpg),
//  au format portrait 3 × 4 (par exemple 765 × 1024 pixels).
//
//  Ce fichier a exactement le même format que kassen/kassen/jeu.js
//  (le jeu Kassen, déjà rempli) : regarde-le pour un exemple complet.
//
//  Tant que le jeu n'est pas complet, le côté « Gwynt » de l'interrupteur
//  reste grisé ; le toucher indique précisément ce qui manque.
//
//  Règle des decks : au moins 22 unités (cartes de la faction + cartes
//  neutres) et au plus 10 cartes spéciales.
// =====================================================================

export const JEU = {
  nom: 'Gwynt',

  // ---------------------------------------------------------------
  //  FACTIONS
  // ---------------------------------------------------------------
  //  La clé (faction1, faction2…) sert à rattacher les cartes à leur faction.
  //  Tu peux la renommer (minuscules, sans accents ni espaces), et en ajouter ou en retirer.
  //
  //  nom       : nom de la faction
  //  couleur   : couleur des cartes sans image (code couleur, ex. '#2B4A7A')
  //  symbole   : 1 ou 2 caractères affichés dans l'emblème
  //  atout     : effet permanent, au choix :
  //                'pioche-victoire' : pioche 1 carte à chaque manche gagnée
  //                'egalites'        : remporte les manches à égalité
  //                'hantise'         : une unité au hasard reste sur le plateau après chaque manche
  //                'patience'        : l'adversaire commence toujours la première manche
  //  atoutNom  : (facultatif) nom de l'atout, affiché avant sa description
  //  chefs     : la liste des chefs de la faction ; le joueur choisit le sien dans l'atelier de deck.
  //              Chaque chef : { id, nom, effet }. L'id sert aussi de nom d'image : un chef
  //              d'id 'roi_bataille' a son image dans cartes/roi_bataille.jpg (format des cartes).
  //              Les id des chefs doivent être différents de ceux des cartes.
  //              effet, au choix. Une fois par partie, à la place de jouer une carte :
  //                'cor-cac'             : double la force de sa rangée de corps à corps
  //                'cor-dist'            : double la force de sa rangée à distance (sauf s'il y a déjà un cor)
  //                'cor-siege'           : double la force de sa rangée de siège
  //                'bruler-cac'          : détruit l'unité la plus forte du corps à corps adverse (si la rangée vaut 10 ou plus)
  //                'bruler-dist'         : idem, rangée à distance adverse
  //                'bruler-siege'        : idem, rangée de siège adverse
  //                'meteo-cac'           : joue depuis sa pioche une météo qui touche le corps à corps
  //                'meteo-dist'          : idem, météo qui touche la distance
  //                'meteo-siege'         : idem, météo qui touche le siège
  //                'meteo'               : choisit n'importe quelle carte météo de sa pioche et la joue
  //                'eclaircie'           : dissipe toutes les météos
  //                'resurrection'        : ramène en jeu l'unité la plus forte de sa défausse
  //                'recuperer'           : choisit une carte de sa défausse et la reprend en main
  //                'voler-defausse'      : choisit une carte de la défausse adverse et la prend en main
  //                'pioche'              : pioche une carte
  //                'echanger'            : défausse 2 cartes de sa main, puis choisit une carte de sa pioche
  //                'espionner'           : regarde 3 cartes au hasard de la main adverse
  //                'agiles'              : déplace ses unités agiles vers la rangée où elles comptent le plus
  //                'melanger-defausses'  : remélange les défausses des deux joueurs dans leurs pioches
  //              Effets passifs (agissent tout seuls pendant toute la partie) :
  //                'annuler-chef'        : le chef adverse n'a aucun effet
  //                'garder-unite'        : à chaque fin de manche, chaque joueur garde une unité au hasard
  //                'medecins-hasard'     : les capacités qui ramènent une unité de la défausse sur le plateau
  //                                        (médecin, résurrection) la choisissent au hasard (pour les deux joueurs)
  //                'pioche-depart'       : commence la partie avec une carte de plus
  //                'espions-doubles'     : la force des espions est doublée (pour les deux joueurs)
  //                'meteo-moitie'        : par mauvais temps, ses unités ne perdent que la moitié de leur force
  //
  //  Ci-dessous : 5 factions prêtes à remplir, avec 5 chefs chacune (2 pour la dernière).
  //  Remplace les noms, les couleurs et les effets ; ajoute ou retire des chefs librement.
  factions: {
    faction1: { nom: 'Royaumes du Nord', couleur: '#0361ED', symbole: 'RN', atout: 'pioche-victoire',
      chefs: [
        { id: 'chef1_a', nom: 'Foltest : Roi de Temeria', effet: 'meteo-dist' },
        { id: 'chef1_b', nom: 'Foltest : Protecteur du Nord', effet: 'eclaircie' },
        { id: 'chef1_c', nom: 'Foltest : Maître du siège', effet: 'cor-siege' },
        { id: 'chef1_d', nom: 'Foltest : Le Brave', effet: 'bruler-siege' },
        { id: 'chef1_e', nom: 'Foltest : Fils de Medell', effet: 'bruler-dist' },
      ] },
    faction2: { nom: 'Nilfgaard', couleur: '#3A3A3A', symbole: 'N', atout: 'egalites',
      chefs: [
        { id: 'chef2_a', nom: 'Emhyr var Emreis : Sa Majesté impériale', effet: 'meteo-siege' },
        { id: 'chef2_b', nom: 'Emhyr var Emreis : Empereur du Nilfgaard', effet: 'espionner' },
        { id: 'chef2_c', nom: 'Emhyr var Emreis : La Flamme Blanche', effet: 'annuler-chef' },
        { id: 'chef2_d', nom: "Emhyr var Emreis : L'Implacable", effet: 'voler-defausse' },
        { id: 'chef2_e', nom: 'Emhyr var Emreis : Envahisseur du Nord', effet: 'medecins-hasard' },
      ] },
    faction3: { nom: "scoia'tael", couleur: '#2A810A', symbole: 'S', atout: 'patience',
      chefs: [
        { id: 'chef3_a', nom: 'Francesca Findabair : Elfe de sang pur	Elfe de sang pur', effet: 'meteo-cac' },
        { id: 'chef3_b', nom: 'Francesca Findabair : La Pâquerette des vallées', effet: 'pioche-depart' },
        { id: 'chef3_c', nom: 'Francesca Findabair : La Belle', effet: 'cor-dist' },
        { id: 'chef3_d', nom: 'Francesca Findabair : Reine de Dol Blathanna', effet: 'bruler-cac' },
        { id: 'chef3_e', nom: "Francesca Findabair : L'espoir des Aen Seidhe", effet: 'agiles' },
      ] },
    faction4: { nom: 'Monstres', couleur: '#b70a0a', symbole: '4', atout: 'hantise',
      chefs: [
        { id: 'chef4_a', nom: 'Eredin : Commandant des Cavaliers pourpres', effet: 'cor-cac' },
        { id: 'chef4_b', nom: 'Eredin : Roi de la Chasse Sauvage', effet: 'meteo' },
        { id: 'chef4_c', nom: 'Eredin : Le Mortifère', effet: 'resurrection' },
        { id: 'chef4_d', nom: 'Eredin : Destructeur de mondes', effet: 'echanger' },
        { id: 'chef4_e', nom: 'Eredin Bréacc Glas : Le Fourbe', effet: 'espions-doubles' },
      ] },
    faction5: { nom: 'Faction 5', couleur: '#543461', symbole: '5', atout: 'pioche-victoire',
      chefs: [
        { id: 'chef5_a', nom: 'Crach an Craite', effet: 'melanger-defausses' },
        { id: 'chef5_b', nom: 'King Bran', effet: 'meteo-moitie' },
      ] },
  },

  // ---------------------------------------------------------------
  //  CARTES
  // ---------------------------------------------------------------
  //  Une ligne par carte (pas par exemplaire : utilise « exemplaires »).
  //
  //  id          : identifiant unique, en minuscules sans accents ni espaces ; c'est aussi
  //                le nom de l'image (id 'archer' → image cartes/archer.jpg)
  //  nom         : nom de la carte
  //  faction     : clé de la faction (ex. 'faction1'), ou 'neutre' pour une carte de toutes les factions
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
  //  symbole     : (facultatif, cartes spéciales) caractère affiché si la carte n'a pas d'image
  //  texte       : (facultatif, cartes spéciales) description de l'effet
  cartes: [
    // Exemples (enlève les // au début d'une ligne pour l'activer) :
    //
    // { id: 'roi', nom: 'Le Roi', faction: 'faction1', type: 'unite', force: 10, rangee: 'cac', legende: true, capacite: '', exemplaires: 1 },
    // { id: 'archer', nom: 'Archer', faction: 'faction1', type: 'unite', force: 4, rangee: 'dist', legende: false, capacite: '', exemplaires: 2 },
    // { id: 'freres', nom: 'Frères d\'armes', faction: 'faction1', type: 'unite', force: 4, rangee: 'cac', legende: false, capacite: 'lien', groupe: 'freres', exemplaires: 3 },
    // { id: 'eclaireur', nom: 'Éclaireur', faction: 'faction1', type: 'unite', force: 5, rangee: 'cac+dist', legende: false, capacite: '', exemplaires: 1 },
    // { id: 'barde', nom: 'Le Barde', faction: 'neutre', type: 'unite', force: 2, rangee: 'cac', legende: false, capacite: 'cor', exemplaires: 1 },
    // { id: 'gel', nom: 'Gel mordant', faction: 'neutre', type: 'meteo', meteo: 'cac', exemplaires: 3 },
    // { id: 'soleil', nom: 'Temps clair', faction: 'neutre', type: 'eclaircie', exemplaires: 3 },
    // { id: 'cor_guerre', nom: 'Cor de guerre', faction: 'neutre', type: 'cor', exemplaires: 3 },
    // { id: 'leurre', nom: 'Leurre', faction: 'neutre', type: 'leurre', exemplaires: 3 },
    // { id: 'brasier', nom: 'Brasier', faction: 'neutre', type: 'brasier', exemplaires: 3 },
  ],

  // ---------------------------------------------------------------
  //  DECKS PAR DÉFAUT (facultatif)
  // ---------------------------------------------------------------
  //  Deck des bots et point de départ de l'atelier, pour chaque faction.
  //  Sans rien, le jeu en compose un automatiquement.
  //  Format : faction1: [['roi', 1], ['archer', 2], …]
  decksParDefaut: {},
};
