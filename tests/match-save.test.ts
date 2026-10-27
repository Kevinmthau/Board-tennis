import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, strike, stepMatch } from '../src/tennis';
import { readMatchSave, SAVE_VERSION } from '../src/match-save';

const sides = [{ sessionId: 11, side: 0 }, { sessionId: 22, side: 1 }];

test('an old active match keeps its score and players but starts a valid new serve', () => {
  const old = { phase: 'rally', score: [3, 2], bestRally: 8, rally: 4, server: 0, receiver: 1,
    backWallBounces: 1, ball: { x: 1700, y: 400, vx: -700, vy: 50 } };
  const restored = readMatchSave({ version: 1, match: old, sides });
  assert.ok(restored);
  assert.equal(restored.match.phase, 'serve'); assert.equal(restored.match.server, 1);
  assert.deepEqual(restored.match.score, [3, 2]); assert.equal(restored.match.bestRally, 8);
  assert.deepEqual(restored.sides, sides); assert.equal(restored.match.ball.z, 0);
  assert.equal(restored.match.groundBounces, 0); assert.equal(restored.match.ball.vx, 0);
  assert.equal(old.phase, 'rally', 'migration never edits the stored object');
});

test('an old completed match remains on its result with the same winner', () => {
  const restored = readMatchSave({ version: 1, sides,
    match: { phase: 'over', score: [8, 6], server: 1, receiver: 1, winner: 0, rally: 3, bestRally: 9 } });
  assert.ok(restored); assert.equal(restored.match.phase, 'over'); assert.equal(restored.match.winner, 0);
  assert.deepEqual(restored.match.score, [8, 6]); assert.equal(restored.match.bestRally, 9);
});

test('new saves preserve an airborne ball and continue the same bounce timing', () => {
  const match = createMatch(); strike(match, 0, { vx: 700, vy: 30 }); stepMatch(match, .2);
  assert.ok(match.ball.z > 0);
  const restored = readMatchSave({ version: SAVE_VERSION, match, sides }); assert.ok(restored);
  assert.deepEqual(restored.match, match);
  stepMatch(match, .1); stepMatch(restored.match, .1); assert.deepEqual(restored.match, match);
  restored.match.ball.x = 100; assert.notEqual(match.ball.x, 100);
});

test('corrupt flight state cannot introduce NaN physics after restore', () => {
  const match = createMatch();
  for (const z of [NaN, Infinity, -1]) {
    assert.equal(readMatchSave({ version: SAVE_VERSION, sides, match: { ...match, ball: { ...match.ball, z } } }), null);
  }
  assert.equal(readMatchSave({ version: SAVE_VERSION, sides, match: { ...match, gravity: 0 } }), null);
  assert.equal(readMatchSave({ version: SAVE_VERSION, sides, match: { ...match, groundBounces: 3 } }), null);
});
