// Gestion des salons, partagée par la Bataille navale et le Skyjo.
// Chaque jeu fournit : etatInitial(nom, nbJoueurs), demarrer(etat), afficher(etat, maPlace),
// et pour le mode un seul téléphone : quiDoitJouer(etat) et secret (faut-il cacher le jeu entre deux tours).
import { localDb } from './local-db.js';
import { creerRelais, de } from './relais.js';
import { EXEMPLE_PSEUDO } from './perso.js';

export { de };

// Firebase n'est chargé que pour le mode en ligne : sans internet, le mode local marche quand même.
let firebase = null;
async function chargerFirebase() {
  if (!firebase) firebase = await import('../firebase.js');
  return firebase;
}

export const $ = (id) => document.getElementById(id);

export function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function melanger(tab) {
  for (let i = tab.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tab[i], tab[j]] = [tab[j], tab[i]];
  }
  return tab;
}

// ---------- Message flottant ----------
let toastEl = null;
let toastTimer = null;
export function toast(texte, fort = false) {
  if (!toastEl) {
    toastEl = el('div', 'toast');
    toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = texte;
  toastEl.classList.toggle('fort', fort);
  void toastEl.offsetWidth;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 3200);
}

function messageErreur(err) {
  const m = String(err && err.message || err);
  if (m.includes('permission')) return "La base de données a refusé l'accès : vérifie les règles Firebase.";
  if (m.includes('import') || m.includes('fetch')) return "Pas de connexion internet. Utilise l'onglet « Sur ce téléphone ».";
  return 'Problème de connexion : ' + m;
}

// ---------- Règles du jeu ----------
export function initRegles() {
  const d = $('regles');
  $('btn-regles').addEventListener('click', () => d.showModal());
  d.querySelector('.fermer').addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
}

// ---------- Salon ----------
const LETTRES = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sans I ni O, pour éviter les confusions

function genererCode() {
  let c = '';
  for (let i = 0; i < 4; i++) c += LETTRES[Math.floor(Math.random() * LETTRES.length)];
  return c;
}

