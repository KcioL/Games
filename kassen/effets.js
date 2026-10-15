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
  // la lueur est posée DANS la carte : elle la suit exactement (même si la carte rebondit ou si la rangée se décale)
  const voile = document.createElement('div');
  voile.className = 'flash-capacite';
  const symbole = document.createElement('div');
  symbole.className = 'flash-symbole';
  symbole.innerHTML = SYMBOLES[capacite] || '';
  voile.appendChild(symbole);
  carte.appendChild(voile);
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

// =====================================================================
// Météo sur le plateau : tant qu'une météo est active, sa rangée (dans les deux camps) est animée
//   corps à corps : gel (glace, givre, stalactites, flocons)
//   distance      : brume / brouillard (nappes de fumée qui dérivent)
//   siège         : Gwynt → pluie (averse, éclaboussures, gouttes qui glissent)
//                   Kassen → typhon (vent, tornades, éclairs)
// Un seul canvas pour tout le plateau, qui lit la position des rangées à chaque image :
// l'effet suit le plateau quelle que soit la taille de l'écran, et ne redémarre pas à chaque coup.
// =====================================================================
let calque = null;
let ctxMeteo = null;
let enCours = false;
const etats = new Map(); // état des particules de chaque rangée
const reduit = window.matchMedia('(prefers-reduced-motion: reduce)');

function typeMeteo(ligne) {
  const r = ligne.dataset.rangee;
  if (r === 'cac') return 'gel';
  if (r === 'dist') return 'brume';
  return document.body.dataset.jeu === 'gwynt' ? 'pluie' : 'typhon';
}

function preparerCalque() {
  if (!calque) {
    calque = document.createElement('canvas');
    calque.className = 'meteo-plateau';
    document.body.appendChild(calque);
    ctxMeteo = calque.getContext('2d');
  }
  const k = Math.min(1.5, window.devicePixelRatio || 1);
  const L = window.innerWidth; const H = window.innerHeight;
  if (calque.width !== Math.round(L * k) || calque.height !== Math.round(H * k)) {
    calque.width = Math.round(L * k); calque.height = Math.round(H * k);
    calque.style.width = `${L}px`; calque.style.height = `${H}px`;
  }
  ctxMeteo.setTransform(k, 0, 0, k, 0, 0);
}

// État initial d'une rangée (recréé si sa taille change beaucoup)
function nouvelEtat(type, w, h) {
  const e = { type, w, h, t0: performance.now() };
  if (type === 'gel') {
    e.stalactites = [];
    for (let x = hasard(2, h * 0.2); x < w - 2; x += hasard(h * 0.12, h * 0.32)) {
      e.stalactites.push({ x, long: h * hasard(0.1, 0.42), larg: h * hasard(0.035, 0.09), phase: hasard(0, 6) });
    }
    e.flocons = Array.from({ length: Math.round(w / 40) + 6 }, () => ({ x: hasard(0, w), y: hasard(0, h), v: hasard(0.006, 0.018) * h, r: hasard(0.6, 1.8), d: hasard(-0.3, 0.3) }));
    e.eclats = Array.from({ length: Math.round(w / 60) + 3 }, () => ({ x: hasard(0, w), y: hasard(0, h), phase: hasard(0, 6), vit: hasard(1, 3) }));
  } else if (type === 'brume') {
    e.nappes = Array.from({ length: Math.round(w / (h * 1.2)) + 4 }, () => ({ x: hasard(-h, w + h), y: hasard(0.1, 0.9) * h, r: h * hasard(0.6, 1.2), v: hasard(0.02, 0.06) * h, a: hasard(0.12, 0.24) }));
  } else if (type === 'pluie') {
    e.gouttes = Array.from({ length: Math.round(w / 14) + 10 }, () => ({ x: hasard(0, w), y: hasard(-h, h), v: hasard(1.6, 2.6) * h, l: hasard(0.12, 0.25) * h }));
    e.eclabous = [];
    e.vitre = Array.from({ length: Math.round(w / 70) + 3 }, () => ({ x: hasard(0, w), y: hasard(0, h), r: hasard(1.5, 3.2) * Math.max(1, h / 70), v: hasard(0.02, 0.09) * h }));
  } else {
    e.vent = Array.from({ length: Math.round(w / 30) + 8 }, () => ({ x: hasard(0, w), y: hasard(0, h), v: hasard(1.2, 2.4) * w / 3, l: hasard(0.05, 0.14) * w }));
    e.tornades = Array.from({ length: w > h * 6 ? 2 : 1 }, (_, k) => ({ x: w * (0.25 + k * 0.5), v: hasard(0.04, 0.09) * w * (k % 2 ? -1 : 1), phase: hasard(0, 6) }));
    e.prochainEclair = performance.now() + hasard(600, 2200);
    e.eclair = null;
    e.debris = Array.from({ length: 14 }, () => ({ angle: hasard(0, 6.28), haut: hasard(0, 1), tornade: Math.floor(hasard(0, 2)), vit: hasard(3, 6) }));
  }
  return e;
}

