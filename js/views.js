/* Схеми в реальному масштабі (1 м по X = 1 м по Y): профіль, поперечний переріз, план.
   Деталі поручнів — за рис. 5а, 5г, 5д ДБН В.2.2-40:2018 (Зміна № 3). */
import { html, useEffect, useRef, useMemo, useState as useStateW } from './vendor/preact-htm.js';
import { fmt, fmtT } from './norms.js';
import { rider, subscribe } from './anim.js';

export const C = {
  ok: '#3fcf6d', warn: '#e6b23a', fail: '#ff5f57', accent: '#5cc6e8',
  ink: '#e9eef5', muted: '#a3b1c2', faint: '#7d8da1', line: '#2c3b4d', grid: '#1c2733',
  concrete: '#1d2835', landing: '#243b55', stripe: '#ffd84d',
  rail: '#f5c542', railDull: '#5f6d7c', steel: '#c3d0dc', person: '#8fc7e6', skin: '#e9c7a6',
  wall: '#3a4a5d', door: '#7aa6c2', water: '#5cc6e8',
};
const SC = { ok: C.ok, limit: C.warn, fail: C.fail, auto: C.warn };
const TINT = { ok: 'rgba(63,207,109,0.16)', limit: 'rgba(230,178,58,0.16)', fail: 'rgba(255,95,87,0.16)' };

/* ── геометрія ділянок: нижня площадка → марші (± проміжні площадки) → верхня площадка ──
   k ∈ [0,1] — масштаб проміжних площадок для плавного морфу при зміні кількості маршів. */
export function buildSegments(s, n, k = 1) {
  const L = s.H / (s.slope / 100), lm = L / n, h = s.H / n, d = s.landing, di = d * k;
  const segs = [{ type: 'landing', kind: 'bottom', x0: 0, x1: d, y: 0 }];
  let x = d, y = 0;
  for (let i = 0; i < n; i++) {
    segs.push({ type: 'march', x0: x, x1: x + lm, y0: y, y1: y + h, i });
    x += lm; y += h;
    if (i < n - 1) { segs.push({ type: 'landing', kind: 'mid', x0: x, x1: x + di, y }); x += di; }
  }
  segs.push({ type: 'landing', kind: 'top', x0: x, x1: x + d, y });
  return segs;
}
const surfY = (segs, x) => {
  for (const sg of segs) {
    if (x <= sg.x1) {
      if (sg.type === 'march') return sg.y0 + (Math.max(x, sg.x0) - sg.x0) / (sg.x1 - sg.x0) * (sg.y1 - sg.y0);
      return sg.y;
    }
  }
  const l = segs[segs.length - 1];
  return l.type === 'march' ? l.y1 : l.y;
};

/* ── розмірні лінії з архітектурними засічками ── */
function DimH({ x1, x2, y, label, color = C.faint, text = C.muted, up = false, minPx = 0, outside = false }) {
  const w = Math.abs(x2 - x1);
  if (w < 3) return null;
  const fits = w >= Math.max(minPx, String(label).length * 6.6 + 6);
  return html`<g stroke=${color} stroke-width="1" fill="none">
    <line x1=${x1} y1=${y} x2=${x2} y2=${y} />
    <line x1=${x1} y1=${y - 5} x2=${x1} y2=${y + 5} /><line x1=${x2} y1=${y - 5} x2=${x2} y2=${y + 5} />
    <line x1=${x1 - 3.5} y1=${y + 3.5} x2=${x1 + 3.5} y2=${y - 3.5} /><line x1=${x2 - 3.5} y1=${y + 3.5} x2=${x2 + 3.5} y2=${y - 3.5} />
    ${fits || outside
      ? html`<text x=${fits ? (x1 + x2) / 2 : outside === 'left' ? Math.min(x1, x2) - 6 : Math.max(x1, x2) + 6} y=${fits ? (up ? y - 5 : y + 14) : y + 4}
          fill=${text} stroke="none" text-anchor=${fits ? 'middle' : outside === 'left' ? 'end' : 'start'} class="dim">${label}</text>`
      : null}
  </g>`;
}
function DimV({ x, y1, y2, label, color = C.faint, text = C.muted, side = 1 }) {
  if (Math.abs(y2 - y1) < 8) return null;
  return html`<g stroke=${color} stroke-width="1" fill="none">
    <line x1=${x} y1=${y1} x2=${x} y2=${y2} />
    <line x1=${x - 5} y1=${y1} x2=${x + 5} y2=${y1} /><line x1=${x - 5} y1=${y2} x2=${x + 5} y2=${y2} />
    <line x1=${x - 3.5} y1=${y1 + 3.5} x2=${x + 3.5} y2=${y1 - 3.5} /><line x1=${x - 3.5} y1=${y2 + 3.5} x2=${x + 3.5} y2=${y2 - 3.5} />
    <text x=${x + 7 * side} y=${(y1 + y2) / 2 + 4} fill=${text} stroke="none" text-anchor=${side > 0 ? 'start' : 'end'} class="dim">${label}</text>
  </g>`;
}

/* ── фігури (метри, y — вгору) ── */
/* Фігури — мінімалістичні, однією лінією сталої товщини (vector-effect: non-scaling-stroke, клас .mono),
   у метрах, y — вгору. Рука, спиці й ефекти анімуються з циклу в ProfileView. */
