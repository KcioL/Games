// Données du plateau « Tokyo Tycoon » : 40 cases, groupes de couleur et cartes.
// Montants en yens. Loyers : [terrain nu, 1 maison, 2, 3, 4 maisons, hôtel].

export const GROUPES = {
  brun: { nom: 'Quartiers populaires', couleur: '#8B5A3C', maison: 5000 },
  ciel: { nom: 'Ouest de Tokyo', couleur: '#7EC8E3', maison: 5000 },
  rose: { nom: 'Vieux Tokyo', couleur: '#E58FB0', maison: 10000 },
  orange: { nom: 'Quartiers branchés', couleur: '#E8833A', maison: 10000 },
  rouge: { nom: 'Jeunesse et mode', couleur: '#D9412B', maison: 15000 },
  jaune: { nom: 'Baie et gares', couleur: '#E9C23C', maison: 15000 },
  vert: { nom: 'Quartiers d\'affaires', couleur: '#5E8C3A', maison: 20000 },
  bleu: { nom: 'Prestige', couleur: '#264A7A', maison: 20000 },
};

const P = (nom, court, groupe, prix, loyers) => ({ type: 'propriete', nom, court, groupe, prix, loyers });
const T = (nom, court, icone) => ({ type: 'transport', nom, court, icone, prix: 20000 });
const C = (nom, court, icone) => ({ type: 'compagnie', nom, court, icone, prix: 15000 });

export const CASES = [
  { type: 'depart', nom: 'Départ', court: 'Départ', icone: '⛩' },
  P('Adachi', 'Adachi', 'brun', 6000, [200, 1000, 3000, 9000, 16000, 25000]),
  { type: 'matsuri', nom: 'Matsuri', court: 'Matsuri', icone: '祭' },
  P('Katsushika', 'Katsushika', 'brun', 6000, [400, 2000, 6000, 18000, 32000, 45000]),
  { type: 'taxe', nom: 'Impôt sur le revenu', court: 'Impôt', icone: '税', montant: 20000 },
  T('Gare de Tokyo', 'Gare Tokyo', '🚉'),
  P('Nakano', 'Nakano', 'ciel', 10000, [600, 3000, 9000, 27000, 40000, 55000]),
  { type: 'omikuji', nom: 'Omikuji', court: 'Omikuji', icone: '御' },
  P('Kōenji', 'Kōenji', 'ciel', 10000, [600, 3000, 9000, 27000, 40000, 55000]),
  P('Kichijōji', 'Kichijōji', 'ciel', 12000, [800, 4000, 10000, 30000, 45000, 60000]),
  { type: 'koban', nom: 'Kōban (simple visite)', court: 'Kōban', icone: '交' },
  P('Asakusa', 'Asakusa', 'rose', 14000, [1000, 5000, 15000, 45000, 62500, 75000]),
  C('Électricité de Tokyo', 'Électricité', '⚡'),
  P('Ueno', 'Ueno', 'rose', 14000, [1000, 5000, 15000, 45000, 62500, 75000]),
  P('Akihabara', 'Akihabara', 'rose', 16000, [1200, 6000, 18000, 50000, 70000, 90000]),
  T('Aéroport de Haneda', 'Haneda', '✈'),
  P('Ikebukuro', 'Ikebukuro', 'orange', 18000, [1400, 7000, 20000, 55000, 75000, 95000]),
  { type: 'matsuri', nom: 'Matsuri', court: 'Matsuri', icone: '祭' },
  P('Shimokitazawa', 'Shimokita', 'orange', 18000, [1400, 7000, 20000, 55000, 75000, 95000]),
  P('Nakameguro', 'Nakameguro', 'orange', 20000, [1600, 8000, 22000, 60000, 80000, 100000]),
  { type: 'jardin', nom: 'Jardin zen', court: 'Jardin zen', icone: '庭' },
  P('Harajuku', 'Harajuku', 'rouge', 22000, [1800, 9000, 25000, 70000, 87500, 105000]),
  { type: 'omikuji', nom: 'Omikuji', court: 'Omikuji', icone: '御' },
  P('Shibuya', 'Shibuya', 'rouge', 22000, [1800, 9000, 25000, 70000, 87500, 105000]),
  P('Ebisu', 'Ebisu', 'rouge', 24000, [2000, 10000, 30000, 75000, 92500, 110000]),
  T('Shinkansen', 'Shinkansen', '🚄'),
  P('Odaiba', 'Odaiba', 'jaune', 26000, [2200, 11000, 33000, 80000, 97500, 115000]),
  P('Shinagawa', 'Shinagawa', 'jaune', 26000, [2200, 11000, 33000, 80000, 97500, 115000]),
  C('Eaux de Tokyo', 'Eaux', '💧'),
  P('Shinjuku', 'Shinjuku', 'jaune', 28000, [2400, 12000, 36000, 85000, 102500, 120000]),
  { type: 'police', nom: 'Au kōban !', court: 'Au kōban !', icone: '🚨' },
  P('Roppongi', 'Roppongi', 'vert', 30000, [2600, 13000, 39000, 90000, 110000, 127500]),
  P('Aoyama', 'Aoyama', 'vert', 30000, [2600, 13000, 39000, 90000, 110000, 127500]),
  { type: 'matsuri', nom: 'Matsuri', court: 'Matsuri', icone: '祭' },
  P('Marunouchi', 'Marunouchi', 'vert', 32000, [2800, 15000, 45000, 100000, 120000, 140000]),
  T('Aéroport de Narita', 'Narita', '✈'),
  { type: 'omikuji', nom: 'Omikuji', court: 'Omikuji', icone: '御' },
  P('Azabu', 'Azabu', 'bleu', 35000, [3500, 17500, 50000, 110000, 130000, 150000]),
  { type: 'taxe', nom: 'Taxe de luxe', court: 'Taxe luxe', icone: '税', montant: 10000 },
  P('Ginza', 'Ginza', 'bleu', 40000, [5000, 20000, 60000, 140000, 170000, 200000]),
];