function dessinerGel(c, e, w, h, t, dt) {
  // teinte glacée et givre dans les coins
  let g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(190, 230, 255, .26)'); g.addColorStop(1, 'rgba(120, 180, 235, .10)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  [[0, 0], [w, 0], [0, h], [w, h]].forEach(([x, y]) => {
    const rg = c.createRadialGradient(x, y, 0, x, y, h * 1.1);
    rg.addColorStop(0, 'rgba(235, 248, 255, .32)'); rg.addColorStop(1, 'rgba(235, 248, 255, 0)');
    c.fillStyle = rg; c.fillRect(0, 0, w, h);
  });
  // croûte de glace en bas
  c.fillStyle = 'rgba(225, 245, 255, .28)';
  c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += h * 0.15) c.lineTo(x, h - h * (0.05 + 0.04 * Math.sin(x * 0.07)));
  c.lineTo(w, h); c.closePath(); c.fill();
  // stalactites qui pendent du haut, avec un reflet qui scintille
  e.stalactites.forEach((s) => {
    const gg = c.createLinearGradient(s.x, 0, s.x, s.long);
    gg.addColorStop(0, 'rgba(245, 252, 255, .9)'); gg.addColorStop(0.6, 'rgba(190, 230, 255, .55)'); gg.addColorStop(1, 'rgba(170, 220, 255, 0)');
    c.fillStyle = gg;
    c.beginPath(); c.moveTo(s.x - s.larg, 0); c.lineTo(s.x + s.larg, 0); c.lineTo(s.x + s.larg * 0.1, s.long); c.closePath(); c.fill();
    const brille = 0.35 + 0.35 * Math.sin(t / 700 + s.phase);
    c.strokeStyle = `rgba(255, 255, 255, ${brille})`; c.lineWidth = Math.max(0.8, s.larg * 0.25);
    c.beginPath(); c.moveTo(s.x - s.larg * 0.4, 1); c.lineTo(s.x, s.long * 0.7); c.stroke();
  });
  // liseré glacé
  c.strokeStyle = 'rgba(210, 240, 255, .7)'; c.lineWidth = 1.5; c.strokeRect(0.75, 0.75, w - 1.5, h - 1.5);
  // flocons
  c.fillStyle = 'rgba(255, 255, 255, .85)';
  e.flocons.forEach((f) => {
    f.y += f.v * dt / 1000; f.x += f.d * dt / 100;
    if (f.y > h) { f.y = -2; f.x = hasard(0, w); }
    c.beginPath(); c.arc(f.x, f.y, f.r, 0, 6.283); c.fill();
  });
  // éclats de givre qui scintillent
  e.eclats.forEach((s) => {
    const a = Math.max(0, Math.sin(t / 1000 * s.vit + s.phase));
    if (a < 0.6) return;
    const r = 2 + 4 * a;
    c.strokeStyle = `rgba(255, 255, 255, ${(a - 0.6) * 2.2})`; c.lineWidth = 1;
    c.beginPath(); c.moveTo(s.x - r, s.y); c.lineTo(s.x + r, s.y); c.moveTo(s.x, s.y - r); c.lineTo(s.x, s.y + r); c.stroke();
  });
}