const ARM_S = [0.06, 0.93];                                    // плече
export function armPath(theta) {
  // кисть на ободі колеса (центр 0;0,3, r 0,25), лікоть відведений назад
  const hx = 0.25 * Math.cos(theta), hy = 0.3 + 0.25 * Math.sin(theta);
  const vx = hx - ARM_S[0], vy = hy - ARM_S[1], l = Math.hypot(vx, vy) || 1;
  const ex = ARM_S[0] + vx / 2 + (vy / l) * 0.09, ey = ARM_S[1] + vy / 2 - (vx / l) * 0.09;
  return `M ${ARM_S[0]} ${ARM_S[1]} L ${ex.toFixed(3)} ${ey.toFixed(3)} L ${hx.toFixed(3)} ${hy.toFixed(3)}`;
}
function ChairSide() {
  // початок координат — точка контакту заднього колеса, рух у бік +x
  return html`<g class="mono" fill="none" stroke=${C.steel} stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7">
    <circle cx="0" cy="0.3" r="0.3" stroke-width="2.2" />
    <circle cx="0" cy="0.3" r="0.25" opacity="0.45" stroke-width="1" />
    <g class="spokes" transform="translate(0 0.3)" opacity="0.4" stroke-width="1">
      <path d="M -0.25 0 L 0.25 0 M -0.125 -0.217 L 0.125 0.217 M -0.125 0.217 L 0.125 -0.217" />
    </g>
    <circle cx="0" cy="0.3" r="0.028" fill=${C.steel} stroke="none" />
    <circle cx="0.52" cy="0.07" r="0.07" />
    <path d="M -0.02 0.5 L 0.44 0.5 L 0.48 0.3 L 0.52 0.07 M -0.02 0.5 L -0.1 0.93 L -0.2 0.94 M 0.42 0.5 L 0.56 0.15 L 0.66 0.15" />
    <g stroke=${C.ink} stroke-width="2.2">
      <circle cx="0.05" cy="1.13" r="0.1" />
      <path d="M 0.06 1.01 L 0.1 0.56 L 0.42 0.6 L 0.5 0.2 L 0.6 0.19" />
      <path class="arm" d=${armPath(1.2)} />
    </g>
    <path class="fx-sweat" d="M 0.2 1.3 q 0.04 -0.06 0 -0.1 q -0.04 0.04 0 0.1 Z" fill=${C.water} stroke="none" opacity="0" />
    <g class="fx-speed" opacity="0" stroke=${C.ink} stroke-width="1.4"><path d="M 0.72 0.75 L 0.98 0.75 M 0.76 0.5 L 1.08 0.5 M 0.72 0.25 L 0.94 0.25" /></g>
    <g class="fx-bump" opacity="0" stroke=${C.fail} stroke-width="1.8">
      <path d="M 0.78 0.45 L 0.95 0.55 M 0.8 0.32 L 0.98 0.32 M 0.78 0.2 L 0.95 0.1 M 0.74 0.6 L 0.82 0.76" />
    </g>
  </g>`;
}
function ChairFront({ hit }) {
  // центр — посередині між колесами на рівні поверхні
  const st = hit ? C.fail : C.steel;
  return html`<g class="mono" fill="none" stroke=${st} stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7">
    <rect x="-0.35" y="0" width="0.045" height="0.6" rx="0.022" stroke-width="2" />
    <rect x="0.305" y="0" width="0.045" height="0.6" rx="0.022" stroke-width="2" />
    <path d="M -0.3 0.3 L 0.3 0.3 M -0.24 0.48 L 0.24 0.48 M -0.22 0.48 L -0.22 0.93 M 0.22 0.48 L 0.22 0.93 M -0.17 0.12 L -0.05 0.12 M 0.05 0.12 L 0.17 0.12" />
    <g stroke=${hit ? C.fail : C.ink} stroke-width="2.2">
      <circle cx="0" cy="1.14" r="0.1" />
      <path d="M -0.17 0.97 L 0.17 0.97 M 0 0.97 L 0 0.55 M -0.13 0.52 L 0.13 0.52 M -0.12 0.52 L -0.11 0.14 M 0.12 0.52 L 0.11 0.14" />
      <path d="M -0.17 0.97 L -0.27 0.74 L -0.31 0.56 M 0.17 0.97 L 0.27 0.74 L 0.31 0.56" />
    </g>
  </g>`;
}
function ChairTop({ hit }) {
  // центр сидіння, рух у бік +x
  const st = hit ? C.fail : C.steel;
  return html`<g class="mono" fill="none" stroke=${st} stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6">
    <rect x="-0.3" y="-0.35" width="0.6" height="0.05" rx="0.025" />
    <rect x="-0.3" y="0.3" width="0.6" height="0.05" rx="0.025" />
    <path d="M 0.33 -0.22 L 0.43 -0.22 M 0.33 0.22 L 0.43 0.22 M -0.24 -0.25 L -0.24 0.25" />
    <g stroke=${hit ? C.fail : C.ink} stroke-width="2">
      <circle cx="-0.06" cy="0" r="0.1" />
      <path d="M -0.1 -0.2 Q 0.02 0 -0.1 0.2 M 0.08 -0.1 L 0.46 -0.09 M 0.08 0.1 L 0.46 0.09" />
    </g>
  </g>`;
}

function useUid() { return useMemo(() => 'u' + Math.random().toString(36).slice(2, 8), []); }

