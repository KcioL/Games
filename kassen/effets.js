// Effets de pose inspirés du Gwynt de The Witcher 3, dessinés sur un canvas (particules) :
//  - légende : nuage de fumée d'où sort la carte, et une mèche d'étincelles dorées qui fait le tour de son emplacement ;
//  - rassemblement : la carte s'illumine d'or avec le grand symbole de la capacité ; les copies appelées
//    arrivent une à une depuis la pioche.
// Toutes les tailles sont calculées d'après la carte à l'écran : l'effet s'adapte au téléphone comme au grand écran.

const DPR = () => Math.min(2, window.devicePixelRatio || 1);
const hasard = (a, b) => a + Math.random() * (b - a);

// Canvas posé par-dessus une zone de l'écran (rect élargi d'une marge), retiré à la fin
function canvasAutour(r, marge) {
  const cv = document.createElement('canvas');
  cv.className = 'effet-canvas';
  const l = r.width + marge * 2;
  const h = r.height + marge * 2;
  const k = DPR();
  cv.width = Math.round(l * k);
  cv.height = Math.round(h * k);
  Object.assign(cv.style, { left: `${r.left - marge}px`, top: `${r.top - marge}px`, width: `${l}px`, height: `${h}px` });
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  ctx.scale(k, k);
  return { cv, ctx, l, h };
}

// Boucle d'animation : dessine(t, dt) jusqu'à duree (ms)
function boucle(duree, dessine, fin) {
  const debut = performance.now();
  let avant = debut;
  const pas = (maintenant) => {
    const t = maintenant - debut;
    const dt = Math.min(50, maintenant - avant);
    avant = maintenant;
    dessine(Math.min(t, duree), dt);
    if (t < duree) requestAnimationFrame(pas);
    else if (fin) fin();
  };
  requestAnimationFrame(pas);
}