function dessinerBrume(c, e, w, h, t, dt) {
  c.fillStyle = 'rgba(190, 195, 205, .12)'; c.fillRect(0, 0, w, h);
  e.nappes.forEach((n) => {
    n.x += n.v * dt / 1000;
    if (n.x - n.r > w) n.x = -n.r;
    const y = n.y + Math.sin(t / 2200 + n.r) * h * 0.08;
    const g = c.createRadialGradient(n.x, y, 0, n.x, y, n.r);
    g.addColorStop(0, `rgba(215, 220, 228, ${n.a})`); g.addColorStop(0.55, `rgba(200, 205, 215, ${n.a * 0.5})`); g.addColorStop(1, 'rgba(200, 205, 215, 0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(n.x, y, n.r * 1.6, n.r, 0, 0, 6.283); c.fill();
  });
}

function dessinerPluie(c, e, w, h, t, dt) {
  c.fillStyle = 'rgba(40, 70, 120, .16)'; c.fillRect(0, 0, w, h);
  const pente = 0.18;
  c.strokeStyle = 'rgba(190, 215, 255, .55)'; c.lineWidth = Math.max(1, h / 90);
  c.beginPath();
  e.gouttes.forEach((g) => {
    g.y += g.v * dt / 1000; g.x -= g.v * pente * dt / 1000;
    if (g.y > h) {
      if (Math.random() < 0.6) e.eclabous.push({ x: g.x, y: h - hasard(1, h * 0.12), age: 0 });
      g.y = hasard(-h * 0.4, 0); g.x = hasard(0, w + h * 0.3);
    }
    c.moveTo(g.x, g.y); c.lineTo(g.x + g.l * pente, g.y - g.l);
  });
  c.stroke();
  // éclaboussures
  for (let k = e.eclabous.length - 1; k >= 0; k--) {
    const s = e.eclabous[k];
    s.age += dt;
    if (s.age > 260) { e.eclabous.splice(k, 1); continue; }
    const u = s.age / 260;
    c.strokeStyle = `rgba(200, 225, 255, ${0.6 * (1 - u)})`; c.lineWidth = 1;
    c.beginPath(); c.ellipse(s.x, s.y, 2 + u * h * 0.06, 1 + u * h * 0.015, 0, 0, 6.283); c.stroke();
  }
  // gouttes d'eau qui glissent sur la rangée
  e.vitre.forEach((d) => {
    d.y += d.v * dt / 1000;
    if (d.y - d.r > h) { d.y = -d.r; d.x = hasard(0, w); }
    const g = c.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 0, d.x, d.y, d.r);
    g.addColorStop(0, 'rgba(255, 255, 255, .8)'); g.addColorStop(0.5, 'rgba(170, 205, 245, .45)'); g.addColorStop(1, 'rgba(90, 130, 190, .3)');
    c.fillStyle = g; c.beginPath(); c.ellipse(d.x, d.y, d.r * 0.85, d.r, 0, 0, 6.283); c.fill();
    c.strokeStyle = 'rgba(170, 205, 245, .25)'; c.lineWidth = d.r * 0.5;
    c.beginPath(); c.moveTo(d.x, d.y - d.r); c.lineTo(d.x, d.y - d.r * 4); c.stroke();
  });
}