/* ════════ ПРОФІЛЬ (вид збоку) ════════ */
export function ProfileView({ s, segs, ev, focus, W, maxH }) {
  const uid = useUid();
  const H = s.H;
  const top = segs[segs.length - 1];
  const wallX = top.x1;
  const worldW = wallX + 1.15, worldTop = H + 1.75, worldBot = -0.2;   // двері вищі за кадр — обрізаються
  const padL = 12, padR = 70, padT = 30, padB = 58;
  const sc = Math.min((W - padL - padR) / worldW, (maxH - padT - padB) / (worldTop - worldBot));
  // стала висота схеми (= maxH): сторінка не «стрибає»; креслення притиснуте до низу, як до ґрунту
  const svgH = Math.round(maxH);
  const top0 = Math.max(padT, svgH - padB - (worldTop - worldBot) * sc);
  const offX = padL + ((W - padL - padR) - worldW * sc) / 2;
  const X = (x) => offX + x * sc;
  const Y = (y) => top0 + (worldTop - y) * sc;
  const st = (id) => ev.byId[id] ? ev.byId[id].status : 'ok';
  const fade = (tags) => ({ opacity: tags.includes(focus) ? 1 : W < 640 ? 0 : 0.18 });

  const marches = segs.filter((sg) => sg.type === 'march');
  const xs = marches[0].x0, xe = marches[marches.length - 1].x1;
  const pts =[{ x: 0, y: 0 }, ...segs.map((sg) => ({ x: sg.x1, y: sg.type === 'march' ? sg.y1 : sg.y }))];
  const P = (arr) => arr.map((p, i) => `${i ? 'L' : 'M'} ${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  const surf = P(pts);
  const body = surf + ` L ${X(wallX)} ${Y(worldBot)} L ${X(0)} ${Y(worldBot)} Z`;

  /* поручні: вершини — від початку першого маршу до кінця останнього, плюс горизонтальні продовження */
  const inner = pts.filter((p) => p.x >= xs - 1e-6 && p.x <= xe + 1e-6);
  const r = s.railDiam / 2;
  const railColor = st('railLevels') === 'fail' || st('railDiam') === 'fail' ? C.fail : s.railContrast ? C.rail : C.railDull;
  const extColor = st('railExt') === 'fail' ? C.fail : railColor;
  const railW = Math.max(s.railDiam * sc, 1.6);
  /* Рис. 5г: 900 і 700 — від поверхні до ВЕРХУ поручня, тож вісь труби нижче на r.
     300 — від вертикалі початку (кінця) схилу до ЗОВНІШНЬОГО краю заокруглення.
     Рівні 0,9 і 0,7 з'єднує півколо (U-завершення) — і внизу, і вгорі. */
  const aTop = s.railTop - r, aLow = s.railLow - r;                 // висоти осей труб
  const Rax = Math.max((aTop - aLow) / 2, 0.01);                     // радіус півкола по осі
  const extAx = Math.max(s.railExt - r, 0.005);                      // крайня точка осі заокруглення
  const loopRx = Math.min(Rax, extAx);
  const straight = extAx - loopRx;                                   // пряма горизонтальна ділянка до дуги
  const railLine = (axis, sideExt = straight) => P([
    { x: xs - sideExt, y: axis }, ...inner.map((p) => ({ x: p.x, y: p.y + axis })), { x: xe + sideExt, y: H + axis },
  ]);
  const loop = (x0, yb, dir) => {
    const yt = Y(yb + aTop), yl = Y(yb + aLow), rx = loopRx * sc, ry = (yl - yt) / 2;
    return `M ${X(x0)} ${yt} A ${rx} ${ry} 0 0 ${dir < 0 ? 0 : 1} ${X(x0)} ${yl}`;
  };
  // дитячий поручень 0,5 м (рис. 5а) — окрема труба, кінці теж горизонтальні й заокруглені донизу
  const cr = Math.min(0.05, extAx), childStraight = extAx - cr;
  const childEnd = (x0, yb, dir) => {
    const y = Y(yb + 0.5 - r), rr = cr * sc;
    return `M ${X(x0)} ${y} A ${rr} ${rr} 0 0 ${dir < 0 ? 0 : 1} ${X(x0) + dir * rr} ${y + rr}`;
  };
  // труба «як на кресленні»: контур + світлий просвіт усередині, коли вистачає масштабу
  const tube = (d, color) => html`<path d=${d} stroke=${color} stroke-width=${railW} />${railW >= 4.5 ? html`<path d=${d} stroke="#0d131b" stroke-width=${railW * 0.4} />` : null}`;
  /* опори: крайні — на postGap від краю заокруглення, проміжні — не рідше ніж через 1,5 м */
  const xFirst = xs - s.railExt + s.postGap, xLast = xe + s.railExt - s.postGap;
  const marks = [...inner.map((p) => p.x).filter((x) => x - xFirst >= 0.4 && xLast - x >= 0.4), xLast];
  const postXs = [xFirst];
  let prev = xFirst;
  for (const mx of marks) {
    const gap = mx - prev;
    if (gap < 0.4 && mx !== xLast) continue;
    const k = Math.ceil(gap / 1.5 - 1e-6);
    for (let j = 1; j < k; j++) postXs.push(prev + (gap * j) / k);
    postXs.push(mx); prev = mx;
  }
  const postColor = st('postGap') === 'fail' ? C.fail : C.faint;

  const m1 = marches[0];
  const lx = m1.x0 + 0.62 * (m1.x1 - m1.x0), ly = m1.y0 + 0.62 * (m1.y1 - m1.y0);
  const slopeSt = st('slope');
  const curbClr = st('curb') === 'fail' ? C.fail : C.accent;
  const cheerOk = ev.overall === 'ok';

  /* анімація: крісло, колеса, двері, бульбашка, конфеті */
  const riderRef = useRef(null), doorRef = useRef(null), bubRef = useRef(null), confRef = useRef(null);
  const env = useRef(null);
  env.current = { X, Y, sc, segs, wallX, H, cheerOk };
  useEffect(() => subscribe(() => {
    const e = env.current, st8 = rider.state, el = riderRef.current;
    if (!st8 || !el) return;
    const x = st8.x, wb = 0.5;
    const y0 = surfY(e.segs, x), y1 = surfY(e.segs, x + wb);
    let ang = Math.atan2(y1 - y0, wb) * 180 / Math.PI;
    if (st8.tag === 'strain') ang += Math.sin(st8.k * Math.PI * 10) * 1.2;
    if (st8.tag === 'back') ang += 4 * Math.sin(st8.k * Math.PI);
    el.setAttribute('transform', `translate(${e.X(x).toFixed(2)} ${e.Y(y0).toFixed(2)}) rotate(${(-ang).toFixed(2)}) scale(${e.sc.toFixed(3)} ${(-e.sc).toFixed(3)})`);
    el.setAttribute('opacity', st8.op.toFixed(2));
    const sp = el.querySelector('.spokes');
    if (sp) sp.setAttribute('transform', `translate(0 0.3) rotate(${(-(x / 0.3) * 180 / Math.PI).toFixed(1)})`);
    // рука штовхає обід; на «Ой, круто!» — напружено смикається, при скочуванні — гальмує
    const tag = st8.tag;
    const theta = tag === 'back' ? 0.95 : tag === 'strain' ? 1.0 + 0.12 * Math.sin(st8.k * 40)
      : st8.dir ? 1.22 + 0.6 * Math.sin((x / 0.3) * 0.9) : 1.22;
    const arm = el.querySelector('.arm');
    if (arm) arm.setAttribute('d', armPath(theta));
    const fx = (cls, op, tr) => { const n = el.querySelector(cls); if (n) { n.setAttribute('opacity', op.toFixed(2)); if (tr) n.setAttribute('transform', tr); } };
    fx('.fx-sweat', tag === 'strain' ? Math.min(1, st8.k * 3) : 0, `translate(0 ${(-0.12 * st8.k).toFixed(3)})`);
    fx('.fx-speed', tag === 'back' ? Math.sin(st8.k * Math.PI) : 0);
    fx('.fx-bump', tag === 'bump' ? Math.abs(Math.sin(st8.k * Math.PI * 3.5)) : 0);
    if (doorRef.current) doorRef.current.setAttribute('width', Math.max(0.05, 0.9 * st8.door) * e.sc);
    const b = bubRef.current;
    if (b) {
      const txt = { rest: 'Перепочинок', strain: 'Ой, круто!', back: 'Ой, круто!', bump: 'Не вміщуюсь!', cheer: e.cheerOk ? 'Ура! Доїхав!' : 'Доїхав, але…' }[st8.tag];
      if (txt) {
        const atDoor = st8.tag === 'cheer';
        const bx = atDoor ? e.X(e.wallX) - 40 : e.X(x + 0.2), by = Math.max(30, atDoor ? e.Y(e.H + 1.45) : e.Y(y0 + 1.35));
        const t = b.querySelector('text'), rc = b.querySelector('rect');
        if (t.textContent !== txt) { t.textContent = txt; rc.setAttribute('width', txt.length * 7.4 + 16); rc.setAttribute('x', -(txt.length * 7.4 + 16) / 2); }
        b.setAttribute('transform', `translate(${bx.toFixed(1)} ${by.toFixed(1)})`);
        b.setAttribute('opacity', Math.min(1, st8.k * 5).toFixed(2));
      } else b.setAttribute('opacity', '0');
    }
    const cf = confRef.current;
    if (cf) {
      const on = st8.tag === 'cheer' && e.cheerOk;
      cf.setAttribute('opacity', on ? (1 - st8.k).toFixed(2) : '0');
      if (on) {
        const k = st8.k;
        [...cf.children].forEach((c, i) => {
          const a = (i / cf.children.length) * Math.PI - Math.PI, v = 70 + (i % 3) * 25;
          c.setAttribute('transform', `translate(${(e.X(e.wallX) - 20 + Math.cos(a) * v * k).toFixed(1)} ${(e.Y(e.H + 1.2) + Math.sin(a) * v * k + 120 * k * k).toFixed(1)}) rotate(${i * 40 + k * 300})`);
        });
      }
    }
  }), []);

  return html`<svg viewBox="0 0 ${W} ${svgH}" width=${W} height=${svgH} class="view" role="img" aria-label="Профіль пандуса, вид збоку">
    <defs>
      <pattern id="${uid}h" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke=${C.line} stroke-width="1.2" />
      </pattern>
    </defs>
    <!-- ґрунт -->
    <rect x="0" y=${Y(0)} width=${W} height=${svgH - Y(0)} fill="url(#${uid}h)" opacity="0.6" />
    <line x1="0" y1=${Y(0)} x2=${W} y2=${Y(0)} stroke=${C.line} stroke-width="1.5" />
    <!-- будівля: стіна в розрізі, дверний проріз, підлога -->
    <rect x=${X(wallX)} y=${Y(H)} width=${W - X(wallX)} height=${(H - worldBot) * sc} fill=${C.concrete} />
    <line x1=${X(wallX)} y1=${Y(H)} x2=${W} y2=${Y(H)} stroke=${C.line} stroke-width="1.5" />
    <!-- укіс дверного прорізу (за площиною розрізу), перемичка в розрізі, полотно дверей -->
    <rect x=${X(wallX)} y=${0} width=${0.3 * sc} height=${Y(H)} fill="#26323f" />
    <rect ref=${doorRef} x=${X(wallX + 0.25)} y=${0} width=${0.05 * sc} height=${Y(H)} fill=${C.door} opacity="0.7" />
    <text x=${X(wallX + 0.35) + 4} y=${Y(H + 1.5)} class="lbl" fill=${C.muted}>вхід</text>

    <!-- тіло пандуса -->
    <path d=${body} fill=${C.concrete} />
    ${segs.filter((sg) => sg.type === 'landing').map((sg) => html`<rect x=${X(sg.x0)} y=${Y(sg.y)} width=${Math.max(0, (sg.x1 - sg.x0) * sc)} height=${Math.min(0.12, sg.y + 0.2) * sc + 1}
      fill=${s.landingMark ? C.landing : C.concrete} />`)}
    <!-- бортик по краю (бічна грань, за поверхнею) -->
    <path d=${P(pts.map((p) => ({ x: p.x, y: p.y + s.curb / 2 })))} fill="none" stroke=${curbClr} stroke-width=${Math.max(s.curb * sc, 1)} opacity="0.35" stroke-linejoin="round" />
    <path d=${surf} fill="none" stroke=${SC[ev.overall]} stroke-width="2.6" stroke-linejoin="round" class="tr-stroke" />
    ${!s.surface && html`<path d=${surf} fill="none" stroke=${C.fail} stroke-width="2.6" stroke-dasharray="6 6" />`}
    ${s.landingMark && marches.map((m) => {
      const dx = m.x1 - m.x0, dy = m.y1 - m.y0, l = Math.hypot(dx, dy), ux = dx / l * 0.1, uy = dy / l * 0.1;
      return html`<g stroke=${C.stripe} stroke-width="4"><line x1=${X(m.x0)} y1=${Y(m.y0) - 2} x2=${X(m.x0 + ux)} y2=${Y(m.y0 + uy) - 2} />
        <line x1=${X(m.x1 - ux)} y1=${Y(m.y1 - uy) - 2} x2=${X(m.x1)} y2=${Y(m.y1) - 2} /></g>`;
    })}
    ${s.overlays && marches.map((m) => {
      const n = Math.max(3, Math.floor((m.x1 - m.x0) * sc / 14));
      return Array.from({ length: n }, (_, i) => {
        const t = (i + 0.5) / n, x = m.x0 + t * (m.x1 - m.x0), y = m.y0 + t * (m.y1 - m.y0);
        return html`<rect x=${X(x) - 2} y=${Y(y) - 5} width="4" height="4" fill=${C.fail} />`;
      });
    })}

    <!-- опори -->
    ${postXs.map((px) => html`<line x1=${X(px)} y1=${Y(surfY(segs, px))} x2=${X(px)} y2=${Y(surfY(segs, px) + s.railTop + 0.03)} stroke=${postColor} stroke-width=${Math.max(0.04 * sc, 1.4)} />`)}

    <!-- поручні: 0,9 і 0,7 м з U-завершеннями (рис. 5г); дитячий 0,5 м (рис. 5а) -->
    <g fill="none" stroke-linecap="round" stroke-linejoin="round" class="tr-stroke">
      ${(s.kids || s.railChild) && html`<g stroke=${s.railChild ? railColor : C.fail} stroke-width=${railW} stroke-dasharray=${s.railChild ? null : '5 5'} opacity=${s.railChild ? 0.9 : 0.6}>
        <path d=${railLine(0.5 - r, childStraight)} />
        <path d=${childEnd(xs - childStraight, 0, -1)} /><path d=${childEnd(xe + childStraight, H, 1)} />
      </g>`}
      ${tube(railLine(aLow), railColor)}
      ${tube(railLine(aTop), railColor)}
      ${tube(loop(xs - straight, 0, -1), extColor)}
      ${tube(loop(xe + straight, H, 1), extColor)}
    </g>

    <!-- крісло колісне -->
    <g ref=${riderRef} opacity="0"><${ChairSide} /></g>
    <g ref=${confRef} opacity="0">${Array.from({ length: 14 }, (_, i) => html`<rect x="-3" y="-2" width="6" height="4" fill=${[C.stripe, C.ok, C.accent, '#ff8fb1'][i % 4]} />`)}</g>
    <g ref=${bubRef} opacity="0" class="bubble"><rect x="-40" y="-26" width="80" height="22" rx="11" /><text x="0" y="-11" text-anchor="middle">…</text></g>

    <!-- ухил -->
    <g style=${fade(['slope'])} class="fade">
      <path d="M ${X(m1.x0 + 1)} ${Y(m1.y0)} A ${sc} ${sc} 0 0 0 ${X(m1.x0 + Math.cos(Math.atan(s.slope / 100)))} ${Y(m1.y0 + Math.sin(Math.atan(s.slope / 100)))}" fill="none" stroke=${SC[slopeSt]} stroke-width="1.3" />
      <text x=${X(lx)} y=${Math.min(Y(ly + s.railTop) - 14, Y(ly) - 40)} text-anchor="middle" class="big" fill=${SC[slopeSt]}>${fmtT(s.slope, 1)} % · 1:${fmtT(100 / s.slope, 1)} · ${fmtT(Math.atan(s.slope / 100) * 180 / Math.PI, 1)}°</text>
    </g>

    <!-- поручні: розміри як на рис. 5г -->
    <g style=${fade(['rails'])} class="fade">
      ${[{ x0: xs, yb: 0, dir: -1, xp: xFirst }, { x0: xe, yb: H, dir: 1, xp: xLast }].map(({ x0, yb, dir, xp }) => {
        const xo = x0 + dir * s.railExt;                       // зовнішній край заокруглення
        const y300 = Y(yb + s.railTop) - 34, y150 = Y(yb + s.railTop) - 18;
        const clr = (id) => (st(id) === 'fail' ? C.fail : C.ink);
        const hx = (k) => Math.min(W - 30, Math.max(44, X(xo) + dir * k));
        return html`<g>
          <g stroke=${C.faint} stroke-width="0.8" stroke-dasharray="3 3">
            <line x1=${X(x0)} y1=${Y(yb)} x2=${X(x0)} y2=${y300 - 5} />
            <line x1=${X(xo)} y1=${Y(yb + s.railLow - r)} x2=${X(xo)} y2=${y300 - 5} />
            <line x1=${X(xp)} y1=${Y(yb + s.railTop + 0.03)} x2=${X(xp)} y2=${y150 - 5} />
          </g>
          <${DimH} x1=${X(Math.min(x0, xo))} x2=${X(Math.max(x0, xo))} y=${y300} up outside=${dir < 0 ? 'left' : 'right'} label=${fmt(s.railExt * 1000, 0)} text=${clr('railExt')} />
          <${DimH} x1=${X(Math.min(xp, xo))} x2=${X(Math.max(xp, xo))} y=${y150} up outside=${dir < 0 ? 'left' : 'right'} label=${fmt(s.postGap * 1000, 0)} text=${clr('postGap')} />
          <${DimV} x=${hx(14)} y1=${Y(yb)} y2=${Y(yb + s.railTop)} side=${dir} label=${fmt(s.railTop * 1000, 0)} text=${clr('railLevels')} />
          <${DimV} x=${hx(42)} y1=${Y(yb)} y2=${Y(yb + s.railLow)} side=${dir} label=${fmt(s.railLow * 1000, 0)} text=${clr('railLevels')} />
        </g>`;
      })}
    </g>

    <!-- висоти, площадки, довжини -->
    <g style=${fade(['flights'])} class="fade">
      <${DimV} x=${W - padR + 8} y1=${Y(0)} y2=${Y(H)} label=${`H ${fmt(H)}`} text=${C.ink} />
      ${segs.filter((sg) => sg.kind === 'mid' && sg.x1 - sg.x0 > 0.3).map((sg) => html`<text x=${X((sg.x0 + sg.x1) / 2)} y=${Y(sg.y) - 6} text-anchor="middle" class="lbl" fill=${st('landing') === 'fail' ? C.fail : C.muted}>площадка</text>`)}
      ${segs.map((sg) => html`<${DimH} x1=${X(sg.x0)} x2=${X(sg.x1)} y=${Y(0) + 22} label=${fmt(sg.x1 - sg.x0)} text=${sg.type === 'march' ? C.ink : st('landing') === 'fail' ? C.fail : C.muted} />`)}
      <${DimH} x1=${X(0)} x2=${X(wallX)} y=${Y(0) + 44} label=${`разом ${fmt(wallX)} м`} />
    </g>
    <g style=${fade(['safety'])} class="fade">
      <text x=${X(xe) - 4} y=${Y(H + s.curb) - 8} text-anchor="end" class="lbl" fill=${curbClr}>бортик ${fmt(s.curb * 1000, 0)} мм</text>
    </g>
  </svg>`;
}

/* ════════ ПОПЕРЕЧНИЙ ПЕРЕРІЗ (рис. 5а, 5д) ════════ */
export function SectionView({ s, ev, focus, W, maxH }) {
  const st = (id) => ev.byId[id] ? ev.byId[id].status : 'ok';
  const fade = (tags) => ({ opacity: tags.includes(focus) ? 1 : 0.22 });
  const r = s.railDiam / 2, half = s.width / 2;
  const zr = half + r, zp = half + 2 * r + 0.045, zE = zp + 0.06;   // вісь поручня, опори, край плити
  const worldW = 2 * zE + 0.25, worldTop = Math.max(s.railTop, 1.3) + 0.35, worldBot = -0.25;
  const padL = 46, padR = 74, padT = 34, padB = 40;
  const sc = Math.min((W - padL - padR) / worldW, (maxH - padT - padB) / (worldTop - worldBot));
  const svgH = Math.round(maxH);                                   // стала висота — без стрибків
  const top0 = padT + ((svgH - padT - padB) - (worldTop - worldBot) * sc) / 2;
  const cx = padL + (W - padL - padR) / 2;
  const X = (z) => cx + z * sc, Y = (y) => top0 + (worldTop - y) * sc;
  const cs = s.cross / 100;
  const ys = (z) => -(z + zE) * cs;                                // поперечний ухил униз праворуч
  const sides = s.railsBoth ? [-1, 1] : [1];
  const railColor = st('railLevels') === 'fail' || st('railDiam') === 'fail' ? C.fail : s.railContrast ? C.rail : C.railDull;
  const levels = [s.railTop, s.railLow, ...(s.railChild ? [0.5] : [])];
  const two = s.traffic === 'two';
  const chairs = two ? [-0.4, 0.4] : [0];
  const hitZ = (zc) => Math.abs(zc) + 0.35 > half - 1e-6;
  const wSt = st('width');
  const curbClr = st('curb') === 'fail' ? C.fail : C.accent;

  return html`<svg viewBox="0 0 ${W} ${svgH}" width=${W} height=${svgH} class="view" role="img" aria-label="Поперечний переріз пандуса">
    <path d="M ${X(-zE)} ${Y(ys(-zE))} L ${X(zE)} ${Y(ys(zE))} L ${X(zE)} ${Y(-0.2)} L ${X(-zE)} ${Y(-0.2)} Z" fill=${C.concrete} stroke=${SC[ev.overall]} stroke-width="1.5" />
    <line x1=${X(-zE)} y1=${Y(ys(-zE))} x2=${X(zE)} y2=${Y(ys(zE))} stroke=${SC[ev.overall]} stroke-width="2.6" />
    ${[-1, 1].map((sg) => html`<rect x=${sg < 0 ? X(-zE) : X(zE - 0.05)} y=${Y(ys(sg * zE) + s.curb)} width=${0.05 * sc} height=${Math.max(s.curb * sc, 1)} fill=${curbClr} />`)}

    ${sides.map((sg) => html`<g>
      <rect x=${X(sg * zp) - 0.02 * sc} y=${Y(ys(sg * zp) + s.railTop + 0.05)} width=${0.04 * sc} height=${(s.railTop + 0.05) * sc} fill=${C.faint} />
      ${levels.map((lvl) => {
        const yb = ys(sg * zr) + lvl;
        return html`<g>
          <path d="M ${X(sg * (zp - 0.02))} ${Y(yb - 2 * r - 0.05)} L ${X(sg * zr)} ${Y(yb - 2 * r - 0.05)} L ${X(sg * zr)} ${Y(yb - 2 * r)}" fill="none" stroke=${C.faint} stroke-width=${Math.max(0.012 * sc, 1)} />
          <circle cx=${X(sg * zr)} cy=${Y(yb - r)} r=${Math.max(r * sc, 2.2)} fill=${lvl === 0.5 ? 'none' : railColor} stroke=${railColor} stroke-width="1.4" />
        </g>`;
      })}
    </g>`)}

    ${chairs.map((zc, i) => html`<g class=${'chair' + (hitZ(zc) ? ' shake' : ' bob')} style=${{ animationDelay: `${i * 0.4}s` }}>
      <g transform="translate(${X(zc)} ${Y(ys(zc))}) scale(${sc} ${-sc})"><${ChairFront} hit=${hitZ(zc)} /></g></g>`)}
    ${chairs.some(hitZ) && html`<text x=${X(0)} y=${Y(1.45)} text-anchor="middle" class="big" fill=${C.fail}>не вміщується!</text>`}
    ${two && !chairs.some(hitZ) && html`<text x=${X(0)} y=${Y(1.45)} text-anchor="middle" class="lbl" fill=${C.muted}>двобічний рух</text>`}

    <g style=${fade(['width'])} class="fade">
      ${sides.length === 2 && html`<line x1=${X(-half)} y1=${Y(worldTop - 0.1)} x2=${X(-half)} y2=${Y(ys(-half) + 0.1)} stroke=${SC[wSt]} stroke-dasharray="4 4" opacity="0.7" />`}
      <line x1=${X(half)} y1=${Y(worldTop - 0.1)} x2=${X(half)} y2=${Y(ys(half) + 0.1)} stroke=${SC[wSt]} stroke-dasharray="4 4" opacity="0.7" />
      <${DimH} x1=${X(-half)} x2=${X(half)} y=${Y(worldTop - 0.16)} up label=${(half * 2 * sc > 130 ? `${fmt(s.width)} м у просвіті` : `${fmt(s.width)} м`)} color=${SC[wSt]} text=${SC[wSt]} outside />
    </g>
    <g style=${fade(['rails'])} class="fade">
      ${levels.map((lvl, i) => html`<${DimV} x=${X(zE) + 14 + i * 22} y1=${Y(ys(zr))} y2=${Y(ys(zr) + lvl)} label=${fmt(lvl * 1000, 0)}
        text=${lvl !== 0.5 && st('railLevels') === 'fail' ? C.fail : C.ink} />`)}
      <text x=${X(sides[0] * zr) + (sides[0] < 0 ? -10 : 10)} y=${Y(ys(sides[0] * zr) + s.railTop) - 8} text-anchor=${sides[0] < 0 ? 'end' : 'start'} class="lbl"
        fill=${st('railDiam') === 'fail' ? C.fail : C.ink}>Ø ${fmt(s.railDiam * 1000, 0)}</text>
    </g>
    <g style=${fade(['slope', 'safety'])} class="fade">
      <text x=${X(0)} y=${Y(-0.2) + 16} text-anchor="middle" class="lbl" fill=${SC[st('cross')]}>поперечний ухил ${fmtT(s.cross, 1)} % →</text>
      <text x=${X(0)} y=${Y(-0.2) + 31} text-anchor="middle" class="lbl" fill=${curbClr}>бортики ${fmt(s.curb * 1000, 0)} мм</text>
    </g>
  </svg>`;
}

/* ════════ ПЛАН (вид зверху) ════════ */
export function PlanView({ s, segs, ev, focus, W, maxH }) {
  const st = (id) => ev.byId[id] ? ev.byId[id].status : 'ok';
  const fade = (tags) => ({ opacity: tags.includes(focus) ? 1 : 0.2 });
  const r = s.railDiam / 2, half = s.width / 2;
  const zr = half + r, zp = half + 2 * r + 0.045, zE = zp + 0.06;
  const wallX = segs[segs.length - 1].x1;
  const worldW = wallX + 0.35, worldH = 2 * zE;
  const padL = 12, padR = 70, padT = 26, padB = 40;
  const sc = Math.min((W - padL - padR) / worldW, (maxH - padT - padB) / worldH);
  const svgH = Math.round(maxH);                                   // стала висота — без стрибків
  const top0 = padT + ((svgH - padT - padB) - worldH * sc) / 2;
  const offX = padL + ((W - padL - padR) - worldW * sc) / 2;
  const X = (x) => offX + x * sc, Y = (z) => top0 + (z + zE) * sc;
  const marches = segs.filter((sg) => sg.type === 'march');
  const xs = marches[0].x0, xe = marches[marches.length - 1].x1;
  const railColor = st('railLevels') === 'fail' || st('railDiam') === 'fail' ? C.fail : s.railContrast ? C.rail : C.railDull;
  const sides = s.railsBoth ? [-1, 1] : [1];
  const curbClr = st('curb') === 'fail' ? C.fail : C.accent;
  const cross = s.cross, crossSt = st('cross');
  const topL = segs[segs.length - 1];
  const two = s.traffic === 'two';

  const chairRef = useRef(null), chair2Ref = useRef(null);
  const env = useRef(null);
  env.current = { X, Y, sc, wallX, two };
  useEffect(() => subscribe(() => {
    const e = env.current, st8 = rider.state;
    if (!st8) return;
    const zc = e.two ? 0.4 : 0;
    const a = chairRef.current, b = chair2Ref.current;
    if (a) { a.setAttribute('transform', `translate(${e.X(st8.x + 0.22).toFixed(1)} ${e.Y(zc).toFixed(1)}) scale(${e.sc.toFixed(3)})`); a.setAttribute('opacity', st8.op.toFixed(2)); }
    if (b) { const x2 = e.wallX - 0.9 - (st8.x - 0.15) * 0.8; b.setAttribute('transform', `translate(${e.X(Math.max(x2, 0.5)).toFixed(1)} ${e.Y(-0.4).toFixed(1)}) scale(${e.sc.toFixed(3)}) rotate(180)`); }
  }), []);
  const hit = (zc) => Math.abs(zc) + 0.35 > half - 1e-6;

  // крапельки дощу: стікають до нижнього краю (1–2 %), стоять калюжею (< 1 %), «зносять» крісло (> 2 %)
  const drops = [];
  for (let i = 0; i < 7; i++) drops.push({ x: topL.x0 + (topL.x1 - topL.x0) * ((i + 0.5) / 7), z: -half * 0.6 + (i % 3) * 0.2, d: i * 0.37 });

  return html`<svg viewBox="0 0 ${W} ${svgH}" width=${W} height=${svgH} class="view" role="img" aria-label="План пандуса, вид зверху">
    <rect x=${X(0)} y=${Y(-zE)} width=${wallX * sc} height=${worldH * sc} fill=${TINT[ev.overall]} stroke=${SC[ev.overall]} stroke-width="1.6" class="tr-stroke" />
    ${segs.filter((sg) => sg.type === 'landing').map((sg) => html`<rect x=${X(sg.x0)} y=${Y(-zE)} width=${Math.max(0, (sg.x1 - sg.x0) * sc)} height=${worldH * sc}
      fill=${s.landingMark ? 'rgba(92,198,232,0.14)' : 'rgba(233,238,245,0.04)'} stroke=${C.line} />`)}
    <rect x=${X(wallX)} y=${Y(-zE) - 14} width=${0.3 * sc} height=${worldH * sc + 28} fill=${C.wall} />
    <rect x=${X(wallX)} y=${Y(-0.45)} width=${0.3 * sc} height=${0.9 * sc} fill=${C.concrete} />
    ${s.landingMark && marches.map((m) => html`<g fill=${C.stripe} opacity="0.9">
      <rect x=${X(m.x0)} y=${Y(-zE)} width=${Math.max(0.1 * sc, 2)} height=${worldH * sc} />
      <rect x=${X(m.x1) - Math.max(0.1 * sc, 2)} y=${Y(-zE)} width=${Math.max(0.1 * sc, 2)} height=${worldH * sc} /></g>`)}
    ${s.overlays && marches.map((m) => {
      const n = Math.max(3, Math.floor((m.x1 - m.x0) * sc / 16));
      return Array.from({ length: n }, (_, i) => html`<line x1=${X(m.x0 + (i + 0.5) / n * (m.x1 - m.x0))} y1=${Y(-half + 0.05)} x2=${X(m.x0 + (i + 0.5) / n * (m.x1 - m.x0))} y2=${Y(half - 0.05)} stroke=${C.fail} stroke-width="2" />`);
    })}
    ${marches.map((m) => {
      const n = Math.max(1, Math.floor((m.x1 - m.x0) * sc / 60));
      return Array.from({ length: n }, (_, i) => {
        const x = X(m.x0 + (i + 0.5) / n * (m.x1 - m.x0)), y = Y(two ? 0.4 : 0);
        return html`<path d="M ${x - 5} ${y - 6} L ${x + 3} ${y} L ${x - 5} ${y + 6}" fill="none" stroke=${C.faint} stroke-width="1.6" />`;
      });
    })}

    <!-- бортики по краях -->
    ${[-1, 1].map((sg) => html`<rect x=${X(xs)} y=${sg < 0 ? Y(-zE) : Y(zE - 0.05)} width=${(topL.x1 - xs) * sc} height=${Math.max(0.05 * sc, 2)} fill=${curbClr} opacity="0.8" />`)}
    <!-- поручні та опори -->
    ${sides.map((sg) => html`<g>
      <line x1=${X(xs - s.railExt)} y1=${Y(sg * zr)} x2=${X(xe + s.railExt)} y2=${Y(sg * zr)} stroke=${railColor} stroke-width=${Math.max(s.railDiam * sc, 2)} stroke-linecap="round" />
      ${[xs - s.railExt + s.postGap, xe + s.railExt - s.postGap].map((px) => html`<rect x=${X(px) - Math.max(0.02 * sc, 1.5)} y=${Y(sg * zp) - Math.max(0.02 * sc, 1.5)} width=${Math.max(0.04 * sc, 3)} height=${Math.max(0.04 * sc, 3)} fill=${st('postGap') === 'fail' ? C.fail : C.faint} />`)}
    </g>`)}

    <!-- дощ і поперечний ухил на верхній площадці -->
    <g style=${fade(['slope', 'safety'])} class="fade">
      ${drops.map((d) => html`<circle cx=${X(d.x)} cy=${Y(d.z)} r="2.4" fill=${C.water}
        class=${crossSt === 'ok' ? 'drop flow' : cross < 1 ? 'drop pool' : 'drop flow fast'}
        style=${{ animationDelay: `${d.d}s`, '--dy': `${Math.max(10, (half - d.z) * sc)}px` }} />`)}
      ${cross < 1 && html`<ellipse cx=${X((topL.x0 + topL.x1) / 2)} cy=${Y(0)} rx=${0.5 * sc} ry=${0.22 * sc} fill="rgba(92,198,232,0.22)" stroke=${C.water} class="puddle" />`}
      <text x=${X((topL.x0 + topL.x1) / 2)} y=${Y(zE) + 15} text-anchor="middle" class="lbl" fill=${SC[crossSt]}>
        ${cross < 1 ? 'калюжа' : cross > 2 ? 'зносить убік' : 'вода стікає'} · ${fmtT(cross, 1)} %</text>
    </g>

    <!-- крісла: 1 або 2 смуги руху -->
    <g ref=${chairRef} opacity="0"><${ChairTop} hit=${hit(two ? 0.4 : 0)} /></g>
    ${two && html`<g ref=${chair2Ref}><${ChairTop} hit=${hit(0.4)} /></g>`}
    <!-- коло розвороту Ø 1,5 м на верхній площадці -->
    <g style=${fade(['flights'])} class="fade">
      <circle cx=${X(topL.x0 + Math.min(0.75, (topL.x1 - topL.x0) / 2))} cy=${Y(0)} r=${0.75 * sc} fill="none" stroke=${st('landing') === 'fail' ? C.fail : C.faint} stroke-dasharray="4 4" />
      ${segs.filter((sg) => sg.type === 'landing').map((sg) => html`<${DimH} x1=${X(sg.x0)} x2=${X(sg.x1)} y=${Y(zE) + 22} label=${fmt(sg.x1 - sg.x0)}
        text=${st('landing') === 'fail' ? C.fail : C.muted} />`)}
    </g>
    <g style=${fade(['width'])} class="fade">
      <${DimV} x=${X(wallX) + 0.3 * sc + 22} y1=${Y(-half)} y2=${Y(half)} label=${fmt(s.width)} text=${SC[st('width')]} color=${SC[st('width')]} />
    </g>
  </svg>`;
}

/** Ширина контейнера в px — схеми малюються «піксель у піксель», тож підписи читаються й на телефоні. */
export function useWidth(ref, fallback = 900) {
  const [w, setW] = useStateW(() => Math.max(260, Math.min(fallback, innerWidth - 40)));   // без «спалаху» на телефоні
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}
