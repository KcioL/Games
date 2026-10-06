const COLORS = ['red', 'blue', 'green', 'yellow'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '⊘', '⇄', '+2'];

let deck = [];
let discardPile = [];
let players = [];
let activePlayerIndex = 0;
let playDirection = 1;
let currentColor = '';

// Nouveaux états
let roomCode = '';
let myPlayerId = 0;
let isOnline = false;
let gameStatus = 'waiting';
let winner = null;
let unoVulnerablePlayer = null; 
let actionLocked = false; 
let drawPenalty = 0; // Cumul des +2 / +4
let hasDrawnThisTurn = false; // Retient si on a pioché

// --- Anti "clic fantôme" et anti double-clic sur UNO / Contre UNO ---
let uiClickGuardUntil = 0;   // aucune action de jeu acceptée avant cette date
let contreHandledFor = null; // j'ai déjà contré ce joueur, ne pas réafficher le bouton
let unoSaidFor = null;       // j'ai déjà annoncé UNO pour ce tour
let lastEvent = null;        // message partagé (ex: "X a été contré")
let shownEventTs = null;
let firstSyncDone = false;

// DOM Elements
const playerNameInput = document.getElementById('player-name-input');
const lobbyControls = document.getElementById('lobby-controls');
const roomInfo = document.getElementById('room-info');
const displayRoomCode = document.getElementById('display-room-code');
const roomCodeInput = document.getElementById('room-code-input');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const selectMaxPlayers = document.getElementById('select-max-players');

const elOpponents = document.getElementById('opponents-container');
const elDrawPile = document.getElementById('draw-pile');
const elDiscardPile = document.getElementById('discard-pile');
const elActiveHand = document.getElementById('active-hand');
const elActivePlayerName = document.getElementById('active-player-name');
const elTurnIndicator = document.getElementById('turn-indicator');
const colorPickerOverlay = document.getElementById('color-picker-overlay');

// Écrans dynamiques
const btnUno = document.createElement('button');
btnUno.className = 'uno-btn';
btnUno.textContent = 'UNO\u00a0!';
document.body.appendChild(btnUno);

const btnContre = document.createElement('button');
btnContre.className = 'contre-uno-btn';
btnContre.textContent = 'Contre UNO !';
document.body.appendChild(btnContre);

const winScreen = document.createElement('div');
winScreen.className = 'win-overlay hidden';
winScreen.innerHTML = `
  <div id="win-text"></div>
  <button id="btn-replay" style="margin-top: 40px; padding: 15px 30px; font-size: 24px; font-weight: bold; cursor: pointer; border-radius: 10px; border: none; background: #2ecc71; color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">Rejouer la partie</button>
`;
document.body.appendChild(winScreen);

// Message flottant (remplace les alert() bloquants)
const toastEl = document.createElement('div');
toastEl.className = 'uno-toast';
document.body.appendChild(toastEl);
let toastTimer = null;
function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 3500);
}

// --- Panneau d'annonce façon jeu (Contre UNO / UNO) ---
const announceEl = document.createElement('div');
announceEl.className = 'game-announce';
document.body.appendChild(announceEl);
let announceTimer = null;

// Crée un élément texte (les pseudos sont insérés en texte brut, jamais en HTML)
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// Construit une phrase avec les pseudos mis en valeur : parts = ['texte', {name: 'Paul'}, 'texte']
function sentence(parts) {
  const p = el('p', 'ga-message');
  parts.forEach(part => {
    if (typeof part === 'string') p.appendChild(document.createTextNode(part));
    else p.appendChild(el('span', 'ga-name', part.name));
  });
  return p;
}

function showAnnouncement({ variant, title, message, card }) {
  announceEl.innerHTML = '';
  announceEl.className = 'game-announce ' + variant;

  const panel = el('div', 'ga-panel');
  panel.appendChild(el('div', 'ga-title', title));
  const body = el('div', 'ga-body');
  if (card) body.appendChild(el('div', 'ga-card', card));
  body.appendChild(message);
  panel.appendChild(body);
  announceEl.appendChild(panel);

  // Relance l'animation même si un panneau est déjà affiché
  void announceEl.offsetWidth;
  announceEl.classList.add('visible');
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => announceEl.classList.remove('visible'), 3200);
}

