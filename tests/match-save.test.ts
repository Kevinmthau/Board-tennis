import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, strike, stepMatch } from '../src/pickleball';
import { readMatchSave, savedSideForPlayer, SAVE_VERSION } from '../src/match-save';

const sides = [{ sessionId: 11, side: 0 }, { sessionId: 22, side: 1 }];

test('an old active match keeps its score and players but starts a valid new serve', () => {
  const old = { phase: 'rally', score: [3, 2], bestRally: 8, rally: 4, server: 0, receiver: 1,
    backWallBounces: 1, ball: { x: 1700, y: 400, vx: -700, vy: 50 } };
  const restored = readMatchSave({ version: 1, match: old, sides });
  assert.ok(restored);
  assert.equal(restored.match.phase, 'serve'); assert.equal(restored.match.server, 0);
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

test('saved players keep their sides after load assigns fresh or reused session IDs', () => {
  const sides = [{ sessionId: 11, playerId: 'left-profile', side: 0 }, { sessionId: 22, playerId: 'right-profile', side: 1 }];
  const restored = readMatchSave({ version: SAVE_VERSION, match: createMatch(), sides });
  assert.ok(restored); assert.deepEqual(restored.sides, sides);
  assert.equal(savedSideForPlayer(restored, { sessionId: 101, playerId: 'left-profile' }), 0);
  assert.equal(savedSideForPlayer(restored, { sessionId: 11, playerId: 'right-profile' }), 1,
    'stable identity takes priority over another saved player\'s former session ID');
  assert.equal(savedSideForPlayer(restored, { sessionId: 22, playerId: 'new-profile' }), undefined,
    'a reused session ID cannot inherit a different identified player\'s side');
});

test('legacy saves retain their session-ID fallback without requiring player IDs', () => {
  for (const version of [1, SAVE_VERSION]) {
    const restored = readMatchSave({ version, match: createMatch(), sides });
    assert.ok(restored); assert.deepEqual(restored.sides, sides);
    assert.equal(savedSideForPlayer(restored, { sessionId: 22, playerId: 'returning-profile' }), 1);
    assert.equal(savedSideForPlayer(restored, { sessionId: 101, playerId: 'returning-profile' }), undefined);
  }
});

test('malformed stable identities are rejected rather than falling back to a reused session ID', () => {
  for (const playerId of ['', null, 42, {}]) {
    assert.equal(readMatchSave({ version: SAVE_VERSION, match: createMatch(), sides: [{ sessionId: 11, side: 0, playerId }] }), null);
  }
});

test('version 2 tennis rallies restart with pickleball service and preserve identities and scores', () => {
  const match=createMatch(1);match.phase='rally';match.score=[7,6];match.receiver=0;match.lastHitter=1;
  const old=JSON.parse(JSON.stringify(match));delete old.volleyGuards;delete old.pendingOutcome;delete old.pointScored;
  const restored=readMatchSave({version:2,match:old,sides});assert.ok(restored);
  assert.deepEqual(restored.match.score,[7,6]);assert.equal(restored.match.server,1);
  assert.equal(restored.match.phase,'serve');assert.equal(restored.match.rally,0);
  assert.deepEqual(restored.match.volleyGuards,[null,null]);assert.deepEqual(restored.sides,sides);
});

test('pickleball saves preserve a pending volley outcome without awarding it twice', () => {
  const match=createMatch();match.phase='point';match.rally=4;match.receiver=1;match.lastHitter=0;
  match.volleyGuards=[{x:700,y:500,facingDeg:270,anchorX:700,anchorY:500,anchorFacing:270,stillFor:.1},null];
  match.pendingOutcome={winner:0,reason:'double-bounce'};
  const restored=readMatchSave({version:SAVE_VERSION,match,sides});assert.ok(restored);
  assert.deepEqual(restored.match,match);assert.equal(restored.match.pointWinner,null);assert.deepEqual(restored.match.score,[0,0]);
  restored.match.volleyGuards[0]!.x=650;assert.equal(match.volleyGuards[0]!.x,700);
});

test('malformed pickleball obligations and impossible pending outcomes are rejected', () => {
  const match=createMatch();
  for(const patch of [{volleyGuards:[]},{volleyGuards:[{},null]}, {pointScored:undefined},
    {reason:'tennis-fault'},{pendingOutcome:{winner:0,reason:'out'}},
    {phase:'rally',lastHitter:null,rally:0},{phase:'over',winner:null}]) {
    assert.equal(readMatchSave({version:SAVE_VERSION,match:{...match,...patch},sides}),null);
  }
});
