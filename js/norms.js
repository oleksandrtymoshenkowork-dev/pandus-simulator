/* Нормативне ядро: ДБН В.2.2-40:2018 «Інклюзивність будівель і споруд» зі Змінами № 3 і № 4,
   підрозділ 5.3 «Відкриті пандуси», п. 5.1.5, 5.1.7, додаток Д (табл. Д.1).
   Чисті функції без DOM — їх перевіряє tests/norms.test.mjs. */

export const EPS = 1e-6;

/* Табл. Д.1 (Зміна № 3): обов'язкова для нового будівництва, довідкова для реконструкції.
   rise — макс. підйом між площадками, м; pct — макс. ухил, %; len — макс. довжина маршу, м. */
export const D1 = [
  { rise: 0.200, ratio: 12, deg: 4.57, pct: 8.0, len: 2.400 },
  { rise: 0.245, ratio: 13, deg: 4.40, pct: 7.7, len: 3.185 },
  { rise: 0.280, ratio: 14, deg: 4.06, pct: 7.1, len: 3.920 },
  { rise: 0.315, ratio: 15, deg: 3.83, pct: 6.7, len: 4.725 },
  { rise: 0.350, ratio: 16, deg: 3.60, pct: 6.3, len: 5.600 },
  { rise: 0.385, ratio: 17, deg: 3.38, pct: 5.9, len: 6.545 },
  { rise: 0.420, ratio: 18, deg: 3.21, pct: 5.6, len: 7.560 },
  { rise: 0.460, ratio: 19, deg: 3.03, pct: 5.3, len: 8.740 },
  { rise: 0.500, ratio: 20, deg: 2.86, pct: 5.0, len: 10.000 },
  { rise: 0.800, ratio: 20, deg: 2.86, pct: 5.0, len: 16.000 },
];
export const MAX_SLOPE = 8;     // %, п. 5.3.1 і прим. 3 до табл. Д.1
export const MAX_RISE = 0.8;    // м, п. 5.3.1.2

/* Межі введення (повзунки, ручний ввід, параметри з посилання). */
export const RANGES = {
  H:        { min: 0.05, max: 2.0,  step: 0.01 },
  slope:    { min: 2,    max: 14,   step: 0.1 },
  cross:    { min: 0,    max: 4,    step: 0.1 },
  width:    { min: 0.6,  max: 2.5,  step: 0.01 },
  landing:  { min: 0.8,  max: 3.0,  step: 0.05 },
  railTop:  { min: 0.6,  max: 1.1,  step: 0.01 },
  railLow:  { min: 0.5,  max: 0.9,  step: 0.01 },
  railDiam: { min: 0.02, max: 0.07, step: 0.001 },
  railExt:  { min: 0,    max: 0.6,  step: 0.01 },
  postGap:  { min: 0,    max: 0.4,  step: 0.01 },
  curb:     { min: 0,    max: 0.15, step: 0.005 },
};

export const DEFAULTS = {
  mode: 'new',          // 'new' — нове будівництво | 'recon' — реконструкція, кап. ремонт, реставрація
  traffic: 'one',       // 'one' | 'two'
  H: 0.45,              // загальний перепад висот, м
  slope: 5,             // поздовжній ухил, %
  cross: 1.5,           // поперечний ухил, %
  width: 1.2,           // ширина у просвіті між поручнями, м
  landing: 1.5,         // глибина площадок, м
  railsBoth: true,      // поручні з обох боків
  railTop: 0.9,         // м
  railLow: 0.7,         // м
  kids: false,          // місце масового перебування дітей дошкільного віку
  railChild: false,     // поручень 0,5 м встановлено
  railDiam: 0.04,       // м
  railExt: 0.3,         // горизонтальне продовження за марш, м
  postGap: 0.18,        // крайня опора від краю заокруглення, м
  railContrast: true,   // поручні контрастні за кольором
  curb: 0.05,           // бортик, м
  surface: true,        // покриття шорстке, тверде, не насипне
  landingMark: true,    // площадки іншого кольору або смуга ≥ 0,1 м
  overlays: false,      // накладні протиковзкі планки / напрямні тактильні смуги на пандусі
};

/* ── форматування ── */
export const fmt = (x, d = 2) =>
  Number(x).toLocaleString('uk-UA', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtT = (x, d = 1) =>
  Number(x).toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: d });
