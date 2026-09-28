// Écrans « passe le téléphone » du mode un seul téléphone (partagés par les 3 jeux).
// barre : en bas de l'écran, le joueur qui vient de jouer voit le résultat puis passe la main.
// voile : écran plein qui cache le jeu pendant que le téléphone change de mains.
// « de Léa », mais « d'Emma »
export function de(nom) {
  return /^[aeiouàâäéèêëîïôöùûüœ]/i.test(nom) ? `d'${nom}` : `de ${nom}`;
}

export function creerRelais() {
  const barre = document.createElement('div');
  barre.className = 'relais-barre';
  barre.hidden = true;
  const texteBarre = document.createElement('span');
  const boutonBarre = document.createElement('button');
  boutonBarre.type = 'button';
  barre.append(texteBarre, boutonBarre);

  const voile = document.createElement('div');
  voile.className = 'relais-voile';
  voile.hidden = true;
  voile.setAttribute('role', 'dialog');
  voile.setAttribute('aria-modal', 'true');
  const carte = document.createElement('div');
  carte.className = 'relais-carte';
  const jeton = document.createElement('div');
  jeton.className = 'relais-jeton';
  jeton.textContent = '\u265F\uFE0E'; // pion (♟), affiché comme symbole et non comme émoji
  const titre = document.createElement('h2');
  const texte = document.createElement('p');
  const boutonVoile = document.createElement('button');
  boutonVoile.type = 'button';
  carte.append(jeton, titre, texte, boutonVoile);
  voile.appendChild(carte);

  document.body.append(barre, voile);

  let apresBarre = null;
  let apresVoile = null;

  boutonBarre.addEventListener('click', () => {
    const f = apresBarre;
    apresBarre = null;
    barre.hidden = true;
    if (f) f();
  });
  boutonVoile.addEventListener('click', () => {
    const f = apresVoile;
    apresVoile = null;
    voile.hidden = true;
    if (f) f();
  });

  return {
    barre(nom, fn, message) {
      texteBarre.textContent = message || 'Ton tour est fini.';
      boutonBarre.textContent = `Passer le téléphone à ${nom}`;
      apresBarre = fn;
      barre.hidden = false;
    },
    cacherBarre() { barre.hidden = true; apresBarre = null; },
    voile(nom, fn) {
      titre.textContent = `Au tour ${de(nom)}`;
      texte.textContent = `Donne le téléphone à ${nom}. Les autres, on ne regarde pas !`;
      boutonVoile.textContent = `C'est moi, afficher mon jeu`;
      apresVoile = fn;
      voile.hidden = false;
      boutonVoile.focus();
    },
    voileVisible: () => !voile.hidden,
    barreVisible: () => !barre.hidden,
  };
}