// Affiche l'événement partagé, adapté selon qu'on est celui qui a cliqué,
// celui qui est visé, ou un autre joueur.
function showGameEvent(ev) {
  if (!ev) return;
  if (ev.type === 'contre') {
    if (ev.by === myPlayerId) {
      showAnnouncement({ variant: 'ga-self', title: 'CONTRE UNO\u00a0!', card: '+2',
        message: sentence(['Bien vu ! ', { name: ev.targetName }, ' pioche 2 cartes.']) });
    } else if (ev.target === myPlayerId) {
      showAnnouncement({ variant: 'ga-victim', title: 'CONTRÉ\u00a0!', card: '+2',
        message: sentence([{ name: ev.byName }, ' t\'a contré. Tu pioches 2 cartes\u00a0!']) });
    } else {
      showAnnouncement({ variant: 'ga-other', title: 'CONTRE UNO\u00a0!', card: '+2',
        message: sentence([{ name: ev.byName }, ' a contré ', { name: ev.targetName }, ' qui pioche 2 cartes.']) });
    }
    return;
  }
  if (ev.type === 'uno') {
    const isMe = ev.by === myPlayerId;
    showAnnouncement({ variant: 'ga-uno', title: 'UNO\u00a0!', card: '1',
      message: isMe ? sentence(['Tu es protégé\u00a0!'])
                    : sentence([{ name: ev.byName }, ' n\'a plus qu\'une carte\u00a0!']) });
    return;
  }
  showToast(ev.text);
}

// Neutralise le plateau pendant un court instant après un clic sur UNO / Contre UNO.
// Sans ça, le tap "traverse" vers la pioche située juste en dessous du bouton.
function guardBoard(ms = 800) {
  uiClickGuardUntil = Date.now() + ms;
  elDrawPile.style.pointerEvents = 'none';
  setTimeout(() => { elDrawPile.style.pointerEvents = ''; }, ms);
}

// Place le bouton à un endroit aléatoire MAIS jamais au-dessus de la pioche,
// de la défausse ou de la main du joueur.
function placeButtonSafely(btn) {
  btn.style.bottom = 'auto';
  btn.style.right = 'auto';
  btn.style.transform = 'none';
  btn.style.visibility = 'hidden';
  btn.style.display = 'block';

  const bw = btn.offsetWidth || 160;
  const bh = btn.offsetHeight || 60;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Zones interdites
  const forbidden = [];
  const center = document.querySelector('.center-table');
  if (center) {
    const r = center.getBoundingClientRect();
    forbidden.push({ left: r.left - 25, top: r.top - 25, right: r.right + 25, bottom: r.bottom + 25 });
  }
  const hand = document.getElementById('active-hand');
  if (hand) {
    const r = hand.getBoundingClientRect();
    forbidden.push({ left: 0, top: r.top - 20, right: vw, bottom: vh });
  }
  const header = document.querySelector('.game-header');
  if (header) {
    const r = header.getBoundingClientRect();
    forbidden.push({ left: 0, top: 0, right: vw, bottom: r.bottom + 10 });
  }

  const maxLeft = Math.max(10, vw - bw - 10);
  const maxTop = Math.max(10, vh - bh - 10);

  const collides = (l, t) => forbidden.some(z =>
    !(l + bw < z.left || l > z.right || t + bh < z.top || t > z.bottom)
  );

  let left = 10, top = 10, placed = false;
  for (let i = 0; i < 80; i++) {
    const l = Math.random() * maxLeft;
    const t = Math.random() * maxTop;
    if (!collides(l, t)) { left = l; top = t; placed = true; break; }
  }
  if (!placed) {
    // Repli : coin haut-gauche, sous le header
    const headerBottom = header ? header.getBoundingClientRect().bottom + 10 : 10;
    left = 10;
    top = Math.min(headerBottom, maxTop);
  }

  btn.style.left = Math.round(left) + 'px';
  btn.style.top = Math.round(top) + 'px';
  btn.style.visibility = 'visible';
}

// Pioche appliquée directement sur l'état SERVEUR (utilisé dans les transactions)
function drawIntoHand(state, playerIdx, count) {
  if (!state.players || !state.players[playerIdx]) return 0;
  const p = state.players[playerIdx];
  if (!p.hand) p.hand = [];
  if (!state.deck) state.deck = [];
  if (!state.discardPile) state.discardPile = [];

  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) {
      if (state.discardPile.length <= 1) break;
      const top = state.discardPile.pop();
      state.deck = state.discardPile;
      state.discardPile = [top];
      state.deck.forEach(c => { if (c.value === '\u{1F3A8}' || c.value === '+4') c.color = 'black'; });
      state.deck.sort(() => Math.random() - 0.5);
    }
    if (state.deck.length > 0) { p.hand.push(state.deck.pop()); drawn++; }
  }
  return drawn;
}

