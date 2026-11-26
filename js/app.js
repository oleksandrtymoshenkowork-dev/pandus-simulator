/* Застосунок: стан (і в посиланні), вердикт, схеми, панель керування, навчання. */
import { html, render, useState, useEffect, useMemo, useRef } from './vendor/preact-htm.js';
import { DEFAULTS, RANGES, D1, evaluate, toHash, fromHash, fmt, fmtT, pl, clamp } from './norms.js';
import { buildSegments, ProfileView, SectionView, PlanView, useWidth } from './views.js';
import { setRiderEnv } from './anim.js';
import { Slider, Segmented, Switch, Tabs, Help, STATUS_COLOR } from './ui.js';

const TABS = [
  { id: 'slope', label: 'Ухил' },
  { id: 'flights', label: 'Марші й площадки' },
  { id: 'width', label: 'Ширина' },
  { id: 'rails', label: 'Поручні' },
  { id: 'safety', label: 'Безпека' },
];
const TAB_VIEW = { slope: 'profile', flights: 'profile', width: 'section', rails: 'profile', safety: 'plan' };
const VIEWS = [{ id: 'profile', label: 'Профіль' }, { id: 'section', label: 'Переріз' }, { id: 'plan', label: 'План' }];
const WORD = { ok: 'Відповідає', limit: 'Гранично', fail: 'Не відповідає' };
const SENT = {
  ok: 'Пандус зручний і безпечний — так будувати можна.',
  limit: 'Допускається лише як виняток для існуючої будівлі.',
  fail: 'Для людини в кріслі колісному це бар’єр — так будувати не можна.',
};
const MARSH = ['марш', 'марші', 'маршів'];

function statusByTab(ev) {
  const rank = { ok: 0, auto: 1, limit: 1, fail: 2 };
  const out = {};
  for (const t of TABS) {
    const w = ev.items.filter((i) => i.tab === t.id).reduce((a, i) => (rank[i.status] > rank[a] ? i.status : a), 'ok');
    out[t.id] = w === 'auto' ? 'limit' : w;
  }
  return out;
}

