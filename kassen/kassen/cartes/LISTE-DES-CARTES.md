# Gwynt, édition Japon : liste des cartes

Les **125 cartes** et les **12 chefs** sont illustrés (images de ce dossier, nommées avec leur id).

## Comment ajouter une carte

1. Crée l'image de la carte **complète** (cadre, force, icônes, nom, texte), au format **portrait 3 × 4**, par exemple **765 × 1024 pixels**.
2. Enregistre-la en **JPG** avec exactement le nom indiqué dans la colonne « Fichier » (en minuscules, sans accents).
3. Dépose-la dans le dossier **`kassen/kassen/cartes/`** du site.

C'est tout : l'image remplace automatiquement le dessin de la carte, pour tous ses exemplaires, dans la main, sur le plateau et dans l'atelier. Sur le plateau, la force *actuelle* (modifiée par les météos, les liens, les cors…) s'affiche par-dessus le chiffre imprimé, en vert si elle est augmentée et en rouge si elle est diminuée.

Les cartes sans image gardent leur dessin par défaut : tu peux les ajouter petit à petit.

## Capacités de clan

En plus de sa capacité habituelle, une carte peut avoir une **capacité de clan** (écrite à la suite dans la colonne « Capacité », par exemple « Légende, Brûlure » pour une légende). Dans `kassen/jeu.js`, c'est le champ `pouvoir`.

| Icône | Capacité | Clan | Effet | Dans jeu.js |
|---|---|---|---|---|
| 隠 | Camouflage | 忍 Shinobi | Insensible à la Brûlure et à la Colère de Raijin. | `pouvoir: 'camouflage'` |
| 鉄 | Volonté de fer | 僧 Sōhei | Insensible aux météos. | `pouvoir: 'volonte'` |
| 切 | Harakiri | 龍 Clan du Dragon | À ton tour, au lieu de jouer une carte : elle se sacrifie et emporte avec elle l'unité adverse de ton choix (hors légendes). | `pouvoir: 'harakiri'` |
| 祟 | Malédiction | 妖 Yōkai | Tant qu'elle est en jeu : −1 de force à chaque unité de la rangée adverse en face (hors légendes, jamais sous 1). | `pouvoir: 'malediction'` |

## 龍 Clan du Dragon (29 cartes)

| Fichier | Carte | Force | Rangée | Capacité | Exemplaires |
|---|---|---|---|---|---|
| `shogun.jpg` | Shōgun du Dragon | 10 | Corps à corps | Légende | 1 |
| `archere.jpg` | Archère légendaire | 10 | Distance | Légende | 1 |
| `daimyo.jpg` | Daimyō du Dragon | 8 | Siège | Légende, Cor | 1 |
| `samourai.jpg` | Samouraï du Dragon | 4 | Corps à corps | Lien | 3 |
| `cavalier.jpg` | Cavalier lancier | 6 | Corps à corps | Harakiri | 1 |
| `hatamoto.jpg` | Porte-étendard | 3 | Corps à corps | Porte-étendard | 1 |
| `ashigaru.jpg` | Ashigaru | 2 | Corps à corps | Rassemblement | 3 |
| `yumi.jpg` | Archer yumi | 4 | Distance | — | 2 |
| `teppo.jpg` | Arquebusier | 5 | Distance | — | 2 |
| `infiltre.jpg` | Shinobi infiltré | 4 | Distance | Espion | 1 |
| `bombarde.jpg` | Bombarde | 6 | Siège | — | 1 |
| `catapulte.jpg` | Catapulte | 8 | Siège | Lien | 2 |
| `moine.jpg` | Moine guérisseur | 3 | Siège | Médecin | 1 |
| `ronin.jpg` | Rōnin | 6 | Corps à corps ou Distance | — | 1 |
| `garde_chateau.jpg` | Garde du château | 5 | Corps à corps | Harakiri | 2 |
| `tour_siege.jpg` | Tour de siège | 7 | Siège | — | 1 |
| `ingenieur.jpg` | Ingénieur de siège | 4 | Siège | — | 1 |
| `archer_monte.jpg` | Archer monté | 5 | Distance | — | 1 |
| `tomoe.jpg` | Tomoe Gozen | 9 | Corps à corps | Légende, Brûlure | 1 |
| `maitre_taiko.jpg` | Maître du taiko | 2 | Corps à corps | Cor | 1 |
| `salve.jpg` | Arquebusiers en salve | 3 | Distance | Lien | 3 |
| `canon_bronze.jpg` | Canon de bronze | 5 | Siège | Brûlure | 1 |
| `garde_daimyo.jpg` | Garde du daimyō | 7 | Corps à corps | Harakiri | 2 |
| `emissaire.jpg` | Émissaire du shōgun | 5 | Corps à corps | Espion | 1 |
| `medecin_campagne.jpg` | Médecin de campagne | 4 | Distance | Médecin | 1 |
| `belier.jpg` | Bélier de siège | 6 | Siège | — | 1 |
| `capitaine_archers.jpg` | Capitaine des archers | 4 | Distance | Porte-étendard | 1 |
| `onna_bugeisha.jpg` | Onna-bugeisha | 5 | Corps à corps ou Distance | Harakiri | 2 |
| `infiltrateur_dragon.jpg` | Infiltrateur du Dragon | 4 | Corps à corps ou Distance | Espion | 1 |