export const pl = (n, forms) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
};
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const MARSH = ['марш', 'марші', 'маршів'];
const PLOSH = ['площадка', 'площадки', 'площадок'];

/* ── табл. Д.1 ── */
/** Найбільший підйом маршу, допустимий за табл. Д.1 для ухилу pct (%); 0 — ухил недопустимий. */
export function maxRiseFor(pct) {
  let r = 0;
  for (const row of D1) if (row.pct >= pct - EPS) r = Math.max(r, row.rise);
  return r;
}
/** Рядок табл. Д.1 для підйому маршу h (м): найменший «макс. підйом», що ≥ h; null — h > 0,8 м. */
export function rowFor(h) {
  return D1.find((row) => row.rise >= h - EPS) || null;
}

/* ── геометрія ── */
export function compute(s) {
  const k = s.slope / 100;
  const L = s.H / k;                                         // сумарна горизонтальна проєкція маршів
  const nRise = Math.max(1, Math.ceil(s.H / MAX_RISE - EPS));  // п. 5.3.1.2
  const maxRise = maxRiseFor(s.slope);
  const nD1 = maxRise > 0 ? Math.max(1, Math.ceil(s.H / maxRise - EPS)) : nRise;
  const n = s.mode === 'new' ? Math.max(nRise, nD1) : nRise;
  const h = s.H / n;
  return {
    k, L, n, nRise, nD1, h, maxRise,
    lm: L / n,
    angle: Math.atan(k) * 180 / Math.PI,
    ratio: 1 / k,
    totalLen: (n + 1) * s.landing + L,
    row: rowFor(h),
  };
}

/** Найкоротший у плані варіант, що відповідає нормі (для реконструкції Д.1 лише рекомендація). */
export function bestVariant(H, landing, mode = 'new') {
  const nRise = Math.max(1, Math.ceil(H / MAX_RISE - EPS));
  if (mode !== 'new') {
    return { n: nRise, h: H / nRise, slope: MAX_SLOPE, L: H / 0.08, total: H / 0.08 + (nRise + 1) * landing };
  }
  let best = null;
  for (let n = nRise; n <= 40; n++) {
    const h = H / n, row = rowFor(h);
    if (!row) continue;
    const L = H / (row.pct / 100), total = L + (n + 1) * landing;
    if (!best || total < best.total - 1e-4) best = { n, h, slope: row.pct, L, total };
  }
  return best;
}

