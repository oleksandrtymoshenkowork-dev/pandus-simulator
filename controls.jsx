/* Контроли: слайдер із кольоровими зонами, перемикачі, вкладки. */
const { fmt, fmtT } = window.RampNorms;

const STATUS_COLOR = {
  ok: 'var(--ok)',
  limit: 'var(--warn)',
  fail: 'var(--fail)',
  auto: 'var(--warn)',
};

/* zones: [{to, color: 'ok'|'limit'|'fail'}, ...] — від min до max */
function zoneGradient(zones, min, max) {
  if (!zones || !zones.length) return 'var(--line-soft)';
  const cmap = { ok: 'rgba(65,196,99,0.4)', limit: 'rgba(219,166,46,0.45)', fail: 'rgba(242,85,77,0.45)' };
  const stops = [];
  let from = min;
  for (const z of zones) {
    const a = ((from - min) / (max - min)) * 100;
    const b = ((Math.min(z.to, max) - min) / (max - min)) * 100;
    stops.push(`${cmap[z.color]} ${a.toFixed(2)}% ${b.toFixed(2)}%`);
    from = z.to;
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

function QMark({ text, below }) {
  return (
    <span className={'qmark' + (below ? ' below' : '')} tabIndex={0} aria-label="Пояснення">?
      <span className="qtip" role="tooltip">{text}</span>
    </span>
  );
}

function Slider({ label, help, value, onChange, min, max, step, unit, digits = 2, zones, ticks, sub, display }) {
  const pos = (x) => `${(((x - min) / (max - min)) * 100).toFixed(2)}%`;
  const [editing, setEditing] = React.useState(false);
  const [txt, setTxt] = React.useState('');
  const shown = display != null ? String(display) : fmt(value, digits);
  const startEdit = () => { setTxt(shown.replace(/[\s\u00a0\u202f]/g, '')); setEditing(true); };
  const commit = () => {
    setEditing(false);
    const v = parseFloat(txt.trim().replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
    if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
  };
  return (
    <div className="sl">
      <div className="row1">
        <span className="name">{label}{help ? <QMark text={help} /> : null}</span>
        <span className="val">
          {editing ? (
            <input
              className="valedit"
              autoFocus
              value={txt}
              inputMode="decimal"
              onChange={(e) => setTxt(e.target.value)}
              onBlur={commit}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            />
          ) : (
            <button type="button" className="valbtn" title="Натисніть, щоб увести точне значення" onClick={startEdit}>
              {shown}{unit ? <span className="unit"> {unit}</span> : null}<span className="pen">✎</span>
            </button>
          )}
        </span>
      </div>
      <div className="track-wrap">
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          style={{ background: zoneGradient(zones, min, max) }}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          aria-label={label}
        />
        {(ticks || []).map((t, i) => {
          const p = ((t.at - min) / (max - min)) * 100;
          const cls = p < 12 ? ' tl' : p > 88 ? ' tr' : '';
          return (
            <div className={'tick' + cls} key={i} style={{ left: pos(t.at) }}>
              <span>{t.label}</span>
            </div>
          );
        })}
      </div>
      {sub ? <div className={'sub' + (sub.mono ? ' mono' : '')}>{sub.text || sub}</div> : null}
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
          type="button"
        >{o.label}</button>
      ))}
    </div>
  );
}

function SwitchRow({ name, hint, help, value, onChange }) {
  return (
    <div className="switch-row">
      <div>
        <div className="name">{name}{help ? <QMark text={help} /> : null}</div>
        {hint ? <div className="hint">{hint}</div> : null}
      </div>
      <div
        className={'sw' + (value ? ' on' : '')}
        role="switch"
        aria-checked={value}
        tabIndex={0}
        onClick={() => onChange(!value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!value); } }}
      ></div>
    </div>
  );
}

function Tabs({ tabs, value, onChange, statusByTab }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          className={value === t.id ? 'on' : ''}
          onClick={() => onChange(t.id)}
          type="button"
        >
          <span className="tdot" style={{ background: STATUS_COLOR[statusByTab[t.id] || 'ok'] }}></span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

Object.assign(window, { Slider, Segmented, SwitchRow, Tabs, QMark, STATUS_COLOR, zoneGradient });
