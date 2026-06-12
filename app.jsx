/* Головний застосунок: стан, вердикт, вкладки, слайдери. Провідні величини — H і ухил; L обчислюється. */
const { useState, useMemo, useEffect } = React;
const { DEFAULTS, evaluate, fmt, fmtT, pl, clamp } = window.RampNorms;

const TABS = [
  { id: 'slope', label: 'Ухил' },
  { id: 'height', label: 'Висота і площадки' },
  { id: 'width', label: 'Ширина' },
  { id: 'rails', label: 'Поручні' },
  { id: 'edge', label: 'Бортик і покриття' },
];
const VERDICT_WORD = { ok: 'Відповідає', limit: 'Гранично', fail: 'Не відповідає' };
const VERDICT_SENT = {
  ok: 'Пандус зручний і безпечний — так будувати можна.',
  limit: 'Проїхати можна, але це межа допустимого — лише як виняток.',
  fail: 'Для людини в кріслі це барʼєр — так будувати не можна.',
};
const VERDICT_CLR = { ok: 'var(--ok)', limit: 'var(--warn)', fail: 'var(--fail)' };

function statusByTab(ev) {
  const rank = { ok: 0, limit: 1, auto: 1, fail: 2 };
  const out = {};
  for (const t of TABS) {
    const worst = ev.items.filter((i) => i.tab === t.id)
      .reduce((a, i) => (rank[i.status] > rank[a] ? i.status : a), 'ok');
    out[t.id] = worst === 'auto' ? 'limit' : worst;
  }
  return out;
}

function IssueRow({ it }) {
  const clr = it.status === 'fail' ? 'var(--fail)' : 'var(--warn)';
  return (
    <div className="issue">
      <span className="dot" style={{ background: clr }}></span>
      <div>
        <div className="t" style={it.status === 'fail' ? { color: 'var(--fail)' } : null}>
          {it.status === 'auto' ? <span style={{ color: 'var(--warn)', fontFamily: 'var(--mono)', fontSize: '11px', marginRight: '6px' }}>АВТО</span> : null}
          {it.title}
        </div>
        {it.detail ? <div className="dt">{it.detail}</div> : null}
        {it.fix ? <div className="fx">{it.fix}</div> : null}
      </div>
      <span className="clause">п. {it.clause}</span>
    </div>
  );
}

function VerdictBand({ s, ev }) {
  const g = ev.g;
  const slopeItem = ev.items.find((i) => i.id === 'slope');
  const issues = [...ev.fails, ...ev.autos, ...ev.limits];
  const mark = ev.overall === 'ok' ? '✔' : ev.overall === 'limit' ? '▲' : '✖';
  return (
    <section className="verdict" data-screen-label="Вердикт">
      <div className="vcard">
        <div className="vstate">
          <span className="vlamp" style={{ background: VERDICT_CLR[ev.overall], boxShadow: `0 0 14px ${ev.overall === 'ok' ? 'rgba(65,196,99,0.55)' : ev.overall === 'limit' ? 'rgba(219,166,46,0.55)' : 'rgba(242,85,77,0.55)'}` }}></span>
          <span className="vword" style={{ color: VERDICT_CLR[ev.overall] }}>{VERDICT_WORD[ev.overall]}</span>
        </div>
        <div className="vsent">{VERDICT_SENT[ev.overall]}</div>
        <div className="vmeta">виконано {ev.passed} із {ev.total} вимог · ДБН В.2.2-40:2018</div>
        <div className="vmath">
          <div className="vrow">H <b>{fmt(s.H)} м</b> ÷ <b>{fmtT(s.slope * 100, 1)} %</b> <span className="dim">→</span> L <b className="hl">{fmt(g.L)} м</b> <span className="dim">(1:{fmtT(g.ratio, 1)})</span></div>
          <div className="vrow">
            {g.n === 1
              ? <span>1 марш <span style={{ color: VERDICT_CLR[ev.overall] }}>{mark}</span></span>
              : <span>{g.n} {pl(g.n, ['марш', 'марші', 'маршів'])} по <b>{fmt(g.h)} м</b> + {g.n - 1} {pl(g.n - 1, ['площадка', 'площадки', 'площадок'])} <b>{fmt(s.landingDepth)} м</b> <span style={{ color: VERDICT_CLR[ev.overall] }}>{mark}</span></span>}
          </div>
          <div className="vrow dim">разом у плані {fmt(g.totalLen)} м</div>
          <div className="vrow vnote">{slopeItem.note || '\u00a0'}</div>
        </div>
      </div>
      <div className="vcard">
        {issues.length === 0
          ? <div className="allok">✔ Конфігурація відповідає всім перевіреним вимогам ДБН В.2.2-40:2018</div>
          : <div className="issues">{issues.map((it, i) => <IssueRow key={it.id} it={it} idx={i} />)}</div>}
      </div>
    </section>
  );
}

