import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALL_RADIUS, COURT, POINT_DELAY, canStrike, createMatch, inOwnHalf, nextServe,
  stepMatch, strike, travelScale, type Match } from '../src/tennis';

function advance(match: Match, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 120) stepMatch(match, 1 / 120);
}
function winBaseline(match: Match, side: 0 | 1): void {
  match.phase = 'rally'; match.lastHitter = side; match.receiver = side === 0 ? 1 : 0;
  match.crossedNet = true; match.backWallBounces = 1;
  match.ball = { x: side === 0 ? COURT.left + BALL_RADIUS + 1 : COURT.right - BALL_RADIUS - 1,
    y: 540, vx: side === 0 ? -1000 : 1000, vy: 0 };
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

test('a second end-wall touch scores for the hitter and the conceding player serves', () => {
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

test('top and bottom walls reflect the ball without a point or a lost bounce allowance', () => {
  const match = createMatch(); strike(match, 0, { vx: 0, vy: -700 });
  match.ball.y = COURT.top + BALL_RADIUS + 1;
  stepMatch(match, .01);
  assert.equal(match.phase, 'rally'); assert.ok(match.ball.vy > 0);
  assert.ok(match.ball.y > BALL_RADIUS);
  advance(match, 5);
  assert.equal(match.phase, 'rally'); assert.deepEqual(match.score, [0, 0]);
  assert.equal(match.backWallBounces, 0);
  assert.ok(match.ball.y >= BALL_RADIUS && match.ball.y <= COURT.bottom - BALL_RADIUS);
});

test('corner collisions reflect in physical order and count only the end wall', () => {
  for (const wallFirst of [true, false]) {
    const match = createMatch(); strike(match, 0, { vx: 1000, vy: 1000 }); match.crossedNet = true;
    match.ball.x = COURT.right - BALL_RADIUS - (wallFirst ? 8 : 2);
    match.ball.y = COURT.bottom - BALL_RADIUS - (wallFirst ? 3 : 8);
    const trace: {time:number; x:number; y:number}[] = [];
    stepMatch(match, .1, trace);
    const contacts = trace.filter(p => Math.abs(p.x - (COURT.right - BALL_RADIUS)) < 1e-7
      || Math.abs(p.y - (COURT.bottom - BALL_RADIUS)) < 1e-7);
    assert.ok(contacts.length >= 2);
    if (wallFirst) assert.equal(contacts[0].y, COURT.bottom - BALL_RADIUS);
    else assert.equal(contacts[0].x, COURT.right - BALL_RADIUS);
    assert.ok(match.ball.vx < 0 && match.ball.vy < 0);
    assert.equal(match.backWallBounces, 1); assert.deepEqual(match.score, [0, 0]);
  }
});

test('a backwards bank keeps its real direction and does not consume the receiver bounce', () => {
  const match = createMatch(); strike(match, 0, { vx: -700, vy: 0 });
  assert.equal(match.ball.vx, -700);
  advance(match, 1);
  assert.ok(match.ball.vx > 0); assert.equal(match.crossedNet, false);
  assert.deepEqual(match.score, [0, 0]); assert.equal(match.backWallBounces, 0);
  advance(match, 1.2);
  assert.equal(match.crossedNet, true); assert.equal(match.phase, 'rally');
  assert.equal(match.backWallBounces, 0);
});

test('the receiver gets one slow recovery bounce; the next end wall loses the point', () => {
  const match = createMatch(); strike(match, 0, { vx: 1000, vy: 0 });
  match.crossedNet = true; match.ball.x = COURT.right - BALL_RADIUS - 1;
  stepMatch(match, .05);
  assert.equal(match.backWallBounces, 1); assert.equal(match.phase, 'rally');
  assert.equal(match.receiver, 1); assert.equal(canStrike(match, 1), true);
  assert.ok(match.ball.vx < 0); assert.deepEqual(match.score, [0, 0]);
  match.ball.x = 1200;
  assert.ok(Math.abs(travelScale(match) - .22) < 1e-10, 'recovery stays slow while leaving the back wall');
  match.ball.x = 900;
  assert.equal(travelScale(match), 1, 'speed returns after passing the center');
  match.ball.x = COURT.left + BALL_RADIUS + 1;
  stepMatch(match, .05);
  assert.equal(match.phase, 'point'); assert.deepEqual(match.score, [1, 0]);
  assert.equal(match.pointWinner, 0);
});

test('a return resets the back-wall allowance for the next incoming shot', () => {
  const match = createMatch(); strike(match, 0, { vx: 1000, vy: 0 });
  match.crossedNet = true; match.backWallBounces = 1; match.ball.x = 1500;
  assert.equal(strike(match, 1, { vx: -700, vy: 0 }), true);
  assert.equal(match.backWallBounces, 0); assert.equal(match.shotTime, 0);
});

test('an exactly vertical shot resolves after eight live seconds without changing its tangent', () => {
  const match = createMatch(); strike(match, 0, { vx: 0, vy: -700 });
  advance(match, 4);
  assert.equal(match.phase, 'rally'); assert.equal(match.ball.vx, 0);
  const pausedTime = match.shotTime;
  stepMatch(match, 0); assert.equal(match.shotTime, pausedTime, 'no elapsed physics means no timeout progress');
  advance(match, 4.1);
  assert.equal(match.phase, 'point'); assert.deepEqual(match.score, [0, 1]);
  assert.equal(match.reason, 'short');
  assert.ok(Math.abs(match.shotTime - 8) < 1e-7);
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
