/* Схеми: профіль (вид збоку) і план (вид зверху). Масштаб чесний: 1 м по X = 1 м по Y. */
const { fmt: nFmt, fmtT: nFmtT } = window.RampNorms;

const C = {
  ok: '#41c463', warn: '#dba62e', fail: '#f2554d',
  okDim: 'rgba(65,196,99,0.13)', warnDim: 'rgba(219,166,46,0.13)', failDim: 'rgba(242,85,77,0.13)',
  accent: '#56b9d8', ink: '#e7edf4', muted: '#8b99aa', faint: '#5c6b7d',
  line: '#243140', steel: '#a8bccd', stripe: '#ffd84d',
};
const OVERALL = {
  ok: { solid: C.ok, dim: C.okDim },
  limit: { solid: C.warn, dim: C.warnDim },
  fail: { solid: C.fail, dim: C.failDim },
};
const stColor = (st) => (st === 'ok' ? C.ok : st === 'limit' ? C.warn : C.fail);

/* Послідовність ділянок: нижня площадка → марші (± проміжні площадки) → верхня площадка.
   s.interDepth (якщо задано) — анімована глибина лише проміжних площадок (для морфу). */
function buildSegments(s, g) {
  const d = s.landingDepth;
  const di = s.interDepth != null ? s.interDepth : s.landingDepth;
  const segs = [{ type: 'landing', x0: 0, x1: d, y: 0, kind: 'нижня' }];
  let x = d, y = 0;
  for (let i = 0; i < g.n; i++) {
    segs.push({ type: 'march', x0: x, x1: x + g.lm, y0: y, y1: y + g.h, idx: i });
    x += g.lm; y += g.h;
    if (i < g.n - 1) {
      segs.push({ type: 'landing', x0: x, x1: x + di, y, kind: 'проміжна' });
      x += di;
    }
  }
  segs.push({ type: 'landing', x0: x, x1: x + d, y, kind: 'верхня' });
  return segs;
}
const topPts = (segs) => {
  const pts = [{ x: 0, y: 0 }];
  for (const sg of segs) pts.push({ x: sg.x1, y: sg.type === 'march' ? sg.y1 : sg.y });
  return pts;
};

/* ── розмірні лінії (архітектурні засічки 45°) ── */
function DimH({ x1, x2, y, label, color = C.faint, text = C.muted, up = false }) {
  if (x2 - x1 < 6) return null;
  return (
    <g stroke={color} strokeWidth="1" fill="none">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} />
      <line x1={x1 - 3} y1={y + 3} x2={x1 + 3} y2={y - 3} />
      <line x1={x2 - 3} y1={y + 3} x2={x2 + 3} y2={y - 3} />
      <text x={(x1 + x2) / 2} y={up ? y - 5 : y + 13} fill={text} fontSize="10.5" textAnchor="middle" stroke="none">{label}</text>
    </g>
  );
}
function DimV({ x, y1, y2, label, color = C.faint, text = C.muted, side = 1 }) {
  if (Math.abs(y2 - y1) < 6) return null;
  return (
    <g stroke={color} strokeWidth="1" fill="none">
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} />
      <line x1={x - 4} y1={y2} x2={x + 4} y2={y2} />
      <line x1={x - 3} y1={y1 + 3} x2={x + 3} y2={y1 - 3} />
      <line x1={x - 3} y1={y2 + 3} x2={x + 3} y2={y2 - 3} />
      <text x={x + 7 * side} y={(y1 + y2) / 2 + 4} fill={text} fontSize="10.5"
        textAnchor={side > 0 ? 'start' : 'end'} stroke="none">{label}</text>
    </g>
  );
}