// Boutons UNO & Rejouer
// IMPORTANT : ces deux boutons peuvent être cliqués par n'importe qui, à n'importe
// quel moment, y compris pendant le tour d'un autre joueur. Ils DOIVENT donc passer
// par une transaction : on modifie l'état du serveur, jamais notre copie locale.
btnUno.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  guardBoard(900);

  if (!isOnline || unoVulnerablePlayer !== myPlayerId) return;

  unoSaidFor = myPlayerId;
  btnUno.style.display = 'none';
  btnUno.dataset.active = "false";

  const { ref, runTransaction } = window.firebaseRefs;
  if (!runTransaction) { console.error("runTransaction manquant : mets à jour index.html"); return; }

  runTransaction(ref(window.db, 'uno/' + roomCode), (state) => {
    if (!state) return state;
    // Quelqu'un m'a contré entre-temps : on abandonne, sa version fait foi.
    if (state.unoVulnerablePlayer !== myPlayerId) return;
    state.unoVulnerablePlayer = null;
    state.majAt = Date.now();
    const me = state.players && state.players[myPlayerId];
    const myName = me ? me.name : 'Un joueur';
    state.lastEvent = { ts: Date.now(), type: 'uno', by: myPlayerId, byName: myName, text: `${myName} a annoncé UNO !` };
    return state;
  }).then(() => {
    guardBoard(250);
    elTurnIndicator.textContent = "Tu as annoncé UNO ! Tu es protégé.";
  }).catch(err => console.error('UNO :', err));
});

btnContre.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  guardBoard(900);

  if (!isOnline) return;

  const seen = unoVulnerablePlayer;
  if (seen === null || seen === undefined || seen === myPlayerId) return;

  // On masque tout de suite : évite un second clic pendant l'aller-retour réseau
  contreHandledFor = seen;
  btnContre.style.display = 'none';
  btnContre.dataset.active = "false";

  const { ref, runTransaction } = window.firebaseRefs;
  if (!runTransaction) { console.error("runTransaction manquant : mets à jour index.html"); return; }

  runTransaction(ref(window.db, 'uno/' + roomCode), (state) => {
    if (!state) return state;

    const targetId = state.unoVulnerablePlayer;
    // Déjà contré, ou le joueur a annoncé UNO à temps : on abandonne.
    if (targetId === null || targetId === undefined) return;
    // Garde-fou absolu : on ne se punit jamais soi-même.
    if (targetId === myPlayerId) return;
    if (!state.players || !state.players[targetId]) return;

    drawIntoHand(state, targetId, 2);
    state.unoVulnerablePlayer = null;
    const contreur = state.players[myPlayerId];
    const contreurName = contreur ? contreur.name : 'Un joueur';
    const targetName = state.players[targetId].name;
    state.lastEvent = {
      ts: Date.now(),
      type: 'contre',
      by: myPlayerId,
      byName: contreurName,
      target: targetId,
      targetName: targetName,
      text: `Contre UNO ! ${contreurName} a contré ${targetName}, qui pioche 2 cartes.`
    };
    return state;
  }).then((result) => {
    guardBoard(250);
    if (result && result.committed === false) {
      showToast("Trop tard, quelqu'un a été plus rapide !");
    }
  }).catch(err => console.error('Contre UNO :', err));
});

document.getElementById('btn-replay').addEventListener('click', () => {
  if (myPlayerId === 0 || modeLocal) {
    // Seul l'hôte (ou n'importe qui en mode un seul téléphone) génère la nouvelle partie et tire au sort !
    startOnlineGameFromFirebase(players);
  } else {
    alert("Seul l'hôte (Joueur 1) peut relancer la partie !");
    elTurnIndicator.textContent = "En attente de l'hôte pour rejouer...";
  }
});

// Salons Firebase
btnCreateRoom.addEventListener('click', () => {
  roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  myPlayerId = 0;
  isOnline = true;

  const myName = playerNameInput.value.trim() || 'Hôte';
  const maxPlayers = parseInt(selectMaxPlayers.value);
  let initialPlayers = [];
  for (let i = 0; i < maxPlayers; i++) {
    initialPlayers.push({ 
      id: i, 
      name: (i === 0) ? myName : 'En attente...', 
      hand: [], 
      joined: (i === 0) 
    });
  }

  const initialGameState = {
    status: 'waiting',
    activePlayerIndex: 0,
    playDirection: 1,
    currentColor: 'red',
    deck: [],
    discardPile: [],
    players: initialPlayers,
    winner: null,
    unoVulnerablePlayer: null,
    drawPenalty: 0,
    createdAt: Date.now(),
    majAt: Date.now() // dernière activité (les salons inactifs plus de 24 h sont supprimés)
  };

  const { ref, set } = window.firebaseRefs;
  set(ref(window.db, 'uno/' + roomCode), initialGameState).then(() => {
    lobbyControls.classList.add('hidden');
    roomInfo.classList.remove('hidden');
    displayRoomCode.textContent = roomCode;
    elTurnIndicator.textContent = `Salon créé ! En attente des joueurs (1/${maxPlayers})...`;
    listenToRoom();
  });
});

