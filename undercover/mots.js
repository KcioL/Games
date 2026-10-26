// Undercover : chargement des paires de mots.
// Les paires sont rangées dans paires.txt (un fichier texte facile à modifier : une paire par ligne).
// Ce fichier-ci les lit ; il n'y a rien à y changer pour ajouter des mots ou des thèmes.

export const THEMES = {}; // identifiant → { nom, desc, paires: [[mot1, mot2], …] }

// Quelques paires de secours, si paires.txt ne peut pas être lu (pas d'internet et rien en mémoire)
const SECOURS = {
  general: {
    nom: 'Général',
    desc: 'Animaux, objets, métiers, lieux…',
    paires: [['Chat', 'Chien'], ['Café', 'Thé'], ['Plage', 'Piscine'], ['Pizza', 'Burger'], ['Avion', 'Hélicoptère'],
      ['Train', 'Métro'], ['Pomme', 'Poire'], ['Lion', 'Tigre'], ['Guitare', 'Violon'], ['Football', 'Rugby']],
  },
};

// Lecture du texte de paires.txt
//   == identifiant | Nom affiché | description   → un nouveau thème
//   mot 1 / mot 2                                → une paire
//   # commentaire, ligne vide                    → ignorés
export function lirePaires(texte) {
  const themes = {};
  let courant = null;
  String(texte || '').split(/\r?\n/).forEach((brute) => {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith('#')) return;
    if (ligne.startsWith('==')) {
      const [id, nom, desc] = ligne.slice(2).split('|').map((x) => x.trim());
      const cle = (id || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]/g, '');
      if (!cle || cle === 'melange') { courant = null; return; }
      courant = themes[cle] = themes[cle] || { nom: nom || id, desc: desc || '', paires: [] };
      return;
    }
    if (!courant) return;
    const morceaux = ligne.split('/').map((x) => x.trim());
    if (morceaux.length !== 2 || !morceaux[0] || !morceaux[1]) return; // ligne mal écrite : ignorée
    courant.paires.push([morceaux[0], morceaux[1]]);
  });
  Object.keys(themes).forEach((k) => { if (!themes[k].paires.length) delete themes[k]; });
  return themes;
}

let chargement = null;
export function chargerThemes() {
  if (!chargement) {
    chargement = fetch('paires.txt', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((texte) => {
        const themes = lirePaires(texte);
        if (!Object.keys(themes).length) throw new Error('aucune paire');
        Object.assign(THEMES, themes);
      })
      .catch((err) => {
        console.warn('Undercover : paires.txt illisible, paires de secours utilisées', err);
        Object.assign(THEMES, SECOURS);
      })
      .then(() => THEMES);
  }
  return chargement;
}

// Mot du joueur ramené à sa plus simple forme, pour comparer la proposition de Mister White
export function simplifier(mot) {
  return String(mot || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]/g, '')
    .replace(/s$/, ''); // pluriel toléré
}