## 忍 Shinobi (27 cartes)

| Fichier | Carte | Force | Rangée | Capacité | Exemplaires |
|---|---|---|---|---|---|
| `maitre_ombres.jpg` | Maître des ombres | 10 | Corps à corps | Légende, Cor | 1 |
| `kunoichi_ecarlate.jpg` | Kunoichi écarlate | 8 | Distance | Légende, Porte-étendard | 1 |
| `ninja_ombre.jpg` | Ninja de l'ombre | 3 | Corps à corps | Rassemblement | 3 |
| `espion_cour.jpg` | Espion à la cour | 1 | Corps à corps | Espion | 2 |
| `informatrice.jpg` | Informatrice | 2 | Distance | Espion | 1 |
| `kunoichi.jpg` | Kunoichi | 5 | Corps à corps ou Distance | Camouflage | 2 |
| `shuriken.jpg` | Lanceur de shuriken | 4 | Distance | — | 2 |
| `herboriste.jpg` | Herboriste | 3 | Distance | Médecin | 1 |
| `pieges.jpg` | Poseur de pièges | 5 | Siège | Camouflage | 2 |
| `fusees.jpg` | Fusées incendiaires | 6 | Siège | — | 1 |
| `freres_lame.jpg` | Frères de lame | 4 | Corps à corps | Lien | 2 |
| `grimpeur.jpg` | Ninja grimpeur | 5 | Distance | Camouflage | 2 |
| `poisons.jpg` | Maître des poisons | 4 | Siège | Médecin | 1 |
| `kusarigama.jpg` | Porteur de kusarigama | 6 | Corps à corps | Camouflage | 1 |
| `guetteuse.jpg` | Guetteuse | 2 | Distance | Espion | 1 |
| `cerf_volant.jpg` | Cerf-volant d'attaque | 7 | Siège | — | 1 |
| `recrues.jpg` | Jeunes recrues | 3 | Corps à corps | — | 2 |
| `fantome_iga.jpg` | Le Fantôme d'Iga | 9 | Corps à corps ou Distance | Légende, Brûlure | 1 |
| `assassin_aube.jpg` | Assassin de l'aube | 4 | Corps à corps | Brûlure | 1 |
| `saboteur.jpg` | Saboteur | 4 | Siège | Brûlure | 1 |
| `corbeaux.jpg` | Clan des corbeaux | 2 | Distance | Rassemblement | 3 |
| `jumelles.jpg` | Sœurs jumelles | 4 | Distance | Lien | 2 |
| `jonin.jpg` | Jōnin | 4 | Corps à corps | Porte-étendard | 1 |
| `komuso.jpg` | Komusō | 2 | Distance | Cor | 1 |
| `agent_double.jpg` | Agent double | 3 | Siège | Espion | 1 |
| `infiltree.jpg` | Infiltrée du château | 6 | Corps à corps ou Distance | Camouflage | 1 |
| `fumigenes.jpg` | Lanceur de fumigènes | 5 | Siège | Camouflage | 2 |

## 妖 Yōkai (28 cartes)

