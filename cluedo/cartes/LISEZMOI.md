# Cluedo : illustrations des cartes (facultatif)

Dépose ici une carte toute faite pour remplacer le dessin par défaut. Le jeu l'utilise
automatiquement ; une carte sans image garde son dessin. Tu peux les ajouter petit à petit.

## Format

- Des **cartes complètes** (cadre, nom, dessin : tout est dans l'image). Le jeu les affiche telles quelles,
  sans rien ajouter par-dessus.
- Portrait au format **3 × 4**, par exemple **765 × 1024 pixels**.
- **JPG**, **PNG** ou **WEBP** (le jeu essaie dans cet ordre).
- Le nom du fichier est l'`id` de la carte, tel qu'il est écrit dans `cluedo/donnees.js`
  (minuscules, sans accents).

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
