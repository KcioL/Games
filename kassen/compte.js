// Compte (facultatif) : les decks (3 par clan, chacun avec son chef et son nom) sont enregistrés
// dans le compte du joueur, dans la Realtime Database (comptes/<uid>/kassen/decks/<clan>/d1…d3),
// et suivent le joueur sur tous ses appareils.
// Sans compte (ou hors ligne), tout reste enregistré sur l'appareil.
//
// Firebase n'est chargé qu'au moment où on en a besoin : le jeu marche sans internet.

const VERSION_FB = '10.12.2';
export const NB_DECKS = 3;
const CLE_DECKS = (clan) => `jeux-vol:gwynt-decks:${clan}`; // { actif, emplacements: { d1: { deck, chef, nom, majAt }, … } }
// anciennes clés (un seul deck par clan) : reprises automatiquement comme deck 1
const ANCIEN_DECK = (clan) => `jeux-vol:gwynt-deck:${clan}`;
const ANCIEN_CHEF = (clan) => `jeux-vol:gwynt-chef:${clan}`;
const ANCIEN_MAJ = (clan) => `jeux-vol:gwynt-maj:${clan}`;
const CLE_SESSION = 'jeux-vol:compte-connu'; // un compte a déjà été utilisé sur cet appareil
const emp = (n) => `d${n}`;

let fb = null;      // modules Firebase chargés
let auth = null;
let utilisateur = null;
let surChangement = () => {};

const lire = (cle) => { try { return localStorage.getItem(cle); } catch (e) { return null; } };
const ecrire = (cle, v) => { try { if (v === null || v === undefined) localStorage.removeItem(cle); else localStorage.setItem(cle, v); } catch (e) { /* stockage indisponible */ } };

// Les decks d'un clan sur cet appareil
function decksLocaux(clan) {
  let donnees = null;
  try { donnees = JSON.parse(lire(CLE_DECKS(clan))); } catch (e) { /* illisible */ }
  if (!donnees || typeof donnees !== 'object') {
    donnees = { actif: 1, emplacements: {} };
    // reprise de l'ancien deck unique
    let ancien = null;
    try { ancien = JSON.parse(lire(ANCIEN_DECK(clan))); } catch (e) { /* illisible */ }
    if (Array.isArray(ancien)) {
      donnees.emplacements.d1 = { deck: ancien, chef: lire(ANCIEN_CHEF(clan)) || '', nom: '', majAt: Number(lire(ANCIEN_MAJ(clan)) || 0) };
    }
  }
  donnees.emplacements = donnees.emplacements || {};
  return donnees;
}
const sauverLocaux = (clan, donnees) => ecrire(CLE_DECKS(clan), JSON.stringify(donnees));

// Deck n° n (1 à 3) du clan : { deck, chef, nom, majAt }, ou null s'il n'a jamais été enregistré
export const deckSauve = (clan, n) => decksLocaux(clan).emplacements[emp(n)] || null;
// Deck choisi pour jouer ce clan
export const emplacementActif = (clan) => Math.min(NB_DECKS, Math.max(1, Number(decksLocaux(clan).actif) || 1));
export function choisirEmplacement(clan, n) {
  const d = decksLocaux(clan);
  d.actif = n;
  sauverLocaux(clan, d);
}

// Tous les clans qui ont des decks sur cet appareil (nouvelles et anciennes clés)
function clansLocaux() {
  const clans = new Set();
  try {
    for (let k = 0; k < localStorage.length; k++) {
      const cle = localStorage.key(k) || '';
      if (cle.startsWith('jeux-vol:gwynt-decks:')) clans.add(cle.slice('jeux-vol:gwynt-decks:'.length));
      else if (cle.startsWith('jeux-vol:gwynt-deck:')) clans.add(cle.slice('jeux-vol:gwynt-deck:'.length));
    }
  } catch (e) { /* stockage indisponible */ }
  return clans;
}

async function charger() {
  if (fb) return fb;
  const [base, authMod, dbMod] = await Promise.all([
    import('../firebase.js'),
    import(`https://www.gstatic.com/firebasejs/${VERSION_FB}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${VERSION_FB}/firebase-database.js`),
  ]);
  fb = { ...authMod, ...dbMod, app: base.app, db: base.db };
  auth = fb.getAuth(fb.app);
  auth.languageCode = 'fr';
  fb.onAuthStateChanged(auth, async (u) => {
    utilisateur = u;
    if (u) {
      ecrire(CLE_SESSION, '1');
      try { await synchroniser(); } catch (err) { console.warn('Compte : synchronisation impossible', err); }
    }
    surChangement();
  });
  return fb;
}