| Fichier | Carte | Force | Rangée | Capacité | Exemplaires |
|---|---|---|---|---|---|
| `kitsune.jpg` | Kitsune à neuf queues | 10 | Distance | Légende | 1 |
| `gashadokuro.jpg` | Gashadokuro | 10 | Siège | Légende | 1 |
| `umibozu.jpg` | Umibōzu | 9 | Corps à corps | Légende, Brûlure | 1 |
| `oni.jpg` | Oni rouge | 7 | Corps à corps | — | 1 |
| `kappa.jpg` | Kappa | 2 | Corps à corps | Rassemblement | 3 |
| `tengu.jpg` | Tengu | 5 | Corps à corps ou Distance | — | 2 |
| `yukionna.jpg` | Yuki-onna | 6 | Distance | Malédiction | 1 |
| `jorogumo.jpg` | Jorōgumo | 6 | Corps à corps | Malédiction | 1 |
| `kodama.jpg` | Kodama | 2 | Siège | Rassemblement | 3 |
| `nue.jpg` | Nue | 7 | Siège | — | 1 |
| `rokurokubi.jpg` | Rokurokubi | 4 | Distance | — | 2 |
| `freres_oni.jpg` | Frères oni | 5 | Corps à corps | Lien | 2 |
| `bakeneko.jpg` | Bakeneko | 4 | Distance | Malédiction | 2 |
| `nurikabe.jpg` | Nurikabe | 7 | Siège | — | 1 |
| `tsuchigumo.jpg` | Tsuchigumo | 6 | Corps à corps | Malédiction | 1 |
| `kamaitachi.jpg` | Kamaitachi | 5 | Corps à corps ou Distance | — | 1 |
| `ittan_momen.jpg` | Ittan-momen | 4 | Distance | — | 1 |
| `shuten_doji.jpg` | Shuten-dōji | 8 | Corps à corps | Légende, Porte-étendard | 1 |
| `omukade.jpg` | Ōmukade | 6 | Corps à corps | Brûlure | 1 |
| `hitodama.jpg` | Hitodama | 2 | Distance | Rassemblement | 3 |
| `nopperabo.jpg` | Nopperabō | 4 | Corps à corps | Espion | 1 |
| `inugami.jpg` | Meute d'inugami | 3 | Corps à corps | Lien | 3 |
| `zashiki_warashi.jpg` | Zashiki-warashi | 2 | Siège | Porte-étendard | 1 |
| `biwa.jpg` | Biwa-bokuboku | 2 | Distance | Cor | 1 |
| `raiju.jpg` | Raijū | 6 | Corps à corps ou Distance | — | 1 |
| `funayurei.jpg` | Funayūrei | 3 | Distance | Médecin | 1 |
| `wanyudo.jpg` | Wanyūdō | 7 | Siège | Malédiction | 1 |
| `chochin.jpg` | Chōchin-obake | 4 | Siège | Lien | 3 |

## 僧 Sōhei (25 cartes)

| Fichier | Carte | Force | Rangée | Capacité | Exemplaires |
|---|---|---|---|---|---|
| `abbe.jpg` | Grand abbé | 11 | Siège | Légende, Médecin | 1 |
| `colosse.jpg` | Moine colossal | 10 | Corps à corps | Légende, Brûlure | 1 |
| `naginata.jpg` | Sōhei à naginata | 6 | Corps à corps | Lien | 3 |
| `tambour.jpg` | Joueur de tambour | 3 | Corps à corps | Porte-étendard | 1 |
| `archer_temple.jpg` | Archer du temple | 5 | Distance | — | 3 |
| `pretre.jpg` | Prêtre guérisseur | 3 | Siège | Médecin | 2 |
| `novices.jpg` | Novices | 4 | Corps à corps | Rassemblement | 3 |
| `arbalete.jpg` | Arbalète géante | 7 | Siège | — | 1 |
| `pelerin.jpg` | Pèlerin espion | 3 | Distance | Espion | 2 |
| `yamabushi.jpg` | Yamabushi | 7 | Corps à corps ou Distance | Volonté de fer | 1 |
| `lanternes.jpg` | Moine aux lanternes | 4 | Distance | Porte-étendard | 1 |
| `gardien_portail.jpg` | Gardien du portail | 6 | Corps à corps | Volonté de fer | 2 |
| `archer_cheval.jpg` | Moine archer à cheval | 5 | Distance | — | 1 |
| `bonze.jpg` | Bonze guérisseur | 3 | Distance | Médecin | 1 |
| `cloche.jpg` | Gardien de la cloche | 4 | Siège | Volonté de fer | 1 |
| `benkei.jpg` | Benkei | 9 | Corps à corps | Légende, Cor | 1 |
| `maitre_gong.jpg` | Maître du gong | 2 | Siège | Cor | 1 |
| `sutras.jpg` | Récitant de sutras | 3 | Siège | Porte-étendard | 1 |
| `frondeurs.jpg` | Frondeurs du temple | 3 | Distance | Rassemblement | 3 |
| `porteurs_belier.jpg` | Porteurs de bélier | 4 | Siège | Lien | 2 |
| `exorciste.jpg` | Exorciste | 4 | Distance | Brûlure | 1 |
| `nio.jpg` | Gardien Niō | 7 | Corps à corps | Volonté de fer | 1 |
| `moine_cimes.jpg` | Moine des cimes | 5 | Corps à corps ou Distance | Volonté de fer | 1 |
| `catapulte_monastere.jpg` | Catapulte du monastère | 6 | Siège | — | 1 |
| `nonne_guerriere.jpg` | Nonne guerrière | 5 | Corps à corps | Volonté de fer | 2 |

