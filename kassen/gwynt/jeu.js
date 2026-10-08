// =====================================================================
// GWYNT : TES CARTES
// =====================================================================
// Les chefs sont dans `factions`, les cartes dans `cartes`.
//
// Images : kassen/gwynt/cartes/<id>.jpg (un chef : <id du chef>.jpg).
// Une carte qui a plusieurs illustrations (une par exemplaire) indique
// « images: 3 » : ses fichiers sont alors <id>.jpg, <id>_2.jpg, <id>_3.jpg.
// Un chef ou une carte sans image garde un dessin par défaut.
// =====================================================================

export const JEU = {
  nom: 'Gwynt',

  // Format des images (largeur, hauteur en pixels) et position du rond de force imprimé
  // (centre en % de la largeur / de la hauteur, diamètre en % de la largeur) :
  // le rond blanc de la force modifiée se pose exactement dessus.
  format: [170, 324],
  rondForce: { x: 13, y: 6.9, taille: 28 },

  factions: {
    faction1: { nom: 'Royaumes du Nord', couleur: '#0361ED', symbole: 'RN', atout: 'pioche-victoire',
      chefs: [
        { id: 'chef1_a', nom: 'Foltest : Roi de Temeria', effet: 'meteo-dist' },
        { id: 'chef1_b', nom: 'Foltest : Protecteur du Nord', effet: 'eclaircie' },
        { id: 'chef1_c', nom: 'Foltest : Maître du siège', effet: 'cor-siege' },
        { id: 'chef1_d', nom: 'Foltest : Le Brave', effet: 'bruler-siege' },
      ] },
    faction2: { nom: 'Nilfgaard', couleur: '#3A3A3A', symbole: 'N', atout: 'egalites',
      chefs: [
        { id: 'chef2_a', nom: 'Emhyr var Emreis : Sa Majesté impériale', effet: 'meteo-siege' },
        { id: 'chef2_b', nom: 'Emhyr var Emreis : Empereur du Nilfgaard', effet: 'espionner' },
        { id: 'chef2_c', nom: 'Emhyr var Emreis : La Flamme Blanche', effet: 'annuler-chef' },
        { id: 'chef2_d', nom: "Emhyr var Emreis : L'Implacable", effet: 'voler-defausse' },
      ] },
    faction3: { nom: "scoia'tael", couleur: '#2A810A', symbole: 'S', atout: 'choix-premier',
      chefs: [
        { id: 'chef3_a', nom: 'Francesca Findabair : Elfe de sang pur', effet: 'meteo-cac' },
        { id: 'chef3_b', nom: 'Francesca Findabair : La Pâquerette des vallées', effet: 'pioche-depart' },
        { id: 'chef3_c', nom: 'Francesca Findabair : La Belle', effet: 'cor-dist' },
        { id: 'chef3_d', nom: 'Francesca Findabair : Reine de Dol Blathanna', effet: 'bruler-cac' },
      ] },
    faction4: { nom: 'Monstres', couleur: '#b70a0a', symbole: 'M', atout: 'hantise',
      chefs: [
        { id: 'chef4_a', nom: 'Eredin : Commandant des Cavaliers pourpres', effet: 'cor-cac' },
        { id: 'chef4_b', nom: 'Eredin : Roi de la Chasse Sauvage', effet: 'meteo' },
        { id: 'chef4_c', nom: 'Eredin : Le Mortifère', effet: 'recuperer' },
        { id: 'chef4_d', nom: 'Eredin : Destructeur de mondes', effet: 'echanger' },
      ] },
  },

  cartes: [
    // ===============================================================
    // ROYAUMES DU NORD
    // ===============================================================
    { id: 'ballista', nom: 'Ballista', faction: 'faction1', type: 'unite', force: 6, rangee: 'siege', legende: false, capacite: '', exemplaires: 2 },
    { id: 'blue_stripes_commando', nom: 'Commando des Stries bleues', faction: 'faction1', type: 'unite', force: 4, rangee: 'cac', legende: false, capacite: 'lien', groupe: 'blue_stripes', exemplaires: 3 },
    { id: 'catapulte', nom: 'Catapulte', faction: 'faction1', type: 'unite', force: 8, rangee: 'siege', legende: false, capacite: 'lien', groupe: 'catapulte', exemplaires: 2 },
    { id: 'chasseur_dragon', nom: 'Chasseur de dragons des Crinfrid', faction: 'faction1', type: 'unite', force: 5, rangee: 'dist', legende: false, capacite: 'lien', groupe: 'chasseur_dragon', exemplaires: 3 },
    { id: 'dethmold', nom: 'Dethmold', faction: 'faction1', type: 'unite', force: 6, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'medecin_banniere_dun', nom: 'Médecin de la bannière de Dun', faction: 'faction1', type: 'unite', force: 5, rangee: 'siege', legende: false, capacite: 'medecin', exemplaires: 1 },
    { id: 'expert_siege_kaedwen', nom: 'Expert en siège kaedwenien', faction: 'faction1', type: 'unite', force: 1, rangee: 'siege', legende: false, capacite: 'moral', exemplaires: 3 },
    { id: 'keira_metz', nom: 'Keira Metz', faction: 'faction1', type: 'unite', force: 5, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'pauvres_fantassins', nom: 'Pauvres fantassins', faction: 'faction1', type: 'unite', force: 1, rangee: 'cac', legende: false, capacite: 'lien', groupe: 'pauvres_fantassins', exemplaires: 3 },
    { id: 'prince_stennis', nom: 'Prince Stennis', faction: 'faction1', type: 'unite', force: 5, rangee: 'cac', legende: false, capacite: 'espion', exemplaires: 1 },
    { id: 'soldat_pied_redanien', nom: 'Fantassin rédaniais', faction: 'faction1', type: 'unite', force: 1, rangee: 'cac', legende: false, capacite: '', exemplaires: 2, images: 2 },
    { id: 'sabrina_glevissig', nom: 'Sabrina Glevissig', faction: 'faction1', type: 'unite', force: 4, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'sheldon_skaggs', nom: 'Sheldon Skaggs', faction: 'faction1', type: 'unite', force: 4, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'tour_de_siege', nom: 'Tour de siège', faction: 'faction1', type: 'unite', force: 6, rangee: 'siege', legende: false, capacite: '', exemplaires: 1 },
    { id: 'siegfried_denesle', nom: 'Siegfried de Denesle', faction: 'faction1', type: 'unite', force: 5, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'sigismund_dijkstra', nom: 'Sigismund Dijkstra', faction: 'faction1', type: 'unite', force: 4, rangee: 'cac', legende: false, capacite: 'espion', exemplaires: 1 },
    { id: 'sile_de_tansarville', nom: 'Síle de Tansarville', faction: 'faction1', type: 'unite', force: 5, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'thaler', nom: 'Thaler', faction: 'faction1', type: 'unite', force: 1, rangee: 'siege', legende: false, capacite: 'espion', exemplaires: 1 },
    { id: 'trebuchet', nom: 'Trébuchet', faction: 'faction1', type: 'unite', force: 6, rangee: 'siege', legende: false, capacite: '', exemplaires: 2, images: 2 },
    { id: 'vernon_roche', nom: 'Vernon Roche', faction: 'faction1', type: 'unite', force: 10, rangee: 'cac', legende: true, capacite: '', exemplaires: 1 },
    { id: 'esterad_thyssen', nom: 'Esterad Thyssen', faction: 'faction1', type: 'unite', force: 10, rangee: 'cac', legende: true, capacite: '', exemplaires: 1 },
    { id: 'jan_natalis', nom: 'Jan Natalis', faction: 'faction1', type: 'unite', force: 10, rangee: 'cac', legende: true, capacite: '', exemplaires: 1 },
    { id: 'philippa_eilhart', nom: 'Philippa Eilhart', faction: 'faction1', type: 'unite', force: 10, rangee: 'dist', legende: true, capacite: '', exemplaires: 1 },
    { id: 'ves', nom: 'Ves', faction: 'faction1', type: 'unite', force: 5, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'yarpen_zigrin', nom: 'Yarpen Zigrin', faction: 'faction1', type: 'unite', force: 2, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },

    // ===============================================================
    // NILFGAARD
    // ===============================================================
    { id: 'albrich', nom: 'Albrich', faction: 'faction2', type: 'unite', force: 2, rangee: 'dist', legende: false, capacite: '', exemplaires: 2 },
    { id: 'assire_var_anahid', nom: 'Assire var Anahid', faction: 'faction2', type: 'unite', force: 6, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'archer_infanterie_noire', nom: 'Archer d’infanterie noire', faction: 'faction2', type: 'unite', force: 10, rangee: 'dist', legende: false, capacite: '', exemplaires: 2, images: 2 },
    { id: 'cahir', nom: 'Cahir Mawr Dyffryn aep Ceallach', faction: 'faction2', type: 'unite', force: 6, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'cynthia', nom: 'Cynthia', faction: 'faction2', type: 'unite', force: 4, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'archers_auxiliaires_etoliens', nom: 'Archers auxiliaires étoliens', faction: 'faction2', type: 'unite', force: 1, rangee: 'dist', legende: false, capacite: 'medecin', exemplaires: 2, images: 2 },
    { id: 'fringilla_vigo', nom: 'Fringilla Vigo', faction: 'faction2', type: 'unite', force: 6, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'scorpion_lourd_zerrikanien', nom: 'Scorpion de feu lourd zerrikanien', faction: 'faction2', type: 'unite', force: 10, rangee: 'siege', legende: false, capacite: '', exemplaires: 2 },
    { id: 'garde_impera', nom: 'Garde de la brigade Impera', faction: 'faction2', type: 'unite', force: 3, rangee: 'cac', legende: false, capacite: 'lien', groupe: 'garde_impera', exemplaires: 4 },
    { id: 'letho_de_gulet', nom: 'Letho de Gulet', faction: 'faction2', type: 'unite', force: 10, rangee: 'cac', legende: true, capacite: '', exemplaires: 1 },
    { id: 'menno_coehoorn', nom: 'Menno Coehoorn', faction: 'faction2', type: 'unite', force: 10, rangee: 'cac', legende: true, capacite: 'medecin', exemplaires: 1 },
    { id: 'morteisen', nom: 'Morteisen', faction: 'faction2', type: 'unite', force: 3, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'morvran_voorhis', nom: 'Morvran Voorhis', faction: 'faction2', type: 'unite', force: 10, rangee: 'siege', legende: true, capacite: '', exemplaires: 1 },
    { id: 'cavalier_nausicaa', nom: 'Cavalier de la Nausicaa', faction: 'faction2', type: 'unite', force: 2, rangee: 'cac', legende: false, capacite: 'lien', groupe: 'cavalier_nausicaa', exemplaires: 3 },
    { id: 'puttkammer', nom: 'Puttkammer', faction: 'faction2', type: 'unite', force: 3, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'rainfarn', nom: 'Rainfarn', faction: 'faction2', type: 'unite', force: 4, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'renuald_aep_matsen', nom: 'Renuald aep Matsen', faction: 'faction2', type: 'unite', force: 5, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'mangonneau_corrompu', nom: 'Mangonneau corrompu', faction: 'faction2', type: 'unite', force: 3, rangee: 'siege', legende: false, capacite: '', exemplaires: 1 },
    { id: 'shilard_fitz_oesterlen', nom: 'Shilard Fitz-Oesterlen', faction: 'faction2', type: 'unite', force: 7, rangee: 'cac', legende: false, capacite: 'espion', exemplaires: 1 },
    { id: 'ingenieur_siege', nom: 'Ingénieur de siège', faction: 'faction2', type: 'unite', force: 6, rangee: 'siege', legende: false, capacite: '', exemplaires: 1 },
    { id: 'technicien_siege', nom: 'Technicien de siège', faction: 'faction2', type: 'unite', force: 0, rangee: 'siege', legende: false, capacite: 'medecin', exemplaires: 2 },
    { id: 'stefan_skellen', nom: 'Stefan Skellen', faction: 'faction2', type: 'unite', force: 9, rangee: 'cac', legende: false, capacite: 'espion', exemplaires: 1 },
    { id: 'sweers', nom: 'Sweers', faction: 'faction2', type: 'unite', force: 2, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'tibor_eggebracht', nom: 'Tibor Eggebracht', faction: 'faction2', type: 'unite', force: 10, rangee: 'dist', legende: true, capacite: '', exemplaires: 1 },
    { id: 'vanhemar', nom: 'Vanhemar', faction: 'faction2', type: 'unite', force: 4, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'vattier_de_rideaux', nom: 'Vattier de Rideaux', faction: 'faction2', type: 'unite', force: 4, rangee: 'cac', legende: false, capacite: 'espion', exemplaires: 1 },
    { id: 'vreemde', nom: 'Vreemde', faction: 'faction2', type: 'unite', force: 2, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'jeune_emissaire', nom: 'Jeune émissaire', faction: 'faction2', type: 'unite', force: 5, rangee: 'cac', legende: false, capacite: 'lien', groupe: 'jeune_emissaire', exemplaires: 2, images: 2 },
    { id: 'scorpion_zerrikanien', nom: 'Scorpion de feu zerrikanien', faction: 'faction2', type: 'unite', force: 5, rangee: 'siege', legende: false, capacite: '', exemplaires: 1 },

    // ===============================================================
    // MONSTRES
    // ===============================================================
    { id: 'arachas', nom: 'Arachas', faction: 'faction4', type: 'unite', force: 4, rangee: 'cac', legende: false, capacite: 'rassemblement', groupe: 'arachas', exemplaires: 3, images: 3 },
    { id: 'arachas_behemoth', nom: 'Arachas Behemoth', faction: 'faction4', type: 'unite', force: 6, rangee: 'siege', legende: false, capacite: 'rassemblement', groupe: 'arachas', exemplaires: 1 },
    { id: 'botchling', nom: 'Botchling', faction: 'faction4', type: 'unite', force: 4, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'harpie_celaeno', nom: 'Harpie célano', faction: 'faction4', type: 'unite', force: 2, rangee: 'cac+dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'cockatrice', nom: 'Cockatrice', faction: 'faction4', type: 'unite', force: 2, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'crone_brewess', nom: 'Brewess', faction: 'faction4', type: 'unite', force: 6, rangee: 'cac', legende: false, capacite: 'rassemblement', groupe: 'crones', exemplaires: 1 },
    { id: 'crone_weavess', nom: 'Weavess', faction: 'faction4', type: 'unite', force: 6, rangee: 'cac', legende: false, capacite: 'rassemblement', groupe: 'crones', exemplaires: 1 },
    { id: 'crone_whispess', nom: 'Whispess', faction: 'faction4', type: 'unite', force: 6, rangee: 'cac', legende: false, capacite: 'rassemblement', groupe: 'crones', exemplaires: 1 },
    { id: 'draug', nom: 'Draug', faction: 'faction4', type: 'unite', force: 10, rangee: 'cac', legende: true, capacite: '', exemplaires: 1 },
    { id: 'elementaire_terre', nom: 'Élémentaire de terre', faction: 'faction4', type: 'unite', force: 6, rangee: 'siege', legende: false, capacite: '', exemplaires: 1 },
    { id: 'endriague', nom: 'Endriague', faction: 'faction4', type: 'unite', force: 2, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'fiend', nom: 'Fiend', faction: 'faction4', type: 'unite', force: 6, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'elementaire_feu', nom: 'Élémentaire de feu', faction: 'faction4', type: 'unite', force: 6, rangee: 'siege', legende: false, capacite: '', exemplaires: 1 },
    { id: 'foglet', nom: 'Foglet', faction: 'faction4', type: 'unite', force: 2, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'fourchequeue', nom: 'Fourchequeue', faction: 'faction4', type: 'unite', force: 5, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'frightener', nom: 'Frightener', faction: 'faction4', type: 'unite', force: 5, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'gargouille', nom: 'Gargouille', faction: 'faction4', type: 'unite', force: 2, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'ghoul', nom: 'Goule', faction: 'faction4', type: 'unite', force: 1, rangee: 'cac', legende: false, capacite: 'rassemblement', groupe: 'ghoul', exemplaires: 3, images: 3 },
    { id: 'grave_hag', nom: 'Mégère funéraire', faction: 'faction4', type: 'unite', force: 5, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'griffon', nom: 'Griffon', faction: 'faction4', type: 'unite', force: 5, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'harpy', nom: 'Harpie', faction: 'faction4', type: 'unite', force: 2, rangee: 'cac+dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'ice_giant', nom: 'Géant des glaces', faction: 'faction4', type: 'unite', force: 5, rangee: 'siege', legende: false, capacite: '', exemplaires: 1 },
    { id: 'imlerith', nom: 'Imlerith', faction: 'faction4', type: 'unite', force: 10, rangee: 'cac', legende: true, capacite: '', exemplaires: 1 },
    { id: 'kayran', nom: 'Kayran', faction: 'faction4', type: 'unite', force: 8, rangee: 'cac+dist', legende: true, capacite: 'moral', exemplaires: 1 },
    { id: 'leshen', nom: 'Leshen', faction: 'faction4', type: 'unite', force: 10, rangee: 'dist', legende: true, capacite: '', exemplaires: 1 },
    { id: 'nekker', nom: 'Nekker', faction: 'faction4', type: 'unite', force: 2, rangee: 'cac', legende: false, capacite: 'rassemblement', groupe: 'nekker', exemplaires: 3, images: 2 },
    { id: 'plague_maiden', nom: 'Dame de peste', faction: 'faction4', type: 'unite', force: 5, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'vampire_bruxa', nom: 'Vampire Bruxa', faction: 'faction4', type: 'unite', force: 4, rangee: 'cac', legende: false, capacite: 'rassemblement', groupe: 'vampires', exemplaires: 1 },
    { id: 'vampire_ekimmara', nom: 'Vampire Ekimmara', faction: 'faction4', type: 'unite', force: 4, rangee: 'cac', legende: false, capacite: 'rassemblement', groupe: 'vampires', exemplaires: 1 },
    { id: 'vampire_fleder', nom: 'Vampire Fleder', faction: 'faction4', type: 'unite', force: 4, rangee: 'cac', legende: false, capacite: 'rassemblement', groupe: 'vampires', exemplaires: 1 },
    { id: 'vampire_garkain', nom: 'Vampire Garkain', faction: 'faction4', type: 'unite', force: 4, rangee: 'cac', legende: false, capacite: 'rassemblement', groupe: 'vampires', exemplaires: 1 },
    { id: 'vampire_katakan', nom: 'Vampire Katakan', faction: 'faction4', type: 'unite', force: 5, rangee: 'cac', legende: false, capacite: 'rassemblement', groupe: 'vampires', exemplaires: 1 },
    { id: 'werewolf', nom: 'Loup-garou', faction: 'faction4', type: 'unite', force: 5, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'wyvern', nom: 'Wyverne', faction: 'faction4', type: 'unite', force: 2, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },

    // ===============================================================
    // SCOIA'TAEL
    // ===============================================================
    { id: 'barclay_els', nom: 'Barclay Els', faction: 'faction3', type: 'unite', force: 6, rangee: 'cac+dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'ciaran', nom: 'Ciaran aep Easnillien', faction: 'faction3', type: 'unite', force: 3, rangee: 'cac+dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'dennis_cranmer', nom: 'Dennis Cranmer', faction: 'faction3', type: 'unite', force: 6, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'archer_dol_blathanna', nom: 'Archer de Dol Blathanna', faction: 'faction3', type: 'unite', force: 4, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'eclaireur_dol_blathanna', nom: 'Éclaireur de Dol Blathanna', faction: 'faction3', type: 'unite', force: 6, rangee: 'cac+dist', legende: false, capacite: '', exemplaires: 3, images: 3 },
    { id: 'tirailleur_nain', nom: 'Tirailleur nain', faction: 'faction3', type: 'unite', force: 3, rangee: 'cac', legende: false, capacite: 'rassemblement', groupe: 'tirailleur_nain', exemplaires: 3, images: 3 },
    { id: 'eithne', nom: 'Eithné', faction: 'faction3', type: 'unite', force: 10, rangee: 'dist', legende: true, capacite: '', exemplaires: 1 },
    { id: 'tirailleur_elfe', nom: 'Tirailleur elfe', faction: 'faction3', type: 'unite', force: 2, rangee: 'dist', legende: false, capacite: 'rassemblement', groupe: 'tirailleur_elfe', exemplaires: 3, images: 3 },
    { id: 'filavandrel', nom: 'Filavandrel aen Fidhail', faction: 'faction3', type: 'unite', force: 6, rangee: 'cac+dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'havekar_healer', nom: 'Guérisseur Havekar', faction: 'faction3', type: 'unite', force: 0, rangee: 'dist', legende: false, capacite: 'medecin', exemplaires: 3, images: 3 },
    { id: 'havekar_smuggler', nom: 'Contrebandier Havekar', faction: 'faction3', type: 'unite', force: 5, rangee: 'cac', legende: false, capacite: 'rassemblement', groupe: 'havekar_smuggler', exemplaires: 3, images: 3 },
    { id: 'ida_emean', nom: 'Ida Emean aep Sivney', faction: 'faction3', type: 'unite', force: 6, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'iorveth', nom: 'Iorveth', faction: 'faction3', type: 'unite', force: 10, rangee: 'dist', legende: true, capacite: '', exemplaires: 1 },
    { id: 'isengrim', nom: 'Isengrim Faoiltiarna', faction: 'faction3', type: 'unite', force: 10, rangee: 'cac', legende: true, capacite: 'moral', exemplaires: 1 },
    { id: 'defenseur_mahakam', nom: 'Défenseur de Mahakam', faction: 'faction3', type: 'unite', force: 5, rangee: 'cac', legende: false, capacite: '', exemplaires: 5, images: 5 },
    { id: 'milva', nom: 'Milva', faction: 'faction3', type: 'unite', force: 10, rangee: 'dist', legende: false, capacite: 'moral', exemplaires: 1 },
    { id: 'riordain', nom: 'Riordain', faction: 'faction3', type: 'unite', force: 1, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'saesenthessis', nom: 'Saesenthessis', faction: 'faction3', type: 'unite', force: 10, rangee: 'dist', legende: true, capacite: '', exemplaires: 1 },
    { id: 'toruviel', nom: 'Toruviel', faction: 'faction3', type: 'unite', force: 2, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'recrue_vrihedd', nom: 'Recrue de la brigade Vrihedd', faction: 'faction3', type: 'unite', force: 4, rangee: 'dist', legende: false, capacite: '', exemplaires: 1 },
    { id: 'veteran_vrihedd', nom: 'Vétéran de la brigade Vrihedd', faction: 'faction3', type: 'unite', force: 5, rangee: 'cac+dist', legende: false, capacite: '', exemplaires: 2, images: 2 },
    { id: 'yaevinn', nom: 'Yaevinn', faction: 'faction3', type: 'unite', force: 6, rangee: 'cac+dist', legende: false, capacite: '', exemplaires: 1 },

    // ===============================================================
    // NEUTRES
    // ===============================================================
    { id: 'avallach', nom: 'Avallac’h', faction: 'neutre', type: 'unite', force: 0, rangee: 'cac', legende: true, capacite: 'espion', exemplaires: 1 },
    { id: 'cirilla', nom: 'Cirilla Fiona Elen Riannon', faction: 'neutre', type: 'unite', force: 15, rangee: 'cac', legende: true, capacite: '', exemplaires: 1 },
    { id: 'dandelion', nom: 'Jaskier', faction: 'neutre', type: 'unite', force: 2, rangee: 'cac', legende: false, capacite: 'cor', exemplaires: 1 },
    { id: 'emiel_regis', nom: 'Emiel Regis Rohellec Terzieff', faction: 'neutre', type: 'unite', force: 5, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'geralt', nom: 'Geralt de Riv', faction: 'neutre', type: 'unite', force: 15, rangee: 'cac', legende: true, capacite: '', exemplaires: 1 },
    { id: 'triss', nom: 'Triss Merigold', faction: 'neutre', type: 'unite', force: 7, rangee: 'cac', legende: true, capacite: '', exemplaires: 1 },
    { id: 'vesemir', nom: 'Vesemir', faction: 'neutre', type: 'unite', force: 6, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },
    { id: 'villentretenmerth', nom: 'Villentretenmerth', faction: 'neutre', type: 'unite', force: 7, rangee: 'cac', legende: false, capacite: 'brasier_rangee', exemplaires: 1 },
    { id: 'yennefer', nom: 'Yennefer de Vengerberg', faction: 'neutre', type: 'unite', force: 7, rangee: 'dist', legende: true, capacite: 'medecin', exemplaires: 1 },
    { id: 'zoltan', nom: 'Zoltan Chivay', faction: 'neutre', type: 'unite', force: 5, rangee: 'cac', legende: false, capacite: '', exemplaires: 1 },

    { id: 'gel_mordant', nom: 'Gel mordant', faction: 'neutre', type: 'meteo', meteo: 'cac', exemplaires: 3 },
    { id: 'brouillard', nom: 'Brouillard impénétrable', faction: 'neutre', type: 'meteo', meteo: 'dist', exemplaires: 3 },
    { id: 'pluie_torrentielle', nom: 'Pluie torrentielle', faction: 'neutre', type: 'meteo', meteo: 'siege', exemplaires: 2 },
    { id: 'temps_clair', nom: 'Temps clair', faction: 'neutre', type: 'eclaircie', exemplaires: 2 },
    { id: 'cor_guerre', nom: 'Cor de guerre', faction: 'neutre', type: 'cor', exemplaires: 3 },
    { id: 'leurre', nom: 'Leurre', faction: 'neutre', type: 'leurre', exemplaires: 3 },
    { id: 'brasier', nom: 'Brasier', faction: 'neutre', type: 'brasier', exemplaires: 3 },
  ],

  decksParDefaut: {},
};
