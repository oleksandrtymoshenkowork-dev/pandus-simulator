import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, D1, compute, evaluate, maxRiseFor, rowFor, bestVariant, toHash, fromHash, parseNum } from '../js/norms.js';

const S = (p) => ({ ...DEFAULTS, ...p });
const st = (s, id) => evaluate(s).byId[id]?.status;

test('табл. Д.1: довжина = підйом × знаменник', () => {
  for (const r of D1) assert.ok(Math.abs(r.rise * r.ratio - r.len) < 1e-9, `${r.rise}`);
});

test('maxRiseFor / rowFor', () => {
  assert.equal(maxRiseFor(8), 0.2);
  assert.equal(maxRiseFor(7.7), 0.245);
  assert.equal(maxRiseFor(6), 0.35);
  assert.equal(maxRiseFor(5), 0.8);
  assert.equal(maxRiseFor(3), 0.8);
  assert.equal(maxRiseFor(8.1), 0);
  assert.equal(rowFor(0.2).pct, 8);
  assert.equal(rowFor(0.3).pct, 6.7);
  assert.equal(rowFor(0.6).pct, 5);
  assert.equal(rowFor(0.81), null);
});

test('за замовчуванням — відповідає', () => {
  assert.equal(evaluate(DEFAULTS).overall, 'ok');
});

test('стара конфігурація H 0,6 @ 8 % одним маршем більше не «зелена»: розбивка на 3 марші', () => {
  const g = compute(S({ H: 0.6, slope: 8 }));
  assert.equal(g.n, 3);
  assert.ok(Math.abs(g.h - 0.2) < 1e-9);
  assert.equal(st(S({ H: 0.6, slope: 8 }), 'flights'), 'auto');
});

test('H 0,2 @ 8 % — один марш; H 0,6 @ 5 % — один марш', () => {
  assert.equal(compute(S({ H: 0.2, slope: 8 })).n, 1);
  assert.equal(compute(S({ H: 0.6, slope: 5 })).n, 1);
  assert.equal(compute(S({ H: 1.2, slope: 5 })).n, 2); // п. 5.3.1.2
});

test('ухил > 8 % — не відповідає в обох режимах', () => {
  assert.equal(st(S({ slope: 8.1 }), 'slope'), 'fail');
  assert.equal(st(S({ slope: 9.5, mode: 'recon' }), 'slope'), 'fail');
  assert.equal(st(S({ slope: 8 }), 'slope'), 'ok');
});

test('реконструкція: Д.1 рекомендована → «гранично», без автороз­бивки', () => {
  const s = S({ mode: 'recon', H: 0.6, slope: 8 });
  assert.equal(compute(s).n, 1);
  assert.equal(st(s, 'flights'), 'limit');
});

test('ширина', () => {
  assert.equal(st(S({ width: 1.2 }), 'width'), 'ok');
  assert.equal(st(S({ width: 1.1 }), 'width'), 'fail');
  assert.equal(st(S({ width: 0.9, mode: 'recon' }), 'width'), 'limit');
  assert.equal(st(S({ width: 0.85, mode: 'recon' }), 'width'), 'fail');
  assert.equal(st(S({ width: 1.5, traffic: 'two' }), 'width'), 'fail');
  assert.equal(st(S({ width: 1.8, traffic: 'two' }), 'width'), 'ok');
});

test('поперечний ухил 1–2 %', () => {
  assert.equal(st(S({ cross: 0.5 }), 'cross'), 'fail');
  assert.equal(st(S({ cross: 2.5 }), 'cross'), 'fail');
  assert.equal(st(S({ cross: 1 }), 'cross'), 'ok');
});

test('поручні', () => {
  assert.equal(st(S({ railTop: 0.95 }), 'railLevels'), 'fail');
  assert.equal(st(S({ railLow: 0.65 }), 'railLevels'), 'fail');
  assert.equal(st(S({ railDiam: 0.05 }), 'railDiam'), 'fail');
  assert.equal(st(S({ railExt: 0.25 }), 'railExt'), 'fail');
  assert.equal(st(S({ postGap: 0.1 }), 'postGap'), 'fail');
  assert.equal(st(S({ postGap: 0.2 }), 'postGap'), 'ok');
  assert.equal(st(S({ kids: true }), 'railChild'), 'fail');
  assert.equal(st(S({ kids: true, railChild: true }), 'railChild'), 'ok');
  assert.equal(st(S({}), 'railChild'), undefined);
  assert.equal(st(S({ railsBoth: false }), 'railsBoth'), 'fail');
});

test('безпека: бортик, покриття, планки', () => {
  assert.equal(st(S({ curb: 0.04 }), 'curb'), 'fail');
  assert.equal(st(S({ overlays: true }), 'overlays'), 'fail');
  assert.equal(st(S({ surface: false }), 'surface'), 'fail');
  assert.equal(st(S({ landingMark: false }), 'landingMark'), 'fail');
});

test('bestVariant для H 0,6 — 2 марші по 0,30 м при 6,7 %', () => {
  const b = bestVariant(0.6, 1.5, 'new');
  assert.equal(b.n, 2);
  assert.equal(b.slope, 6.7);
  // і застосування дає конфігурацію, що відповідає
  const s = S({ H: 0.6, slope: b.slope });
  assert.equal(compute(s).n, 2);
  assert.equal(evaluate(s).overall, 'ok');
});

test('посилання: туди й назад', () => {
  const s = S({ H: 0.73, slope: 6.3, mode: 'recon', traffic: 'two', kids: true, railChild: true, width: 1.85 });
  assert.deepEqual(fromHash('#' + toHash(s)), s);
  assert.equal(toHash(DEFAULTS), '');
  assert.equal(fromHash('#H=99').H, 2.0); // обрізається до меж
});

test('ручний ввід', () => {
  assert.equal(parseNum('0,45'), 0.45);
  assert.ok(Math.abs(parseNum('1:12', { ratioToPct: true }) - 8.3333) < 1e-3);
  assert.ok(Number.isNaN(parseNum('abc')));
});