/* ── фігура: крісло колісне, вид збоку (метри, y вгору; початок — точка контакту заднього колеса) ── */
function WheelchairSide({ sw = 0.035 }) {
  return (
    <g fill="none" stroke={C.steel} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="0" cy="0.31" r="0.31" />
      <circle cx="0" cy="0.31" r="0.24" strokeWidth={sw * 0.6} opacity="0.6" />
      <circle cx="0" cy="0.31" r="0.05" fill={C.steel} stroke="none" />
      <circle cx="0.58" cy="0.08" r="0.08" />
      <path d="M -0.02 0.55 L 0.38 0.55 M -0.02 0.55 L -0.11 0.93 M 0.38 0.55 L 0.50 0.32 L 0.58 0.32 M 0.30 0.55 L 0.52 0.16" />
      <circle cx="0.03" cy="1.06" r="0.105" />
      <path d="M 0.05 0.94 L 0.11 0.58 L 0.40 0.63 L 0.47 0.36" />
      <path d="M 0.07 0.84 L 0.27 0.62" />
    </g>
  );
}
/* вид зверху (метри, по ходу руху +x, початок — центр) */
function WheelchairTop({ sw = 0.03 }) {
  return (
    <g fill="none" stroke={C.steel} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="-0.45" y="-0.36" width="0.62" height="0.075" rx="0.037" />
      <rect x="-0.45" y="0.285" width="0.62" height="0.075" rx="0.037" />
      <rect x="0.28" y="-0.31" width="0.17" height="0.055" rx="0.027" />
      <rect x="0.28" y="0.255" width="0.17" height="0.055" rx="0.027" />
      <rect x="-0.33" y="-0.255" width="0.5" height="0.51" rx="0.07" />
      <ellipse cx="-0.16" cy="0" rx="0.09" ry="0.24" />
      <circle cx="-0.08" cy="0" r="0.1" fill="#0d1219" />
      <line x1="0.5" y1="-0.2" x2="0.5" y2="0.2" />
    </g>
  );
}

/* Анімований їздець: котиться по поверхні; якщо засто круто — пробує, нахиляється і з'їжджає назад.
   Фаза p ∈ [0,1) накопичується по кадрах (НЕ від абсолютного часу), тож зміна геометрії
   повзунком не скидає період — рух лишається плавним, без «перемотки» і смикання. */
