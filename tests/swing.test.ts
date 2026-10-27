import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ballSpeedForTwist, clubDistance, shortAngleDelta, sweptClubContact, SwingController,
  SWING, type SwingPose, type SwingHit } from '../src/swing';
import { pieceFootprint, frontPoint, type PieceFootprints } from '../src/piece-footprints';

const ball = { x: 200, y: 0 };
const pose = (facingDeg: number, x = 0, y = 0): SwingPose => ({ x, y, facingDeg, frontReach: 70 });
function swing(speed: number, clockwise = true, range = 200): SwingHit {
  const s = new SwingController(), target = { x: range, y: 0 }, start = clockwise ? 330 : 30;
  let now = 0, angle = start;
  s.update(pose(angle), target, now);
  for (let i = 0; i < 200; i++) {
    now += 1000 / 60; angle += (clockwise ? 1 : -1) * speed / 60;
    const hit = s.update(pose(angle), target, now);
    if (hit) return hit;
  }
  throw new Error(`No hit at ${speed} degrees per second`);
}

test('power follows twist speed, clamps, and is independent of distance along the line', () => {
  assert.equal(ballSpeedForTwist(30), 480); assert.equal(ballSpeedForTwist(540), 1100);
  assert.equal(ballSpeedForTwist(1000), 1100); assert.equal(ballSpeedForTwist(-540), 1100);
  assert.ok(swing(360).speed > swing(60).speed);
  assert.ok(Math.abs(swing(120, true, 125).speed - swing(120, true, 225).speed) < 1e-6);
});

test('clockwise and counterclockwise contact sends the ball along opposite tangents', () => {
  const cw = swing(180), ccw = swing(180, false);
  assert.ok(cw.vy > 0 && ccw.vy < 0);
  assert.ok(Math.abs(cw.vx) < cw.speed * .15 && Math.abs(ccw.vx) < ccw.speed * .15);
  assert.ok(Math.abs(Math.hypot(cw.vx, cw.vy) - cw.speed) < 1e-9);
});

test('a fast racket sweep catches the ball between endpoint frames and strikes once per possession', () => {
  const s = new SwingController(); s.update(pose(330), ball, 0);
  const hit = s.update(pose(30), ball, 80);
  assert.ok(hit); assert.equal(hit.speed, 1100);
  assert.equal(s.update(pose(330), ball, 96), null); assert.equal(s.status, 'spent');
  s.update(pose(330), ball, 112, false);
  assert.equal(s.update(pose(330), ball, 128), null, 'new possession seeds without a hit');
  assert.ok(s.update(pose(30), ball, 144), 'next return is armed');
});

test('relative sweep catches a moving ball that crosses the line entirely between frames', () => {
  const s = new SwingController();
  s.update(pose(-2), { x: 200, y: -90 }, 0);
  const hit = s.update(pose(2), { x: 200, y: 90 }, 80);
  assert.ok(hit); assert.ok(hit.vy > 0);
  assert.ok(sweptClubContact(pose(-2), pose(2), { x: 200, y: 90 }, { x: 200, y: -90 }) !== null);
});

test('a racket catches the visible edge of an enlarged airborne ball', () => {
  const target = { x: 200, y: 27 };
  assert.equal(sweptClubContact(pose(-2), pose(0), target), null, 'the default 18 px ball misses this line');
  assert.notEqual(sweptClubContact(pose(-2), pose(0), { ...target, radius: 27 }), null,
    'the displayed 27 px edge is a real contact');
  assert.equal(sweptClubContact(pose(-2), pose(0), { ...target, radius: NaN }), null);
});

test('ball motion alone and sliding alone cannot create a strike', () => {
  const still = new SwingController(); still.update(pose(0), { x: 200, y: -90 }, 0);
  assert.equal(still.update(pose(0), { x: 200, y: 90 }, 80), null);
  const slide = new SwingController(); slide.update(pose(0), ball, 0);
  for (let i = 1; i < 20; i++) assert.equal(slide.update(pose(0, i * 5), ball, i * 16), null);
});

