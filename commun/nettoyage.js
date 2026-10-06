// Nettoyage de la base : supprime les salons sans activité depuis plus de 24 heures.
// Lancé quand quelqu'un joue en ligne, au plus une fois toutes les 6 heures par appareil.
// Les règles de la base n'autorisent à lister QUE les salons de plus de 24 h (voir database.rules.json).

export const JEUX = ['uno', 'bataille', 'skyjo', 'blackjack', 'poker', 'chevaux', 'puissance4', 'tokyo', 'kassen'];
const DUREE_VIE = 24 * 60 * 60 * 1000;
const MARGE = 10 * 60 * 1000;            // tolère une horloge de téléphone un peu en avance
const INTERVALLE = 6 * 60 * 60 * 1000;
const CLE = 'jeux-vol:dernier-nettoyage';

export async function nettoyerVieuxSalons(fb, { forcer = false } = {}) {
  try {
    const dernier = Number(localStorage.getItem(CLE)) || 0;
    if (!forcer && Date.now() - dernier < INTERVALLE) return 0;
    localStorage.setItem(CLE, String(Date.now()));
  } catch (e) { /* stockage indisponible : on nettoie quand même */ }
  const limite = Date.now() - DUREE_VIE - MARGE;
  let supprimes = 0;
  for (const jeu of JEUX) {
    try {
      // Les salons sans heure d'activité (créés avant cette mise à jour) sont aussi renvoyés : ils passent en premier.
      const vieux = await fb.get(fb.query(fb.ref(fb.db, jeu), fb.orderByChild('majAt'), fb.endAt(limite)));
      const codes = [];
      vieux.forEach((salon) => { codes.push(salon.key); });
      for (const code of codes) {
        if (code === 'LOCAL') continue;
        await fb.remove(fb.ref(fb.db, `${jeu}/${code}`));
        supprimes++;
      }
    } catch (e) {
      // règles pas encore publiées, hors connexion… : on réessaiera plus tard
    }
  }
  return supprimes;
}
