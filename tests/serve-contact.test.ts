import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COURT, createMatch, legalServeFooting, serveBall, serveSetup, serviceTarget, stepMatch } from '../src/pickleball';
import { advanceRallyFrame, type RallyControl } from '../src/rally-frame';
import { frontPoint, pieceFootprint, type PieceFootprints } from '../src/piece-footprints';
import { SwingController } from '../src/swing';

const footprints: PieceFootprints = JSON.parse(readFileSync('public/piece-footprints.json', 'utf8'));

for (const side of [0, 1] as const) for (const score of [0, 1]) {
  test(`${side ? 'right' : 'left'} player can sweep every Sports piece through an ${score ? 'odd' : 'even'}-score serve`, () => {
    for (let glyphId = 1; glyphId <= 8; glyphId++) for (const hz of [30, 60, 120])
      for (const speed of [60, 480]) for (const approach of [0, 20]) {
        const label = `glyph ${glyphId}, ${hz} Hz, ${speed} deg/s, ${approach} deg approach`;
        const match = createMatch(side), setup = serveSetup(side, score), controller = new SwingController();
        match.score[side] = score; match.ball = serveBall(side, score);
        let angle = setup.orientation - setup.turn * approach, now = 0;
        const poseAt = (x: number) => {
          const fp = pieceFootprint(footprints, { glyphId, x, y: setup.y, orientation: angle })!;
          const front = frontPoint(fp, 6);
          return { x, y: setup.y, facingDeg: fp.facingDeg, frontReach: Math.hypot(front.x - x, front.y - setup.y) };
        };
        const control: RallyControl = { side, controller, pose: poseAt(setup.x + (side ? -250 : 250)),
          footingAt: pose => ({ ...pose, outline: pieceFootprint(footprints,
            { glyphId, x: pose.x, y: pose.y, orientation: pose.facingDeg })!.outline }) };
        const frame = () => advanceRallyFrame(match, 1 / hz, now += 1000 / hz, [control]);
        assert.equal(frame().hit, null, `placement: ${label}`);
        control.pose = poseAt(setup.x);
        assert.equal(frame().hit, null, `translation: ${label}`);
        for (let i = 0; i < 3; i++) assert.equal(frame().hit, null, `stationary: ${label}`);
        assert.equal(match.phase, 'serve', label);

        let hit: ReturnType<typeof frame>['hit'] = null;
        for (let i = 0; i < hz && !hit; i++) {
          angle += setup.turn * speed / hz; control.pose = poseAt(setup.x); hit = frame().hit;
        }
        assert.ok(hit, `a real measured racket sweep must contact: ${label}`);
        assert.equal(hit.side, side); assert.equal(match.phase, 'rally', label);
        assert.equal(match.lastHitter, side); assert.equal(match.rally, 1);
        const feet = control.footingAt!(hit.shot.contactPose).outline;
        assert.ok(legalServeFooting(match, feet), `behind the correct baseline: ${label}`);
        assert.ok(feet.every(p => p.x >= 48 && p.x <= 1872 && p.y >= 48 && p.y <= 1032), `clear of the glass edge: ${label}`);
        assert.ok(side ? match.ball.vx < 0 : match.ball.vx > 0, `forward tangent: ${label}`);
        for (let i = 0; i < 2400 && match.phase === 'rally' && !match.groundBounces; i++) stepMatch(match, 1 / 120);
        assert.equal(match.phase, 'rally', `legal first landing (${match.reason}): ${label}`);
        assert.equal(match.groundBounces, 1, label);
        const box = serviceTarget(match), landing = match.lastBounce!;
        assert.ok(landing.x > box.left && landing.x < box.right && landing.y > box.top && landing.y < box.bottom,
          `lands inside the diagonal service box: ${label}`);
        assert.ok(landing.x < COURT.kitchenLeft || landing.x > COURT.kitchenRight, label);
      }
  });
}