btnJoinRoom.addEventListener('click', () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  if (code.length !== 4) return alert("Entre un code à 4 lettres.");

  roomCode = code;
  isOnline = true;

  const { ref, onValue, update } = window.firebaseRefs;
  onValue(ref(window.db, 'uno/' + roomCode), (snapshot) => {
    const data = snapshot.val();
    if (!data) return alert("Ce salon n'existe pas !");

    if (data.status === 'waiting') {
      let assignedId = -1;
      for (let i = 0; i < data.players.length; i++) {
        if (!data.players[i].joined) { assignedId = i; break; }
      }

      if (assignedId === -1) return alert("Le salon est complet !");
      myPlayerId = assignedId;
      
      const myName = playerNameInput.value.trim() || `Joueur ${myPlayerId + 1}`;
      data.players[myPlayerId].joined = true;
      data.players[myPlayerId].name = myName;

      update(ref(window.db, 'uno/' + roomCode), { players: data.players, majAt: Date.now() });

      lobbyControls.classList.add('hidden');
      roomInfo.classList.remove('hidden');
      displayRoomCode.textContent = roomCode;

      if (data.players.every(p => p.joined)) {
        elTurnIndicator.textContent = "Connecté ! L'hôte lance la partie...";
      } else {
        elTurnIndicator.textContent = "Connecté ! En attente...";
      }
    } else {
      syncGameState(data);
    }
  }, { onlyOnce: true });

  listenToRoom();
});

function listenToRoom() {
  const { ref, onValue } = window.firebaseRefs;
  onValue(ref(window.db, 'uno/' + roomCode), (snapshot) => {
    const data = snapshot.val();
    if (data) {
      if (data.status === 'waiting') {
        const joinedCount = data.players.filter(p => p.joined).length;
        elTurnIndicator.textContent = `En attente des joueurs (${joinedCount}/${data.players.length})...`;
        if (data.players.every(p => p.joined) && myPlayerId === 0) {
          startOnlineGameFromFirebase(data.players);
        }
      } else {
        syncGameState(data);
      }
    }
  });
}

function updateFirebaseState() {
  if (!isOnline) return;

  const { ref, update } = window.firebaseRefs;
  update(ref(window.db, 'uno/' + roomCode), {
    majAt: Date.now(),
    status: gameStatus,
    activePlayerIndex: activePlayerIndex,
    playDirection: playDirection,
    currentColor: currentColor,
    deck: deck,
    discardPile: discardPile,
    players: players,
    winner: winner,
    unoVulnerablePlayer: unoVulnerablePlayer,
    drawPenalty: drawPenalty,
    lastEvent: lastEvent
  });
}

function syncGameState(data) {
  const oldDiscardLength = discardPile.length;
  const newDiscardLength = data.discardPile ? data.discardPile.length : 0;
  
  let opponentWhoPlayed = -1;
  let cardPlayedByOpponent = null;
  let opponentWhoDrew = -1;
  let cardsDrawn = 0;

  for (let i = 0; i < data.players.length; i++) {
    const oldHandSize = (players[i] && players[i].hand) ? players[i].hand.length : 0;
    const newHandSize = (data.players[i] && data.players[i].hand) ? data.players[i].hand.length : 0;
    
    if (newHandSize < oldHandSize && i !== myPlayerId) {
      opponentWhoPlayed = i;
      cardPlayedByOpponent = data.discardPile[data.discardPile.length - 1];
    } else if (newHandSize > oldHandSize && i !== myPlayerId) {
      opponentWhoDrew = i;
      cardsDrawn = newHandSize - oldHandSize;
    }
  }

  if (data.activePlayerIndex !== myPlayerId) {
    hasDrawnThisTurn = false;
  }

  gameStatus = data.status || 'waiting';
  activePlayerIndex = data.activePlayerIndex;
  playDirection = data.playDirection;
  currentColor = data.currentColor;
  deck = data.deck || [];
  discardPile = data.discardPile || [];
  players = data.players || [];
  winner = data.winner !== undefined ? data.winner : null;
  unoVulnerablePlayer = data.unoVulnerablePlayer !== undefined ? data.unoVulnerablePlayer : null;
  drawPenalty = data.drawPenalty || 0;
  lastEvent = data.lastEvent || null;

  // Le joueur puni (et les autres) sont prévenus de ce qui vient de se passer
  if (!firstSyncDone) {
    firstSyncDone = true;
    shownEventTs = data.lastEvent ? data.lastEvent.ts : null;
  } else if (data.lastEvent && data.lastEvent.ts !== shownEventTs) {
    shownEventTs = data.lastEvent.ts;
    showGameEvent(data.lastEvent);
  }

  renderTable();

  if (opponentWhoPlayed !== -1 && cardPlayedByOpponent) {
    const fromEl = document.getElementById(`opponent-zone-${opponentWhoPlayed}`);
    const toEl = document.getElementById('discard-pile');
    if (fromEl && toEl) {
      const topCardEl = toEl.lastChild;
      if (topCardEl) topCardEl.style.opacity = '0'; 
      animateCardFlight(fromEl, toEl, cardPlayedByOpponent, () => {
        if (topCardEl) topCardEl.style.opacity = '1';
      });
    }
  }

  if (opponentWhoDrew !== -1) {
    const toEl = document.getElementById(`opponent-zone-${opponentWhoDrew}`);
    const fromEl = document.getElementById('draw-pile');
    if (fromEl && toEl) {
      for(let k = 0; k < cardsDrawn; k++) {
        setTimeout(() => {
          animateCardFlight(fromEl, toEl, {color: 'back', value: ''});
        }, k * 150);
      }
    }
  }

  majIndicateurTour();
  if (modeLocal) majRelaisLocal();
}

