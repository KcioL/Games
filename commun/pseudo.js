// Pseudo du joueur, demandé avant les jeux où il apparaît dans les résultats (Sutom, Pédantix, Cémantix).
// Le même pseudo sert à tous les jeux du site (rangé dans ce téléphone, comme celui des salons en ligne).
import { EXEMPLE_PSEUDO } from './perso.js';

export const CLE_PSEUDO = 'jeux-vol:pseudo';
const INTERDITS = /^(joueur|player|invite|anonyme|test)\s*\d*$/i;

// Un pseudo valable : 2 à 16 caractères, pas « Joueur 1 »
export function pseudoValide(nom) {
  const n = String(nom || '').replace(/\s+/g, ' ').trim();
  return n.length >= 2 && n.length <= 16 && !INTERDITS.test(n);
}
export function pseudoActuel() {
  try { const n = (localStorage.getItem(CLE_PSEUDO) || '').trim(); return pseudoValide(n) ? n : ''; } catch (e) { return ''; }
}
function enregistrer(nom) {
  try { localStorage.setItem(CLE_PSEUDO, nom); } catch (e) { /* stockage indisponible : gardé pour cette page */ }
  memoire = nom;
  document.dispatchEvent(new CustomEvent('pseudo-change', { detail: nom }));
}
let memoire = '';
export const pseudo = () => pseudoActuel() || memoire;

// Fenêtre « Ton pseudo » ; renvoie le pseudo choisi, ou '' si on ferme sans valider
export function demanderPseudo(message = 'Il apparaît dans les résultats de la partie (nombre d’essais, temps…).') {
  return new Promise((resoudre) => {
    const d = document.createElement('dialog');
    d.className = 'regles dialogue-pseudo';
    d.innerHTML = `<form method="dialog">
        <h2>Ton pseudo</h2>
        <p></p>
        <input class="champ-pseudo" maxlength="16" autocomplete="nickname" required>
        <p class="erreur-pseudo" hidden>Choisis un pseudo de 2 à 16 caractères (pas « Joueur 1 »).</p>
        <div class="actions-pseudo">
          <button type="button" class="btn annuler-pseudo">Annuler</button>
          <button type="submit" class="btn btn-principal">C’est moi</button>
        </div>
      </form>`;
    d.querySelector('p').textContent = message;
    const champ = d.querySelector('.champ-pseudo');
    champ.placeholder = `Ex : ${EXEMPLE_PSEUDO || 'Léa'}`;
    champ.value = pseudo();
    let fini = false;
    const finir = (valeur) => { if (fini) return; fini = true; d.close(); d.remove(); resoudre(valeur); };
    d.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const n = champ.value.replace(/\s+/g, ' ').trim();
      if (!pseudoValide(n)) { d.querySelector('.erreur-pseudo').hidden = false; champ.focus(); return; }
      enregistrer(n);
      finir(n);
    });
    d.querySelector('.annuler-pseudo').addEventListener('click', () => finir(''));
    d.addEventListener('cancel', (e) => { e.preventDefault(); finir(''); });
    document.body.appendChild(d);
    d.showModal();
    champ.focus();
  });
}

// Le pseudo, demandé s'il manque. Renvoie '' si le joueur a refusé.
export async function assurerPseudo(message) {
  return pseudo() || demanderPseudo(message);
}

// Bandeau « Choisis ton pseudo pour jouer » : visible tant qu'il n'y a pas de pseudo (le jeu reste bloqué)
export function avisPseudo(message = 'Choisis ton pseudo pour jouer : il apparaît dans les résultats.') {
  const e = document.createElement('div');
  e.className = 'avis-pseudo';
  const t = document.createElement('p');
  t.textContent = `🔒 ${message}`;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn btn-principal';
  b.textContent = 'Choisir mon pseudo';
  b.addEventListener('click', () => demanderPseudo());
  e.append(t, b);
  const maj = () => { e.hidden = !!pseudo(); };
  maj();
  document.addEventListener('pseudo-change', maj);
  return e;
}

// Petit bouton « 👤 Léa » pour voir et changer son pseudo
export function boutonPseudo() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn btn-discret bouton-pseudo';
  const maj = () => { const n = pseudo(); b.textContent = n ? `👤 ${n}` : '👤 Choisir un pseudo'; b.title = 'Changer de pseudo'; };
  maj();
  b.addEventListener('click', () => { demanderPseudo('Ton pseudo apparaît dans les résultats de tes parties.'); });
  document.addEventListener('pseudo-change', maj);
  return b;
}