/* Покрокове навчання при першому відкритті */
const TOUR_STEPS = [
  { sel: ".verdict", title: "Світлофор норми", text: "Угорі — миттєвий вердикт: зелений «Відповідає», бурштиновий «Гранично», червоний «Не відповідає». Поруч — список порушень із пунктом ДБН і порадою, як виправити." },
  { sel: ".schemes", title: "Дві схеми одного пандуса", text: "Профіль (вид збоку) і план (вид зверху) у чесному масштабі: кут на екрані дорівнює реальному. Крісло-їздець показує, чи вдасться заїхати." },
  { sel: ".seg-row", title: "Режими розрахунку", place: "left", text: "Ці перемикачі змінюють самі вимоги: для реконструкції мінімуми мʼякші, а для двобічного руху потрібна більша ширина." },
  { sel: ".tabs", title: "Вкладки-аспекти", place: "left", text: "Кожна вкладка показує свою групу повзунків і підсвічує відповідну частину схеми. Кольорова крапка — стан групи." },
  { sel: ".sliders", title: "Повзунки та точний ввід", place: "left", text: "Тягніть повзунок — геометрія й вердикт оновлюються миттєво. Кольорові зони на треку показують норму. Клікніть на число з олівцем ✎ — і впишіть своє значення з клавіатури." },
  { sel: ".ctrl", title: "Підказки «?»", place: "left", text: "Біля кожного параметра є знак питання — наведіть на нього, щоб дізнатися, що параметр означає та якою є норма. Повернути це навчання можна кнопкою «? Навчання» вгорі." },
];