function majIndicateurTour() {
  if (gameStatus === 'playing') {
    const currentPlayer = players[activePlayerIndex];
    let penText = '';
    
    if (drawPenalty > 0 && discardPile.length > 0) {
      const topCard = discardPile[discardPile.length - 1];
      const typeRequis = topCard.value === '+4' ? '+4' : '+2';
      penText = `<br><span style="color:#e74c3c; font-size:16px;">⚠️ PÉNALITÉ : +${drawPenalty} (Joue un ${typeRequis} ou pioche)</span>`;
    } 
    else if (hasDrawnThisTurn && activePlayerIndex === myPlayerId) {
      penText = `<br><span style="color:#f1c40f; font-size:16px;">💡 Carte jouable ! Joue-la, ou re-clique sur la pioche pour passer.</span>`;
    }
    
    if (activePlayerIndex === myPlayerId) {
      elTurnIndicator.innerHTML = `<span style="color: #2ecc71;">C'est à TON tour !</span> (Couleur : ${getFrenchColor(currentColor)})${penText}`;
    } else {
      elTurnIndicator.innerHTML = `Au tour ${deNom(currentPlayer.name)} (Couleur : ${getFrenchColor(currentColor)})${penText}`;
    }
  }
}

// Logique de Jeu UNO
function createDeck() {
  deck = [];
  COLORS.forEach(color => {
    deck.push({ color, value: '0' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, value: i.toString() }); deck.push({ color, value: i.toString() });
    }
    ['⊘', '⇄', '+2'].forEach(val => {
      deck.push({ color, value: val }); deck.push({ color, value: val });
    });
  });
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'black', value: '🎨' }); deck.push({ color: 'black', value: '+4' });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function drawCard(player, count = 1) {
  if (!player.hand) player.hand = [];
  
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      const topDiscard = discardPile.pop();
      deck = [...discardPile];
      discardPile = [topDiscard];
      deck.forEach(c => { if(c.value === '🎨' || c.value === '+4') c.color = 'black'; });
      deck.sort(() => Math.random() - 0.5);
    }
    if (deck.length > 0) {
      const newCard = deck.pop();
      newCard.isNew = true; 
      player.hand.push(newCard);
    }
  }
}