function eclairEntre(x, y0, y1, w) {
  const pts = [[x, y0]];
  const n = 7;
  for (let k = 1; k <= n; k++) pts.push([x + hasard(-1, 1) * w * 0.025 * (k < n ? 1 : 0.3), y0 + (y1 - y0) * k / n]);
  return pts;
}
function dessinerTyphon(c, e, w, h, t, dt) {
  c.fillStyle = 'rgba(15, 20, 40, .32)'; c.fillRect(0, 0, w, h);
  // rafales de vent
  c.strokeStyle = 'rgba(200, 210, 230, .35)'; c.lineWidth = 1;
  c.beginPath();
  e.vent.forEach((v) => {
    v.x -= v.v * dt / 1000;
    if (v.x + v.l < 0) { v.x = w + hasard(0, w * 0.3); v.y = hasard(0, h); }
    const y = v.y + Math.sin((v.x + t * 0.2) / 40) * h * 0.04;
    c.moveTo(v.x, y); c.quadraticCurveTo(v.x + v.l / 2, y - h * 0.05, v.x + v.l, y);
  });
  c.stroke();
  // tornades : un entonnoir d'ellipses qui tournent, et des débris
  e.tornades.forEach((tn, k) => {
    tn.x += tn.v * dt / 1000;
    if (tn.x < w * 0.08 || tn.x > w * 0.92) tn.v = -tn.v;
    const etages = 12;
    for (let i = 0; i < etages; i++) {
      const u = i / (etages - 1); // 0 en bas, 1 en haut
      const y = h * (0.95 - u * 0.95);
      const rx = h * (0.05 + u * 0.38);
      const dx = Math.sin(t / 260 + i * 0.7 + tn.phase) * h * 0.06 * (0.3 + u);
      c.strokeStyle = `rgba(205, 215, 235, ${0.18 + 0.22 * (1 - u)})`; c.lineWidth = Math.max(1, h / 60);
      c.beginPath(); c.ellipse(tn.x + dx, y, rx, rx * 0.22, 0, Math.PI * (t / 400 % 2), Math.PI * (t / 400 % 2) + Math.PI * 1.6); c.stroke();
    }
    c.fillStyle = 'rgba(120, 100, 80, .7)';
    e.debris.filter((d) => d.tornade === k % 2).forEach((d) => {
      d.angle += d.vit * dt / 1000;
      const u = d.haut; const y = h * (0.95 - u * 0.95); const rx = h * (0.05 + u * 0.38);
      c.fillRect(tn.x + Math.cos(d.angle) * rx, y + Math.sin(d.angle) * rx * 0.22, 2, 2);
    });
  });
  // éclairs
  const maintenant = performance.now();
  if (!e.eclair && maintenant > e.prochainEclair) {
    const x = hasard(0.1, 0.9) * w;
    e.eclair = { debut: maintenant, pts: eclairEntre(x, 0, h, w), branche: eclairEntre(x + hasard(-1, 1) * w * 0.04, h * 0.35, h * 0.8, w) };
    e.prochainEclair = maintenant + hasard(1300, 3800);
  }
  if (e.eclair) {
    const age = maintenant - e.eclair.debut;
    if (age > 260) e.eclair = null;
    else {
      const a = age < 60 ? 1 : 1 - (age - 60) / 200;
      c.fillStyle = `rgba(210, 225, 255, ${0.28 * a})`; c.fillRect(0, 0, w, h);
      [e.eclair.pts, e.eclair.branche].forEach((pts, k) => {
        c.strokeStyle = `rgba(235, 242, 255, ${a})`; c.lineWidth = Math.max(1.5, h / (k ? 70 : 40));
        c.shadowColor = 'rgba(140, 180, 255, 1)'; c.shadowBlur = 12;
        c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      });
      c.shadowBlur = 0;
    }
  }
}

const DESSINS = { gel: dessinerGel, brume: dessinerBrume, pluie: dessinerPluie, typhon: dessinerTyphon };
let avantImage = 0;
function image(maintenant) {
  const lignes = [...document.querySelectorAll('body.en-bataille .rangee.meteo')];
  if (!lignes.length || reduit.matches) {
    if (calque) ctxMeteo.clearRect(0, 0, calque.width, calque.height);
    enCours = false;
    etats.clear();
    return;
  }
  preparerCalque();
  const dt = Math.min(50, maintenant - (avantImage || maintenant));
  avantImage = maintenant;
  ctxMeteo.clearRect(0, 0, window.innerWidth, window.innerHeight);
  const vues = new Set();
  lignes.forEach((ligne) => {
    // la zone des cartes de la rangée (sans l'en-tête avec le total)
    const zone = ligne.querySelector('.rangee-cartes') || ligne;
    const r = ligne.getBoundingClientRect();
    const rz = zone.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = rz.left; const y = r.top; const w = r.right - rz.left; const h = r.height;
    const type = typeMeteo(ligne);
    const cle = `${(ligne.closest('.camp') || {}).id}-${ligne.dataset.rangee}`;
    vues.add(cle);
    let e = etats.get(cle);
    if (!e || e.type !== type || Math.abs(e.w - w) > 20 || Math.abs(e.h - h) > 10) { e = nouvelEtat(type, w, h); etats.set(cle, e); }
    ctxMeteo.save();
    ctxMeteo.translate(x, y);
    ctxMeteo.beginPath(); ctxMeteo.rect(0, 0, w, h); ctxMeteo.clip();
    DESSINS[type](ctxMeteo, e, w, h, maintenant - e.t0, dt);
    ctxMeteo.restore();
  });
  [...etats.keys()].forEach((k) => { if (!vues.has(k)) etats.delete(k); });
  requestAnimationFrame(image);
}

// À appeler après chaque affichage du plateau : lance l'animation s'il y a une météo active
export function majMeteoPlateau() {
  if (enCours) return;
  if (!document.querySelector('body.en-bataille .rangee.meteo')) {
    if (calque) ctxMeteo.clearRect(0, 0, calque.width, calque.height);
    return;
  }
  enCours = true;
  avantImage = 0;
  requestAnimationFrame(image);
}