## Cartes neutres, utilisables par tous les clans (9 cartes)

| Fichier | Carte | Force | Rangée | Capacité | Exemplaires |
|---|---|---|---|---|---|
| `sabre_invaincu.jpg` | Le Sabre invaincu | 15 | Corps à corps | Légende | 1 | 
| `grue_blanche.jpg` | La Grue blanche | 7 | Distance | Légende, Médecin | 1 | 
| `kirin.jpg` | Kirin | 15 | Siège | Légende | 1 | 
| `kamuri.jpg` | Kamuri | 0 | Corps à corps | Légende, Espion | 1 |
| `marchand.jpg` | Marchand ambulant | 4 | Siège | Espion | 1 | 
| `moine_errant.jpg` | Moine errant | 5 | Distance | Médecin | 1 | 
| `ronin_errant.jpg` | Rōnin errant | 6 | Corps à corps ou Distance | — | 1 | 
| `maneki_neko.jpg` | Maneki-neko | 2 | Corps à corps | Porte-étendard | 1 | 
| `conteuse.jpg` | Conteuse de légendes | 4 | Distance | — | 1 | 

## Cartes spéciales (7 cartes)

| Fichier | Carte | Effet |
|---|---|---|
| `neige.jpg` | Neige | Toutes les unités au corps à corps (des deux camps) tombent à 1 de force. | 
| `brume.jpg` | Brume | Toutes les unités à distance (des deux camps) tombent à 1 de force. | 
| `typhon.jpg` | Typhon | Toutes les unités de siège (des deux camps) tombent à 1 de force. | 
| `soleil.jpg` | Éclaircie | Dissipe toutes les météos. | 
| `taiko.jpg` | Taiko de guerre | Double la force des unités d'une de tes rangées (hors légendes). | 
| `kagemusha.jpg` | Kagemusha | Ce sosie prend la place d'une de tes unités (hors légendes), qui revient dans ta main. | 
| `raijin.jpg` | Colère de Raijin | Détruit la ou les unités les plus fortes du plateau, dans les deux camps (hors légendes). | 

## 將 Chefs (12 cartes)

Chaque clan a 3 chefs ; le joueur choisit le sien dans « Modifier le deck ». Leurs images vont dans le même dossier que les cartes.

| Fichier | Chef | Clan | Effet (une fois par partie) |
|---|---|---|---|
| `chef_dragon_cri.jpg` | Shōgun du Dragon | Clan du Dragon | Double la force de sa rangée de corps à corps. | 
| `chef_dragon_artilleur.jpg` | Maître artilleur | Clan du Dragon | Double la force de sa rangée de siège. | 
| `chef_dragon_stratege.jpg` | Stratège du clan | Clan du Dragon | Joue depuis sa pioche une météo qui touche la distance. | 
| `chef_shinobi_assassin.jpg` | Maître assassin | Shinobi | Détruit l'unité la plus forte de la rangée à distance adverse, si cette rangée vaut 10 ou plus. | 
| `chef_shinobi_lame.jpg` | Lame silencieuse | Shinobi | Détruit l'unité la plus forte de la rangée de corps à corps adverse, si cette rangée vaut 10 ou plus. | 
| `chef_shinobi_espion.jpg` | Maître espion | Shinobi | Pioche une carte. | 
| `chef_yokai_reine.jpg` | Reine des Yōkai | Yōkai | Ramène en jeu l'unité la plus forte de sa défausse (hors légendes et espions). | 
| `chef_yokai_brume.jpg` | Esprit de la brume | Yōkai | Joue depuis sa pioche une météo qui touche la distance. | 
| `chef_yokai_tempete.jpg` | Seigneur des tempêtes | Yōkai | Joue depuis sa pioche une météo qui touche le siège. | 
| `chef_sohei_soleil.jpg` | Grand prêtre du soleil | Sōhei | Dissipe toutes les météos. | 
| `chef_sohei_tambour.jpg` | Maître des tambours | Sōhei | Double la force de sa rangée à distance. | 
| `chef_sohei_feu.jpg` | Gardien du feu sacré | Sōhei | Détruit l'unité la plus forte de la rangée de siège adverse, si cette rangée vaut 10 ou plus. | 