test('zero/360 wraps take the short rotation arc', () => {
  assert.equal(shortAngleDelta(2, 359), 3); assert.equal(shortAngleDelta(359, 2), -3);
  const angle = sweptClubContact(pose(345), pose(15), ball);
  assert.ok(angle !== null && angle > 350 && angle < 360);
});

test('a held piece with subdegree jitter never strikes', () => {
  const s = new SwingController();
  for (let i = 0; i < 1000; i++) {
    const jitter = [0, .4, -.4, .25, -.25, .35, -.35][i % 7];
    assert.equal(s.update(pose(355 + jitter, (i % 3) - 1), ball, i * 16), null);
  }
});

test('an already touching line responds to the first deliberate twist without an arming wait', () => {
  for (const direction of [-1, 1]) {
    const s = new SwingController();
    assert.equal(s.update(pose(0), ball, 0), null);
    const hit = s.update(pose(direction * 2), ball, 16);
    assert.ok(hit); assert.equal(Math.sign(hit.vy), direction);
  }
});

test('a tracking gap, pause reset, lift, and disabled input never replay a stale sweep', () => {
  for (const kind of ['gap', 'reset', 'lift', 'disabled']) {
    const s = new SwingController(); s.update(pose(330), ball, 0);
    if (kind === 'reset') s.reset();
    if (kind === 'lift') s.update(null, ball, 16);
    if (kind === 'disabled') s.update(pose(30), ball, 16, false);
    assert.equal(s.update(pose(30), ball, kind === 'gap' ? 150 : 32), null, kind);
  }
});

test('natural center drift during a twist remains live', () => {
  const s = new SwingController(); s.update(pose(330), ball, 0);
  assert.ok(s.update(pose(30, 30, 6), ball, 16));
});

test('slow turns accumulate tolerance without hitting where a moving ball used to be', () => {
  assert.equal(swing(20).speed, 480);
  const s = new SwingController(); s.update(pose(0), ball, 0);
  for (let i = 1; i <= 20; i++) {
    assert.equal(s.update(pose(i * .1), { x: 200, y: i * 10 }, i * 16), null);
  }
});

test('only the finite forehead line contacts the ball', () => {
  for (const range of [100, 119, 231, 240, 250]) {
    const s = new SwingController(), target = { x: range, y: 0 };
    s.update(pose(330), target, 0);
    assert.ok(s.update(pose(30), target, 16), `contact at ${range} px`);
  }
  assert.equal(sweptClubContact(pose(330), pose(30), { x: 400, y: 0 }), null);
  assert.equal(sweptClubContact(pose(330), pose(30), { x: 30, y: 0 }), null);
  assert.equal(clubDistance(pose(0), { x: -10, y: 0 }), 80);
});

test('all eight actual Sports fronts leave clearance and share the same line length', () => {
  const footprints = JSON.parse(readFileSync('public/piece-footprints.json', 'utf8')) as PieceFootprints;
  assert.equal(footprints.set, 'sports');
  for (const key of Object.keys(footprints.pieces)) {
    const fp = pieceFootprint(footprints, { glyphId: Number(key), x: 0, y: 0, orientation: 0 })!;
    const front = frontPoint(fp, 6), reach = Math.hypot(front.x, front.y);
    assert.ok(reach < SWING.clubLength, `${key} has visible line outside its front`);
    assert.ok(fp.radiusPx + SWING.ballRadius < 120, `${key} clears the ball 120 px away`);
    assert.equal(clubDistance({ ...pose(0), frontReach: reach }, { x: 120, y: 0 }), 0);
  }
});

test('invalid geometry cannot create a strike', () => {
  const s = new SwingController(); s.update(pose(330), ball, 0);
  assert.equal(s.update({ ...pose(30), x: NaN }, ball, 16), null);
  assert.equal(sweptClubContact(pose(330), pose(30), { x: Infinity, y: 0 }), null);
  assert.equal(sweptClubContact(pose(330), { ...pose(30), frontReach: 300 }, ball), null);
});
