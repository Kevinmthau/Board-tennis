import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceRallyFrame, type RallyControl } from '../src/rally-frame';
import { createMatch, strike, type Match } from '../src/tennis';
import { SwingController, type SwingPose } from '../src/swing';

const pose = (angle: number, x = 1884, y = 370): SwingPose => ({ x, y, facingDeg: angle, frontReach: 70 });
function incoming(): Match {
  const match = createMatch();
  strike(match, 0, { vx: 1000, vy: 0 });
  match.ball.x = 1892; match.crossedNet = true; match.groundBounces = 1; match.gravity = 800;
  // The second landing is 45 ms away at the receiver's .22 travel scale.
  match.ball.z = 100 * .0099 + .5 * 800 * .0099 ** 2; match.ball.vz = -100;
  return match;
}
function rightControl(match: Match, previous: SwingPose): RallyControl {
  const controller = new SwingController();
  controller.update(previous, match.ball, 0);
  return { side: 1, pose: previous, controller };
}

test('a final-frame return before the second landing prevents a provisional winning point', () => {
  const match = incoming(); match.score = [6, 0];
  const control = rightControl(match, pose(70));
  control.pose = pose(110);
  const result = advanceRallyFrame(match, .1, 100, [control]);
  assert.ok(result.hit, 'the line contacts the ball before its second ground bounce');
  assert.equal(result.point, false);
  assert.equal(match.phase, 'rally'); assert.deepEqual(match.score, [6, 0]);
  assert.equal(match.winner, null); assert.equal(match.lastHitter, 1);
  assert.ok(result.hit.shot.contactTimeMs < 100 * (10 / 22));
  assert.ok(result.hit.at.x < 1902);
  assert.ok(match.ball.x < result.hit.at.x, 'the remaining time follows the returned shot');
  assert.ok(match.ball.vx < 0);
});

test('a twist that reaches the ball only after the second landing cannot rescue the point', () => {
  const match = incoming();
  const control = rightControl(match, pose(50));
  control.pose = pose(90);
  const result = advanceRallyFrame(match, .1, 100, [control]);
  assert.equal(result.hit, null, 'the pose is clipped to the exit time, not squeezed into it');
  assert.equal(result.point, true);
  assert.equal(match.phase, 'point'); assert.deepEqual(match.score, [1, 0]);
  assert.ok(Math.abs(match.ball.x - 1901.9) < 1e-7);
});

test('the last frame still requires rotation, not a stationary line or a slide', () => {
  for (const moved of [false, true]) {
    const match = incoming();
    const control = rightControl(match, pose(90, moved ? 1824 : 1884));
    control.pose = pose(90);
    const result = advanceRallyFrame(match, .1, 100, [control]);
    assert.equal(result.hit, null); assert.equal(result.point, true);
    assert.deepEqual(match.score, [1, 0]);
  }
});

test('a clean middle-of-court return starts at the actual swept contact position', () => {
  const match = incoming(); match.ball.x = 1370; match.ball.z = 180; match.ball.vz = 0;
  const control = rightControl(match, pose(70, 1420));
  control.pose = pose(125, 1420);
  const result = advanceRallyFrame(match, .1, 100, [control]);
  assert.ok(result.hit);
  assert.ok(result.hit.at.x >= 1370 && result.hit.at.x < 1420);
  assert.ok(match.ball.x < result.hit.at.x);
  assert.equal(match.rally, 2); assert.equal(match.receiver, 0);
  assert.equal(result.point, false); assert.deepEqual(match.score, [0, 0]);
});

test('a fresh placement on the exit frame cannot become an emergency return', () => {
  const match = incoming();
  const result = advanceRallyFrame(match, .1, 100,
    [{ side: 1, pose: pose(90), controller: new SwingController() }]);
  assert.equal(result.hit, null); assert.equal(result.point, true);
});