/* ── перевірки ── */
export function evaluate(s) {
  const g = compute(s);
  const items = [];
  const add = (o) => items.push({ detail: null, fix: null, note: null, action: null, ...o });
  const pctS = fmtT(s.slope, 1);
  const recon = s.mode === 'recon';
  const best = bestVariant(s.H, s.landing, s.mode);
  const bestText = (b) => `${b.n} ${pl(b.n, MARSH)} по ${fmt(b.h)} м при ухилі ${fmtT(b.slope, 1)} % — разом ${fmt(b.total, 1)} м у плані`;
  const near = (a, b) => Math.abs(a - b) < 0.005;

  // 1. Поздовжній ухил — п. 5.3.1, прим. 3 до табл. Д.1
  if (s.slope > MAX_SLOPE + EPS) {
    add({
      id: 'slope', tab: 'slope', status: 'fail', clause: '5.3.1',
      title: 'Занадто круто — людина в кріслі не заїде, а донизу розженеться',
      detail: `Ухил ${pctS} % (1:${fmtT(g.ratio, 1)}) — більше за 8 % (1:12), що не допускається${recon ? ' і при реконструкції' : ''}`,
      fix: `Найкоротший варіант за нормою: ${bestText(best)}`,
      action: { label: `Застосувати ${fmtT(best.slope, 1)} %`, patch: { slope: best.slope } },
    });
  } else {
    add({
      id: 'slope', tab: 'slope', status: 'ok', clause: '5.3.1',
      title: `Ухил ${pctS} % (1:${fmtT(g.ratio, 1)}, ${fmtT(g.angle, 2)}°) — не більше 8 %`,
      note: s.slope < 5 - EPS ? 'Положистіше за 1:20 — за прим. 2 до табл. Д.1 проміжні площадки не потрібні, але підйом одного маршу все одно ≤ 0,80 м (п. 5.3.1.2).' : null,
    });
  }

  // 2. Марші: п. 5.3.1.2 (≤ 0,8 м) і табл. Д.1
  {
    const hS = fmt(g.h), mrS = fmt(g.maxRise, 3);
    const split = `${g.n} ${pl(g.n, MARSH)} по ${hS} м + ${g.n - 1} ${pl(g.n - 1, ['проміжна площадка', 'проміжні площадки', 'проміжних площадок'])}`;
    const shorter = best && best.total < g.totalLen - 0.05 && s.slope <= MAX_SLOPE + EPS
      ? { note: `Коротший варіант: ${bestText(best)}`, action: { label: 'Застосувати', patch: { slope: best.slope } } }
      : {};
    if (s.slope > MAX_SLOPE + EPS) {
      add({
        id: 'flights', tab: 'flights', status: g.nRise > 1 ? 'auto' : 'ok', clause: '5.3.1.2',
        title: g.nRise > 1 ? `Перепад ${fmt(s.H)} м > 0,80 м — потрібно щонайменше ${g.nRise} ${pl(g.nRise, MARSH)}` : 'Підйом одного маршу ≤ 0,80 м',
      });
    } else if (recon && g.h > g.maxRise + EPS) {
      add({
        id: 'flights', tab: 'flights', status: 'limit', clause: '5.3.1.2, Д.1',
        title: 'Допустимо для реконструкції, але задовгий підйом без перепочинку',
        detail: `Табл. Д.1 (для реконструкції — рекомендована): при ухилі ${pctS} % підйом маршу ≤ ${mrS} м, а тут ${hS} м`,
        fix: `За можливості: ${bestText(bestVariant(s.H, s.landing, 'new'))}`,
        action: { label: 'Як для нового', patch: { slope: bestVariant(s.H, s.landing, 'new').slope } },
      });
    } else if (g.n > 1) {
      const why = !recon && g.nD1 > g.nRise
        ? `Табл. Д.1: при ухилі ${pctS} % один марш може підніматися не більше ніж на ${mrS} м`
        : `Перепад ${fmt(s.H)} м > 0,80 м — одним маршем долати не можна (п. 5.3.1.2)`;
      add({
        id: 'flights', tab: 'flights', status: 'auto', clause: recon ? '5.3.1.2' : '5.3.1.2, Д.1',
        title: 'Посередині потрібні рівні площадки для перепочинку',
        detail: why, fix: `Розбито автоматично: ${split}`, ...shorter,
      });
    } else {
      add({
        id: 'flights', tab: 'flights', status: 'ok', clause: recon ? '5.3.1.2' : '5.3.1.2, Д.1',
        title: `Один марш: підйом ${hS} м ≤ ${recon ? '0,80' : mrS} м`, ...shorter,
      });
    }
  }

  // 3. Площадки — п. 5.3.1.2
  add(s.landing >= 1.5 - EPS ? {
    id: 'landing', tab: 'flights', status: 'ok', clause: '5.3.1.2',
    title: `Площадки ${fmt(s.landing)} м ≥ 1,50 м`,
  } : {
    id: 'landing', tab: 'flights', status: 'fail', clause: '5.3.1.2',
    title: 'Площадка замала — кріслу ніде зупинитися',
    detail: `Глибина ${fmt(s.landing)} м < 1,50 м (перед і після кожного підйому)`,
    fix: 'Збільште глибину нижньої, верхньої та проміжних площадок до ≥ 1,50 м',
    action: { label: '1,50 м', patch: { landing: 1.5 } },
  });

  // 4. Ширина у просвіті — п. 5.3.1.1
  {
    const need = s.traffic === 'two' ? 1.8 : 1.2;
    const w = s.width, wS = fmt(w);
    if (w >= need - EPS) {
      add({ id: 'width', tab: 'width', status: 'ok', clause: '5.3.1.1', title: `Ширина ${wS} м ≥ ${fmt(need)} м (${s.traffic === 'two' ? 'двобічний' : 'однобічний'} рух)` });
    } else if (recon && w >= 0.9 - EPS) {
      add({
        id: 'width', tab: 'width', status: 'limit', clause: '5.3.1.1',
        title: s.traffic === 'two' ? 'Допускається для існуючої будівлі, але двом кріслам не розминутися' : 'Тісно, але допускається для існуючої будівлі',
        detail: `Ширина ${wS} м: для реконструкції мінімум 0,90 м, повна норма ${fmt(need)} м`,
        fix: `За можливості розширте до ${fmt(need)} м`,
        action: { label: `${fmt(need)} м`, patch: { width: need } },
      });
    } else {
      const min = recon ? 0.9 : need;
      add({
        id: 'width', tab: 'width', status: 'fail', clause: '5.3.1.1',
        title: w < 0.75 ? 'Крісло колісне фізично не проїде' : s.traffic === 'two' && w >= 1.2 ? 'Двом кріслам назустріч не розминутися' : 'Завузько — проїзд затиснутий між поручнями',
        detail: `Ширина у просвіті ${wS} м < ${fmt(min)} м`,
        fix: `Розширте просвіт між поручнями до ≥ ${fmt(min)} м`,
        action: { label: `${fmt(min)} м`, patch: { width: min } },
      });
    }
  }

  // 5. Поперечний ухил — п. 5.1.5
  {
    const c = s.cross, cS = fmtT(c, 1);
    add(c >= 1 - EPS && c <= 2 + EPS ? {
      id: 'cross', tab: 'slope', status: 'ok', clause: '5.1.5', title: `Поперечний ухил ${cS} % — у межах 1–2 %`,
    } : c < 1 ? {
      id: 'cross', tab: 'slope', status: 'fail', clause: '5.1.5',
      title: 'Вода стоятиме калюжами, взимку — лід',
      detail: `Поперечний ухил ${cS} % < 1 %`, fix: 'Зробіть ухил убік 1–2 %',
      action: { label: '1,5 %', patch: { cross: 1.5 } },
    } : {
      id: 'cross', tab: 'slope', status: 'fail', clause: '5.1.5',
      title: 'Крісло тягне вбік, до краю',
      detail: `Поперечний ухил ${cS} % > 2 %`, fix: 'Зменште поперечний ухил до 1–2 %',
      action: { label: '1,5 %', patch: { cross: 1.5 } },
    });
  }

  // 6. Поручні з обох боків — п. 5.3.2, 5.3.1.3
  add(s.railsBoth ? {
    id: 'railsBoth', tab: 'rails', status: 'ok', clause: '5.3.2', title: 'Поручні з обох боків',
  } : {
    id: 'railsBoth', tab: 'rails', status: 'fail', clause: '5.3.2',
    title: 'Поручень лише з одного боку — тягнутися нема за що',
    detail: 'Відкриті пандуси повинні мати поручні з обох боків',
    fix: 'Встановіть поручні з обох боків', action: { label: 'Додати', patch: { railsBoth: true } },
  });

  // 7. Рівні поручнів — п. 5.3.2
  {
    const okT = near(s.railTop, 0.9), okL = near(s.railLow, 0.7);
    add(okT && okL ? {
      id: 'railLevels', tab: 'rails', status: 'ok', clause: '5.3.2', title: 'Поручні на висоті 0,90 і 0,70 м',
    } : {
      id: 'railLevels', tab: 'rails', status: 'fail', clause: '5.3.2',
      title: 'Поручень не на тій висоті — рука його не знайде',
      detail: [!okT && `верхній ${fmt(s.railTop)} м замість 0,90`, !okL && `нижній ${fmt(s.railLow)} м замість 0,70`].filter(Boolean).join('; '),
      fix: 'Поручні на двох рівнях: 0,90 і 0,70 м від поверхні пандуса до верху поручня',
      action: { label: '0,90 / 0,70', patch: { railTop: 0.9, railLow: 0.7 } },
    });
  }

  // 8. Дитячий поручень — п. 5.3.2
  if (s.kids) {
    add(s.railChild ? {
      id: 'railChild', tab: 'rails', status: 'ok', clause: '5.3.2', title: 'Додатковий поручень 0,50 м для дітей',
    } : {
      id: 'railChild', tab: 'rails', status: 'fail', clause: '5.3.2',
      title: 'Дитина не дотягнеться до поручня',
      detail: 'У місцях масового перебування дітей дошкільного віку — додатковий поручень на 0,50 м',
      fix: 'Додайте третій поручень на висоті 0,50 м', action: { label: 'Додати', patch: { railChild: true } },
    });
  }

  // 9. Діаметр — п. 5.3.2.1
  {
    const ok = s.railDiam >= 0.035 - EPS && s.railDiam <= 0.045 + EPS;
    add(ok ? {
      id: 'railDiam', tab: 'rails', status: 'ok', clause: '5.3.2.1', title: `Діаметр поручня ${fmt(s.railDiam * 1000, 0)} мм — у межах 35–45 мм`,
    } : {
      id: 'railDiam', tab: 'rails', status: 'fail', clause: '5.3.2.1',
      title: s.railDiam < 0.035 ? 'Затонкий поручень — ріже долоню' : 'Затовстий поручень — долоня не обхопить',
      detail: `Діаметр ${fmt(s.railDiam * 1000, 0)} мм поза межами 35–45 мм`,
      fix: 'Труба круглого перерізу Ø 35–45 мм', action: { label: 'Ø 40 мм', patch: { railDiam: 0.04 } },
    });
  }

  // 10. Продовження кінців — п. 5.3.2.1
  add(s.railExt >= 0.3 - EPS ? {
    id: 'railExt', tab: 'rails', status: 'ok', clause: '5.3.2.1', title: `Кінці поручнів продовжено на ${fmt(s.railExt)} м із заокругленням`,
  } : {
    id: 'railExt', tab: 'rails', status: 'fail', clause: '5.3.2.1',
    title: 'Поручень закінчується зарано — нема за що взятися перед схилом',
    detail: `Горизонтальне продовження ${fmt(s.railExt)} м < 0,30 м`,
    fix: 'Продовжте поручні по горизонталі на 0,30 м униз і вгорі, із заокругленням',
    action: { label: '0,30 м', patch: { railExt: 0.3 } },
  });

  // 11. Крайні опори — п. 5.3.2.3
  {
    const ok = s.postGap >= 0.15 - EPS && s.postGap <= 0.2 + EPS;
    add(ok ? {
      id: 'postGap', tab: 'rails', status: 'ok', clause: '5.3.2.3', title: `Крайні опори за ${fmt(s.postGap * 1000, 0)} мм від заокруглення`,
    } : {
      id: 'postGap', tab: 'rails', status: 'fail', clause: '5.3.2.3',
      title: 'Тростина незрячої людини не намацає край поручня',
      detail: `Перша/остання опора за ${fmt(s.postGap * 1000, 0)} мм від краю заокруглення, а треба 150–200 мм`,
      fix: 'Перенесіть крайні опори на 0,15–0,20 м від краю заокругленої частини',
      action: { label: '180 мм', patch: { postGap: 0.18 } },
    });
  }

  // 12. Контраст поручнів — п. 5.3.2.2
  add(s.railContrast ? {
    id: 'railContrast', tab: 'rails', status: 'ok', clause: '5.3.2.2', title: 'Поручні контрастні за кольором',
  } : {
    id: 'railContrast', tab: 'rails', status: 'fail', clause: '5.3.2.2',
    title: 'Поручень зливається з тлом — людина зі слабким зором його не бачить',
    fix: 'Пофарбуйте поручні в колір, контрастний до пандуса й прилеглих поверхонь',
    action: { label: 'Виправити', patch: { railContrast: true } },
  });

  // 13. Бортик — п. 5.3.2.3
  add(s.curb >= 0.05 - EPS ? {
    id: 'curb', tab: 'safety', status: 'ok', clause: '5.3.2.3', title: `Бортик ${fmt(s.curb * 1000, 0)} мм ≥ 50 мм по відкритих краях`,
  } : {
    id: 'curb', tab: 'safety', status: 'fail', clause: '5.3.2.3',
    title: 'Колесо може з’їхати з краю пандуса',
    detail: `Бортик ${fmt(s.curb * 1000, 0)} мм < 50 мм по краях, що не примикають до стін`,
    fix: 'Підніміть бортики до ≥ 0,05 м', action: { label: '50 мм', patch: { curb: 0.05 } },
  });

  // 14. Покриття — п. 5.3.2.4, 5.1.7
  add(s.surface ? {
    id: 'surface', tab: 'safety', status: 'ok', clause: '5.3.2.4', title: 'Покриття шорстке й тверде',
  } : {
    id: 'surface', tab: 'safety', status: 'fail', clause: '5.3.2.4, 5.1.7',
    title: 'Слизько або грузько — колеса буксують',
    detail: 'Покриття гладке, насипне чи крупноструктурне',
    fix: 'Тверде шорстке покриття, контрастне до суміжних поверхонь', action: { label: 'Виправити', patch: { surface: true } },
  });

  // 15. Контрастні площадки або смуга — п. 5.3.2.4
  add(s.landingMark ? {
    id: 'landingMark', tab: 'safety', status: 'ok', clause: '5.3.2.4', title: 'Площадки виділено кольором (смуга ≥ 0,10 м)',
  } : {
    id: 'landingMark', tab: 'safety', status: 'fail', clause: '5.3.2.4',
    title: 'Не видно, де починається схил',
    detail: 'Площадки не відрізняються кольором від похилих частин і немає контрастної смуги',
    fix: 'Виділіть площадки кольором або нанесіть смугу ≥ 0,10 м на всю ширину на початку зміни висоти',
    action: { label: 'Виправити', patch: { landingMark: true } },
  });

  // 16. Без накладних планок і напрямних ТС — п. 5.3.1.3
  add(!s.overlays ? {
    id: 'overlays', tab: 'safety', status: 'ok', clause: '5.3.1.3', title: 'Без накладних планок і напрямних тактильних смуг',
  } : {
    id: 'overlays', tab: 'safety', status: 'fail', clause: '5.3.1.3',
    title: 'Планки на пандусі трясуть крісло й чіпляють колеса',
    detail: 'Накладні протиковзкі планки та напрямні тактильні смуги на поверхні пандуса не допускаються',
    fix: 'Приберіть накладки — шорсткість має давати саме покриття', action: { label: 'Прибрати', patch: { overlays: false } },
  });

  const fails = items.filter((i) => i.status === 'fail');
  const limits = items.filter((i) => i.status === 'limit');
  const autos = items.filter((i) => i.status === 'auto');
  const checked = items.filter((i) => i.status !== 'auto');
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const rider = byId.slope.status === 'fail' ? 'slip' : s.width < 0.75 ? 'narrow' : 'go';
  return {
    overall: fails.length ? 'fail' : limits.length ? 'limit' : 'ok',
    items, byId, g, best, rider, fails, limits, autos,
    passed: checked.filter((i) => i.status === 'ok').length,
    total: checked.length,
  };
}

