// Mode « sur ce téléphone » de l'UNO : base locale et écrans de relais,
// mis à disposition du script principal (script.js, non-module).
import { localDb } from '../commun/local-db.js';
import { creerRelais } from '../commun/relais.js';

window.localDB = localDb;
window.relais = creerRelais();
