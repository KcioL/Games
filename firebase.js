// Configuration Firebase partagée par tous les jeux (UNO, Bataille navale, Skyjo).
// Base utilisée : Realtime Database du projet games-12f19.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, set, get, onValue, update, runTransaction, query, orderByChild, endAt, remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { nettoyerVieuxSalons } from './commun/nettoyage.js';

const firebaseConfig = {
  apiKey: "AIzaSyBSIgd6macNEApb4U9UuFssu01d5hvW41c",
  authDomain: "games-12f19.firebaseapp.com",
  // Adresse de la Realtime Database : à vérifier dans la console Firebase
  // (Realtime Database > onglet Données, l'adresse est affichée en haut).
  databaseURL: "https://games-12f19-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "games-12f19",
  storageBucket: "games-12f19.firebasestorage.app",
  messagingSenderId: "959159505386",
  appId: "1:959159505386:web:1180fb72fce754b8ae6293"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, set, get, onValue, update, runTransaction, query, orderByChild, endAt, remove };

// Ménage : les salons inactifs depuis plus de 24 h sont supprimés (sans gêner le jeu)
setTimeout(() => nettoyerVieuxSalons({ db, ref, get, query, orderByChild, endAt, remove }), 3000);

// Le script UNO (non-module) lit ces deux variables globales.
// En mode « sur ce téléphone », il utilise la base locale : on ne l'écrase pas.
if (!window.modeLocal) {
  window.db = db;
  window.firebaseRefs = { ref, set, onValue, update, runTransaction };
}
