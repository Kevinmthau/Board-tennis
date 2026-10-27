import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceRallyFrame, type RallyControl } from '../src/rally-frame';
import { createMatch, strike, type Match } from '../src/tennis';
import { SwingController, type SwingPose } from '../src/swing';
import { ballDisplay } from '../src/ball-display';

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
  controller.update(previous, ballDisplay(match.ball), 0);
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
  const racketY = ballDisplay(match.ball).y - 170;
  const control = rightControl(match, pose(70, 1420, racketY));
  control.pose = pose(125, 1420, racketY);
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
  const racketY = ballDisplay(match.ball).y - 170;
  const control = rightControl(match, pose(50,1884,racketY)); control.pose = pose(90,1884,racketY);
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
  const racketY=ballDisplay(match.ball).y-170;
  const control=rightControl(match,pose(70,1420,racketY));control.pose=pose(125,1420,racketY);
  const result=advanceRallyFrame(match,.1,100,[control]);
  assert.ok(result.hit);assert.equal(match.groundBounces,0);assert.ok(match.ball.z>100);
  assert.equal(before.lastBounce!.age,.2, 'preview physics must not mutate shared bounce events');
  assert.ok(Math.abs(match.lastBounce!.age-.3)<1e-8);
});

test('volleys hit the lifted visible ball, not its shadow, and keep the ground path continuous', () => {
  const original = incoming();
  original.ball = { x: 1400, y: 640, z: 240, vx: 0, vy: 0, vz: 0 };
  const displayed = ballDisplay(original.ball);
  assert.ok(displayed.y < original.ball.y - 100);
  const visible = structuredClone(original);
  const visibleControl = rightControl(visible, pose(70, 1400, displayed.y - 170));
  visibleControl.pose = pose(110, 1400, displayed.y - 170);
  const hit = advanceRallyFrame(visible, .05, 50, [visibleControl]);
  assert.ok(hit.hit, 'the line can volley at the actual displayed position');
  assert.ok(hit.hit.at.y < 450, 'hit feedback stays on the lifted visible ball');
  assert.ok(visible.ball.y > 600, 'a return preserves the underlying ground path instead of copying the projected y');
  assert.equal(visible.lastHitter, 1);

  const shadow = structuredClone(original);
  const shadowControl = rightControl(shadow, pose(70, 1400, shadow.ball.y - 170));
  shadowControl.pose = pose(110, 1400, shadow.ball.y - 170);
  const miss = advanceRallyFrame(shadow, .05, 50, [shadowControl]);
  assert.equal(miss.hit, null, 'swinging only through the shadow cannot hit an airborne ball');
  assert.equal(shadow.lastHitter, 0);
});

test('a receiver can volley during the frame that first crosses the net', () => {
  for (const side of [0, 1] as const) {
    const server = side === 0 ? 1 : 0;
    const match = createMatch(server);
    strike(match, server, { vx: side === 0 ? -1000 : 1000, vy: 0 });
    match.ball = { x: side === 0 ? 970 : 950, y: 540, z: 0,
      vx: side === 0 ? -1000 : 1000, vy: 0, vz: 20 };
    match.gravity = 2;
    const controller = new SwingController();
    const x = side === 0 ? 800 : 1120;
    const control: RallyControl = { side, pose: pose(side === 0 ? 10 : 170, x, 540), controller };
    assert.equal(advanceRallyFrame(match, 0, 0, [control]).hit, null);
    control.pose = pose(side === 0 ? -10 : 190, x, 540);
    const result = advanceRallyFrame(match, .05, 50, [control]);
    assert.ok(result.hit, 'the receiver was observed before the crossing and can swing immediately');
    assert.equal(match.lastHitter, side);
    assert.ok(result.hit.shot.contactTimeMs > 10, 'overlap on the hitter side cannot consume the return');
    assert.ok(side === 0 ? result.hit.at.x < 960 : result.hit.at.x > 960);
    assert.equal(result.point, false);
  }
});

test('observing an incoming receiver never turns early overlap or a held line into a return', () => {
  for (const crosses of [false, true]) {
    const match = createMatch(); strike(match, 0, { vx: 1000, vy: 0 });
    match.ball = { x: crosses ? 950 : 900, y: 540, z: 0, vx: 1000, vy: 0, vz: 20 };
    match.gravity = 2;
    const control: RallyControl = { side: 1, pose: pose(180, 1120, 540), controller: new SwingController() };
    advanceRallyFrame(match, 0, 0, [control]);
    control.pose = pose(crosses ? 180 : 190, 1120, 540);
    const result = advanceRallyFrame(match, .05, 50, [control]);
    assert.equal(result.hit, null, crosses ? 'a held line still needs a deliberate twist' : 'the ball has not crossed');
    assert.equal(match.lastHitter, 0); assert.equal(match.crossedNet, crosses);
  }
});

test('a return crossing back in the same frame rearms the opponent for the next volley', () => {
  for (const reverseControls of [false, true]) {
    const match = createMatch(1); strike(match, 1, { vx: -1000, vy: 0 });
    match.ball = { x: 950, y: 540, z: 0, vx: -1000, vy: 0, vz: 20 };
    match.crossedNet = true; match.gravity = 2;
    const left = new SwingController(), right = new SwingController();
    left.update(pose(270, 950, 710), ballDisplay(match.ball), 0);
    const previousTarget = { x: 1035, y: 650 - 170 * Math.sin(Math.PI / 3) };
    right.update(pose(240, 1120, 650), previousTarget, -16);
    assert.ok(right.update(pose(244, 1120, 650), previousTarget, 0));
    assert.equal(right.status, 'spent', 'the right player has hit the incoming shot');
    const receiving: RallyControl = { side: 1, pose: pose(250, 1120, 650), controller: right };
    const controls: RallyControl[] = [
      { side: 0, pose: pose(290, 950, 710), controller: left }, receiving,
    ];
    if (reverseControls) controls.reverse();
    assert.equal(advanceRallyFrame(match, .05, 50, controls).hit?.side, 0);
    assert.equal(match.crossedNet, true, 'the new shot has already returned to the right half');
    assert.equal(right.status, 'ready', 'the prior possession lock is released regardless of controller order');
    receiving.pose = pose(215, 1120, 650);
    assert.equal(advanceRallyFrame(match, .05, 100, controls).hit?.side, 1);
    assert.equal(match.rally, 3);
  }
});