/* плавна поява/зникнення проміжних площадок при зміні кількості маршів */
function useMorph(target) {
  const [d, setD] = useState({ n: target, k: 1 });
  const ref = useRef(d);
  useEffect(() => {
    let raf;
    const step = () => {
      let { n, k } = ref.current;
      if (n !== target) { k -= 0.14; if (k <= 0 || n === 1) { n = target; k = 0; } } else k = Math.min(1, k + 0.1);
      ref.current = { n, k }; setD(ref.current);
      if (n !== target || k < 1) raf = requestAnimationFrame(step);
    };
    if (ref.current.n !== target || ref.current.k < 1) raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return d;
}

function Issue({ it, onGo, onFix }) {
  return html`<div class=${'issue st-' + it.status}>
    <span class="dot"></span>
    <div class="issue-body">
      <button type="button" class="issue-t" onClick=${() => onGo(it.tab)}>${it.status === 'auto' && html`<span class="tag">АВТО</span>`}${it.title}</button>
      ${it.detail && html`<div class="issue-d">${it.detail}</div>`}
      ${it.fix && html`<div class="issue-f">${it.fix}</div>`}
      ${it.note && html`<div class="issue-f">${it.note}</div>`}
      ${it.action && html`<button type="button" class="fixbtn" onClick=${() => onFix(it.action.patch)}>${it.action.label}</button>`}
    </div>
    <span class="clause">п. ${it.clause}</span>
  </div>`;
}

function Burst({ k }) {
  return html`<div class="burst" key=${k} aria-hidden="true">${Array.from({ length: 22 }, (_, i) => html`<i style=${{ '--a': `${(i / 22) * 360}deg`, '--d': `${60 + (i % 4) * 22}px`, '--c': ['#ffd84d', '#3fcf6d', '#5cc6e8', '#ff8fb1'][i % 4] }}></i>`)}</div>`;
}

function Verdict({ s, ev, onGo, onFix }) {
  const g = ev.g;
  const issues = [...ev.fails, ...ev.limits, ...ev.autos];
  const [burst, setBurst] = useState(0);
  const prev = useRef(ev.overall);
  useEffect(() => {
    if (ev.overall === 'ok' && prev.current !== 'ok') setBurst((b) => b + 1);
    prev.current = ev.overall;
  }, [ev.overall]);
  return html`<section class="verdict" id="verdict">
    <div class=${'vcard vsum st-' + ev.overall}>
      ${burst > 0 && html`<${Burst} k=${burst} />`}
      <div class="vstate"><span class="lamp"></span><span class="vword">${WORD[ev.overall]}</span></div>
      <div class="vsent">${SENT[ev.overall]}</div>
      <div class="vmeta">виконано ${ev.passed} із ${ev.total} вимог · ${s.mode === 'new' ? 'нове будівництво' : 'реконструкція'}</div>
      <div class="vmath">
        <div>H <b>${fmt(s.H)} м</b> ÷ <b>${fmtT(s.slope, 1)} %</b> → L <b class="hl">${fmt(g.L)} м</b> <span class="dim">(1:${fmtT(g.ratio, 1)})</span></div>
        <div>${g.n} ${pl(g.n, MARSH)} по <b>${fmt(g.h)} м</b>${g.n > 1 ? html` + ${g.n - 1} ${pl(g.n - 1, ['площадка', 'площадки', 'площадок'])}` : ''} · разом <b>${fmt(g.totalLen)} м</b></div>
        ${g.row && s.slope <= 8 && html`<div class="dim">табл. Д.1: підйом ≤ ${fmt(g.row.rise, 3)} м → ухил ≤ ${fmtT(g.row.pct, 1)} %</div>`}
      </div>
    </div>
    <div class="vcard vlist" id="issues">
      ${issues.length === 0
        ? html`<div class="allok">✔ Усі ${ev.total} перевірок за ДБН В.2.2-40:2018 пройдено</div>`
        : html`<div class="issues">${issues.map((it) => html`<${Issue} key=${it.id + it.status} it=${it} onGo=${onGo} onFix=${onFix} />`)}</div>`}
      <details class="passed" open=${issues.length === 0 && !matchMedia('(max-width: 899px)').matches}>
        <summary>Пройдені перевірки (${ev.passed})</summary>
        <ul>${ev.items.filter((i) => i.status === 'ok').map((i) => html`<li><button type="button" onClick=${() => onGo(i.tab)}>✔ ${i.title}</button><span class="clause">п. ${i.clause}</span></li>`)}</ul>
      </details>
    </div>
  </section>`;
}

/* ── навчання ── */
const TOUR = [
  { sel: '.mini, .verdict', title: 'Світлофор норми', text: 'Зелений — відповідає, жовтий — допускається як виняток, червоний — порушення. Кожне зауваження має пункт ДБН і кнопку «виправити».' },
  { sel: '.viewer', title: 'Схеми в реальному масштабі', text: 'Профіль, поперечний переріз і план. Людина в кріслі сама пробує заїхати: якщо круто — скочується, якщо вузько — не вміщується.' },
  { sel: '.modes', title: 'Тип будівництва і рух', text: 'Для реконструкції мінімальна ширина менша (0,90 м), а табл. Д.1 — рекомендація. Для двобічного руху потрібно 1,80 м.' },
  { sel: '.tabs', title: 'Групи параметрів', text: 'Кольорова крапка — стан групи. Вкладка підсвічує потрібні розміри на схемах.' },
  { sel: '.sliders', title: 'Повзунок або точне число', text: 'Тягніть повзунок або впишіть своє значення в поле (ухил можна вводити як 1:15). Кнопка «?» пояснює параметр.' },
  { sel: '.hdr-actions', title: 'Поділитися', text: 'Посилання зберігає всі параметри — надішліть його колезі, і він побачить той самий пандус.' },
];
function Tour({ onClose }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState(null);
  const step = TOUR[i], last = TOUR.length - 1;
  // перший видимий елемент (на телефоні вердикт — це липкий рядок угорі)
  const pick = (sel) => [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().width > 0);
  useEffect(() => {
    const el = pick(step.sel);
    if (el && !el.classList.contains('mini')) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const measure = () => {
      const e = pick(step.sel);
      if (!e) return setBox(null);
      const r = e.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, w: r.width, h: r.height });
    };
    measure();
    const t = [setTimeout(measure, 250), setTimeout(measure, 600)];
    const onKey = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight' && i < last) setI(i + 1); if (e.key === 'ArrowLeft' && i > 0) setI(i - 1); };
    addEventListener('resize', measure); addEventListener('scroll', measure, true); addEventListener('keydown', onKey);
    return () => { t.forEach(clearTimeout); removeEventListener('resize', measure); removeEventListener('scroll', measure, true); removeEventListener('keydown', onKey); };
  }, [i]);
  if (!box) return null;
  const p = 6;
  return html`<div class="tour" role="dialog" aria-modal="true" aria-label="Навчання">
    <div class="tour-hl" style=${{ top: box.top - p, left: box.left - p, width: box.w + 2 * p, height: box.h + 2 * p }}></div>
    <div class=${'tour-card' + (box.top + box.h / 2 > innerHeight / 2 ? ' up' : '')}>
      <div class="tour-step">Крок ${i + 1} із ${TOUR.length}</div>
      <div class="tour-title">${step.title}</div>
      <div class="tour-text">${step.text}</div>
      <div class="tour-btns">
        <button type="button" class="link" onClick=${onClose}>Пропустити</button>
        ${i > 0 && html`<button type="button" class="btn ghost" onClick=${() => setI(i - 1)}>Назад</button>`}
        <button type="button" class="btn" onClick=${() => (i < last ? setI(i + 1) : onClose())}>${i < last ? 'Далі' : 'Зрозуміло'}</button>
      </div>
    </div>
  </div>`;
}