export function initSalon({ jeu, etatInitial, demarrer, afficher, quiDoitJouer, secret }) {
  const cleSession = 'jeux-vol:' + jeu;
  const clePseudo = 'jeux-vol:pseudo';
  const CODE_LOCAL = 'LOCAL';
  let code = null;
  let place = null;
  let arreterEcoute = null;
  let api = null;          // base utilisée : Firebase ou base locale
  let local = false;
  let relais = null;
  let dernierEtat = null;
  let voileAuDebut = false;

  const ui = {
    lobby: $('lobby'), attente: $('attente'), jeuZone: $('jeu'),
    pseudo: $('pseudo'), nb: $('nb-joueurs'), codeInput: $('code-salon'),
    creer: $('btn-creer'), rejoindre: $('btn-rejoindre'), reprendre: $('btn-reprendre'),
    infoSalon: $('info-salon'), codeAffiche: $('code-affiche'),
    codeGrand: $('code-grand'), places: $('liste-places'), quitter: $('btn-quitter'),
    onglets: document.querySelectorAll('.onglets [role="tab"]'),
    localNb: $('local-nb'), localNoms: $('local-noms'), local: $('btn-local'),
  };

  // ---------- Onglets « En ligne » / « Sur ce téléphone » ----------
  ui.onglets.forEach((o) => o.addEventListener('click', () => {
    ui.onglets.forEach((x) => {
      const actif = x === o;
      x.setAttribute('aria-selected', String(actif));
      $(x.dataset.volet).hidden = !actif;
    });
  }));

  function construireNoms() {
    const n = ui.localNb ? parseInt(ui.localNb.value, 10) : 2;
    const anciens = [...ui.localNoms.querySelectorAll('input')].map((i) => i.value);
    ui.localNoms.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const input = el('input');
      input.maxLength = 16;
      input.placeholder = `Joueur ${i + 1}`;
      input.setAttribute('aria-label', `Nom du joueur ${i + 1}`);
      input.value = anciens[i] !== undefined ? anciens[i] : (i === 0 ? (ui.pseudo.value || '') : '');
      ui.localNoms.appendChild(input);
    }
  }
  if (ui.localNb) ui.localNb.addEventListener('change', construireNoms);

  ui.pseudo.placeholder = `Ex : ${EXEMPLE_PSEUDO}`;
  try { ui.pseudo.value = localStorage.getItem(clePseudo) || ''; } catch (e) { /* stockage indisponible */ }

  function lirePseudo() {
    const nom = ui.pseudo.value.trim().slice(0, 16);
    try { if (nom) localStorage.setItem(clePseudo, nom); } catch (e) { /* rien */ }
    return nom;
  }

  function montrer(ecran) {
    ui.lobby.hidden = ecran !== 'lobby';
    ui.attente.hidden = ecran !== 'attente';
    ui.jeuZone.hidden = ecran !== 'jeu';
    ui.infoSalon.hidden = ecran === 'lobby';
    ui.quitter.hidden = ecran === 'lobby';
    const barre = document.querySelector('.barre');
    if (barre) barre.classList.toggle('en-salon', ecran !== 'lobby');
  }

  // Session mémorisée : permet de revenir dans la partie après un rechargement de la page
  function lireSession() {
    try { return JSON.parse(localStorage.getItem(cleSession)); } catch (e) { return null; }
  }
  function ecrireSession(s) {
    try {
      if (s) localStorage.setItem(cleSession, JSON.stringify(s));
      else localStorage.removeItem(cleSession);
    } catch (e) { /* rien */ }
  }

  function afficherReprendre() {
    const session = lireSession();
    const partieLocale = localDb.lireMaintenant(`${jeu}/${CODE_LOCAL}`);
    if (session && session.local && partieLocale) {
      ui.reprendre.hidden = false;
      ui.reprendre.textContent = 'Reprendre la partie sur ce téléphone';
    } else if (session && session.code && !session.local) {
      ui.reprendre.hidden = false;
      ui.reprendre.textContent = `Reprendre la partie ${session.code}`;
    } else {
      ui.reprendre.hidden = true;
    }
  }
  construireNoms();
  afficherReprendre();

  async function passerEnLigne() {
    const fb = await chargerFirebase();
    api = fb;
    local = false;
  }

  function passerEnLocal() {
    api = localDb;
    local = true;
    if (!relais) relais = creerRelais();
  }

  async function creer() {
    const nom = lirePseudo() || 'Joueur 1';
    const nb = ui.nb ? parseInt(ui.nb.value, 10) : 2;
    ui.creer.disabled = true;
    try {
      await passerEnLigne();
      for (let essai = 0; essai < 6; essai++) {
        const c = genererCode();
        const etat = etatInitial(nom, nb);
        etat.status = 'waiting';
        etat.createdAt = Date.now();
        const res = await api.runTransaction(api.ref(api.db, `${jeu}/${c}`), (actuel) => (actuel === null ? etat : undefined));
        if (res.committed) { entrer(c, 0); return; }
      }
      toast("Impossible de créer un salon, réessaie.");
    } catch (err) {
      toast(messageErreur(err), true);
    } finally {
      ui.creer.disabled = false;
    }
  }

  async function rejoindre(c) {
    const nom = lirePseudo();
    if (!/^[A-Z]{4}$/.test(c)) { toast('Le code du salon fait 4 lettres.'); return; }
    let maPlace = -1;
    let raison = '';
    ui.rejoindre.disabled = true;
    try {
      await passerEnLigne();
      const res = await api.runTransaction(api.ref(api.db, `${jeu}/${c}`), (s) => {
        maPlace = -1; raison = '';
        if (!s) { raison = 'introuvable'; return s; }
        const joueurs = s.players || [];
        if (s.status === 'waiting') {
          const libre = joueurs.findIndex((p) => !p.joined);
          if (libre < 0) { raison = 'complet'; return; }
          let nomFinal = nom || `Joueur ${libre + 1}`;
          if (joueurs.some((p) => p.joined && p.name === nomFinal)) nomFinal += ' 2';
          joueurs[libre].joined = true;
          joueurs[libre].name = nomFinal;
          maPlace = libre;
          return s;
        }
        // Partie déjà lancée : on retrouve sa place grâce au pseudo
        const idx = joueurs.findIndex((p) => p.name === nom);
        if (idx >= 0) { maPlace = idx; return; }
        raison = 'commencee';
        return;
      });
      if (maPlace >= 0) { entrer(c, maPlace); return; }
      if (raison === 'introuvable' || !res.snapshot.exists()) toast("Aucun salon avec ce code.");
      else if (raison === 'complet') toast('Ce salon est complet.');
      else toast('La partie a commencé. Rejoins avec le même pseudo que tout à l’heure.');
    } catch (err) {
      toast(messageErreur(err), true);
    } finally {
      ui.rejoindre.disabled = false;
    }
  }

  function afficherAttente(s) {
    ui.codeGrand.textContent = code;
    ui.places.innerHTML = '';
    s.players.forEach((p, i) => {
      const li = el('li', p.joined ? 'ok' : 'vide', p.joined ? p.name : 'Place libre');
      if (i === place) li.append(' (toi)');
      ui.places.appendChild(li);
    });
  }

  function entrer(c, p) {
    code = c;
    place = p;
    ecrireSession({ code, place, local });
    ui.codeAffiche.textContent = local ? 'Sur ce téléphone' : code;
    ui.infoSalon.classList.toggle('local', local);
    montrer('attente');
    if (arreterEcoute) arreterEcoute();
    arreterEcoute = api.onValue(api.ref(api.db, `${jeu}/${code}`), (snap) => {
      const s = snap.val();
      if (!s) {
        toast("Ce salon n'existe plus.");
        quitter();
        return;
      }
      s.players = s.players || [];
      if (s.status === 'waiting') {
        montrer('attente');
        afficherAttente(s);
        if (place === 0 && s.players.every((j) => j.joined)) lancer();
      } else {
        montrer('jeu');
        if (local) gererTourLocal(s);
        else afficher(s, place);
      }
    }, (err) => toast(messageErreur(err), true));
  }

  // ---------- Mode un seul téléphone ----------
  function commencerLocal() {
    const noms = [...ui.localNoms.querySelectorAll('input')]
      .map((i, k) => i.value.trim().slice(0, 16) || `Joueur ${k + 1}`);
    noms.forEach((n, k) => { if (noms.indexOf(n) !== k) noms[k] = `${n} ${k + 1}`; });
    if (noms[0]) { try { localStorage.setItem(clePseudo, noms[0]); } catch (e) { /* rien */ } }
    passerEnLocal();
    const etat = etatInitial(noms[0], noms.length);
    etat.players.forEach((p, k) => { p.name = noms[k]; p.joined = true; });
    etat.createdAt = Date.now();
    etat.status = 'waiting';
    demarrer(etat);
    localDb.set(localDb.ref(localDb.db, `${jeu}/${CODE_LOCAL}`), etat).then(() => {
      voileAuDebut = true;
      entrer(CODE_LOCAL, 0);
    });
  }

  function gererTourLocal(s) {
    dernierEtat = s;
    const cible = quiDoitJouer ? quiDoitJouer(s) : -1;
    if (relais.voileVisible()) return; // le jeu s'affichera quand la bonne personne aura le téléphone

    if (cible >= 0 && (voileAuDebut || (secret && cible !== place))) {
      if (voileAuDebut) {
        voileAuDebut = false;
        montrerVoile(cible);
        return;
      }
      afficher(s, place);
      relais.barre(s.players[cible].name, () => montrerVoile(cible));
      return;
    }
    relais.cacherBarre();
    if (cible >= 0) place = cible;
    ecrireSession({ code, place, local });
    afficher(s, place);
  }

  function montrerVoile(cible) {
    relais.cacherBarre();
    relais.voile(dernierEtat.players[cible].name, () => {
      place = cible;
      ecrireSession({ code, place, local });
      afficher(dernierEtat, place);
    });
  }

  function lancer() {
    agir((s) => {
      if (s.status !== 'waiting' || !s.players.every((j) => j.joined)) return false;
      demarrer(s);
    });
  }

  function quitter() {
    if (arreterEcoute) arreterEcoute();
    arreterEcoute = null;
    code = null;
    place = null;
    if (relais) { relais.cacherBarre(); }
    if (!local) ecrireSession(null); // une partie sur ce téléphone reste disponible
    afficherReprendre();
    montrer('lobby');
  }

  // Toute action de jeu passe par une transaction : l'état du serveur fait foi.
  // fn modifie l'état ; si elle renvoie false, rien n'est écrit.
  function agir(fn) {
    if (!code || !api) return Promise.resolve();
    return api.runTransaction(api.ref(api.db, `${jeu}/${code}`), (s) => {
      if (!s) return s;
      s.players = s.players || [];
      return fn(s) === false ? undefined : s;
    }).catch((err) => toast(messageErreur(err), true));
  }

  ui.creer.addEventListener('click', creer);
  ui.rejoindre.addEventListener('click', () => rejoindre(ui.codeInput.value.trim().toUpperCase()));
  ui.codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') ui.rejoindre.click(); });
  ui.reprendre.addEventListener('click', async () => {
    const s = lireSession();
    if (!s) return;
    if (s.local) {
      passerEnLocal();
      voileAuDebut = true;
      entrer(CODE_LOCAL, s.place || 0);
      return;
    }
    try {
      await passerEnLigne();
      entrer(s.code, s.place);
    } catch (err) {
      toast(messageErreur(err), true);
    }
  });
  ui.local.addEventListener('click', commencerLocal);
  ui.quitter.addEventListener('click', () => {
    const message = local
      ? 'Revenir au menu ? La partie reste enregistrée sur ce téléphone.'
      : 'Quitter ce salon ? Tu pourras revenir avec le même code et le même pseudo.';
    if (confirm(message)) quitter();
  });

  montrer('lobby');
  return { agir, estLocal: () => local };
}
