/* Нормативне ядро — ДБН В.2.2-40:2018 (Зміна №3, чинна з 01.04.2026).
   Чисті функції без DOM. Уся геометрія виводиться з рівності: ухил = H / L.
   Тексти: title — простою мовою, detail — нормативне формулювання з числами. */
window.RampNorms = (() => {
  const EPS = 1e-9;

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  // 0,60 -> "0,60"
  const fmt = (x, d = 2) =>
    Number(x).toLocaleString('uk-UA', { minimumFractionDigits: d, maximumFractionDigits: d });

  // 12,5 -> "12,5"; 10 -> "10" (без хвостових нулів)
  const fmtT = (x, d = 1) =>
    Number(x).toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: d });

  // українські множини: pl(2, ['марш','марші','маршів'])
  const pl = (n, forms) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  };

  const DEFAULTS = {
    mode: 'new',        // 'new' | 'recon'
    traffic: 'one',     // 'one' | 'two'
    H: 0.60,            // загальний перепад, м
    slope: 0.08,        // поздовжній ухил, частка (0.08 = 8 %)
    crossSlope: 0.015,  // поперечний ухил, частка
    width: 1.20,        // ширина у просвіті, м
    landingDepth: 1.50, // глибина площадок, м
    railTop: 0.90,      // верхній рівень поручня, м
    railChild: false,   // дитячий поручень 0,5 м
    railDiam: 0.040,    // діаметр поручня, м
    railExt: 0.30,      // виступ кінців за марш, м
    curb: 0.05,         // бортик по краях, м
    surfaceGood: true,  // тверде, рівне, без фаски
    contrast: true,     // контрастна смуга >= 0,1 м
  };

  /* Геометрія: H, slope — провідні; решта обчислюється. */
  function compute(s) {
    const L = s.H / s.slope;                            // сумарна горизонтальна проєкція маршів
    const n = Math.max(1, Math.ceil(s.H / 0.8 - EPS));  // кількість маршів (підйом маршу <= 0,8 м)
    const h = s.H / n;                                  // підйом одного маршу
    const lm = L / n;                                   // довжина одного маршу
    const angle = Math.atan(s.slope) * 180 / Math.PI;   // кут, °
    const ratio = 1 / s.slope;                          // 1:X
    const totalLen = (n + 1) * s.landingDepth + L;      // з нижньою, верхньою та проміжними площадками
    return { L, n, h, lm, angle, ratio, totalLen };
  }

  function evaluate(s) {
    const g = compute(s);
    const items = [];
    const pct = s.slope * 100;
    const pctS = fmtT(pct, 1);

    // 1. Поздовжній ухил маршу — п. 5.3.1
    {
      let st, title, detail = null, fix = null, note = null;
      if (pct <= 8 + EPS) {
        st = 'ok';
        title = `Ухил ${pctS} % (1:${fmtT(g.ratio, 1)}) — у межах 1:12`;
        if (pct >= 7.5 - EPS) note = '7,5–8 % — впритул до межі 1:12, запасу немає';
      } else if (s.mode === 'recon' && pct <= 10 + EPS) {
        st = 'limit';
        title = 'Крутувато: так дозволено лише при реконструкції';
        detail = `Ухил ${pctS} % — у діапазоні пом'якшення 8–10 % для реконструкції`;
        fix = `Для нового будівництва — не більше 8 % (1:12): подовжіть марші до L ≥ ${fmt(s.H / 0.08)} м`;
      } else {
        st = 'fail';
        title = 'Занадто круто — у крісла не вистачить сил, і це небезпечно';
        detail = s.mode === 'recon'
          ? `Ухил ${pctS} % перевищує навіть пом'якшені 10 % для реконструкції`
          : `Ухил ${pctS} % перевищує максимум 8 % (1:12)`;
        fix = `Зробіть пандус положистішим: за H = ${fmt(s.H)} м потрібні марші L ≥ ${fmt(s.H / 0.08)} м`;
      }
      items.push({ id: 'slope', tab: 'slope', status: st, clause: '5.3.1', title, detail, fix, note });
    }

    // 2. Висота підйому одного маршу — п. 5.3.1.2 (авто-розбивка)
    if (s.H > 0.8 + EPS) {
      items.push({
        id: 'march', tab: 'height', status: 'auto', clause: '5.3.1.2',
        title: 'Підйом задовгий — посередині потрібна рівна площадка для перепочинку',
        detail: `Перепад ${fmt(s.H)} м > 0,80 м — долати одним маршем заборонено`,
        fix: `Зроблено автоматично: ${g.n} ${pl(g.n, ['марш', 'марші', 'маршів'])} по ${fmt(g.h)} м + ${g.n - 1} ${pl(g.n - 1, ['площадка', 'площадки', 'площадок'])} глибиною ${fmt(s.landingDepth)} м — дивіться профіль`,
      });
    } else {
      items.push({
        id: 'march', tab: 'height', status: 'ok', clause: '5.3.1.2',
        title: `Підйом маршу ${fmt(s.H)} м ≤ 0,80 м — достатньо одного маршу`,
      });
    }

    // 3. Глибина площадок — п. 5.3.1.2
    if (s.landingDepth >= 1.5 - EPS) {
      items.push({
        id: 'landing', tab: 'height', status: 'ok', clause: '5.3.1.2',
        title: `Глибина площадок ${fmt(s.landingDepth)} м ≥ 1,50 м`,
      });
    } else {
      items.push({
        id: 'landing', tab: 'height', status: 'fail', clause: '5.3.1.2',
        title: 'Площадка замала — кріслу ніде зупинитися й перепочити',
        detail: `Глибина площадок ${fmt(s.landingDepth)} м < 1,50 м`,
        fix: 'Збільшіть глибину початкової, кінцевої та проміжних площадок до ≥ 1,50 м',
      });
    }

    // 4. Поперечний ухил — пп. 5.1.5, 5.1.11
    {
      const cp = s.crossSlope * 100;
      let st, title, detail = null, fix = null;
      if (cp >= 1 - EPS && cp <= 2 + EPS) {
        st = 'ok';
        title = `Поперечний ухил ${fmtT(cp, 1)} % — у межах 1–2 %`;
      } else if (cp < 1 - EPS) {
        st = 'limit';
        title = 'Поперек майже пласко — дощова вода стоятиме калюжами';
        detail = `Поперечний ухил ${fmtT(cp, 1)} % < 1 %`;
        fix = 'Зробіть ухил убік 1–2 %, щоб вода стікала з покриття';
      } else {
        st = 'fail';
        title = 'Завеликий ухил убік — крісло тягнутиме до краю';
        detail = `Поперечний ухил ${fmtT(cp, 1)} % > 2 %`;
        fix = 'Зменшіть поперечний ухил до 1–2 %';
      }
      items.push({ id: 'cross', tab: 'slope', status: st, clause: '5.1.5, 5.1.11', title, detail, fix });
    }

    // 5. Ширина у просвіті — п. 5.3.1.1
    {
      const w = s.width;
      let st, title, detail = null, fix = null;
      if (s.traffic === 'two') {
        if (w >= 1.8 - EPS) {
          st = 'ok'; title = `Ширина ${fmt(w)} м ≥ 1,80 м для двобічного руху`;
        } else {
          st = 'fail';
          title = 'Двом кріслам назустріч не розминутися';
          detail = `Ширина ${fmt(w)} м < 1,80 м для двобічного руху`;
          fix = 'Розширте просвіт до ≥ 1,80 м або зробіть рух однобічним';
        }
      } else if (w >= 1.2 - EPS) {
        st = 'ok'; title = `Ширина ${fmt(w)} м ≥ 1,20 м для однобічного руху`;
      } else if (s.mode === 'recon' && w >= 0.9 - EPS) {
        st = 'limit';
        title = 'Тісно, але дозволено при реконструкції';
        detail = `Ширина ${fmt(w)} м — гранично для реконструкції (0,90–1,20 м)`;
        fix = 'За можливості розширте просвіт до ≥ 1,20 м — для нового будівництва це мінімум';
      } else {
        st = 'fail';
        title = 'Завузько — крісло не проїде вільно';
        detail = `Ширина ${fmt(w)} м < ${s.mode === 'recon' ? '0,90' : '1,20'} м у просвіті`;
        fix = s.mode === 'recon'
          ? 'Розширте просвіт щонайменше до 0,90 м (гранично); повна норма — 1,20 м'
          : 'Розширте просвіт до ≥ 1,20 м';
      }
      items.push({ id: 'width', tab: 'width', status: st, clause: '5.3.1.1', title, detail, fix });
    }

    // 6. Рівні поручнів — п. 5.3.2
    {
      const ok = Math.abs(s.railTop - 0.9) <= 0.011;
      items.push(ok ? {
        id: 'railTop', tab: 'rails', status: 'ok', clause: '5.3.2',
        title: `Поручні на 0,90 і 0,70 м${s.railChild ? ' + дитячий 0,50 м' : ''} — два рівні`,
      } : {
        id: 'railTop', tab: 'rails', status: 'fail', clause: '5.3.2',
        title: 'Поручень не на тій висоті — рука його не знайде',
        detail: `Верхній рівень ${fmt(s.railTop)} м замість 0,90 м`,
        fix: 'Встановіть поручні на двох рівнях: 0,90 та 0,70 м (дитячий — 0,50 м)',
      });
    }

    // 7. Діаметр поручня — п. 5.3.2
    {
      const ok = s.railDiam >= 0.035 - EPS && s.railDiam <= 0.045 + EPS;
      items.push(ok ? {
        id: 'railDiam', tab: 'rails', status: 'ok', clause: '5.3.2',
        title: `Діаметр поручня ${fmt(s.railDiam, 3)} м — у межах 0,035–0,045 м`,
      } : {
        id: 'railDiam', tab: 'rails', status: 'fail', clause: '5.3.2',
        title: 'За такий поручень незручно хапатися',
        detail: `Діаметр ${fmt(s.railDiam, 3)} м поза межами 0,035–0,045 м`,
        fix: 'Застосуйте поручень круглого перерізу Ø 0,035–0,045 м (відступ від стіни ≥ 0,04 м)',
      });
    }

    // 8. Виступ кінців поручня — п. 5.3.2.1
    {
      const ok = s.railExt >= 0.3 - EPS;
      items.push(ok ? {
        id: 'railExt', tab: 'rails', status: 'ok', clause: '5.3.2.1',
        title: `Виступ кінців поручня ${fmt(s.railExt)} м ≥ 0,30 м`,
      } : {
        id: 'railExt', tab: 'rails', status: 'fail', clause: '5.3.2.1',
        title: 'Поручень починається запізно — нема за що взятися перед схилом',
        detail: `Виступ кінців ${fmt(s.railExt)} м < 0,30 м`,
        fix: 'Подовжіть горизонтальні завершення поручнів на ≥ 0,30 м за межі маршу, із заокругленням',
      });
    }

    // 9. Бортик по краях — п. 5.3.2.3
    {
      const ok = s.curb >= 0.05 - EPS;
      items.push(ok ? {
        id: 'curb', tab: 'edge', status: 'ok', clause: '5.3.2.3',
        title: `Бортик ${fmt(s.curb)} м ≥ 0,05 м по краях без стіни`,
      } : {
        id: 'curb', tab: 'edge', status: 'fail', clause: '5.3.2.3',
        title: 'Колесо може зісковзнути з відкритого краю',
        detail: `Бортик ${fmt(s.curb)} м < 0,05 м по краях без стіни`,
        fix: 'Підніміть бортик до ≥ 0,05 м, щоб колесо не з\u02BCїхало з пандуса',
      });
    }

    // 10. Покриття — п. 5.1.7
    items.push(s.surfaceGood ? {
      id: 'surface', tab: 'edge', status: 'ok', clause: '5.1.7',
      title: 'Покриття тверде, рівне, без фаски',
    } : {
      id: 'surface', tab: 'edge', status: 'fail', clause: '5.1.7',
      title: 'Слизько й нерівно — колеса буксують або застрягають',
      detail: 'Покриття м\u02BCяке, нерівне або з фаскою',
      fix: 'Застосуйте тверде рівне покриття без фасок і виступів',
    });

    // 11. Контрастна смуга — п. 5.3.2.4
    items.push(s.contrast ? {
      id: 'contrast', tab: 'edge', status: 'ok', clause: '5.3.2.4',
      title: 'Контрастна візуальна смуга ≥ 0,10 м нанесена',
    } : {
      id: 'contrast', tab: 'edge', status: 'fail', clause: '5.3.2.4',
      title: 'Початок пандуса непомітний для людей зі слабким зором',
      detail: 'Немає контрастної візуальної смуги (мін. 0,10 м)',
      fix: 'Нанесіть яскраву контрастну смугу шириною ≥ 0,10 м на межах кожного маршу',
    });

    const fails = items.filter(i => i.status === 'fail');
    const limits = items.filter(i => i.status === 'limit');
    const autos = items.filter(i => i.status === 'auto');
    const checked = items.filter(i => i.status !== 'auto');
    const overall = fails.length ? 'fail' : limits.length ? 'limit' : 'ok';

    return {
      overall, items, g,
      fails, limits, autos,
      passed: checked.filter(i => i.status === 'ok').length,
      total: checked.length,
    };
  }

  return { DEFAULTS, compute, evaluate, fmt, fmtT, pl, clamp };
})();