// Au démarrage : on ne charge Firebase que si un compte a déjà été utilisé ici (connexion gardée)
export function initCompte(rappel) {
  surChangement = rappel || surChangement;
  if (lire(CLE_SESSION) && navigator.onLine) charger().catch(() => {});
}

export const compteActuel = () => (utilisateur ? { nom: utilisateur.displayName || utilisateur.email || 'Joueur', email: utilisateur.email } : null);

// Fusion appareil ↔ compte : pour chaque deck (clan et emplacement), la version la plus récente gagne
async function synchroniser() {
  const chemin = `comptes/${utilisateur.uid}/kassen/decks`;
  const instant = await fb.get(fb.ref(fb.db, chemin));
  const distants = instant.val() || {};
  const envois = {};
  const clans = new Set([...Object.keys(distants), ...clansLocaux()]);
  clans.forEach((clan) => {
    const locaux = decksLocaux(clan);
    let modifie = false;
    for (let n = 1; n <= NB_DECKS; n++) {
      const d = (distants[clan] || {})[emp(n)];
      const l = locaux.emplacements[emp(n)];
      if (d && Array.isArray(d.deck) && (!l || (d.majAt || 0) >= (l.majAt || 0))) {
        // le compte est plus récent : on le recopie sur l'appareil
        locaux.emplacements[emp(n)] = { deck: d.deck, chef: d.chef || '', nom: d.nom || '', majAt: d.majAt || 0 };
        modifie = true;
      } else if (l && Array.isArray(l.deck)) {
        // l'appareil est plus récent (ou le compte n'a rien) : on l'envoie
        envois[`${clan}/${emp(n)}`] = { deck: l.deck, chef: l.chef || '', nom: l.nom || '', majAt: l.majAt || Date.now() };
      }
    }
    if (modifie || !lire(CLE_DECKS(clan))) sauverLocaux(clan, locaux);
  });
  if (Object.keys(envois).length) await fb.update(fb.ref(fb.db, chemin), envois);
}

// Enregistrer le deck n° n d'un clan : sur l'appareil, et dans le compte si on est connecté
export function enregistrerDeck(clan, n, deck, chef, nom) {
  const entree = { deck, chef: chef || '', nom: (nom || '').slice(0, 30), majAt: Date.now() };
  const locaux = decksLocaux(clan);
  locaux.emplacements[emp(n)] = entree;
  locaux.actif = n;
  sauverLocaux(clan, locaux);
  if (utilisateur && fb) {
    fb.set(fb.ref(fb.db, `comptes/${utilisateur.uid}/kassen/decks/${clan}/${emp(n)}`), entree)
      .catch((err) => console.warn('Compte : enregistrement impossible', err));
  }
}

// ---------- Connexion / déconnexion ----------
const MESSAGES = {
  'auth/invalid-email': 'Adresse e-mail invalide.',
  'auth/missing-password': 'Indique un mot de passe.',
  'auth/weak-password': 'Mot de passe trop court (6 caractères au moins).',
  'auth/email-already-in-use': 'Un compte existe déjà avec cette adresse : connecte-toi.',
  'auth/invalid-credential': 'Adresse ou mot de passe incorrect.',
  'auth/wrong-password': 'Adresse ou mot de passe incorrect.',
  'auth/user-not-found': 'Aucun compte avec cette adresse : crée-le.',
  'auth/too-many-requests': 'Trop d\'essais : réessaie dans quelques minutes.',
  'auth/network-request-failed': 'Pas de connexion internet.',
  'auth/operation-not-allowed': 'Ce mode de connexion n\'est pas encore activé dans Firebase (voir le fichier LISEZMOI).',
  'auth/configuration-not-found': 'La connexion n\'est pas encore activée dans Firebase (voir le fichier LISEZMOI).',
};
export const messageErreur = (err) => {
  if (err && MESSAGES[err.code]) return MESSAGES[err.code];
  // Firebase n'a pas pu être chargé (hors ligne, réseau bloqué…)
  if (!err || !err.code) return 'Impossible de joindre le service de connexion : vérifie ta connexion internet.';
  return `Connexion impossible (${err.code}).`;
};

export async function connexionEmail(email, motDePasse, creer) {
  await charger();
  if (creer) await fb.createUserWithEmailAndPassword(auth, email, motDePasse);
  else await fb.signInWithEmailAndPassword(auth, email, motDePasse);
}
export async function motDePasseOublie(email) {
  await charger();
  await fb.sendPasswordResetEmail(auth, email);
}
export async function deconnexion() {
  if (!auth) return;
  await fb.signOut(auth);
  ecrire(CLE_SESSION, null);
  utilisateur = null;
  surChangement();
}