function ViewCard({ id, active, title, note, children }) {
  return html`<div class=${'scard' + (active ? ' active' : '')} data-view=${id}>
    <div class="cap"><span>${title}</span><span class="cap-note">${note}</span></div>
    ${children}
  </div>`;
}
function Sized({ maxH, render: r }) {
  const ref = useRef(null);
  const W = useWidth(ref);
  return html`<div ref=${ref} class="sized">${r(W, maxH)}</div>`;
}

function App() {
  const shared = useMemo(() => location.hash.length > 1, []);
  const [s, setS] = useState(() => fromHash(location.hash));
  const [tab, setTab] = useState('slope');
  const [view, setView] = useState('profile');
  const [toast, setToast] = useState(null);
  const [tour, setTour] = useState(() => { if (shared) return false; try { return localStorage.getItem('pandusTour3') !== '1'; } catch (e) { return false; } });
  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const ev = useMemo(() => evaluate(s), [s]);
  const g = ev.g;
  const disp = useMorph(g.n);
  const segs = buildSegments(s, disp.n, disp.k);
  const sbt = statusByTab(ev);
  const narrow = typeof matchMedia === 'function' && matchMedia('(max-width: 899px)').matches;
  const mob = useRef(narrow);

  setRiderEnv({ segs, mode: ev.rider, wallX: segs[segs.length - 1].x1, verdict: ev.overall });

  useEffect(() => {
    const t = setTimeout(() => {
      const h = toHash(s);
      history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
    }, 250);
    return () => clearTimeout(t);
  }, [s]);
  useEffect(() => {
    const on = () => setS(fromHash(location.hash));
    addEventListener('hashchange', on);
    const mq = matchMedia('(max-width: 899px)'); const m = () => (mob.current = mq.matches); mq.addEventListener('change', m);
    return () => { removeEventListener('hashchange', on); mq.removeEventListener('change', m); };
  }, []);

  const goTab = (t) => {
    setTab(t);
    if (mob.current) setView(TAB_VIEW[t]);
    const el = document.querySelector('.ctrl');
    if (el && mob.current) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const pickTab = (t) => { setTab(t); if (mob.current) setView(TAB_VIEW[t]); };
  const say = (t) => { setToast(t); setTimeout(() => setToast(null), 2600); };
  const share = async () => {
    const url = location.origin + location.pathname + (toHash(s) ? '#' + toHash(s) : '');
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: 'Мій пандус — перевірка за ДБН', url }); return; }
      await navigator.clipboard.writeText(url);
      say('Посилання скопійовано — надішліть його колезі');
    } catch (e) { if (e && e.name !== 'AbortError') prompt('Скопіюйте посилання на цей пандус:', url); }
  };
  const reset = () => { setS({ ...DEFAULTS }); setTab('slope'); say('Скинуто до типового пандуса'); };
  const closeTour = () => { setTour(false); try { localStorage.setItem('pandusTour3', '1'); } catch (e) {} };

  const R = RANGES;
  const minL = Math.max(0.3, s.H / 0.14), maxL = Math.min(80, s.H / 0.02);
  const widthNeed = s.traffic === 'two' ? 1.8 : 1.2;
  const widthZones = s.mode === 'recon'
    ? [{ to: 0.9, color: 'fail' }, { to: widthNeed, color: 'limit' }, { to: 9, color: 'ok' }]
    : [{ to: widthNeed, color: 'fail' }, { to: 9, color: 'ok' }];
  const best = ev.best;

  const sl = {
    H: html`<${Slider} id="in-H" label="Перепад висот H" range=${R.H} value=${s.H} onChange=${(v) => set({ H: v })} unit="м"
      help="Різниця рівнів, яку долає пандус: від землі до площадки біля входу. Один марш може піднімати не більше 0,80 м (п. 5.3.1.2), а для нового будівництва — ще менше, залежно від ухилу (табл. Д.1)."
      zones=${[{ to: 0.8, color: 'ok' }, { to: 9, color: 'limit' }]} ticks=${[{ at: 0.2, label: '0,2' }, { at: 0.8, label: '0,8 — макс. марш' }]} />`,
    slope: html`<${Slider} id="in-i" label="Поздовжній ухил" range=${R.slope} value=${s.slope} onChange=${(v) => set({ slope: v })} unit="%" digits=${1} ratio
      help="Крутизна вздовж руху. Максимум — 8 % (1:12, 4,6°), крутіше не можна навіть при реконструкції (п. 5.3.1). Що крутіше, то нижчий допустимий підйом одного маршу (табл. Д.1). Можна вписати як 1:15."
      zones=${[{ to: 8, color: 'ok' }, { to: 99, color: 'fail' }]} ticks=${[{ at: 5, label: '5 % · 1:20' }, { at: 8, label: '8 % · 1:12' }]}
      sub=${`= 1:${fmtT(g.ratio, 1)} · кут ${fmtT(g.angle, 2)}°`} />`,
    L: html`<${Slider} id="in-L" label="Довжина маршів L" range=${{ min: minL, max: maxL, step: 0.05 }} value=${clamp(g.L, minL, maxL)}
      onChange=${(v) => set({ slope: clamp(Math.round((s.H / v) * 1000) / 10, R.slope.min, R.slope.max) })} unit="м"
      help="Сумарна горизонтальна довжина похилих частин: L = H ÷ ухил. Якщо змінити її — підлаштується ухил, а H лишиться."
      zones=${[{ to: s.H / 0.08, color: 'fail' }, { to: 999, color: 'ok' }]} ticks=${[{ at: s.H / 0.08, label: '1:12' }, { at: s.H / 0.05, label: '1:20' }]} />`,
  };

  return html`<div class="app">
    <a class="skip" href="#controls">До параметрів</a>
    <header class="hdr">
      <div class="hdr-title">
        <h1>Симулятор пандуса</h1>
        <span class="law">ДБН В.2.2-40:2018 · Зміни № 3, № 4</span>
      </div>
      <div class="hdr-actions">
        <button type="button" class="btn" onClick=${share}>↗ Поділитися</button>
        <button type="button" class="btn ghost" onClick=${reset}>↺ Скинути</button>
        <button type="button" class="btn ghost" onClick=${() => setTour(true)}>? Навчання</button>
      </div>
    </header>

    <a href="#issues" class=${'mini st-' + ev.overall} aria-label="Вердикт">
      <span class="lamp"></span><b>${WORD[ev.overall]}</b><span>${ev.passed}/${ev.total}</span>
      <span class="mini-sp"></span><span class="mini-m">${fmtT(s.slope, 1)} % · ${g.n} ${pl(g.n, MARSH)} · ${fmt(g.totalLen, 1)} м</span>
    </a>

    ${shared && html`<div class="banner">Вам надіслали пандус. Змінюйте числа під свій проєкт — вердикт оновлюється одразу.</div>`}

    <${Verdict} s=${s} ev=${ev} onGo=${goTab} onFix=${set} />

    <div class="main">
      <div class="viewer">
        <div class="vtabs" role="tablist" aria-label="Схема">
          ${VIEWS.map((v) => html`<button type="button" role="tab" aria-selected=${view === v.id} class=${view === v.id ? 'on' : ''} onClick=${() => setView(v.id)}>${v.label}</button>`)}
        </div>
        <${ViewCard} id="profile" active=${view === 'profile'} title="Профіль · вид збоку" note="кут на екрані = фактичному">
          <${Sized} maxH=${400} render=${(W, mh) => html`<${ProfileView} s=${s} segs=${segs} ev=${ev} focus=${tab} W=${W} maxH=${Math.min(mh, W < 600 ? 260 : mh)} />`} />
        </${ViewCard}>
        <div class="row2">
          <${ViewCard} id="section" active=${view === 'section'} title="Переріз · рис. 5а, 5д" note="ширина між поручнями">
            <${Sized} maxH=${280} render=${(W, mh) => html`<${SectionView} s=${s} ev=${ev} focus=${tab} W=${W} maxH=${W < 600 ? 250 : mh} />`} />
          </${ViewCard}>
          <${ViewCard} id="plan" active=${view === 'plan'} title="План · вид зверху" note="дощ показує поперечний ухил">
            <${Sized} maxH=${240} render=${(W, mh) => html`<${PlanView} s=${s} segs=${segs} ev=${ev} focus=${tab} W=${W} maxH=${mh} />`} />
          </${ViewCard}>
        </div>
      </div>

      <aside class="ctrl" id="controls" aria-label="Параметри пандуса">
        <div class="modes">
          <${Segmented} label="Будівництво" value=${s.mode} onChange=${(v) => set({ mode: v })}
            help="Нове будівництво — повні вимоги, табл. Д.1 обов'язкова. Реконструкція, капремонт, реставрація існуючих будівель — ширина від 0,90 м, табл. Д.1 рекомендована. Ухил понад 8 % не допускається в жодному разі."
            options=${[{ value: 'new', label: 'Нове' }, { value: 'recon', label: 'Реконструкція' }]} />
          <${Segmented} label="Рух" value=${s.traffic} onChange=${(v) => set({ traffic: v })}
            help="Однобічний — мін. 1,20 м у просвіті; двобічний (два крісла розминаються) — мін. 1,80 м (п. 5.3.1.1)."
            options=${[{ value: 'one', label: 'Однобічний' }, { value: 'two', label: 'Двобічний' }]} />
        </div>

        <${Tabs} tabs=${TABS} value=${tab} onChange=${pickTab} statusByTab=${sbt} />

        <div class="sliders" role="tabpanel">
          ${tab === 'slope' && html`
            ${sl.H}${sl.slope}${sl.L}
            <${Slider} id="in-c" label="Поперечний ухил" range=${R.cross} value=${s.cross} onChange=${(v) => set({ cross: v })} unit="%" digits=${1}
              help="Нахил убік, щоб стікала вода: 1–2 % (п. 5.1.5). Менше — калюжі й лід, більше — крісло зносить до краю. Подивіться на дощ на плані."
              zones=${[{ to: 1, color: 'fail' }, { to: 2, color: 'ok' }, { to: 99, color: 'fail' }]} ticks=${[{ at: 1, label: '1 %' }, { at: 2, label: '2 %' }]} />`}

          ${tab === 'flights' && html`
            ${sl.H}
            <${Slider} id="in-l" label="Глибина площадок" range=${R.landing} value=${s.landing} onChange=${(v) => set({ landing: v })} unit="м"
              help="Рівні площадки перед і після кожного підйому — мін. 1,50 м (п. 5.3.1.2): тут можна зупинитися й перепочити. На плані пунктиром — коло розвороту Ø 1,5 м."
              zones=${[{ to: 1.5, color: 'fail' }, { to: 99, color: 'ok' }]} ticks=${[{ at: 1.5, label: '1,5 мін.' }]} />
            <div class="breakdown">
              <div>марші: <b>${g.n} × ${fmt(g.h)} м</b>, кожен <b>${fmt(g.lm)} м</b> завдовжки</div>
              <div>площадки: <b>${g.n + 1}</b> (нижня, верхня${g.n > 1 ? `, ${g.n - 1} проміжн.` : ''}) · разом <b>${fmt(g.totalLen)} м</b></div>
            </div>
            ${best && html`<div class="tip">
              <div><b>Найкоротший варіант за нормою</b> для H ${fmt(s.H)} м: ${best.n} ${pl(best.n, MARSH)} по ${fmt(best.h)} м при ${fmtT(best.slope, 1)} % — ${fmt(best.total, 1)} м у плані.</div>
              ${Math.abs(best.slope - s.slope) > 0.05 && html`<button type="button" class="fixbtn" onClick=${() => set({ slope: best.slope })}>Застосувати ${fmtT(best.slope, 1)} %</button>`}
            </div>`}
            <details class="d1" open=${!mob.current}>
              <summary>Табл. Д.1 — ухил залежно від підйому маршу ${s.mode === 'new' ? '(обов’язкова)' : '(рекомендована)'}</summary>
              <table>
                <thead><tr><th>підйом ≤, м</th><th>ухил ≤</th><th>1:x</th><th>марш ≤, м</th></tr></thead>
                <tbody>${D1.filter((r) => r.rise !== 0.5).map((r) => html`<tr class=${g.row && g.row.rise === r.rise && s.slope <= 8 ? (s.slope <= r.pct + 1e-6 ? 'cur ok' : 'cur bad') : ''}>
                  <td>${fmt(r.rise, 3)}</td><td>${fmtT(r.pct, 1)} %</td><td>1:${r.ratio}</td><td>${fmt(r.len, 2)}</td></tr>`)}</tbody>
              </table>
              <p class="small">Рядок підсвічено для вашого підйому маршу (${fmt(g.h, 3)} м). Ухил понад 8 % не допускається (прим. 3).</p>
            </details>`}

          ${tab === 'width' && html`
            <${Slider} id="in-w" label="Ширина у просвіті" range=${R.width} value=${s.width} onChange=${(v) => set({ width: v })} unit="м"
              help="Відстань між ВНУТРІШНІМИ краями поручнів (рис. 5д), не по конструкції. Мін. 1,20 м (однобічний), 1,80 м (двобічний), для існуючих будівель — 0,90 м. Крісло колісне — близько 0,70 м завширшки."
              zones=${widthZones} ticks=${[{ at: 0.9, label: '0,9' }, { at: 1.2, label: '1,2' }, { at: 1.8, label: '1,8' }]} />
            <div class="info"><b>i</b><span>Подивіться на <b>переріз</b>: якщо крісло торкається поручнів — воно стає червоним і «тремтить». Перемикачі «Будівництво» і «Рух» угорі змінюють мінімум (п. 5.3.1.1).</span></div>`}

          ${tab === 'rails' && html`
            <${Switch} name="Поручні з обох боків" hint="п. 5.3.2" status=${ev.byId.railsBoth.status} value=${s.railsBoth} onChange=${(v) => set({ railsBoth: v })}
              help="Відкриті пандуси повинні мати поручні з обох боків — щоб триматися будь-якою рукою." />
            <${Slider} id="in-rt" label="Верхній поручень" range=${R.railTop} value=${s.railTop} onChange=${(v) => set({ railTop: v })} unit="м"
              help="0,90 м від поверхні пандуса до верху поручня (п. 5.3.2, рис. 5а)." zones=${[{ to: 0.895, color: 'fail' }, { to: 0.905, color: 'ok' }, { to: 9, color: 'fail' }]} ticks=${[{ at: 0.9, label: '0,90' }]} />
            <${Slider} id="in-rl" label="Нижній поручень" range=${R.railLow} value=${s.railLow} onChange=${(v) => set({ railLow: v })} unit="м"
              help="0,70 м — для людей у кріслі та невисокого зросту (п. 5.3.2)." zones=${[{ to: 0.695, color: 'fail' }, { to: 0.705, color: 'ok' }, { to: 9, color: 'fail' }]} ticks=${[{ at: 0.7, label: '0,70' }]} />
            <${Slider} id="in-d" label="Діаметр поручня" range=${R.railDiam} value=${s.railDiam} onChange=${(v) => set({ railDiam: v })} unit="мм" scale=${1000} digits=${0}
              help="Труба круглого перерізу Ø 35–45 мм, щоб долоня обхоплювала. Відступ від стіни — не менше 0,04 м (п. 5.3.2.1, рис. 5в)."
              zones=${[{ to: 35, color: 'fail' }, { to: 45, color: 'ok' }, { to: 999, color: 'fail' }]} ticks=${[{ at: 35, label: '35' }, { at: 45, label: '45' }]} />
            <${Slider} id="in-e" label="Продовження кінців" range=${R.railExt} value=${s.railExt} onChange=${(v) => set({ railExt: v })} unit="м"
              help="Горизонтальне продовження поручня за межі маршу — 0,30 м униз і вгорі, із заокругленням (п. 5.3.2.1, рис. 5г). Вимірюється до зовнішнього краю заокруглення."
              zones=${[{ to: 0.3, color: 'fail' }, { to: 9, color: 'ok' }]} ticks=${[{ at: 0.3, label: '0,30' }]} />
            <${Slider} id="in-p" label="Крайня опора від заокруглення" range=${R.postGap} value=${s.postGap} onChange=${(v) => set({ postGap: v })} unit="м"
              help="Перша й остання опори — за 0,15–0,20 м від краю заокругленої частини (п. 5.3.2.3, рис. 5г), щоб тростина незрячої людини натрапила на поручень, а не на стійку."
              zones=${[{ to: 0.15, color: 'fail' }, { to: 0.2, color: 'ok' }, { to: 9, color: 'fail' }]} ticks=${[{ at: 0.15, label: '0,15' }, { at: 0.2, label: '0,20' }]} />
            <${Switch} name="Поручні контрастні за кольором" hint="п. 5.3.2.2" status=${ev.byId.railContrast.status} value=${s.railContrast} onChange=${(v) => set({ railContrast: v })}
              help="Колір поручнів має контрастувати з пандусом і тлом — щоб їх бачили люди зі слабким зором." />
            <${Switch} name="Тут бувають дошкільнята" hint="садок, дитячий майданчик, парк" value=${s.kids} onChange=${(v) => set({ kids: v })}
              help="У місцях масового перебування дітей дошкільного віку потрібен третій поручень на висоті 0,50 м (п. 5.3.2)." />
            <${Switch} name="Дитячий поручень 0,50 м" hint="п. 5.3.2" status=${ev.byId.railChild && ev.byId.railChild.status} value=${s.railChild} onChange=${(v) => set({ railChild: v })} />`}

          ${tab === 'safety' && html`
            <${Slider} id="in-cu" label="Бортик по краях" range=${R.curb} value=${s.curb} onChange=${(v) => set({ curb: v })} unit="м" digits=${3}
              help="По поздовжніх краях, що не примикають до стін, — бортик заввишки не менше 0,05 м, щоб колесо не з’їхало (п. 5.3.2.3)."
              zones=${[{ to: 0.05, color: 'fail' }, { to: 9, color: 'ok' }]} ticks=${[{ at: 0.05, label: '0,05 мін.' }]} />
            <${Switch} name="Покриття шорстке й тверде" hint="п. 5.3.2.4, 5.1.7" status=${ev.byId.surface.status} value=${s.surface} onChange=${(v) => set({ surface: v })}
              help="Шорстке, не слизьке при намоканні, без насипних і крупноструктурних матеріалів (гравій, бруківка з великими швами)." />
            <${Switch} name="Площадки виділено кольором" hint="або смуга ≥ 0,10 м на початку схилу" status=${ev.byId.landingMark.status} value=${s.landingMark} onChange=${(v) => set({ landingMark: v })}
              help="Площадки мають відрізнятися кольором від похилих частин; якщо це неможливо — контрастна смуга ≥ 0,10 м на всю ширину на початку зміни висоти (п. 5.3.2.4)." />
            <${Switch} name="Накладні планки / тактильні смуги на пандусі" hint="п. 5.3.1.3 — заборонено" status=${ev.byId.overlays.status} value=${s.overlays} onChange=${(v) => set({ overlays: v })}
              help="Накладні протиковзкі планки та напрямні тактильні смуги на поверхні пандуса не допускаються — вони трясуть крісло й чіпляють колеса." />
            <div class="info"><b>i</b><span><b>Попереджувальні тактильні смуги</b> перед пандусом угорі й унизу не застосовуються (п. 5.3.2.5); окремі випадки — п. 8.2.10 у редакції Змін № 3 і № 4.</span></div>`}
        </div>
      </aside>
    </div>

    <footer class="foot">
      Навчальний інструмент. Перевірки — за ДБН В.2.2-40:2018 «Інклюзивність будівель і споруд» зі Змінами № 3 (з 01.04.2026) і № 4 (з 01.10.2026): п. 5.1.5, 5.1.7, 5.3, табл. Д.1. Перед проєктуванням звіряйте з чинним текстом норми.
    </footer>

    ${toast && html`<div class="toast" role="status">${toast}</div>`}
    ${tour && html`<${Tour} onClose=${closeTour} />`}
  </div>`;
}

render(html`<${App} />`, document.getElementById('root'));
