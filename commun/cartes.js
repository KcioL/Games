// Cartes à jouer (Blackjack et Poker)
export const COULEURS = ['♠', '♥', '♦', '♣'];
export const VALEURS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Figures à la française : J = Valet, Q = Dame, K = Roi
const AFFICHAGE = { J: 'V', Q: 'D', K: 'R' };

export function nouveauPaquet(nbPaquets = 1) {
  const p = [];
  for (let n = 0; n < nbPaquets; n++) {
    for (const s of COULEURS) for (const v of VALEURS) p.push({ v, s });
  }
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

// Crée l'élément d'une carte. carte = null ou cachee = true : dos de carte.
export function carteEl(carte, { cachee = false, taille = '' } = {}) {
  const e = document.createElement('div');
  e.className = 'carte-jeu' + (taille ? ' ' + taille : '');
  if (!carte || cachee) {
    e.classList.add('dos');
    e.setAttribute('aria-label', 'Carte cachée');
    return e;
  }
  const rouge = carte.s === '♥' || carte.s === '♦';
  if (rouge) e.classList.add('rouge');
  const v = AFFICHAGE[carte.v] || carte.v;
  const coin = document.createElement('span');
  coin.className = 'coin';
  coin.textContent = v;
  const centre = document.createElement('span');
  centre.className = 'centre';
  centre.textContent = carte.s;
  const coinBas = document.createElement('span');
  coinBas.className = 'coin bas';
  coinBas.textContent = v;
  e.append(coin, centre, coinBas);
  e.setAttribute('aria-label', `${v} ${carte.s}`);
  return e;
}

// Remplit un conteneur ; les nouvelles cartes (au-delà de `deja`) arrivent avec une animation.
// Par défaut, `deja` = nombre de cartes déjà présentes dans le conteneur.
export function afficherCartes(conteneur, cartes, options = {}, deja) {
  const avant = deja === undefined ? conteneur.children.length : deja;
  conteneur.innerHTML = '';
  (cartes || []).forEach((c, i) => {
    const opts = typeof options === 'function' ? options(c, i) : options;
    const e = carteEl(c, opts);
    if (i >= avant) {
      e.classList.add('arrivee');
      e.style.animationDelay = `${(i - avant) * 90}ms`;
    }
    conteneur.appendChild(e);
  });
}