// ---------------------------------------------------------------------
// Légende : fumée + mèche d'étincelles autour de l'emplacement
// ---------------------------------------------------------------------
export function effetLegende(carte, { duree = 2000 } = {}) {
  if (!carte) return;
  const r = carte.getBoundingClientRect();
  if (!r.width) return;
  const w = r.width;
  const marge = Math.max(30, r.height * 0.9);
  const { cv, ctx, l, h } = canvasAutour(r, marge);
  // la carte sort de la fumée : invisible au début, elle apparaît pendant que la fumée se dissipe
  carte.animate([{ opacity: 0.15, filter: 'brightness(1.8)' }, { opacity: 0.35, offset: 0.25 }, { opacity: 1, filter: 'brightness(1.3)', offset: 0.6 }, { opacity: 1, filter: 'brightness(1)' }],
    { duration: duree * 0.6, easing: 'ease-out' });

  // rectangle de l'emplacement dans le repère du canvas (un peu plus large que la carte)
  const ecart = Math.max(2, w * 0.05);
  const x0 = marge - ecart; const y0 = marge - ecart;
  const x1 = marge + r.width + ecart; const y1 = marge + r.height + ecart;
  const perimetre = 2 * ((x1 - x0) + (y1 - y0));
  // point du contour à la distance d (départ en haut à gauche, puis côté gauche vers le bas, bas, droite, haut)
  const surContour = (d) => {
    d = ((d % perimetre) + perimetre) % perimetre;
    const H = y1 - y0; const L = x1 - x0;
    if (d < H) return [x0, y0 + d];
    if (d < H + L) return [x0 + (d - H), y1];
    if (d < 2 * H + L) return [x1, y1 - (d - H - L)];
    return [x1 - (d - 2 * H - L), y0];
  };

  // fumée : bouffées grises qui gonflent, montent un peu et s'effacent
  // (bouffées surtout sur les bords et en bas : la carte reste devinée au milieu, comme dans le jeu)
  const fumees = Array.from({ length: 16 }, (_, k) => {
    const bord = k % 4;
    const fx = bord === 0 ? hasard(-0.1, 0.25) : bord === 1 ? hasard(0.75, 1.1) : hasard(0, 1);
    const fy = bord === 2 ? hasard(0.75, 1.05) : bord === 3 ? hasard(0.3, 0.7) : hasard(0.2, 1);
    return {
      x: marge + fx * r.width, y: marge + fy * r.height,
      r0: w * hasard(0.2, 0.35), r1: w * hasard(0.55, 0.9),
      vx: (fx - 0.5) * hasard(0.15, 0.4) * w / 1000, vy: -hasard(0.08, 0.3) * w / 1000,
      debut: hasard(0, 120), vie: hasard(800, 1300), gris: Math.round(hasard(140, 200)), a: bord === 3 ? hasard(0.15, 0.25) : hasard(0.22, 0.38),
    };
  });
  const etincelles = [];
  const trace = []; // positions déjà parcourues par la mèche : [d, instant]
  const tMeche0 = 60; const tMeche1 = 1300;
  const epaisseur = Math.max(1.2, w / 55);

  boucle(duree, (t, dt) => {
    ctx.clearRect(0, 0, l, h);
    // --- fumée
    fumees.forEach((f) => {
      const u = (t - f.debut) / f.vie;
      if (u <= 0 || u >= 1) return;
      const rayon = f.r0 + (f.r1 - f.r0) * Math.sqrt(u);
      const x = f.x + f.vx * (t - f.debut); const y = f.y + f.vy * (t - f.debut);
      const alpha = f.a * (u < 0.06 ? u / 0.06 : 1 - (u - 0.06) / 0.94);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rayon);
      g.addColorStop(0, `rgba(${f.gris},${f.gris},${f.gris},${alpha})`);
      g.addColorStop(0.6, `rgba(${f.gris - 20},${f.gris - 20},${f.gris - 15},${alpha * 0.45})`);
      g.addColorStop(1, `rgba(${f.gris - 30},${f.gris - 30},${f.gris - 30},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rayon, 0, Math.PI * 2); ctx.fill();
    });
    // --- mèche : la tête avance le long du contour, en laissant une trace dorée qui s'éteint
    if (t >= tMeche0 && t <= tMeche1 + 40) {
      const u = Math.min(1, (t - tMeche0) / (tMeche1 - tMeche0));
      const dTete = perimetre * (1 - Math.pow(1 - u, 1.6)); // rapide au début, ralentit à la fin
      const dernier = trace.length ? trace[trace.length - 1][0] : 0;
      for (let d = dernier; d <= dTete; d += 3) trace.push([d, t]);
      // étincelles projetées par la tête
      const [hx, hy] = surContour(dTete);
      const n = Math.round(dt / 4);
      for (let k = 0; k < n; k++) {
        const ang = hasard(0, Math.PI * 2); const v = hasard(0.02, 0.12) * w / 60;
        etincelles.push({ x: hx, y: hy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 0.03, vie: hasard(250, 650), age: 0, taille: hasard(0.6, 1.6) * epaisseur });
      }
    }
    // trace : segments dorés, plus brillants près de la tête
    ctx.lineCap = 'round';
    for (let k = 1; k < trace.length; k++) {
      const age = t - trace[k][1];
      const a = Math.max(0, 1 - age / 650);
      if (a <= 0) continue;
      const [ax, ay] = surContour(trace[k - 1][0]);
      const [bx, by] = surContour(trace[k][0]);
      ctx.strokeStyle = `rgba(255, ${Math.round(150 + 90 * a)}, ${Math.round(60 * a)}, ${a})`;
      ctx.lineWidth = epaisseur * (0.6 + a);
      ctx.shadowColor = 'rgba(255, 140, 30, .9)';
      ctx.shadowBlur = epaisseur * 4 * a;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // fin de la mèche : tout le contour rougeoie un instant
    if (t > tMeche1 - 100) {
      const a = Math.max(0, 1 - (t - (tMeche1 - 100)) / 500);
      ctx.strokeStyle = `rgba(255, 120, 40, ${a * 0.8})`;
      ctx.lineWidth = epaisseur;
      ctx.shadowColor = 'rgba(255, 90, 20, 1)';
      ctx.shadowBlur = epaisseur * 8 * a;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.shadowBlur = 0;
    }
    // étincelles
    for (let k = etincelles.length - 1; k >= 0; k--) {
      const e = etincelles[k];
      e.age += dt;
      if (e.age > e.vie) { etincelles.splice(k, 1); continue; }
      e.vy += 0.0004 * dt * w / 60; // légère gravité
      e.x += e.vx * dt; e.y += e.vy * dt;
      const a = 1 - e.age / e.vie;
      ctx.fillStyle = `rgba(255, ${Math.round(170 + 80 * a)}, ${Math.round(80 * a)}, ${a})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.taille * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
    }
  }, () => cv.remove());
}

// ---------------------------------------------------------------------
// Rassemblement : lueur dorée et grand symbole sur la carte
// ---------------------------------------------------------------------
// Symbole du rassemblement : trois silhouettes casquées, comme l'icône de The Witcher 3
const SVG_RASSEMBLEMENT = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <g fill="#3B2A12" stroke="#FFF6D8" stroke-width="3" stroke-linejoin="round">
    <path d="M14 78 v-14 q0-12 12-14 q-8-4-8-13 q0-11 11-11 q11 0 11 11 q0 9-8 13 q12 2 12 14 v14 z"/>
    <path d="M56 78 v-14 q0-12 12-14 q-8-4-8-13 q0-11 11-11 q11 0 11 11 q0 9-8 13 q12 2 12 14 v14 z"/>
    <path d="M33 86 v-16 q0-13 13-15 q-9-5-9-14 q0-12 13-12 q13 0 13 12 q0 9-9 14 q13 2 13 15 v16 z"/>
  </g></svg>`;
const SYMBOLES = { rassemblement: SVG_RASSEMBLEMENT };

export function flashCapacite(carte, capacite, { duree = 1300 } = {}) {
  if (!carte) return;
  const r = carte.getBoundingClientRect();
  if (!r.width) return;
  const voile = document.createElement('div');
  voile.className = 'flash-capacite';
  Object.assign(voile.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const symbole = document.createElement('div');
  symbole.className = 'flash-symbole';
  symbole.innerHTML = SYMBOLES[capacite] || '';
  voile.appendChild(symbole);
  document.body.appendChild(voile);
  voile.animate([
    { opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.7 }, { opacity: 0 },
  ], { duration: duree, easing: 'ease-out', fill: 'forwards' });
  symbole.animate([
    { transform: 'scale(.4)', opacity: 0 },
    { transform: 'scale(1.15)', opacity: 1, offset: 0.22 },
    { transform: 'scale(.95)', offset: 0.38 },
    { transform: 'scale(1.05)', offset: 0.55 },
    { transform: 'scale(1)', opacity: 1, offset: 0.75 },
    { transform: 'scale(1.2)', opacity: 0 },
  ], { duration: duree, easing: 'ease-out', fill: 'forwards' });
  // reflet qui traverse la carte
  const reflet = document.createElement('div');
  reflet.className = 'flash-reflet';
  voile.appendChild(reflet);
  reflet.animate([{ transform: 'translateX(-120%) skewX(-18deg)' }, { transform: 'translateX(220%) skewX(-18deg)' }],
    { duration: duree * 0.6, delay: duree * 0.12, easing: 'ease-in-out', fill: 'both' });
  setTimeout(() => voile.remove(), duree + 50);
}

// Une carte appelée part de la pioche (rect de départ) et vole jusqu'à sa place sur le plateau
export function volDepuis(depart, carte, { duree = 520, delai = 0 } = {}) {
  return new Promise((fini) => {
    if (!carte) { fini(); return; }
    const arrivee = carte.getBoundingClientRect();
    if (!arrivee.width || !depart || !depart.width) { fini(); return; }
    carte.style.visibility = 'hidden';
    const copie = carte.cloneNode(true);
    copie.classList.add('carte-en-vol');
    Object.assign(copie.style, { left: `${arrivee.left}px`, top: `${arrivee.top}px`, width: `${arrivee.width}px`, height: `${arrivee.height}px`, visibility: 'visible' });
    document.body.appendChild(copie);
    const dx = depart.left + depart.width / 2 - (arrivee.left + arrivee.width / 2);
    const dy = depart.top + depart.height / 2 - (arrivee.top + arrivee.height / 2);
    const k = Math.max(0.3, depart.width / arrivee.width);
    const anim = copie.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${k}) rotate(-10deg)`, opacity: 0.5 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - arrivee.height * 0.6}px) scale(1.25) rotate(4deg)`, opacity: 1, offset: 0.5 },
      { transform: 'translate(0, 0) scale(1) rotate(0)', opacity: 1 },
    ], { duration: duree, delay: delai, easing: 'cubic-bezier(.3, .7, .3, 1)', fill: 'backwards' });
    anim.onfinish = () => {
      copie.remove();
      // la carte du plateau a pu être redessinée entre-temps
      const ici = document.querySelector(`.rangee-cartes .carte[data-u="${carte.dataset.u}"]`) || carte;
      ici.style.visibility = '';
      carte.style.visibility = '';
      fini(ici);
    };
  });
}
