// Configuration Firebase partagée par tous les jeux (UNO, Bataille navale, Skyjo).
// Base utilisée : Realtime Database (région europe-west1).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, set, get, onValue, update, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCxlp7cztNKLDcQ54IjM3UiYTT6DUimLzw",
  authDomain: "uno-multi-5a1a0.firebaseapp.com",
  databaseURL: "https://uno-multi-5a1a0-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "uno-multi-5a1a0",
  storageBucket: "uno-multi-5a1a0.firebasestorage.app",
  messagingSenderId: "956811588613",
  appId: "1:956811588613:web:97469aa5e327949292186c",
  measurementId: "G-2J3SMK4YER"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, set, get, onValue, update, runTransaction };

// Le script UNO (non-module) lit ces deux variables globales.
// En mode « sur ce téléphone », il utilise la base locale : on ne l'écrase pas.
if (!window.modeLocal) {
  window.db = db;
  window.firebaseRefs = { ref, set, onValue, update, runTransaction };
}