test('a disabled or wrong-half controller cannot return the final ball', () => {
  const match = incoming();
  const control = rightControl(match, pose(70));
  control.pose = null;
  const result = advanceRallyFrame(match, .1, 100, [control]);
  assert.equal(result.hit, null); assert.equal(control.controller.status, 'missing');
  assert.equal(result.point, true);
  const wrong = createMatch(); strike(wrong, 1, { vx: -700, vy: 0 });
  const wrongController = new SwingController();
  wrongController.update(pose(70, 900), wrong.ball, 0);
  const answer = advanceRallyFrame(wrong, .05, 50,
    [{ side: 1, pose: pose(110, 900), controller: wrongController }]);
  assert.equal(answer.hit, null); assert.equal(wrongController.status, 'missing');
});

test('serve uses the same strike and remaining frame movement, then point and result states stay safe', () => {
  const match = createMatch();
  const controller = new SwingController();
  const control: RallyControl = { side: 0, pose: pose(270, 500, 710), controller };
  assert.equal(advanceRallyFrame(match, 0, 0, [control]).hit, null);
  control.pose = pose(274, 500, 710);
  const first = advanceRallyFrame(match, .016, 16, [control]);
  assert.ok(first.hit); assert.equal(match.phase, 'rally'); assert.ok(match.ball.x > 500);
  assert.equal(match.rally, 1);
  match.phase = 'point'; match.pointTimer = 0;
  assert.equal(advanceRallyFrame(match, .05, 66, [control]).point, false);
  assert.equal(match.pointTimer, .05); assert.equal(match.phase, 'point');
  match.phase = 'over'; match.winner = 0;
  const final = JSON.stringify(match);
  const end = advanceRallyFrame(match, .05, 116, [control]);
  assert.equal(end.hit, null); assert.equal(end.point, false); assert.equal(JSON.stringify(match), final);
});

test('a tracking gap still disarms even when the boundary cutoff shortens the sweep', () => {
  const match = incoming();
  const control = rightControl(match, pose(70)); control.pose = pose(110);
  const result = advanceRallyFrame(match, .1, 150, [control]);
  assert.equal(result.hit, null); assert.equal(result.point, true);
});


test('racket collision follows the top-wall reflection instead of the endpoint chord', () => {
  const match = createMatch(); strike(match, 0, { vx: 0, vy: -1000 });
  match.ball.x = 1200; match.ball.y = 60; match.crossedNet = true;
  const controller = new SwingController();
  const start = pose(0, 1000, 0);
  controller.update(start, match.ball, 0);
  const result = advanceRallyFrame(match, .084, 84,
    [{side: 1, pose: pose(4, 1000, 0), controller}]);
  assert.ok(result.hit, 'the reflected path reaches a racket that the endpoint chord would miss');
  assert.ok(result.hit.at.y < 35);
  assert.equal(match.lastHitter, 1); assert.equal(result.point, false);
});

test('a legal return after a back-wall reflection remains in the same receiver possession', () => {
  const match = incoming(); match.groundBounces = 1; match.ball.z = 180; match.ball.vz = 0;
  const control = rightControl(match, pose(50)); control.pose = pose(90);
  const result = advanceRallyFrame(match, .1, 100, [control]);
  assert.ok(result.hit, 'a late swing can now legally catch the reflected ball');
  assert.ok(result.hit.shot.contactTimeMs > 100 * (10 / 22));
  assert.deepEqual(match.score, [0, 0]); assert.equal(match.phase, 'rally');
  assert.equal(match.lastHitter, 1); assert.equal(match.groundBounces, 0);
});


test('a volley begins at the exact contact height and keeps earlier landing effects isolated', () => {
  const match = incoming(); match.ball.x=1370; match.ball.z=100; match.ball.vz=80;
  match.lastBounce={x:1300,y:540,age:.2};
  const before=structuredClone(match);
  const control=rightControl(match,pose(70,1420));control.pose=pose(125,1420);
  const result=advanceRallyFrame(match,.1,100,[control]);
  assert.ok(result.hit);assert.equal(match.groundBounces,0);assert.ok(match.ball.z>100);
  assert.equal(before.lastBounce!.age,.2, 'preview physics must not mutate shared bounce events');
  assert.ok(Math.abs(match.lastBounce!.age-.3)<1e-8);
});
