// ==========================================================================
// Cluedo : les données du jeu
// Pour changer les personnages ou les armes, il suffit de modifier les deux listes ci-dessous
// (garder 6 personnages ; on peut mettre de 4 à 9 armes).
//   id      : identifiant (minuscules, sans accents ni espaces) ; c'est aussi le nom de l'image
//             facultative à déposer dans cluedo/cartes/ (ex. cartes/rose.jpg)
//   nom     : le nom affiché
//   couleur : la couleur du pion (personnages)
// ==========================================================================

export const SUSPECTS = [
  { id: 'rose', nom: 'Mademoiselle Rose', court: 'Mlle Rose', couleur: '#D9416E' },
  { id: 'moutarde', nom: 'Colonel Moutarde', court: 'Col. Moutarde', couleur: '#E1A91A' },
  { id: 'leblanc', nom: 'Madame Leblanc', court: 'Mme Leblanc', couleur: '#EDEBE4' },
  { id: 'olive', nom: 'Docteur Olive', court: 'Dr Olive', couleur: '#3E9150' },
  { id: 'pervenche', nom: 'Madame Pervenche', court: 'Mme Pervenche', couleur: '#3C6BD0' },
  { id: 'violet', nom: 'Professeur Violet', court: 'Pr Violet', couleur: '#8746C2' },
];

export const ARMES = [
  { id: 'chandelier', nom: 'Chandelier' },
  { id: 'poignard', nom: 'Poignard' },
  { id: 'barre', nom: 'Barre de plomb' },
  { id: 'revolver', nom: 'Revolver' },
  { id: 'corde', nom: 'Corde' },
  { id: 'cle', nom: 'Clé anglaise' },
];

// ---------- Le plateau (coordonnées en pixels de plateau.jpg, 957 × 917) ----------
export const PLATEAU = { largeur: 957, hauteur: 917 };

// grille des couloirs : la case (c, r) commence en (X0 + c·DX, Y0 + r·DY)
export const GRILLE = { x0: 251.2, y0: 247.4, dx: 40.85, dy: 41.1 };

// cases de couloir, ligne par ligne : numéro de ligne → colonnes praticables
export const COULOIRS = {
  0: [0, 1, 2, 8, 9, 10],
  1: [0, 1, 2, 3, 7, 8, 9, 10],
  2: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  3: [1, 9],
  4: [1, 9],
  5: [1, 9],
  6: [1, 9],
  7: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  8: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  9: [1, 2, 8, 9],
  10: [1, 2, 8, 9],
};

// pièces : zone cliquable (x1, y1, x2, y2), où poser les pions et les armes, passage secret
export const PIECES = [
  { id: 'cuisine', nom: 'Cuisine', zone: [38, 29, 294, 245], pions: [158, 185], armes: [158, 91], passage: 'salon', trappe: [64, 221] },
  { id: 'bal', nom: 'Salle de bal', zone: [310, 24, 643, 244], pions: [475, 196], armes: [475, 103] },
  { id: 'veranda', nom: 'Véranda', zone: [653, 21, 943, 244], pions: [773, 185], armes: [773, 91], passage: 'manger', trappe: [912, 221] },
  { id: 'billard', nom: 'Salle de billard', zone: [28, 251, 290, 461], pions: [156, 437], armes: [156, 321] },
  { id: 'bibliotheque', nom: 'Bibliothèque', zone: [666, 251, 930, 424], pions: [813, 387], armes: [813, 295] },
  { id: 'bureau', nom: 'Bureau', zone: [666, 431, 930, 597], pions: [800, 565], armes: [800, 479] },
  { id: 'manger', nom: 'Salle à manger', zone: [28, 469, 280, 837], pions: [161, 757], armes: [161, 633], passage: 'veranda', trappe: [54, 811] },
  { id: 'hall', nom: 'Hall', zone: [376, 627, 583, 904], pions: [475, 777], armes: [475, 679] },
  { id: 'salon', nom: 'Salon', zone: [666, 601, 930, 889], pions: [794, 775], armes: [794, 685], passage: 'cuisine', trappe: [904, 865] },
];

// portes : case de couloir devant la porte → pièce
export const PORTES = [
  { c: 0, r: 0, piece: 'cuisine', sens: 'h' },
  { c: 2, r: 0, piece: 'bal', sens: 'h' },
  { c: 5, r: 2, piece: 'bal', sens: 'h' },
  { c: 8, r: 0, piece: 'bal', sens: 'h' },
  { c: 10, r: 0, piece: 'veranda', sens: 'h' },
  { c: 1, r: 4, piece: 'billard', sens: 'g' },
  { c: 9, r: 2, piece: 'bibliotheque', sens: 'd' },
  { c: 9, r: 5, piece: 'bureau', sens: 'd' },
  { c: 1, r: 9, piece: 'manger', sens: 'g' },
  { c: 5, r: 8, piece: 'hall', sens: 'b' },
  { c: 2, r: 9, piece: 'hall', sens: 'd' },
  { c: 8, r: 9, piece: 'hall', sens: 'g' },
  { c: 9, r: 9, piece: 'salon', sens: 'd' },
];

// cases de départ des six personnages (dans l'ordre de SUSPECTS)
export const DEPARTS = [
  { c: 0, r: 1 }, { c: 10, r: 1 }, { c: 1, r: 10 }, { c: 9, r: 10 }, { c: 3, r: 1 }, { c: 7, r: 1 },
];