/* ── стан у посиланні: #m=n&H=0.45&i=5… ── */
const URL_KEYS = {
  mode: 'm', traffic: 't', H: 'H', slope: 'i', cross: 'c', width: 'w', landing: 'l',
  railsBoth: 'b', railTop: 'rt', railLow: 'rl', kids: 'k', railChild: 'ch', railDiam: 'd',
  railExt: 'e', postGap: 'p', railContrast: 'rc', curb: 'cu', surface: 'sf', landingMark: 'lm', overlays: 'o',
};
export function toHash(s) {
  const q = [];
  for (const [k, u] of Object.entries(URL_KEYS)) {
    if (s[k] === DEFAULTS[k]) continue;
    const v = s[k];
    q.push(`${u}=${typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'number' ? +v.toFixed(3) : v}`);
  }
  return q.join('&');
}
export function fromHash(hash) {
  const s = { ...DEFAULTS };
  const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  for (const [k, u] of Object.entries(URL_KEYS)) {
    if (!p.has(u)) continue;
    const raw = p.get(u), d = DEFAULTS[k];
    if (typeof d === 'boolean') s[k] = raw === '1';
    else if (typeof d === 'number') {
      const v = parseFloat(raw.replace(',', '.'));
      if (Number.isFinite(v)) s[k] = RANGES[k] ? clamp(v, RANGES[k].min, RANGES[k].max) : v;
    } else if (k === 'mode' && (raw === 'new' || raw === 'recon')) s[k] = raw;
    else if (k === 'traffic' && (raw === 'one' || raw === 'two')) s[k] = raw;
  }
  return s;
}

/** Розбір ручного вводу: «0,45», «45 см», «1:15» (для ухилу). */
export function parseNum(txt, { ratioToPct = false } = {}) {
  const t = String(txt).trim().replace(/[\s  ]/g, '').replace(',', '.');
  const m = t.match(/^1:(\d+(?:\.\d+)?)$/);
  if (m && ratioToPct) return 100 / parseFloat(m[1]);
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : NaN;
}
