import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setCanvasFactory } from '../src/fx';
import { drawGame, type GameView } from '../src/view';
import { createMatch, type Side } from '../src/tennis';

type Label = { text: string; size: number; left: number; right: number; top: number; bottom: number };
// Record the actual text rendering calls, including sizes passed through view.text().
// Synthetic metrics make this a layout/floor regression, not a substitute for the real-font audit.
function canvas() {
  const labels: Label[] = [];
  const states: Record<string, unknown>[] = [];
  const state: Record<string, any> = { font: '48px sans-serif' };
  const metrics = (text: string) => {
    const px = parseFloat(state.font), width = [...text].length * px * .6;
    return { width, actualBoundingBoxLeft: width / 2, actualBoundingBoxRight: width / 2,
      actualBoundingBoxAscent: px * .72, actualBoundingBoxDescent: px * .2 };
  };
  const methods: Record<string, any> = {
    save: () => states.push({ ...state }),
    restore: () => Object.assign(state, states.pop()),
    measureText: metrics,
    fillText: (text: string, x: number, y: number) => {
      const m = metrics(text);
      labels.push({ text, size: parseFloat(state.font), left: x - m.actualBoundingBoxLeft,
        right: x + m.actualBoundingBoxRight, top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent });
    },
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  const ctx = new Proxy(state, { get: (target, key: string) => methods[key] ?? target[key] ?? (() => {}) }) as CanvasRenderingContext2D;
  return { ctx, labels };
}
setCanvasFactory((width, height) => ({ width, height, getContext: () => canvas().ctx }));

function view(browser: boolean): GameView {
  return { mode: 'play', now: 1000, match: createMatch(), browser, canContinue: false,
    seats: ['Alexandra Montgomery-Wellington', 'Christopher Maximilian Worthington'].map((name, side) =>
      ({ name, side: side as Side, present: true, glyphId: side ? 1 : 5 })),
    rackets: [], missing: false, drawEffects() {} };
}

test('every rendered in-play label meets the 48 px floor in both orientations', () => {
  for (const browser of [false, true]) for (const phase of ['serve', 'rally', 'point'] as const) for (const missing of [false, true]) {
    const v = view(browser), { ctx, labels } = canvas();
    v.match.phase = phase; v.missing = missing;
    v.match.score = [999, 999];
    if (phase !== 'serve') {
      v.match.groundBounces = phase === 'point' ? 2 : 1;
      v.match.lastBounce = { x: 430, y: 540, age: .1 };
      v.match.pointWinner = phase === 'point' ? 0 : null;
    }
    if (missing) v.seats[0].present = false;
    drawGame(ctx, v);
    assert.ok(labels.length > 0);
    assert.deepEqual(labels.filter(label => label.size < 48), [], `${browser ? 'browser' : 'native'} ${phase} missing=${missing}`);
  }
});

test('browser HUD fits names, three-digit scores and full-size scoring rules without overlaps', () => {
  const v = view(true), { ctx, labels } = canvas();
  v.match.score = [999, 999];
  drawGame(ctx, v);
  const hud = labels.filter(label => label.top < 180);
  assert.ok(hud.some(label => label.text === 'FIRST TO 7' && label.size >= 48));
  assert.ok(hud.some(label => label.text === 'WIN BY 2' && label.size >= 48));
  for (const label of hud) assert.ok(label.left >= 48 && label.right <= 1872 && label.top >= 48,
    `${label.text} stays inside the safe area`);
  for (let i = 0; i < hud.length; i++) for (const other of hud.slice(i + 1)) {
    const label = hud[i];
    assert.ok(label.left >= other.right || other.left >= label.right || label.top >= other.bottom || other.top >= label.bottom,
      `${label.text} overlaps ${other.text}`);
  }
});