function Rider({ segs, X, Y, sc, slope, status, totalLen, m1 }) {
  const ref = React.useRef(null);
  const env = React.useRef({});
  env.current = { segs, X, Y, sc, slope, status, totalLen, m1 };
  const pRef = React.useRef(0);
  const lastRef = React.useRef(0);
  const statusRef = React.useRef(status);
  React.useEffect(() => {
    let raf;
    lastRef.current = performance.now();
    const easeOut = (u) => 1 - Math.pow(1 - u, 3);
    const easeIn = (u) => u * u * u;
    const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
    const surf = (x, e) => {
      for (const sg of e.segs) {
        if (x <= sg.x1) {
          if (sg.type === 'march') {
            const t = Math.max(0, (x - sg.x0) / Math.max(sg.x1 - sg.x0, 1e-9));
            return { y: sg.y0 + t * (sg.y1 - sg.y0), a: Math.atan(e.slope) * 180 / Math.PI };
          }
          return { y: sg.y, a: 0 };
        }
      }
      const last = e.segs[e.segs.length - 1];
      return { y: last.type === 'march' ? last.y1 : last.y, a: 0 };
    };
    const tick = (now) => {
      const e = env.current;
      const el = ref.current;
      // тривалість циклу залежить лише від стану (стала), тож фаза не стрибає при зміні геометрії
      const cycle = e.status === 'fail' ? 6.8 : e.status === 'limit' ? 10.5 : 7.2;
      let dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      if (dt > 0.1) dt = 0.1;            // після прихованої вкладки — без ривка
      if (statusRef.current !== e.status) { pRef.current = 0; statusRef.current = e.status; }
      pRef.current = (pRef.current + dt / cycle) % 1;
      const p = pRef.current;
      if (el) {
        let x, tilt = 0, op = 1;
        if (e.status === 'fail') {
          const x0 = 0.4;
          const xTry = e.m1.x0 + Math.min(0.45 * (e.m1.x1 - e.m1.x0), 2.4);
          const maxTilt = 9 + Math.max(0, e.slope - 0.08) * 90;
          if (p < 0.3) { x = x0 + (xTry - x0) * easeOut(p / 0.3); }
          else if (p < 0.48) { const v = (p - 0.3) / 0.18; x = xTry; tilt = maxTilt * v + Math.sin(now / 1000 * 16) * 1.4 * v; }
          else if (p < 0.78) { const v = (p - 0.48) / 0.3; x = xTry - (xTry - x0) * easeIn(v); tilt = maxTilt * (1 - v); }
          else { x = x0; }
        } else {
          const x1 = 0.25, x2 = Math.max(e.totalLen - 0.95, x1 + 0.5);
          if (p < 0.82) { x = x1 + (x2 - x1) * easeInOut(p / 0.82); }
          else { x = x2; }
          // плавна поява внизу і згасання вгорі
          if (p < 0.06) op = p / 0.06;
          else if (p > 0.82) op = Math.max(0, 1 - (p - 0.82) / 0.18);
        }
        const { y, a } = surf(x, e);
        el.setAttribute('transform', `translate(${e.X(x)} ${e.Y(y)}) rotate(${-(a + tilt)}) scale(${e.sc} ${-e.sc})`);
        el.setAttribute('opacity', op.toFixed(3));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <g ref={ref} opacity="0"><WheelchairSide /></g>;
}

/* ════════ ПРОФІЛЬ ════════ */
function ProfileView({ s, g, ev, focus }) {
  const W = 980, maxH = 390;
  const padL = 16, padR = 96, padT = 18, padB = 64;
  const segs = buildSegments(s, g);
  const pts = topPts(segs);
  const H = s.H;
  const worldW = g.totalLen;
  const worldH = Math.max(H + s.railTop + 0.45, 0.45 * g.h + 1.62, 1.9);
  const sc = Math.min((W - padL - padR) / worldW, (maxH - padT - padB) / worldH);
  const svgH = Math.ceil(worldH * sc + padT + padB);
  const offX = padL + ((W - padL - padR) - worldW * sc) / 2;
  const X = (x) => offX + x * sc;
  const Y = (y) => svgH - padB - y * sc;

  const item = (id) => ev.items.find((i) => i.id === id);
  const oc = OVERALL[ev.overall];
  const fade = (tag) => ({ opacity: focus === tag ? 1 : 0.15, transition: 'opacity 0.25s' });
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const slabPath = 'M ' + pts.map((p) => `${X(p.x)} ${Y(p.y)}`).join(' L ') + ` L ${X(worldW)} ${Y(0)} Z`;
  const surfPath = 'M ' + pts.map((p) => `${X(p.x)} ${Y(p.y)}`).join(' L ');

  /* поручні */
  const innerPts = pts.slice(1, pts.length - 1); // від початку першого маршу до кінця останнього
  const railPath = (lvl, ext) => {
    const p0 = innerPts[0], pN = innerPts[innerPts.length - 1];
    const ps = [{ x: p0.x - ext, y: p0.y + lvl }, ...innerPts.map((p) => ({ x: p.x, y: p.y + lvl })), { x: pN.x + ext, y: pN.y + lvl }];
    return 'M ' + ps.map((p) => `${X(p.x)} ${Y(p.y)}`).join(' L ');
  };
  const railFail = ['railTop', 'railDiam'].some((id) => item(id).status === 'fail');
  const railColor = railFail ? C.fail : C.steel;
  const extColor = item('railExt').status === 'fail' ? C.fail : railColor;
  const railW = Math.max(s.railDiam * sc, 1.6);
  const p0 = innerPts[0], pN = innerPts[innerPts.length - 1];

  /* стовпчики */
  const posts = [];
  innerPts.forEach((p) => posts.push(p));
  segs.filter((sg) => sg.type === 'march').forEach((sg) => posts.push({ x: (sg.x0 + sg.x1) / 2, y: (sg.y0 + sg.y1) / 2 }));

  /* фігура на першому марші */
  const m1 = segs.find((sg) => sg.type === 'march');
  const ft = 0.42;
  const fx = m1.x0 + ft * (m1.x1 - m1.x0), fy = m1.y0 + ft * (m1.y1 - m1.y0);
  const extraTilt = Math.max(0, s.slope - 0.08) * 130;

  /* підпис ухилу */
  const lt = 0.74;
  const lx = m1.x0 + lt * (m1.x1 - m1.x0), ly = m1.y0 + lt * (m1.y1 - m1.y0);
  const slopeSt = item('slope').status;
  const curbSt = item('curb').status;
  const curbBand = 'M ' + innerPts.map((p) => `${X(p.x)} ${Y(p.y + s.curb)}`).join(' L ');

  const marchDims = segs.map((sg, i) => (
    <DimH key={i} x1={X(sg.x0)} x2={X(sg.x1)} y={Y(0) + 24}
      label={sg.type === 'march' ? `${nFmt(g.lm)} м` : nFmt(sg.x1 - sg.x0)}
      text={sg.type === 'march' ? C.ink : C.muted} />
  ));

  return (
    <svg viewBox={`0 0 ${W} ${svgH}`} role="img" aria-label="Профіль пандуса">
      {/* ґрунт */}
      <line x1="0" y1={Y(0)} x2={W} y2={Y(0)} stroke={C.line} strokeWidth="1.5" />
      {Array.from({ length: Math.floor(W / 26) }, (_, i) => (
        <line key={i} x1={i * 26 + 8} y1={Y(0)} x2={i * 26 - 1} y2={Y(0) + 8} stroke={C.line} strokeWidth="1" />
      ))}
      {/* існуючий верхній рівень */}
      <line x1={X(worldW)} y1={Y(H)} x2={W} y2={Y(H)} stroke={C.line} strokeWidth="1.5" strokeDasharray="6 5" />

      {/* тіло пандуса — колір зведеного стану */}
      <path d={slabPath} fill={oc.dim} stroke="none" style={{ transition: 'fill 0.3s' }} />
      <path d={surfPath} fill="none" stroke={oc.solid} strokeWidth="2.6" strokeLinejoin="round" style={{ transition: 'stroke 0.3s' }} />

      {/* покриття з дефектами */}
      {!s.surfaceGood && (
        <g>
          <path d={surfPath} fill="none" stroke={C.fail} strokeWidth="2.6" strokeDasharray="7 6" strokeLinejoin="round" />
          {segs.filter((sg) => sg.type === 'march').map((sg, i) => {
            const n = Math.max(2, Math.floor((sg.x1 - sg.x0) * sc / 46));
            return Array.from({ length: n }, (_, k) => {
              const t = (k + 0.5) / n;
              const bx = sg.x0 + t * (sg.x1 - sg.x0), by = sg.y0 + t * (sg.y1 - sg.y0);
              return <circle key={i + '-' + k} cx={X(bx)} cy={Y(by) - 4} r="2.4" fill="none" stroke={C.fail} strokeWidth="1.2" />;
            });
          })}
        </g>
      )}

      {/* контрастні смуги на межах маршів */}
      {s.contrast && (
        <g>
          {segs.filter((sg) => sg.type === 'march').map((sg, i) => {
            const dx = (sg.x1 - sg.x0), dy = (sg.y1 - sg.y0), len = Math.hypot(dx, dy);
            const ux = dx / len, uy = dy / len;
            return (
              <g key={i} stroke={C.stripe} strokeWidth="4.5" strokeLinecap="butt">
                <line x1={X(sg.x0)} y1={Y(sg.y0) - 1.5} x2={X(sg.x0 + ux * 0.1)} y2={Y(sg.y0 + uy * 0.1) - 1.5} />
                <line x1={X(sg.x1 - ux * 0.1)} y1={Y(sg.y1 - uy * 0.1) - 1.5} x2={X(sg.x1)} y2={Y(sg.y1) - 1.5} />
              </g>
            );
          })}
        </g>
      )}

      {/* бортик */}
      <g>
        <path d={curbBand} fill="none" stroke={curbSt === 'fail' ? C.fail : C.accent}
          strokeWidth={Math.max(s.curb * sc, 1)} opacity="0.85" strokeLinejoin="round" />
        {focus === 'edge' && (
          <text x={X(pN.x - 0.1)} y={Y(pN.y + s.curb) - 6} fontSize="10.5" textAnchor="end"
            fill={curbSt === 'fail' ? C.fail : C.accent}>бортик {nFmt(s.curb)} м</text>
        )}
      </g>

      {/* поручні */}
      <g>
        {posts.map((p, i) => (
          <line key={i} x1={X(p.x)} y1={Y(p.y)} x2={X(p.x)} y2={Y(p.y + s.railTop)} stroke={C.faint} strokeWidth="1.5" />
        ))}
        <path d={railPath(0.7, Math.min(s.railExt, 0.12))} fill="none" stroke={railColor} strokeWidth={railW * 0.8} opacity="0.75" strokeLinejoin="round" strokeLinecap="round" />
        {s.railChild && (
          <path d={railPath(0.5, Math.min(s.railExt, 0.12))} fill="none" stroke={railColor} strokeWidth={railW * 0.7} opacity="0.6" strokeDasharray="5 4" strokeLinejoin="round" />
        )}
        <path d={railPath(s.railTop, s.railExt)} fill="none" stroke={railColor} strokeWidth={railW} strokeLinejoin="round" strokeLinecap="round" />
        {/* заокруглені завершення */}
        <path d={`M ${X(p0.x - s.railExt)} ${Y(p0.y + s.railTop)} q -${0.06 * sc} 0 -${0.06 * sc} ${0.08 * sc}`} fill="none" stroke={extColor} strokeWidth={railW} strokeLinecap="round" />
        <path d={`M ${X(pN.x + s.railExt)} ${Y(pN.y + s.railTop)} q ${0.06 * sc} 0 ${0.06 * sc} ${0.08 * sc}`} fill="none" stroke={extColor} strokeWidth={railW} strokeLinecap="round" />
        {/* виступи кінців */}
        <g stroke={extColor} strokeWidth={railW}>
          <line x1={X(p0.x - s.railExt)} y1={Y(p0.y + s.railTop)} x2={X(p0.x)} y2={Y(p0.y + s.railTop)} />
          <line x1={X(pN.x)} y1={Y(pN.y + s.railTop)} x2={X(pN.x + s.railExt)} y2={Y(pN.y + s.railTop)} />
        </g>
        {focus === 'rails' && (
          <g>
            <DimV x={X(p0.x) - 14} y1={Y(p0.y)} y2={Y(p0.y + s.railTop)} side={-1}
              label={`${nFmt(s.railTop)} м`} text={item('railTop').status === 'fail' ? C.fail : C.ink} />
            <DimH x1={X(pN.x)} x2={X(pN.x + s.railExt)} y={Y(pN.y + s.railTop) - 12} up
              label={nFmt(s.railExt)} text={item('railExt').status === 'fail' ? C.fail : C.ink} />
            <text x={X(p0.x + 0.15)} y={Y(p0.y + 0.7) - 7} fontSize="10" fill={C.muted}>0,70</text>
            {s.railChild && <text x={X(p0.x + 0.15)} y={Y(p0.y + 0.5) - 7} fontSize="10" fill={C.muted}>0,50 діт.</text>}
          </g>
        )}
      </g>

      {/* прапорець на верхній площадці — фініш */}
      <g opacity="0.9">
        <line x1={X(worldW - 0.35)} y1={Y(H)} x2={X(worldW - 0.35)} y2={Y(H + 0.55)} stroke={C.steel} strokeWidth="1.6" />
        <path d={`M ${X(worldW - 0.35)} ${Y(H + 0.55)} L ${X(worldW - 0.35) + 0.34 * sc} ${Y(H + 0.47)} L ${X(worldW - 0.35)} ${Y(H + 0.39)} Z`} fill={C.accent} />
      </g>

      {/* фігура в кріслі: анімований проїзд (статична при reduced motion) */}
      {reduceMotion ? (
        <g transform={`translate(${X(fx)} ${Y(fy)}) rotate(${-(g.angle + extraTilt)}) scale(${sc} ${-sc})`}>
          <WheelchairSide />
        </g>
      ) : (
        <Rider segs={segs} X={X} Y={Y} sc={sc} slope={s.slope} status={slopeSt} totalLen={worldW} m1={m1} />
      )}

      {/* кут і ухил */}
      <g style={fade('slope')}>
        <path d={`M ${X(m1.x0 + 1.1)} ${Y(m1.y0)} A ${1.1 * sc} ${1.1 * sc} 0 0 0 ${X(m1.x0 + 1.1 * Math.cos(Math.atan(s.slope)))} ${Y(m1.y0 + 1.1 * Math.sin(Math.atan(s.slope)))}`}
          fill="none" stroke={stColor(slopeSt)} strokeWidth="1.2" opacity="0.8" />
        <text x={X(lx)} y={Y(ly + s.railTop) - 28} fontSize="12.5" fontWeight="600" textAnchor="middle" fill={stColor(slopeSt)}>
          {nFmtT(s.slope * 100, 1)} % · 1:{nFmtT(g.ratio, 1)} · {nFmtT(g.angle, 1)}°
        </text>
      </g>

      {/* розміри: H праворуч, довжини знизу */}
      <g style={fade('height')}>
        <line x1={X(worldW)} y1={Y(H)} x2={X(worldW) + 34} y2={Y(H)} stroke={C.faint} strokeWidth="1" strokeDasharray="3 3" />
        <DimV x={X(worldW) + 30} y1={Y(0)} y2={Y(H)} label={`H ${nFmt(H)} м`} text={C.ink} />
        {segs.filter((sg) => sg.type === 'landing' && sg.kind === 'проміжна').map((sg, i) => (
          <text key={i} x={X((sg.x0 + sg.x1) / 2)} y={Y(sg.y) - 8} fontSize="10.5" textAnchor="middle"
            fill={item('landing').status === 'fail' ? C.fail : C.muted}>площадка</text>
        ))}
      </g>
      <g style={fade('height')}>
        {marchDims}
        <DimH x1={X(0)} x2={X(worldW)} y={Y(0) + 46} label={`разом ${nFmt(g.totalLen)} м`} text={C.muted} />
      </g>
    </svg>
  );
}

/* ════════ ПЛАН ════════ */
function PlanView({ s, g, ev, focus }) {
  const W = 980, maxH = 300;
  const padL = 16, padR = 96, padT = 24, padB = 56;
  const segs = buildSegments(s, g);
  const worldW = g.totalLen, worldH = s.width;
  const sc = Math.min((W - padL - padR) / worldW, (maxH - padT - padB) / worldH);
  const svgH = Math.ceil(worldH * sc + padT + padB);
  const offX = padL + ((W - padL - padR) - worldW * sc) / 2;
  const X = (x) => offX + x * sc;
  const Y = (y) => padT + y * sc; // y: 0..width (поперек)

  const item = (id) => ev.items.find((i) => i.id === id);
  const oc = OVERALL[ev.overall];
  const fade = (tag) => ({ opacity: focus === tag ? 1 : 0.15, transition: 'opacity 0.25s' });

  const railFail = ['railTop', 'railDiam'].some((id) => item(id).status === 'fail');
  const railColor = railFail ? C.fail : C.steel;
  const railW = Math.max(s.railDiam * sc * 0.85, 1.4);
  const x0 = segs[1].x0, xN = segs[segs.length - 1].x0; // межі маршової частини
  const curbSt = item('curb').status;
  const widthSt = item('width').status;

  const marches = segs.filter((sg) => sg.type === 'march');
  const m1 = marches[0];

  /* поперечний ухил: стік води — на верхній площадці (нижня зайнята розміром ширини) */
  const cp = s.crossSlope * 100;
  const cpCol = cp > 2 + 1e-9 ? C.fail : cp < 1 - 1e-9 ? C.warn : C.accent;
  const entry = segs[segs.length - 1];
  const dropLen = (Math.min(cp, 4) / 2) * 0.3; // м, довжина стрілок пропорційна ухилу

  return (
    <svg viewBox={`0 0 ${W} ${svgH}`} role="img" aria-label="План пандуса">
      {/* контур усієї споруди */}
      <rect x={X(0)} y={Y(0)} width={worldW * sc} height={worldH * sc}
        fill={oc.dim} stroke={oc.solid} strokeWidth="2" style={{ transition: 'fill 0.3s, stroke 0.3s' }} />

      {/* площадки — світліші, з підписом */}
      {segs.filter((sg) => sg.type === 'landing').map((sg, i) => (
        <g key={i}>
          <rect x={X(sg.x0)} y={Y(0)} width={(sg.x1 - sg.x0) * sc} height={worldH * sc} fill="rgba(231,237,244,0.05)" />
          <line x1={X(sg.x0)} y1={Y(0)} x2={X(sg.x0)} y2={Y(worldH)} stroke={C.line} strokeWidth="1" />
          <line x1={X(sg.x1)} y1={Y(0)} x2={X(sg.x1)} y2={Y(worldH)} stroke={C.line} strokeWidth="1" />
        </g>
      ))}

      {/* дефектне покриття */}
      {!s.surfaceGood && marches.map((sg, i) => {
        const n = Math.max(3, Math.floor((sg.x1 - sg.x0) * sc / 40));
        return (
          <g key={i}>
            {Array.from({ length: n }, (_, k) => (
              <circle key={k} cx={X(sg.x0 + ((k + 0.5) / n) * (sg.x1 - sg.x0))}
                cy={Y(worldH * (0.3 + 0.4 * ((k * 7) % 3) / 2))} r="2.6" fill="none" stroke={C.fail} strokeWidth="1.2" />
            ))}
          </g>
        );
      })}

      {/* контрастні смуги */}
      {s.contrast && (
        <g>
          {marches.map((sg, i) => (
            <g key={i} fill={C.stripe} opacity="0.85">
              <rect x={X(sg.x0)} y={Y(0)} width={Math.max(0.1 * sc, 2)} height={worldH * sc} />
              <rect x={X(sg.x1) - Math.max(0.1 * sc, 2)} y={Y(0)} width={Math.max(0.1 * sc, 2)} height={worldH * sc} />
            </g>
          ))}
        </g>
      )}

      {/* напрям руху */}
      {marches.map((sg, i) => {
        const cx = (sg.x0 + sg.x1) / 2;
        return (
          <g key={i} stroke={C.faint} strokeWidth="1.6" fill="none" opacity="0.8">
            {[-0.14, 0, 0.14].map((d, k) => (
              <path key={k} d={`M ${X(cx + d) - 5} ${Y(worldH / 2) - 6} L ${X(cx + d) + 3} ${Y(worldH / 2)} L ${X(cx + d) - 5} ${Y(worldH / 2) + 6}`} />
            ))}
          </g>
        );
      })}

      {/* поперечний ухил: вода стікає до краю (або стоїть калюжами) */}
      <g style={fade('slope')}>
        {cp >= 0.05 ? [0.32, 0.68].map((f, k) => {
          const ax = X(entry.x0 + (entry.x1 - entry.x0) * f);
          const ay0 = Y(worldH * 0.30), ay1 = Y(worldH * 0.30 + dropLen);
          return (
            <g key={k} stroke={cpCol} strokeWidth="1.6" fill="none">
              <line x1={ax} y1={ay0} x2={ax} y2={ay1} />
              <path d={`M ${ax - 4} ${ay1 - 5} L ${ax} ${ay1} L ${ax + 4} ${ay1 - 5}`} />
            </g>
          );
        }) : null}
        {cp < 1 - 1e-9 ? [0.32, 0.68].map((f, k) => (
          <ellipse key={'p' + k} cx={X(entry.x0 + (entry.x1 - entry.x0) * f)} cy={Y(worldH * 0.62)}
            rx="9" ry="3.5" fill="rgba(86,185,216,0.25)" stroke={C.accent} strokeWidth="0.8" />
        )) : null}
        <text x={X((entry.x0 + entry.x1) / 2)} y={Y(0) - 9} fontSize="10" textAnchor="middle" fill={cpCol}>
          {cp < 1 - 1e-9 ? `вода стоїть · ${nFmtT(cp, 1)} %` : `стік води · ${nFmtT(cp, 1)} %`}
        </text>
      </g>

      {/* бортики по краях */}
      <g>
        <rect x={X(x0)} y={Y(0)} width={(xN - x0 + 1.5) * sc} height={Math.max(0.06 * sc, 3)}
          fill={curbSt === 'fail' ? C.fail : C.accent} opacity="0.8" />
        <rect x={X(x0)} y={Y(worldH) - Math.max(0.06 * sc, 3)} width={(xN - x0 + 1.5) * sc} height={Math.max(0.06 * sc, 3)}
          fill={curbSt === 'fail' ? C.fail : C.accent} opacity="0.8" />
      </g>

      {/* поручні вздовж країв + виступи */}
      <g stroke={railColor} strokeLinecap="round">
        <line x1={X(x0 - s.railExt)} y1={Y(0.10)} x2={X(xN + s.railExt)} y2={Y(0.10)} strokeWidth={railW} />
        <line x1={X(x0 - s.railExt)} y1={Y(worldH - 0.10)} x2={X(xN + s.railExt)} y2={Y(worldH - 0.10)} strokeWidth={railW} />
      </g>

      {/* глибина нижньої площадки — підпис завжди помітний на вкладці висоти */}
      {/* крісла колісні: 1 або 2 смуги руху */}
      {s.traffic === 'one' ? (
        <g transform={`translate(${X(m1.x0 + (m1.x1 - m1.x0) * 0.5)} ${Y(worldH / 2)}) scale(${sc})`}>
          <WheelchairTop />
        </g>
      ) : (
        <g>
          <g transform={`translate(${X(m1.x0 + (m1.x1 - m1.x0) * 0.38)} ${Y(worldH * 0.27)}) scale(${sc})`}>
            <WheelchairTop />
          </g>
          <g transform={`translate(${X(m1.x0 + (m1.x1 - m1.x0) * 0.62)} ${Y(worldH * 0.73)}) scale(${sc}) rotate(180)`}>
            <WheelchairTop />
          </g>
        </g>
      )}

      {/* ширина у просвіті — винесена праворуч за контур, як H на профілі */}
      <g style={fade('width')}>
        <DimV x={X(worldW) + 30} y1={Y(0)} y2={Y(worldH)} side={1}
          label={`${nFmt(s.width)} м`} text={stColor(widthSt)} color={stColor(widthSt)} />
      </g>

      {/* глибини площадок знизу */}
      <g style={fade('height')}>
        {segs.filter((sg) => sg.type === 'landing').map((sg, i) => (
          <DimH key={i} x1={X(sg.x0)} x2={X(sg.x1)} y={Y(worldH) + 22}
            label={`${nFmt(sg.x1 - sg.x0)} м`}
            text={sg.kind === 'проміжна' && item('landing').status === 'fail' ? C.fail : C.muted} />
        ))}
      </g>
    </svg>
  );
}

Object.assign(window, { ProfileView, PlanView, buildSegments, VIEW_COLORS: C });
