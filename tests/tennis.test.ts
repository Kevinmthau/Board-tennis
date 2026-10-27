import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALL_RADIUS, COURT, POINT_DELAY, canStrike, createMatch, inOwnHalf, nextServe,
  stepMatch, strike, travelScale, type Match } from '../src/tennis';

function advance(match: Match, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 120) stepMatch(match, 1 / 120);
}
function winBaseline(match: Match, side: 0 | 1): void {
  match.phase = 'rally'; match.lastHitter = side; match.receiver = side === 0 ? 1 : 0;
  match.crossedNet = true;
  match.ball = { x: side === 0 ? COURT.right + BALL_RADIUS - 1 : COURT.left - BALL_RADIUS + 1,
    y: 540, vx: side === 0 ? 1000 : -1000, vy: 0 };
  stepMatch(match, 1 / 60);
}

test('serve waits indefinitely and only the server can strike', () => {
  const match = createMatch();
  advance(match, 30);
  assert.equal(match.phase, 'serve');
  assert.deepEqual(match.ball, { x: 500, y: 540, vx: 0, vy: 0 });
  assert.equal(canStrike(match, 0), true); assert.equal(canStrike(match, 1), false);
  assert.equal(strike(match, 1, { vx: -700, vy: 0 }), false);
  assert.equal(strike(match, 0, { vx: 700, vy: 0 }), true);
  assert.equal(match.phase, 'rally'); assert.equal(match.rally, 1);
});

test('returns alternate and become legal only after crossing the net', () => {
  const match = createMatch(); strike(match, 0, { vx: 1000, vy: 0 });
  assert.equal(canStrike(match, 0), false); assert.equal(canStrike(match, 1), false);
  advance(match, .25); assert.equal(match.crossedNet, false);
  advance(match, .25); assert.equal(match.crossedNet, true);
  assert.equal(canStrike(match, 1), true);
  assert.equal(strike(match, 1, { vx: -700, vy: 0 }), true);
  assert.equal(match.receiver, 0); assert.equal(match.crossedNet, false);
  assert.equal(strike(match, 1, { vx: -700, vy: 0 }), false, 'one return per possession');
  advance(match, .15);
  assert.equal(canStrike(match, 0), true);
  assert.equal(strike(match, 0, { vx: 600, vy: 100 }), true);
  assert.equal(match.rally, 3); assert.equal(match.bestRally, 3);
});

test('a missed baseline scores for the opponent and the conceding player serves', () => {
  for (const winner of [0, 1] as const) {
    const match = createMatch(); winBaseline(match, winner);
    assert.equal(match.phase, 'point'); assert.equal(match.score[winner], 1);
    assert.equal(match.reason, 'baseline'); assert.equal(match.server, 1 - winner);
    assert.equal(nextServe(match), false);
    stepMatch(match, POINT_DELAY);
    assert.equal(nextServe(match), true);
    assert.equal(match.phase, 'serve'); assert.equal(match.receiver, 1 - winner);
    assert.equal(match.ball.x, winner === 0 ? 1420 : 500);
    assert.equal(match.ball.vx, 0); assert.equal(match.rally, 0);
  }
});

test('a sideline miss loses the hitter the point, and touching the line remains in', () => {
  const match = createMatch(); strike(match, 0, { vx: 0, vy: -700 });
  match.ball.y = COURT.top + 1;
  stepMatch(match, .01);
  assert.equal(match.phase, 'rally', 'the ball still overlaps the court');
  advance(match, .1);
  assert.equal(match.phase, 'point'); assert.deepEqual(match.score, [0, 1]);
  assert.equal(match.reason, 'out'); assert.equal(match.ball.y, COURT.top - BALL_RADIUS);
});