function isPlayable(card) {
  const topCard = discardPile[discardPile.length - 1];

  if (drawPenalty > 0) {
    if (topCard.value === '+2') return card.value === '+2';
    if (topCard.value === '+4') return card.value === '+4';
  }
  
  if (card.color === 'black') return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

function startOnlineGameFromFirebase(currentPlayersData) {
  createDeck();
  discardPile = [];
  playDirection = 1;
  
  activePlayerIndex = Math.floor(Math.random() * currentPlayersData.length);
  
  gameStatus = 'playing';
  winner = null;
  unoVulnerablePlayer = null;
  actionLocked = false;
  drawPenalty = 0;
  hasDrawnThisTurn = false;
  contreHandledFor = null;
  unoSaidFor = null;
  lastEvent = null;
  uiClickGuardUntil = 0;

  players = currentPlayersData;
  players.forEach(p => { p.hand = []; });
  players.forEach(p => drawCard(p, 7));

  let firstCard;
  do {
    firstCard = deck.pop();
    if (firstCard.color === 'black' || ['⊘', '⇄', '+2'].includes(firstCard.value)) {
      deck.unshift(firstCard);
    } else {
      discardPile.push(firstCard);
    }
  } while (discardPile.length === 0);

  currentColor = firstCard.color;
  updateFirebaseState();
}

function renderTable() {
  if (gameStatus === 'finished') {
    document.getElementById('win-text').innerHTML = `🎉 ${players[winner].name} a gagné ! 🎉`;
    winScreen.classList.remove('hidden');
    btnUno.style.display = 'none';
    btnContre.style.display = 'none';
    return;
  } else {
    winScreen.classList.add('hidden');
  }

  if (unoVulnerablePlayer !== null && unoVulnerablePlayer !== undefined) {
    if (unoVulnerablePlayer === myPlayerId) {
      btnContre.style.display = 'none';
      btnContre.dataset.active = "false";
      if (unoSaidFor === myPlayerId) {
        btnUno.style.display = 'none';
      } else if (btnUno.dataset.active !== "true") {
        placeButtonSafely(btnUno);
        btnUno.dataset.active = "true";
      }
    } else {
      btnUno.style.display = 'none';
      btnUno.dataset.active = "false";
      if (contreHandledFor === unoVulnerablePlayer) {
        // J'ai déjà contré ce joueur : on n'affiche pas une 2e fois le bouton
        btnContre.style.display = 'none';
      } else if (btnContre.dataset.active !== "true") {
        placeButtonSafely(btnContre);
        btnContre.dataset.active = "true";
      }
    }
  } else {
    btnUno.style.display = 'none';
    btnContre.style.display = 'none';
    btnUno.dataset.active = "false";
    btnContre.dataset.active = "false";
    contreHandledFor = null;
    unoSaidFor = null;
  }

  if (discardPile.length === 0) return;
  const topCard = discardPile[discardPile.length - 1];
  
  elDiscardPile.innerHTML = '';
  const cardEl = document.createElement('div');
  cardEl.className = `card ${currentColor === 'black' ? topCard.color : currentColor}`;
  cardEl.innerHTML = `<span>${topCard.value}</span>`;
  elDiscardPile.appendChild(cardEl);

  elOpponents.innerHTML = '';
  
  const numOpponents = players.length - 1;
  let positions = [];
  if (numOpponents === 1) positions = ['pos-top'];
  else if (numOpponents === 2) positions = ['pos-left', 'pos-right'];
  else if (numOpponents === 3) positions = ['pos-left', 'pos-top', 'pos-right'];
  else if (numOpponents === 4) positions = ['pos-left', 'pos-top-left', 'pos-top-right', 'pos-right'];
  else if (numOpponents === 5) positions = ['pos-left', 'pos-top-left', 'pos-top', 'pos-top-right', 'pos-right'];

  for (let i = 1; i <= numOpponents; i++) {
    const oppIndex = (myPlayerId + i) % players.length;
    const p = players[oppIndex];
    const posClass = positions[i - 1];

    const oppZone = document.createElement('div');
    oppZone.className = `opponent-zone ${posClass}`;
    oppZone.id = `opponent-zone-${oppIndex}`; 
    
    const nameEl = document.createElement('div');
    nameEl.className = 'opponent-name';
    
    if (activePlayerIndex === oppIndex) {
      nameEl.style.color = '#f1c40f';
      nameEl.style.border = '2px solid #f1c40f';
      nameEl.textContent = `▶ ${p.name} (${p.hand ? p.hand.length : 0})`;
    } else {
      nameEl.textContent = `${p.name} (${p.hand ? p.hand.length : 0})`;
    }
    
    const handEl = document.createElement('div');
    handEl.className = 'opponent-hand';
    
    if (p.hand) {
      p.hand.forEach((c) => {
        const cEl = document.createElement('div');
        cEl.className = 'card back';
        handEl.appendChild(cEl);
      });
    }
    
    oppZone.appendChild(nameEl);
    oppZone.appendChild(handEl);
    elOpponents.appendChild(oppZone);
  }

  const myPlayer = players[myPlayerId];
  if (!myPlayer || !myPlayer.hand) return;

  elActivePlayerName.textContent = `${myPlayer.name} (Toi)`;
  elActiveHand.innerHTML = '';
  
  myPlayer.hand.forEach((card, index) => {
    const cEl = document.createElement('div');
    const isMyTurn = (activePlayerIndex === myPlayerId);
    const playable = isMyTurn && isPlayable(card);
    
    cEl.className = `card ${card.color} ${!playable ? 'unplayable' : ''}`;
    cEl.innerHTML = `<span>${card.value}</span>`;
    
    cEl.addEventListener('click', () => {
      if (Date.now() < uiClickGuardUntil) return;
      if (isMyTurn && isPlayable(card)) {
        playCard(index);
      }
    });
    elActiveHand.appendChild(cEl);
  });
}

// Fonction d'Animation (100% gérée en JS, sans CSS !)
function animateCardFlight(fromElement, toElement, cardData, onComplete) {
  if (!fromElement || !toElement) {
    if (onComplete) onComplete();
    return;
  }

  const startRect = fromElement.getBoundingClientRect();
  const endRect = toElement.getBoundingClientRect();

  const dx = startRect.left - endRect.left;
  const dy = startRect.top - endRect.top;

  const flyer = document.createElement('div');
  flyer.className = `card ${cardData.color === 'black' ? 'black' : cardData.color}`;
  if (cardData.color === 'back') {
    flyer.className = 'card back'; 
  }
  flyer.innerHTML = cardData.value ? `<span>${cardData.value}</span>` : '';
  
  flyer.style.position = 'fixed';
  flyer.style.left = `${endRect.left}px`;
  flyer.style.top = `${endRect.top}px`;
  flyer.style.zIndex = '9999';
  flyer.style.pointerEvents = 'none'; 
  flyer.style.margin = '0';

  document.body.appendChild(flyer);

  const animation = flyer.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(1)` }, 
    { transform: `translate(0px, 0px) scale(1)` }          
  ], {
    duration: 400, 
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' 
  });

  animation.onfinish = () => {
    flyer.remove();
    if (onComplete) onComplete();
  };
}

elDrawPile.addEventListener('click', () => {
  // Ignore le clic si on vient de cliquer sur UNO / Contre UNO (clic fantôme mobile)
  if (Date.now() < uiClickGuardUntil) return;
  if (!isOnline || activePlayerIndex !== myPlayerId || actionLocked) return;

  if (hasDrawnThisTurn) {
    hasDrawnThisTurn = false;
    activePlayerIndex = (activePlayerIndex + playDirection + players.length) % players.length;
    updateFirebaseState();
    return;
  }

  actionLocked = true;
  const currentPlayer = players[myPlayerId];
  
  const deckEl = document.getElementById('draw-pile');
  const handEl = document.getElementById('active-hand');
  const dummyCard = { color: 'back', value: '' };

  let cardsToDraw = drawPenalty > 0 ? drawPenalty : 1;

  animateCardFlight(deckEl, handEl, dummyCard, () => {
    drawCard(currentPlayer, cardsToDraw);
    
    if (unoVulnerablePlayer === myPlayerId) {
      unoVulnerablePlayer = null;
    }

    if (drawPenalty > 0) {
      drawPenalty = 0; 
      activePlayerIndex = (activePlayerIndex + playDirection + players.length) % players.length;
      updateFirebaseState();
      actionLocked = false;
    } else {
      const drawnCard = currentPlayer.hand[currentPlayer.hand.length - 1];
      if (isPlayable(drawnCard)) {
        hasDrawnThisTurn = true;
        updateFirebaseState(); 
        actionLocked = false;
      } else {
        activePlayerIndex = (activePlayerIndex + playDirection + players.length) % players.length;
        updateFirebaseState();
        actionLocked = false;
      }
    }
  });
});

function playCard(cardIndex) {
  if (actionLocked) return;
  actionLocked = true;
  hasDrawnThisTurn = false;

  const currentPlayer = players[myPlayerId];
  const cardToPlay = currentPlayer.hand[cardIndex];

  const cardElements = document.querySelectorAll('#active-hand .card');
  const selectedCardEl = cardElements[cardIndex];
  const discardEl = document.getElementById('discard-pile');

  animateCardFlight(selectedCardEl, discardEl, cardToPlay, () => {
    const card = currentPlayer.hand.splice(cardIndex, 1)[0];
    discardPile.push(card);
    currentColor = card.color;

    if (currentPlayer.hand.length === 1) {
      unoVulnerablePlayer = myPlayerId;
    } else if (unoVulnerablePlayer === myPlayerId) {
      unoVulnerablePlayer = null;
    }

    if (currentPlayer.hand.length === 0) {
      gameStatus = 'finished';
      winner = myPlayerId;
      updateFirebaseState();
      actionLocked = false;
      return;
    }

    actionLocked = false;
    if (card.color === 'black') {
      colorPickerOverlay.classList.remove('hidden');
      window.pendingCardValue = card.value;
    } else {
      applySpecialEffects(card.value);
    }
  });
}

document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    currentColor = e.target.getAttribute('data-color');
    colorPickerOverlay.classList.add('hidden');
    applySpecialEffects(window.pendingCardValue);
  });
});

function applySpecialEffects(cardValue) {
  let skipNext = false;
  const nextPlayerIdx = (activePlayerIndex + playDirection + players.length) % players.length;
  
  if (cardValue === '⇄') {
    if (players.length === 2) skipNext = true;
    else playDirection *= -1;
  } else if (cardValue === '⊘') {
    skipNext = true;
  } else if (cardValue === '+2') {
    drawPenalty += 2; 
  } else if (cardValue === '+4') {
    drawPenalty += 4; 
  }

  let steps = skipNext ? 2 : 1;
  activePlayerIndex = (activePlayerIndex + (playDirection * steps) + players.length) % players.length;

  updateFirebaseState();
}

// « de Léa », mais « d'Emma »
function deNom(nom) {
  return /^[aeiouàâäéèêëîïôöùûüœ]/i.test(nom) ? `d'${nom}` : `de ${nom}`;
}

function getFrenchColor(color) {
  const dict = { red: 'Rouge', blue: 'Bleu', green: 'Vert', yellow: 'Jaune', black: 'Couleur' };
  return dict[color] || color;
}


// =====================================================================
// MODE « SUR CE TÉLÉPHONE » : un seul appareil qu'on se passe, sans internet.
// La partie utilise une base locale (même fonctionnement que Firebase) ;
// myPlayerId devient « la personne qui tient le téléphone ».
// =====================================================================
let modeLocal = false;
let voileAuDebut = false;

const localOverlay = document.getElementById('local-overlay');
const localNb = document.getElementById('local-nb');
const localNoms = document.getElementById('local-noms');
const btnLocal = document.getElementById('btn-local');
const btnReprendreLocal = document.getElementById('btn-reprendre-local');

function construireNomsLocaux() {
  const anciens = [...localNoms.querySelectorAll('input')].map(i => i.value);
  localNoms.innerHTML = '';
  const n = parseInt(localNb.value, 10);
  for (let i = 0; i < n; i++) {
    const input = document.createElement('input');
    input.maxLength = 16;
    input.placeholder = `Joueur ${i + 1}`;
    input.setAttribute('aria-label', `Nom du joueur ${i + 1}`);
    input.value = anciens[i] !== undefined ? anciens[i] : (i === 0 ? playerNameInput.value.trim() : '');
    localNoms.appendChild(input);
  }
}

btnLocal.addEventListener('click', () => {
  localNb.value = selectMaxPlayers.value;
  construireNomsLocaux();
  localOverlay.classList.remove('hidden');
  const premier = localNoms.querySelector('input');
  if (premier) premier.focus();
});
localNb.addEventListener('change', construireNomsLocaux);
document.getElementById('local-annuler').addEventListener('click', () => localOverlay.classList.add('hidden'));
document.getElementById('local-go').addEventListener('click', () => {
  const noms = [...localNoms.querySelectorAll('input')].map((i, k) => i.value.trim() || `Joueur ${k + 1}`);
  noms.forEach((n, k) => { if (noms.indexOf(n) !== k) noms[k] = `${n} ${k + 1}`; });
  localOverlay.classList.add('hidden');
  lancerPartieLocale(noms);
});

function activerModeLocal() {
  if (!window.localDB || !window.relais) {
    alert("Le mode sur ce téléphone n'est pas encore chargé, réessaie dans une seconde.");
    return false;
  }
  modeLocal = true;
  window.modeLocal = true;
  window.db = window.localDB.db;
  window.firebaseRefs = window.localDB;
  roomCode = 'LOCAL';
  isOnline = true;
  lobbyControls.classList.add('hidden');
  roomInfo.classList.remove('hidden');
  roomInfo.textContent = 'Sur ce téléphone';
  return true;
}

function lancerPartieLocale(noms) {
  if (!activerModeLocal()) return;
  myPlayerId = 0;
  const joueurs = noms.map((name, i) => ({ id: i, name, hand: [], joined: true }));
  const { ref, set } = window.firebaseRefs;
  set(ref(window.db, 'uno/LOCAL'), {
    status: 'waiting', activePlayerIndex: 0, playDirection: 1, currentColor: 'red',
    deck: [], discardPile: [], players: joueurs, winner: null,
    unoVulnerablePlayer: null, drawPenalty: 0, createdAt: Date.now()
  }).then(() => {
    voileAuDebut = true;
    listenToRoom(); // l'état « waiting » avec tout le monde présent lance la partie
  });
}

// Reprendre une partie locale enregistrée (après un rechargement de la page)
document.addEventListener('DOMContentLoaded', () => {
  const partie = window.localDB && window.localDB.lireMaintenant('uno/LOCAL');
  if (partie && partie.status !== 'waiting') btnReprendreLocal.hidden = false;
});
btnReprendreLocal.addEventListener('click', () => {
  const partie = window.localDB.lireMaintenant('uno/LOCAL');
  if (!partie || !activerModeLocal()) return;
  myPlayerId = partie.activePlayerIndex || 0;
  voileAuDebut = true;
  listenToRoom();
});

// Après chaque coup : si c'est à quelqu'un d'autre, on propose de passer le téléphone.
// Le joueur garde son jeu à l'écran le temps d'appuyer sur UNO s'il le faut.
function majRelaisLocal() {
  const relais = window.relais;
  if (gameStatus !== 'playing') { relais.cacherBarre(); return; }
  if (relais.voileVisible()) return;
  const cible = activePlayerIndex;
  if (voileAuDebut) {
    voileAuDebut = false;
    montrerVoileLocal(cible);
    return;
  }
  if (cible === myPlayerId) { relais.cacherBarre(); return; }
  const message = unoVulnerablePlayer === myPlayerId && unoSaidFor !== myPlayerId
    ? "Plus qu'une carte : n'oublie pas UNO !"
    : 'Ton tour est fini.';
  relais.barre(players[cible].name, () => montrerVoileLocal(cible), message);
}

function montrerVoileLocal(cible) {
  window.relais.cacherBarre();
  btnUno.style.display = 'none';
  btnContre.style.display = 'none';
  window.relais.voile(players[cible].name, () => {
    myPlayerId = cible;
    hasDrawnThisTurn = false;
    btnUno.dataset.active = 'false';
    btnContre.dataset.active = 'false';
    contreHandledFor = null;
    unoSaidFor = null;
    renderTable();
    majIndicateurTour();
  });
}
