/* Елементи керування: повзунок із полем для точного вводу, перемикачі, вкладки, підказки «?». */
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { fmt, parseNum, clamp } from './norms.js';

export const STATUS_COLOR = { ok: 'var(--ok)', limit: 'var(--warn)', fail: 'var(--fail)', auto: 'var(--warn)' };
const ZONE = { ok: 'var(--ok-z)', limit: 'var(--warn-z)', fail: 'var(--fail-z)' };

/* zones: [{to, color}] у одиницях показу, від min до max */
function zoneGradient(zones, min, max) {
  if (!zones || !zones.length) return null;
  let from = min;
  const stops = zones.map((z) => {
    const a = ((from - min) / (max - min)) * 100, b = ((Math.min(z.to, max) - min) / (max - min)) * 100;
    from = z.to;
    return `${ZONE[z.color]} ${a.toFixed(2)}% ${b.toFixed(2)}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export function Help({ text }) {
  const [open, setOpen] = useState(false);
  return html`<span class="help">
    <button type="button" class=${'qbtn' + (open ? ' on' : '')} aria-expanded=${open} aria-label="Пояснення" onClick=${(e) => { e.preventDefault(); setOpen(!open); }}>?</button>
    ${open && html`<span class="helptext" role="note">${text}</span>`}
  </span>`;
}

/**
 * value — у внутрішніх одиницях (м, %); scale — множник для показу (напр. 1000 для мм).
 * ratio — дозволити ввід ухилу як «1:15».
 */
export function Slider({ id, label, help, value, onChange, range, unit, digits = 2, scale = 1, zones, ticks, sub, ratio = false }) {
  const min = range.min * scale, max = range.max * scale, step = range.step * scale;
  const shown = value * scale;
  const [txt, setTxt] = useState(fmt(shown, digits));
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setTxt(fmt(shown, digits)); }, [shown, focus, digits]);
  const commitTxt = (t) => {
    const v = parseNum(t, { ratioToPct: ratio });
    if (Number.isFinite(v)) onChange(clamp(v, min, max) / scale);
  };
  const bad = focus && !Number.isFinite(parseNum(txt, { ratioToPct: ratio }));
  const pos = (x) => `${(((x - min) / (max - min)) * 100).toFixed(2)}%`;
  return html`<div class="sl">
    <div class="sl-row">
      <label class="sl-name" for=${id}>${label}</label>
      ${help && html`<${Help} text=${help} />`}
      <span class="sl-val">
        <input id=${id} class=${'num' + (bad ? ' bad' : '')} type="text" inputmode="decimal" autocomplete="off" spellcheck="false"
          value=${txt} aria-label=${`${label}, ${unit}`}
          onFocus=${(e) => { setFocus(true); e.target.select(); }}
          onInput=${(e) => { setTxt(e.target.value); commitTxt(e.target.value); }}
          onBlur=${() => { setFocus(false); setTxt(fmt(shown, digits)); }}
          onKeyDown=${(e) => {
            if (e.key === 'Enter') e.target.blur();
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const v = clamp(shown + (e.key === 'ArrowUp' ? step : -step), min, max);
              onChange(v / scale); setTxt(fmt(v, digits));
            }
          }} />
        <span class="unit">${unit}</span>
      </span>
    </div>
    <div class="track">
      <input type="range" min=${min} max=${max} step=${step} value=${clamp(shown, min, max)} aria-label=${label} tabindex="-1"
        style=${{ '--zones': zoneGradient(zones, min, max) || 'var(--line-soft)' }}
        onInput=${(e) => onChange(parseFloat(e.target.value) / scale)} />
      ${(ticks || []).filter((t) => t.at >= min && t.at <= max).map((t) => {
        const p = ((t.at - min) / (max - min)) * 100;
        return html`<span class=${'tick' + (p < 12 ? ' tl' : p > 88 ? ' tr' : '')} style=${{ left: pos(t.at) }}><span>${t.label}</span></span>`;
      })}
    </div>
    ${sub && html`<div class="sl-sub">${sub}</div>`}
  </div>`;
}

export function Segmented({ label, options, value, onChange, help }) {
  return html`<div class="seg-line">
    <span class="seg-lbl">${label}${help && html`<${Help} text=${help} />`}</span>
    <div class="seg" role="radiogroup" aria-label=${label}>
      ${options.map((o) => html`<button type="button" role="radio" aria-checked=${value === o.value} class=${value === o.value ? 'on' : ''}
        onClick=${() => onChange(o.value)}>${o.label}</button>`)}
    </div>
  </div>`;
}

export function Switch({ name, hint, help, value, onChange, status }) {
  return html`<div class="sw-row">
    <div class="sw-txt">
      <div class="sw-name">${status && html`<span class="dot" style=${{ background: STATUS_COLOR[status] }}></span>`}${name}${help && html`<${Help} text=${help} />`}</div>
      ${hint && html`<div class="sw-hint">${hint}</div>`}
    </div>
    <button type="button" role="switch" aria-checked=${value} aria-label=${name} class=${'sw' + (value ? ' on' : '')} onClick=${() => onChange(!value)}></button>
  </div>`;
}

export function Tabs({ tabs, value, onChange, statusByTab }) {
  return html`<div class="tabs" role="tablist" aria-label="Групи параметрів">
    ${tabs.map((t) => html`<button type="button" role="tab" aria-selected=${value === t.id} class=${value === t.id ? 'on' : ''} onClick=${() => onChange(t.id)}>
      <span class="dot" style=${{ background: STATUS_COLOR[statusByTab[t.id] || 'ok'] }}></span>${t.label}
    </button>`)}
  </div>`;
}