function Tour({ onClose }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState(null);
  const step = TOUR_STEPS[i];
  const last = TOUR_STEPS.length - 1;
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(TOUR_STEPS[i].sel);
      if (!el) { setBox(null); return; }
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, w: r.width, h: r.height });
    };
    const el = document.querySelector(TOUR_STEPS[i].sel);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 64 || r.bottom > window.innerHeight - 40) {
        window.scrollTo({ top: Math.max(0, r.top + window.scrollY - 84), behavior: "smooth" });
      }
    }
    measure();
    const t1 = setTimeout(measure, 220);
    const t2 = setTimeout(measure, 480);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && i < last) setI(i + 1);
      if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [i]);
  if (!box) return null;
  const pad = 8, cardW = 332, cardH = 210;
  let cardTop, cardLeft;
  if (step.place === "left" && box.left - cardW - 18 > 12) {
    cardLeft = box.left - cardW - 18;
    cardTop = Math.max(12, Math.min(box.top + 16, window.innerHeight - cardH - 16));
  } else if (box.top + box.h + 14 + cardH < window.innerHeight) {
    cardTop = box.top + box.h + pad + 10;
    cardLeft = Math.min(Math.max(12, box.left), Math.max(12, window.innerWidth - cardW - 16));
  } else {
    cardTop = Math.max(12, box.top - cardH - 6);
    cardLeft = Math.min(Math.max(12, box.left), Math.max(12, window.innerWidth - cardW - 16));
  }
  return (
    <div>
      <div className="tour-hl" style={{ top: box.top - pad, left: box.left - pad, width: box.w + pad * 2, height: box.h + pad * 2 }}></div>
      <div className="tour-card" style={{ top: cardTop, left: cardLeft }}>
        <div className="tour-step">Крок {i + 1} із {TOUR_STEPS.length}</div>
        <div className="tour-title">{step.title}</div>
        <div className="tour-text">{step.text}</div>
        <div className="tour-btns">
          <button type="button" className="tour-skip" onClick={onClose}>Пропустити</button>
          {i > 0 ? <button type="button" className="tour-btn ghost" onClick={() => setI(i - 1)}>Назад</button> : null}
          {i < last
            ? <button type="button" className="tour-btn" onClick={() => setI(i + 1)}>Далі</button>
            : <button type="button" className="tour-btn" onClick={onClose}>Зрозуміло</button>}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [s, setS] = useState(DEFAULTS);
  const [tab, setTab] = useState('slope');
  const [showTour, setShowTour] = useState(() => { try { return localStorage.getItem('pandusTourDone') !== '1'; } catch (e) { return true; } });
  const closeTour = () => { setShowTour(false); try { localStorage.setItem('pandusTourDone', '1'); } catch (e) {} };
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));
  const ev = useMemo(() => evaluate(s), [s]);
  const g = ev.g;

  /* плавна поява/зникнення проміжної площадки: глибина твіниться до цілі,
     а два марші з нульовою площадкою геометрично тотожні одному — морф без стрибка */
  const targetDepth = g.n > 1 ? s.landingDepth : 0;
  const [animDepth, setAnimDepth] = useState(targetDepth);
  const animRef = React.useRef(animDepth);
  useEffect(() => {
    let raf, last = performance.now();
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const cur = animRef.current;
      let next = cur + (targetDepth - cur) * (1 - Math.exp(-dt * 7));
      if (Math.abs(next - targetDepth) < 0.004) next = targetDepth;
      if (next !== cur) { animRef.current = next; setAnimDepth(next); }
      if (next !== targetDepth) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [targetDepth]);

  /* геометрія для рендеру схем: глибина ПРОМІЖНИХ площадок анімована (interDepth),
     початкова/кінцева — завжди реальні; розрахунки й вердикт — з реальної геометрії */
  const renderN = (g.n > 1 || animDepth > 0.01) ? Math.max(g.n, 2) : 1;
  const renderS = { ...s, interDepth: animDepth };
  const renderG = { ...g, n: renderN, h: s.H / renderN, lm: g.L / renderN, totalLen: 2 * s.landingDepth + g.L + (renderN - 1) * animDepth };

  useEffect(() => { window.rampDebug = { state: s, set, ev, setTab }; });

  /* L — похідна величина: рух повзунка L підлаштовує ухил, H незмінна */
  const minL = Math.max(0.5, s.H / 0.14);
  const maxL = Math.min(20, s.H / 0.04);
  const setL = (Lv) => set({ slope: clamp(s.H / Lv, 0.04, 0.14) });

  const slopeZones = s.mode === 'recon'
    ? [{ to: 8, color: 'ok' }, { to: 10, color: 'limit' }, { to: 14, color: 'fail' }]
    : [{ to: 8, color: 'ok' }, { to: 14, color: 'fail' }];
  const L8 = s.H / 0.08;
  const lZones = [
    { to: clamp(L8, minL, maxL), color: s.mode === 'recon' ? 'limit' : 'fail' },
    { to: maxL, color: 'ok' },
  ];
  const widthZones = s.traffic === 'two'
    ? [{ to: 1.8, color: 'fail' }, { to: 2.5, color: 'ok' }]
    : s.mode === 'recon'
      ? [{ to: 0.9, color: 'fail' }, { to: 1.2, color: 'limit' }, { to: 2.5, color: 'ok' }]
      : [{ to: 1.2, color: 'fail' }, { to: 2.5, color: 'ok' }];

  const sliders = {
    H: (
      <Slider help="Загальний перепад висот, який долає пандус: від нижнього рівня до верхньої площадки. Понад 0,80 м пандус автоматично ділиться на кілька маршів." label="Перепад висот H" value={s.H} onChange={(v) => set({ H: v })}
        min={0.05} max={1.5} step={0.01} unit="м"
        zones={[{ to: 0.8, color: 'ok' }, { to: 1.5, color: 'limit' }]}
        ticks={[{ at: 0.8, label: '0,8 — макс. марш' }]} />
    ),
    slope: (
      <Slider help="Крутизна пандуса вздовж руху — відношення висоти до довжини. Що більший ухил, то важче їхати вгору. Норма — до 8 % (1:12)." label="Поздовжній ухил" value={s.slope * 100} onChange={(v) => set({ slope: v / 100 })}
        min={4} max={14} step={0.1} unit="%" display={fmtT(s.slope * 100, 1)}
        zones={slopeZones}
        ticks={[{ at: 5, label: '5 %' }, { at: 8, label: '8 % · 1:12' }, ...(s.mode === 'recon' ? [{ at: 10, label: '10 %' }] : [])]}
        sub={{ mono: true, text: `= 1:${fmtT(g.ratio, 1)} · кут ${fmtT(g.angle, 1)}°` }} />
    ),
    L: (
      <Slider help="Сумарна довжина похилих частин. Рахується сама: L = H ÷ ухил. Якщо потягнути цей повзунок — підлаштується ухил." label="Довжина маршів L" value={clamp(g.L, minL, maxL)} onChange={setL}
        min={minL} max={maxL} step={0.05} unit="м" display={fmt(g.L)}
        zones={lZones}
        ticks={L8 >= minL && L8 <= maxL ? [{ at: L8, label: `${fmtT(L8, 1)} — 1:12` }] : []}
        sub={{ mono: true, text: 'L = H ÷ ухил — повзунок підлаштовує ухил' }} />
    ),
  };

  return (
    <div className="app">
      <header className="hdr">
        <h1>Симулятор пандуса</h1>
        <span className="law">ДБН В.2.2-40:2018 · Зміна №3</span>
        <span className="sub">інклюзивність будівель і споруд · геометрія в реальному масштабі</span>
        <button type="button" className="hdr-help" onClick={() => setShowTour(true)}>? Навчання</button>
      </header>

      

      <VerdictBand s={s} ev={ev} />

      <div className="main">
        <div className="schemes">
          <div className="scard" data-screen-label="Профіль (вид збоку)">
            <div className="cap"><span>Профіль · вид збоку</span><span className="scale-note">кут профілю = фактичному ухилу</span></div>
            <ProfileView s={renderS} g={renderG} ev={ev} focus={tab} />
          </div>
          <div className="scard" data-screen-label="План (вид зверху)">
            <div className="cap"><span>План · вид зверху</span><span className="scale-note">спільний масштаб із профілем</span></div>
            <PlanView s={renderS} g={renderG} ev={ev} focus={tab} />
          </div>
        </div>

        <aside className="ctrl" data-screen-label="Панель керування">
          <div className="seg-row">
            <div className="seg-line">
              <span className="lbl">Будівництво<QMark below text="Нове будівництво — повні вимоги норми. Реконструкція — помʼякшені мінімуми для випадків, коли існуючу будівлю фізично не змінити." /></span>
              <Segmented value={s.mode} onChange={(v) => set({ mode: v })}
                options={[{ value: 'new', label: 'Нове' }, { value: 'recon', label: 'Реконструкція' }]} />
            </div>
            <div className="seg-line">
              <span className="lbl">Рух<QMark below text="Однобічний — рух в один бік, мінімальна ширина 1,20 м. Двобічний — два крісла мають розминутися, потрібно щонайменше 1,80 м." /></span>
              <Segmented value={s.traffic} onChange={(v) => set({ traffic: v })}
                options={[{ value: 'one', label: 'Однобічний' }, { value: 'two', label: 'Двобічний' }]} />
            </div>
          </div>

          <Tabs tabs={TABS} value={tab} onChange={setTab} statusByTab={statusByTab(ev)} />

          {tab === 'slope' && (
            <div className="sliders">
              {sliders.H}
              {sliders.slope}
              {sliders.L}
              <Slider help="Нахил поверхні вбік, щоб стікала дощова вода. Норма 1–2 %: менше — стоятимуть калюжі, більше — крісло зноситиме до краю." label="Поперечний ухил" value={s.crossSlope * 100} onChange={(v) => set({ crossSlope: v / 100 })}
                min={0} max={4} step={0.1} unit="%" display={fmtT(s.crossSlope * 100, 1)}
                zones={[{ to: 1, color: 'limit' }, { to: 2, color: 'ok' }, { to: 4, color: 'fail' }]}
                ticks={[{ at: 1, label: '1 %' }, { at: 2, label: '2 %' }]}
                sub="1–2 % — для водовідведення з покриття" />
            </div>
          )}

          {tab === 'height' && (
            <div className="sliders">
              {sliders.H}
              <Slider help="Довжина рівних майданчиків на початку, в кінці та між маршами — місце, щоб зупинитися й перепочити. Мінімум 1,50 м." label="Глибина площадок" value={s.landingDepth} onChange={(v) => set({ landingDepth: v })}
                min={1.0} max={2.5} step={0.05} unit="м"
                zones={[{ to: 1.5, color: 'fail' }, { to: 2.5, color: 'ok' }]}
                ticks={[{ at: 1.5, label: '1,5 мін.' }]}
                sub="глибина всіх площадок: початкової, кінцевої та проміжних — видно на схемах" />
              <div className="breakdown">
                H <span className="v">{fmt(s.H)} м</span> → марші: <span className="v">{g.n} × {fmt(g.h)} м</span><br />
                довжина маршу: <span className="v">{fmt(g.lm)} м</span> · площадки: <span className="v">{g.n + 1} шт</span><br />
                разом у плані: <span className="v">{fmt(g.totalLen)} м</span>
              </div>
            </div>
          )}

          {tab === 'width' && (
            <div className="sliders">
              <Slider help="Вільна відстань між поручнями (у просвіті), а не по конструкції. Мінімум залежить від напряму руху та типу будівництва — перемикачі вгорі." label="Ширина у просвіті" value={s.width} onChange={(v) => set({ width: v })}
                min={0.8} max={2.5} step={0.05} unit="м"
                zones={widthZones}
                ticks={[{ at: 0.9, label: '0,9' }, { at: 1.2, label: '1,2' }, { at: 1.8, label: '1,8' }]}
                sub={s.traffic === 'two' ? 'двобічний рух: мін. 1,80 м' : s.mode === 'recon' ? 'однобічний: 1,20 м; для реконструкції 0,90 м — гранично' : 'однобічний рух, нове будівництво: мін. 1,20 м'} />
              <div className="infocard">
                <span className="i">i</span>
                <span>Ширина вимірюється <b>у просвіті</b> — між поручнями або бортиками, а не по конструкції. Перемикачі «Рух» і «Будівництво» вгорі змінюють мінімум (п. 5.3.1.1).</span>
              </div>
            </div>
          )}

          {tab === 'rails' && (
            <div className="sliders">
              <Slider help="Висота верхнього поручня над поверхнею маршу. Норма — 0,90 м; нижче обовʼязково йде другий рівень 0,70 м." label="Верхній рівень поручня" value={s.railTop} onChange={(v) => set({ railTop: v })}
                min={0.7} max={1.0} step={0.01} unit="м"
                zones={[{ to: 0.889, color: 'fail' }, { to: 0.911, color: 'ok' }, { to: 1.0, color: 'fail' }]}
                ticks={[{ at: 0.7, label: '0,7' }, { at: 0.9, label: '0,9 — норма' }]}
                sub="другий рівень 0,70 м — обов'язковий, показаний на профілі" />
              <Slider help="Товщина труби поручня. 0,035–0,045 м — щоб долоня впевнено обхоплювала. Відступ від стіни — не менше 0,04 м." label="Діаметр поручня" value={s.railDiam} onChange={(v) => set({ railDiam: v })}
                min={0.03} max={0.06} step={0.001} unit="м" digits={3}
                zones={[{ to: 0.035, color: 'fail' }, { to: 0.045, color: 'ok' }, { to: 0.06, color: 'fail' }]}
                ticks={[{ at: 0.035, label: '0,035' }, { at: 0.045, label: '0,045' }]}
                sub="круглий переріз; відступ від стіни ≥ 0,04 м" />
              <Slider help="Горизонтальне продовження поручня за межі маршу, щоб узятися за нього ще до схилу. Мінімум 0,30 м, із заокругленим кінцем." label="Виступ кінців за марш" value={s.railExt} onChange={(v) => set({ railExt: v })}
                min={0} max={0.5} step={0.01} unit="м"
                zones={[{ to: 0.3, color: 'fail' }, { to: 0.5, color: 'ok' }]}
                ticks={[{ at: 0.3, label: '0,3 мін.' }]}
                sub="горизонтально, із заокругленим завершенням (п. 5.3.2.1)" />
              <div>
                <SwitchRow name="Дитячий поручень 0,50 м" hint="третій рівень для закладів із дітьми (п. 5.3.2)"
                  value={s.railChild} onChange={(v) => set({ railChild: v })} />
              </div>
            </div>
          )}

          {tab === 'edge' && (
            <div className="sliders">
              <Slider help="Невисокий бортик уздовж відкритих країв: не дає колесам зісковзнути вбік. Мінімум 0,05 м там, де немає стіни чи огорожі." label="Бортик по краях" value={s.curb} onChange={(v) => set({ curb: v })}
                min={0} max={0.1} step={0.005} unit="м" digits={3}
                zones={[{ to: 0.05, color: 'fail' }, { to: 0.1, color: 'ok' }]}
                ticks={[{ at: 0.05, label: '0,05 мін.' }]}
                sub="на краях, не захищених стіною чи огорожею (п. 5.3.2.3)" />
              <div>
                <SwitchRow name="Покриття тверде, рівне, без фаски" hint="п. 5.1.7"
                  value={s.surfaceGood} onChange={(v) => set({ surfaceGood: v })} />
                <SwitchRow name="Контрастна смуга ≥ 0,10 м" hint="на межах кожного маршу (п. 5.3.2.4)"
                  value={s.contrast} onChange={(v) => set({ contrast: v })} />
              </div>
              <div className="infocard">
                <span className="i">i</span>
                <span><b>Тактильні смуги</b> перед пандусом зазвичай <b>не застосовуються</b> — на відміну від сходів (п. 5.3.2.5). Контрастне візуальне маркування меж маршу при цьому лишається обов'язковим.</span>
              </div>
            </div>
          )}
        </aside>
      </div>

      {showTour ? <Tour onClose={closeTour} /> : null}

      <footer className="note">Навчальний симулятор. Першоджерело — ДБН В.2.2-40:2018 (Зміна №3). Звіряйте з чинним текстом норми.</footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