test('earliest boundary at a corner decides the point rather than axis-test order', () => {
  const outFirst = createMatch(); strike(outFirst, 0, { vx: 1000, vy: 1000 });
  outFirst.ball.x = COURT.right + BALL_RADIUS - 8;
  outFirst.ball.y = COURT.bottom + BALL_RADIUS - 3;
  stepMatch(outFirst, .02);
  assert.equal(outFirst.reason, 'out'); assert.deepEqual(outFirst.score, [0, 1]);
  const baselineFirst = createMatch(); strike(baselineFirst, 0, { vx: 1000, vy: 1000 });
  baselineFirst.ball.x = COURT.right + BALL_RADIUS - 2;
  baselineFirst.ball.y = COURT.bottom + BALL_RADIUS - 8;
  stepMatch(baselineFirst, .02);
  assert.equal(baselineFirst.reason, 'baseline'); assert.deepEqual(baselineFirst.score, [1, 0]);
});

test('backwards shots keep their direction and lose at their own baseline', () => {
  const match = createMatch(); strike(match, 0, { vx: -700, vy: 0 });
  assert.equal(match.ball.vx, -700);
  advance(match, 1);
  assert.deepEqual(match.score, [0, 1]); assert.equal(match.crossedNet, false);
});

test('receiver slowdown is smooth, preserves vector and gives each end the same assistance', () => {
  for (const receiver of [0, 1] as const) {
    const match = createMatch(receiver === 0 ? 1 : 0);
    strike(match, receiver === 0 ? 1 : 0, { vx: receiver === 0 ? -1000 : 1000, vy: 0 });
    match.crossedNet = true;
    match.ball.x = receiver === 0 ? 620 : 1300;
    assert.equal(travelScale(match), 1);
    match.ball.x = receiver === 0 ? 550 : 1370;
    assert.ok(Math.abs(travelScale(match) - .61) < 1e-10);
    match.ball.x = receiver === 0 ? 480 : 1440;
    assert.ok(Math.abs(travelScale(match) - .22) < 1e-10);
    const before = match.ball.x, vx = match.ball.vx;
    stepMatch(match, .05);
    assert.ok(Math.abs(Math.abs(match.ball.x - before) - 11) < 1e-8);
    assert.equal(match.ball.vx, vx, 'assistance does not consume recorded shot power');
  }
});

test('outgoing shots are never slowed at the hitter’s end', () => {
  const match = createMatch(); strike(match, 0, { vx: 1000, vy: 0 });
  match.ball.x = 450;
  assert.equal(travelScale(match), 1);
  stepMatch(match, .05);
  assert.ok(Math.abs(match.ball.x - 500) < 1e-8);
});

test('7-6 keeps playing; 8-6 wins and result never advances itself', () => {
  const match = createMatch(); match.score = [6, 6];
  winBaseline(match, 0);
  assert.deepEqual(match.score, [7, 6]); assert.equal(match.phase, 'point');
  stepMatch(match, POINT_DELAY); nextServe(match);
  winBaseline(match, 0);
  assert.deepEqual(match.score, [8, 6]); assert.equal(match.phase, 'over'); assert.equal(match.winner, 0);
  const final = JSON.stringify(match);
  advance(match, 60); assert.equal(nextServe(match), false);
  assert.equal(JSON.stringify(match), final);
  const rematch = createMatch(); assert.deepEqual(rematch.score, [0, 0]);
  assert.equal(rematch.rally, 0); assert.equal(rematch.winner, null);
});

test('invalid timing or strike values cannot corrupt the match', () => {
  const match = createMatch(), initial = JSON.stringify(match);
  for (const dt of [NaN, Infinity, -1, 0]) stepMatch(match, dt);
  for (const v of [NaN, Infinity, -Infinity]) assert.equal(strike(match, 0, { vx: v, vy: 0 }), false);
  assert.equal(strike(match, 0, { vx: 0, vy: 0 }), false);
  assert.equal(JSON.stringify(match), initial);
  assert.equal(inOwnHalf(0, NaN), false); assert.equal(inOwnHalf(1, 960), false);
});
