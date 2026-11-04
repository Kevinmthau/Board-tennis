import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoardContactPhase, batch, contact, errors, frames, move, newContactId, pauses, poses,
  resumes, serveSetup, snapshot, tick, until, type Side } from './match-harness';

test('both humans serve legally from both halves through real input, including a menu before service', async () => {
  await import('../src/main');
  for (let i = 0; i < 30 && !frames.size; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(frames.size); tick();
  batch!(poses.map(p => contact(p, BoardContactPhase.Began))); tick(3);
  assert.equal(snapshot().mode, 'play');

  function prepare(side: Side, backwards = false) {
    const match = snapshot().match, home = serveSetup(side, match.score[side]);
    assert.equal(match.phase, 'serve'); assert.equal(match.server, side);
    const angle = home.orientation + home.turn * (backwards ? 20 : -20);
    move(side, { x: side ? 1270 : 650, y: 540 }); tick();
    move(side, { orientation: angle }); tick(2);
    move(side, { x: home.x, y: home.y }); tick(10);
    assert.equal(snapshot().match.phase, 'serve', 'sliding and waiting never serve');
    return { angle, turn: home.turn * (backwards ? -1 : 1) };
  }
  function swing(side: Side, prepared: ReturnType<typeof prepare>) {
    for (let i = 0; i < 20 && snapshot().match.phase === 'serve'; i++) {
      prepared.angle += prepared.turn * 3;
      move(side, { orientation: prepared.angle }); tick();
    }
    assert.equal(snapshot().match.phase, 'rally');
    assert.equal(snapshot().match.lastHitter, side);
    assert.equal(snapshot().match.rally, 1);
  }
  for (const side of [0, 1] as const) {
    for (const score of [0, 1]) {
      const prepared = prepare(side);
      if (side === 1 && score === 0) {
        const before = snapshot();
        for (const pause of pauses) pause(); tick(20);
        for (const resume of resumes) resume();
        poses.forEach(p => { p.id = newContactId(); });
        batch!(poses.map(p => contact(p, BoardContactPhase.Began))); tick(20);
        assert.deepEqual(snapshot().match, before.match, 'menu redetection cannot serve');
        assert.equal(snapshot().placementCount, before.placementCount, 'redetection is the same piece');
      }
      swing(side, prepared);
      until(s => s.match.groundBounces === 1 || s.match.phase !== 'rally', 'the serve reaches the ground');
      assert.equal(snapshot().match.phase, 'rally', 'the diagonal serve clears the net and kitchen');
      assert.equal(snapshot().match.groundBounces, 1);
      until(s => s.match.phase === 'point', 'a missed return awards the serving player');
      assert.equal(snapshot().match.score[side], score + 1);
      assert.equal(snapshot().match.pointScored, true);
      until(s => s.match.phase === 'serve', 'the next serve waits for the same player');
      tick(20); assert.equal(snapshot().match.phase, 'serve');
    }
    if (side === 0) {
      swing(side, prepare(side, true));
      until(s => s.match.phase === 'point', 'a deliberate backwards serve transfers service');
      assert.equal(snapshot().match.server, 1); assert.equal(snapshot().match.pointScored, false);
      assert.deepEqual(snapshot().match.score, [2, 0]);
      until(s => s.match.phase === 'serve', 'the right player now serves');
    }
  }
  assert.deepEqual(snapshot().match.score, [2, 2]);
  assert.deepEqual(errors, []);
});
