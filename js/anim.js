/* Один спільний цикл анімації (requestAnimationFrame) для всіх схем.
   Їздець у кріслі рухається за «таймлайном», який будується з геометрії пандуса;
   фаза накопичується по кадрах, тож рух повзунка не скидає анімацію. */

const subs = new Set();
let raf = 0, last = 0;

export const rider = { t: 0, tl: null, key: '', state: null };

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 1 || document.hidden) dt = 0;            // після прихованої вкладки — без ривка
  else if (dt > 0.25) dt = 0.25;                    // повільний пристрій — рух сповільнюється, але не зупиняється
  if (rider.tl) {
    rider.t = (rider.t + dt) % rider.tl.cycle;
    rider.state = rider.tl.at(rider.t);
  }
  for (const f of subs) f(now, dt);
  raf = subs.size ? requestAnimationFrame(frame) : 0;
}

export function subscribe(f) {
  subs.add(f);
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  return () => subs.delete(f);
}

const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const easeOut = (u) => 1 - (1 - u) * (1 - u);
const easeIn = (u) => u * u;

/* Положення крісла задається точкою контакту заднього колеса (м уздовж пандуса).
   mode: 'go' — заїжджає і в'їжджає у двері; 'slip' — заскладно, скочується; 'narrow' — не вміщується. */
export function setRiderEnv({ segs, mode, wallX, verdict }) {
  const marches = segs.filter((sg) => sg.type === 'march');
  const xs = marches[0].x0;
  const key = mode;
  const steps = [];
  let x = 0.15;
  const wait = (d, tag) => steps.push({ type: 'wait', x, d, tag });
  const move = (x1, speed, ease = null, tag = 'move') => {
    const d = Math.abs(x1 - x) / speed;
    if (d > 0.001) steps.push({ type: 'move', x0: x, x1, d, ease, tag });
    x = x1;
  };

  if (mode === 'go') {
    wait(0.35, 'in');
    // рух по ділянках: схилом повільніше, на кожній проміжній площадці — перепочинок
    const pieces = [];
    for (const sg of segs) {
      if (sg.x1 <= x) continue;
      if (sg.type === 'march') pieces.push({ to: sg.x1, speed: 0.75 });
      else if (sg.kind === 'mid') pieces.push({ to: (sg.x0 + sg.x1) / 2 - 0.3, speed: 1.3, rest: true }, { to: sg.x1, speed: 1.3 });
      else if (sg.kind === 'bottom') pieces.push({ to: sg.x1, speed: 1.3 });
    }
    const stopX = wallX - 0.8;
    const raw = pieces.reduce((a, p, i) => a + Math.abs(p.to - (i ? pieces[i - 1].to : x)) / p.speed, 0) + Math.abs(stopX - pieces[pieces.length - 1].to) / 1.3;
    const f = Math.min(3, Math.max(0.9, raw / 5.5));            // будь-який пандус проїжджається за ~5–6 с
    pieces.forEach((p, i) => { move(p.to, p.speed * f, i === 0 ? easeIn : null); if (p.rest) wait(0.55, 'rest'); });
    move(stopX, 1.3 * f, easeOut);
    wait(0.6, 'door');
    move(wallX + 0.5, 1.4, easeIn, 'enter');
    wait(verdict === 'ok' ? 1.3 : 1.0, 'cheer');
  } else if (mode === 'slip') {
    // «не може заїхати»: швидкий під'їзд, ривок угору, зупинка, скочування назад
    const m = marches[0], len = m.x1 - m.x0;
    wait(0.25, 'in');
    move(Math.max(0.2, xs - 0.35), 2.0, easeIn);
    move(xs + Math.min(0.35 * len, 1.2), 0.95, easeOut, 'climb');
    wait(0.55, 'strain');
    move(0.15, 3.2, easeIn, 'back');
    wait(0.45, 'rest0');
  } else {
    wait(0.25, 'in');
    move(Math.max(0.2, xs - 0.95), 1.7, easeOut);
    wait(0.9, 'bump');
    move(Math.max(0.15, xs - 1.4), 1.4, easeInOut);
    wait(0.4, 'rest0');
  }

  let acc = 0;
  for (const st of steps) { st.t0 = acc; acc += st.d; }
  const cycle = acc;
  const at = (t) => {
    let st = steps[steps.length - 1];
    for (const s of steps) if (t < s.t0 + s.d) { st = s; break; }
    const k = Math.min(1, Math.max(0, (t - st.t0) / st.d));
    let px = st.type === 'move' ? st.x0 + (st.x1 - st.x0) * (st.ease ? st.ease(k) : k) : st.x;
    let op = 1, door = 0;
    if (st.tag === 'in') op = k;
    if (st.tag === 'door') door = easeInOut(Math.min(1, k * 1.6));
    if (st.tag === 'enter') { door = 1; op = 1 - k; }
    if (st.tag === 'cheer') { door = 1 - easeInOut(Math.min(1, k * 1.5)); op = 0; }
    if (st.tag === 'bump') px += Math.sin(k * Math.PI * 7) * 0.05 * (1 - k);
    return { x: px, op, door, tag: st.tag, k, dir: st.type === 'move' ? Math.sign(st.x1 - st.x0) : 0 };
  };
  if (rider.key !== key) { rider.t = 0; rider.key = key; }
  rider.tl = { cycle, at, mode, xs };
  rider.state = at(rider.t % cycle);
}
