# Cluedo : illustrations des cartes (facultatif)

Dépose ici une image pour remplacer le dessin par défaut d'une carte. Le jeu l'utilise
automatiquement ; une carte sans image garde son dessin. Tu peux les ajouter petit à petit.

## Format

- L'image remplit le **cadre de l'illustration** de la carte : le jeu ajoute lui-même le petit
  titre (« Suspect », « Arme », « Lieu ») et le nom en dessous. Pas besoin d'écrire le nom dans l'image.
- Format **paysage 4 × 3**, par exemple **800 × 600 pixels** (une image plus grande s'affiche aussi,
  mais elle est lourde à charger sur téléphone : vise moins de 150 Ko par image).
- **JPG**, **PNG** ou **WEBP** (le jeu essaie dans cet ordre).
- Le nom du fichier est l'`id` de la carte, tel qu'il est écrit dans `cluedo/donnees.js`
  (minuscules, sans accents).
- Pour les pièces, sans image, la carte montre la pièce découpée dans le plateau : si ça te plaît,
  il suffit de ne pas mettre d'image pour les pièces.

## Les fichiers (avec les personnages et armes actuels)

| Suspects | Armes | Pièces |
|---|---|---|
| `rose.jpg` | `chandelier.jpg` | `cuisine.jpg` |
| `moutarde.jpg` | `poignard.jpg` | `bal.jpg` |
| `leblanc.jpg` | `barre.jpg` | `veranda.jpg` |
| `olive.jpg` | `revolver.jpg` | `billard.jpg` |
| `pervenche.jpg` | `corde.jpg` | `bibliotheque.jpg` |
| `violet.jpg` | `cle.jpg` | `bureau.jpg` |
| | | `manger.jpg` |
| | | `hall.jpg` |
| | | `salon.jpg` |

Si tu changes un personnage ou une arme dans `donnees.js`, le nom de son image change aussi
(c'est son nouvel `id`).
