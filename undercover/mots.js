// Paires de mots de l'Undercover : les civils reçoivent l'un, les Undercover l'autre
// (on tire au sort lequel des deux va aux civils).
// Pour ajouter des mots : une ligne ['mot 1', 'mot 2'], deux mots proches mais différents.

export const THEMES = {
  general: {
    nom: 'Général',
    paires: [
      ['Chat', 'Chien'], ['Café', 'Thé'], ['Plage', 'Piscine'], ['Pizza', 'Burger'], ['Avion', 'Hélicoptère'],
      ['Train', 'Métro'], ['Vélo', 'Trottinette'], ['Pomme', 'Poire'], ['Orange', 'Mandarine'], ['Fraise', 'Framboise'],
      ['Citron', 'Pamplemousse'], ['Lion', 'Tigre'], ['Loup', 'Renard'], ['Requin', 'Dauphin'], ['Abeille', 'Guêpe'],
      ['Papillon', 'Libellule'], ['Montagne', 'Colline'], ['Lac', 'Étang'], ['Mer', 'Océan'], ['Neige', 'Grêle'],
      ['Soleil', 'Lune'], ['Étoile', 'Planète'], ['Pluie', 'Orage'], ['Forêt', 'Jungle'], ['Désert', 'Savane'],
      ['Château', 'Palais'], ['Église', 'Cathédrale'], ['Hôpital', 'Clinique'], ['École', 'Collège'], ['Professeur', 'Directeur'],
      ['Médecin', 'Infirmier'], ['Pompier', 'Policier'], ['Boulanger', 'Pâtissier'], ['Cuisinier', 'Serveur'], ['Guitare', 'Violon'],
      ['Piano', 'Orgue'], ['Batterie', 'Tambour'], ['Football', 'Rugby'], ['Tennis', 'Badminton'], ['Basket', 'Handball'],
      ['Ski', 'Snowboard'], ['Natation', 'Plongée'], ['Boxe', 'Karaté'], ['Échecs', 'Dames'], ['Cinéma', 'Théâtre'],
      ['Livre', 'Magazine'], ['Journal', 'Radio'], ['Télévision', 'Ordinateur'], ['Téléphone', 'Tablette'], ['Stylo', 'Crayon'],
      ['Cahier', 'Classeur'], ['Chaise', 'Tabouret'], ['Canapé', 'Fauteuil'], ['Lit', 'Hamac'], ['Lampe', 'Bougie'],
      ['Fourchette', 'Cuillère'], ['Couteau', 'Ciseaux'], ['Assiette', 'Bol'], ['Verre', 'Tasse'], ['Bouteille', 'Gourde'],
      ['Chaussure', 'Botte'], ['Pull', 'Gilet'], ['Manteau', 'Veste'], ['Chapeau', 'Casquette'], ['Lunettes', 'Lentilles'],
      ['Montre', 'Bracelet'], ['Bague', 'Collier'], ['Parfum', 'Déodorant'], ['Savon', 'Shampoing'], ['Douche', 'Baignoire'],
      ['Croissant', 'Pain au chocolat'], ['Crêpe', 'Gaufre'], ['Glace', 'Sorbet'], ['Chocolat', 'Caramel'], ['Bonbon', 'Chewing-gum'],
      ['Fromage', 'Yaourt'], ['Beurre', 'Margarine'], ['Sel', 'Poivre'], ['Ketchup', 'Mayonnaise'], ['Frites', 'Chips'],
      ['Pâtes', 'Riz'], ['Soupe', 'Purée'], ['Sushi', 'Maki'], ['Tacos', 'Kebab'], ['Vin', 'Bière'],
      ['Champagne', 'Cidre'], ['Jus d\'orange', 'Limonade'], ['Noël', 'Halloween'], ['Anniversaire', 'Mariage'], ['Vacances', 'Week-end'],
      ['Paris', 'Londres'], ['Italie', 'Espagne'], ['Tour Eiffel', 'Arc de Triomphe'], ['Facebook', 'Instagram'], ['WhatsApp', 'Messenger'],
      ['Netflix', 'YouTube'], ['Voiture', 'Moto'], ['Camion', 'Bus'], ['Bateau', 'Sous-marin'], ['Fusée', 'Satellite'],
      ['Roi', 'Président'], ['Prince', 'Chevalier'], ['Sorcière', 'Fée'], ['Vampire', 'Zombie'], ['Fantôme', 'Squelette'],
      ['Dragon', 'Licorne'], ['Pirate', 'Viking'], ['Cowboy', 'Shérif'], ['Clown', 'Magicien'], ['Cirque', 'Zoo'],
      ['Parapluie', 'Imperméable'], ['Clé', 'Cadenas'], ['Marteau', 'Tournevis'], ['Escalier', 'Ascenseur'], ['Fenêtre', 'Porte'],
      ['Jardin', 'Parc'], ['Rose', 'Tulipe'], ['Cactus', 'Palmier'], ['Hiver', 'Automne'], ['Printemps', 'Été'],
      ['Rêve', 'Cauchemar'], ['Bisou', 'Câlin'], ['Sac à dos', 'Valise'], ['Tente', 'Caravane'], ['Banque', 'Poste'],
      ['Supermarché', 'Marché'], ['Restaurant', 'Cantine'], ['Musée', 'Bibliothèque'], ['Plombier', 'Électricien'], ['Carte bancaire', 'Chèque'],
      ['Euro', 'Dollar'], ['Or', 'Argent'], ['Diamant', 'Rubis'], ['Miroir', 'Vitre'], ['Brosse à dents', 'Dentifrice'],
      ['Oreiller', 'Couette'], ['Four', 'Micro-ondes'], ['Frigo', 'Congélateur'], ['Aspirateur', 'Balai'], ['Ballon', 'Bulle'],
      ['Poupée', 'Peluche'], ['Lego', 'Puzzle'], ['Cerf-volant', 'Montgolfière'], ['Volcan', 'Geyser'], ['Île', 'Presqu\'île'],
      ['Grenouille', 'Crapaud'], ['Tortue', 'Escargot'], ['Cheval', 'Âne'], ['Vache', 'Mouton'], ['Poule', 'Canard'],
      ['Hibou', 'Chouette'], ['Aigle', 'Faucon'], ['Souris', 'Hamster'], ['Lapin', 'Lièvre'], ['Singe', 'Gorille'],
    ],
  },
  anime: {
    nom: 'Anime · Jeux vidéo · Manga',
    paires: [
      ['Naruto', 'Sasuke'], ['Goku', 'Vegeta'], ['Luffy', 'Zoro'], ['Nami', 'Robin'], ['Shanks', 'Barbe Blanche'],
      ['Pikachu', 'Évoli'], ['Dracaufeu', 'Dracolosse'], ['Mewtwo', 'Mew'], ['Pokéball', 'Master Ball'], ['Pokémon', 'Digimon'],
      ['Mario', 'Luigi'], ['Peach', 'Daisy'], ['Bowser', 'Ganondorf'], ['Yoshi', 'Toad'], ['Donkey Kong', 'Diddy Kong'],
      ['Link', 'Zelda'], ['Sonic', 'Tails'], ['Kirby', 'Rondoudou'], ['Pac-Man', 'Tetris'], ['Mario Kart', 'Crash Team Racing'],
      ['Minecraft', 'Roblox'], ['Fortnite', 'Apex Legends'], ['League of Legends', 'Dota'], ['Call of Duty', 'Battlefield'], ['FIFA', 'PES'],
      ['GTA', 'Red Dead Redemption'], ['The Witcher', 'Skyrim'], ['Dark Souls', 'Elden Ring'], ['Street Fighter', 'Tekken'], ['Super Smash Bros', 'Brawlhalla'],
      ['Resident Evil', 'Silent Hill'], ['Halo', 'Destiny'], ['Overwatch', 'Valorant'], ['Counter-Strike', 'Rainbow Six'], ['Clash Royale', 'Clash of Clans'],
      ['Animal Crossing', 'Stardew Valley'], ['Les Sims', 'SimCity'], ['Among Us', 'Fall Guys'], ['Candy Crush', 'Bejeweled'], ['Final Fantasy', 'Dragon Quest'],
      ['Cloud', 'Sephiroth'], ['Genshin Impact', 'Honkai Star Rail'], ['Lara Croft', 'Nathan Drake'], ['Samus', 'Master Chief'], ['Kratos', 'Dante'],
      ['PlayStation', 'Xbox'], ['Nintendo Switch', 'Game Boy'], ['Manette', 'Joystick'], ['Clavier', 'Souris'], ['Steam', 'Epic Games'],
      ['Twitch', 'YouTube'], ['Streamer', 'YouTubeur'], ['Boss', 'Mini-boss'], ['Speedrun', 'Let\'s play'], ['Pixel', 'Polygone'],
      ['Sauvegarde', 'Checkpoint'], ['Game over', 'Continue'], ['Arcade', 'Borne'], ['Manga', 'Webtoon'], ['Anime', 'Dessin animé'],
      ['Cosplay', 'Déguisement'], ['Otaku', 'Geek'], ['Shōnen', 'Seinen'], ['Japan Expo', 'Comic Con'], ['Mangaka', 'Dessinateur'],
      ['Dragon Ball', 'One Piece'], ['Death Note', 'Code Geass'], ['L', 'Light'], ['L\'Attaque des Titans', 'Kaiju n°8'], ['Eren', 'Livaï'],
      ['Demon Slayer', 'Jujutsu Kaisen'], ['Tanjiro', 'Zenitsu'], ['Gojo', 'Sukuna'], ['Kakashi', 'Jiraiya'], ['Itachi', 'Madara'],
      ['Sakura', 'Hinata'], ['Kamehameha', 'Rasengan'], ['Super Saiyan', 'Mode Ermite'], ['Freezer', 'Cell'], ['Piccolo', 'Gohan'],
      ['Saitama', 'Genos'], ['Deku', 'Bakugo'], ['All Might', 'Endeavor'], ['Gon', 'Kirua'], ['Hunter x Hunter', 'Fairy Tail'],
      ['Ichigo', 'Rukia'], ['Bleach', 'Black Clover'], ['Edward', 'Alphonse'], ['Totoro', 'Ponyo'], ['Le Voyage de Chihiro', 'Princesse Mononoké'],
      ['Sailor Moon', 'Sakura chasseuse de cartes'], ['Les Chevaliers du Zodiaque', 'Ken le Survivant'], ['Olive et Tom', 'Inazuma Eleven'], ['Haikyu', 'Kuroko\'s Basket'], ['Vinland Saga', 'Berserk'],
      ['Tokyo Ghoul', 'Parasite'], ['Chainsaw Man', 'Fire Force'], ['Spy x Family', 'Kaguya-sama'], ['Anya', 'Loid'], ['Jojo', 'Dio'],
      ['Détective Conan', 'Lupin III'], ['Doraemon', 'Hamtaro'], ['Goldorak', 'Astro Boy'], ['Albator', 'Capitaine Flam'], ['Nicky Larson', 'Cobra'],
      ['Mob Psycho 100', 'One Punch Man'], ['Solo Leveling', 'Tower of God'], ['Frieren', 'Dungeon Meshi'], ['Pokédex', 'Encyclopédie'], ['Rubis', 'Saphir'],
      ['Triforce', 'Master Sword'], ['Champignon', 'Étoile'], ['Pièce d\'or', 'Rubis vert'], ['Hyrule', 'Royaume Champignon'], ['Pikmin', 'Lemmings'],
    ],
  },
};

// Mot du joueur ramené à sa plus simple forme, pour comparer la proposition de Mister White
export function simplifier(mot) {
  return String(mot || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]/g, '')
    .replace(/s$/, ''); // pluriel toléré
}