export const KOBAN = 10;
export const TRANSPORTS = [5, 15, 25, 35];
export const COMPAGNIES = [12, 28];

// Cases d'un groupe de couleur
export const casesDuGroupe = (g) => CASES.map((c, i) => (c.groupe === g ? i : -1)).filter((i) => i >= 0);

// Omikuji : papiers de fortune tirés au temple
export const OMIKUJI = [
  { texte: '大吉 Grande chance ! Avance jusqu\'au Départ et reçois 20 000 ¥.', effet: 'aller', cible: 0 },
  { texte: 'Dîner d\'affaires à Ginza : avance jusqu\'à Ginza.', effet: 'aller', cible: 39 },
  { texte: 'Séance shopping : avance jusqu\'à Harajuku. Si tu passes par le Départ, reçois 20 000 ¥.', effet: 'aller', cible: 21 },
  { texte: 'Visite du temple Sensō-ji : avance jusqu\'à Asakusa. Si tu passes par le Départ, reçois 20 000 ¥.', effet: 'aller', cible: 11 },
  { texte: 'Pars en voyage : avance jusqu\'au transport le plus proche. S\'il appartient à quelqu\'un, paie-lui le double du loyer.', effet: 'transport' },
  { texte: 'Correspondance ratée : avance jusqu\'au transport le plus proche. S\'il appartient à quelqu\'un, paie-lui le double du loyer.', effet: 'transport' },
  { texte: 'Panne de courant : avance jusqu\'à la compagnie la plus proche. Si elle appartient à quelqu\'un, paie-lui 10 fois le total des dés.', effet: 'compagnie' },
  { texte: 'Tes actions montent : la banque te verse 5 000 ¥.', effet: 'gain', montant: 5000 },
  { texte: 'Omamori : ce talisman te fera sortir du kōban. Garde cette carte.', effet: 'sortie' },
  { texte: 'Tu as oublié ton parapluie : recule de 3 cases.', effet: 'reculer', montant: 3 },
  { texte: '凶 Malchance ! Va directement au kōban, sans passer par le Départ.', effet: 'prison' },
  { texte: 'Rénovation de tes biens : paie 2 500 ¥ par maison et 10 000 ¥ par hôtel.', effet: 'reparations', maison: 2500, hotel: 10000 },
  { texte: 'Excès de vitesse sur l\'autoroute Shuto : paie 1 500 ¥.', effet: 'perte', montant: 1500 },
  { texte: 'Prends le Shinkansen : avance jusqu\'au Shinkansen. Si tu passes par le Départ, reçois 20 000 ¥.', effet: 'aller', cible: 25 },
  { texte: 'Élu président du comité de quartier : verse 5 000 ¥ à chaque joueur.', effet: 'payerChacun', montant: 5000 },
  { texte: 'Ton placement arrive à échéance : reçois 15 000 ¥.', effet: 'gain', montant: 15000 },
];

// Matsuri : fêtes de quartier
export const MATSURI = [
  { texte: 'Tu portes le mikoshi en tête du cortège : avance jusqu\'au Départ et reçois 20 000 ¥.', effet: 'aller', cible: 0 },
  { texte: 'Erreur de la banque en ta faveur : reçois 20 000 ¥.', effet: 'gain', montant: 20000 },
  { texte: 'Trop de takoyaki : visite chez le médecin, paie 5 000 ¥.', effet: 'perte', montant: 5000 },
  { texte: 'Tu vends ta collection de figurines : reçois 5 000 ¥.', effet: 'gain', montant: 5000 },
  { texte: 'Omamori du sanctuaire : ce talisman te fera sortir du kōban. Garde cette carte.', effet: 'sortie' },
  { texte: 'Bagarre au stand de yakitori : va directement au kōban, sans passer par le Départ.', effet: 'prison' },
  { texte: 'Soirée karaoké : chaque joueur te verse 1 000 ¥ pour ta performance.', effet: 'recevoirDeChacun', montant: 1000 },
  { texte: 'Remboursement d\'impôts : reçois 2 000 ¥.', effet: 'gain', montant: 2000 },
  { texte: 'Ton assurance arrive à terme : reçois 10 000 ¥.', effet: 'gain', montant: 10000 },
  { texte: 'Frais d\'hôpital : paie 10 000 ¥.', effet: 'perte', montant: 10000 },
  { texte: 'Cours de calligraphie : paie 5 000 ¥.', effet: 'perte', montant: 5000 },
  { texte: 'Tu aides à monter les stands : reçois 2 500 ¥.', effet: 'gain', montant: 2500 },
  { texte: 'Travaux de voirie après le festival : paie 4 000 ¥ par maison et 11 500 ¥ par hôtel.', effet: 'reparations', maison: 4000, hotel: 11500 },
  { texte: '2e prix du concours de cosplay : reçois 1 000 ¥.', effet: 'gain', montant: 1000 },
  { texte: 'Héritage d\'un grand-oncle d\'Osaka : reçois 10 000 ¥.', effet: 'gain', montant: 10000 },
  { texte: 'Prime de fin d\'année : reçois 10 000 ¥.', effet: 'gain', montant: 10000 },
];
