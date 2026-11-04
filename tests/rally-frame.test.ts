import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { advanceRallyFrame, type RallyControl } from '../src/rally-frame';
import { COURT, createMatch, strike, type Footing, type Match } from '../src/pickleball';
import { SwingController, type SwingPose } from '../src/swing';
import { ballDisplay } from '../src/ball-display';
import { pieceFootprint, type PieceFootprints } from '../src/piece-footprints';

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
  const match = incoming(); match.score = [10, 0];
  const control = rightControl(match, pose(70));
  control.pose = pose(110);
  const result = advanceRallyFrame(match, .1, 100, [control]);
  assert.ok(result.hit, 'the line contacts the ball before its second ground bounce');
  assert.equal(result.point, false);
  assert.equal(match.phase, 'rally'); assert.deepEqual(match.score, [10, 0]);
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
  const control: RallyControl = { side: 0, pose: pose(260, 270, 720), controller };
  assert.equal(advanceRallyFrame(match, 0, 0, [control]).hit, null);
  control.pose = pose(264, 270, 720);
  const first = advanceRallyFrame(match, .016, 16, [control]);
  assert.ok(first.hit); assert.equal(match.phase, 'rally'); assert.ok(match.ball.x > 240);
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


test('a swing after the table edge cannot rescue a missed return', () => {
  const match = incoming(); match.ball.z = 180; match.ball.vz = 0;
  const racketY = ballDisplay(match.ball).y - 170;
  const control = rightControl(match, pose(50,1884,racketY)); control.pose = pose(90,1884,racketY);
  const result = advanceRallyFrame(match, .1, 100, [control]);
  assert.equal(result.hit, null); assert.equal(result.point, true);
  assert.equal(match.reason, 'missed'); assert.deepEqual(match.score, [1,0]);
  assert.equal(match.ball.x, 1902);
});

test('an opening volley faults through real swept contact instead of passing through', () => {
  for (const rally of [1,2]) {
    const match = incoming(); match.ball.x=1370; match.ball.z=100; match.ball.vz=0;
    match.rally=rally; match.groundBounces=0;
    const y=ballDisplay(match.ball).y-170;
    const control=rightControl(match,pose(70,1420,y));control.pose=pose(125,1420,y);
    const result=advanceRallyFrame(match,.1,100,[control]);
    assert.ok(result.hit); assert.equal(result.point,true); assert.equal(match.reason,'two-bounce');
    assert.equal(match.lastHitter,0); assert.deepEqual(match.score,[1,0]);
  }
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
    match.ball = { x: side === 0 ? 970 : 950, y: 900, z: 120,
      vx: side === 0 ? -1000 : 1000, vy: 0, vz: 20 };
    match.rally = 3; match.gravity = 2;
    const controller = new SwingController();
    const x = side === 0 ? 740 : 1180;
    const control: RallyControl = { side, pose: pose(side === 0 ? 10 : 170, x, 786), controller };
    assert.equal(advanceRallyFrame(match, 0, 0, [control]).hit, null);
    control.pose = pose(side === 0 ? -10 : 190, x, 786);
    const result = advanceRallyFrame(match, .05, 50, [control]);
    assert.ok(result.hit, `side ${side}: ${JSON.stringify(match)}; controller ${controller.status}`);
    assert.equal(match.lastHitter, side);
    assert.ok(result.hit.shot.contactTimeMs > 10, 'overlap on the hitter side cannot consume the return');
    assert.ok(side === 0 ? result.hit.at.x < 960 : result.hit.at.x > 960);
    assert.equal(result.point, false);
  }
});

test('observing an incoming receiver never turns early overlap or a held line into a return', () => {
  for (const crosses of [false, true]) {
    const match = createMatch(); strike(match, 0, { vx: 1000, vy: 0 });
    match.ball = { x: crosses ? 950 : 900, y: 900, z: 120, vx: 1000, vy: 0, vz: 20 };
    match.rally = 3; match.gravity = 2;
    const control: RallyControl = { side: 1, pose: pose(180, 1120, 786), controller: new SwingController() };
    advanceRallyFrame(match, 0, 0, [control]);
    control.pose = pose(crosses ? 180 : 190, 1120, 786);
    const result = advanceRallyFrame(match, .05, 50, [control]);
    assert.equal(result.hit, null, crosses ? 'a held line still needs a deliberate twist' : 'the ball has not crossed');
    assert.equal(match.lastHitter, 0); assert.equal(match.crossedNet, crosses);
  }
});

test('a return crossing back in the same frame rearms the opponent for the next volley', () => {
  for (const reverseControls of [false, true]) {
    const match = createMatch(1); strike(match, 1, { vx: -1000, vy: 0 });
    match.ball = { x: 950, y: 900, z: 120, vx: -1000, vy: 0, vz: 20 };
    match.crossedNet = true; match.rally = 3; match.gravity = 2;
    const left = new SwingController(), right = new SwingController();
    left.update(pose(270, 950, 956), ballDisplay(match.ball), 0);
    const previousTarget = { x: 1035, y: 896 - 170 * Math.sin(Math.PI / 3) };
    right.update(pose(240, 1120, 896), previousTarget, -16);
    assert.ok(right.update(pose(244, 1120, 896), previousTarget, 0));
    assert.equal(right.status, 'spent', 'the right player has hit the incoming shot');
    const receiving: RallyControl = { side: 1, pose: pose(250, 1120, 896), controller: right };
    const controls: RallyControl[] = [
      { side: 0, pose: pose(290, 950, 956), controller: left }, receiving,
    ];
    if (reverseControls) controls.reverse();
    assert.equal(advanceRallyFrame(match, .05, 50, controls).hit?.side, 0);
    assert.equal(match.crossedNet, true, 'the new shot has already returned to the right half');
    assert.equal(right.status, 'ready', 'the prior possession lock is released regardless of controller order');
    receiving.pose = pose(215, 1120, 896);
    assert.equal(advanceRallyFrame(match, .05, 100, controls).hit?.side, 1);
    assert.equal(match.rally, 5);
  }
});

test('a swept return preserves the previous volley’s full settling time before a kitchen entry', () => {
  const footprints: PieceFootprints = JSON.parse(readFileSync('public/piece-footprints.json', 'utf8'));
  const footingAt = (p: SwingPose): Footing => ({ ...p, outline: pieceFootprint(footprints,
    { ...p, glyphId: 5, orientation: p.facingDeg - footprints.facingOffsetDeg })!.outline });
  const extent = Math.max(...footingAt(pose(0, 0, 540)).outline.map(p => p.x));
  for (const initialRest of [.05, .17]) for (const reverseControls of [false, true]) {
    const match = createMatch(); strike(match, 0, { vx: 1000, vy: 0 });
    Object.assign(match, { ball: { x: 1370, y: 540, z: 100, vx: 1000, vy: 0, vz: 0 },
      rally: 3, crossedNet: true, gravity: 800 });
    const leftPose = pose(0, COURT.kitchenLeft - extent - 1, 540);
    match.volleyGuards[0] = { x: leftPose.x, y: leftPose.y, facingDeg: 0,
      anchorX: leftPose.x, anchorY: leftPose.y, anchorFacing: 0, stillFor: initialRest };
    const left: RallyControl = { side: 0, pose: leftPose, controller: new SwingController(), footingAt };
    const right = rightControl(match, pose(70, 1420, ballDisplay(match.ball).y - 170));
    right.pose = { ...right.pose!, facingDeg: 125 }; right.footingAt = footingAt;
    const controls = reverseControls ? [right, left] : [left, right];
    const result = advanceRallyFrame(match, .05, 50, controls);
    assert.equal(result.hit?.side, 1, 'exercise a real swept return halfway through the frame');
    const settled = initialRest + .05 >= .2;
    if (settled) assert.equal(match.volleyGuards[0], null);
    else assert.ok(Math.abs(match.volleyGuards[0]!.stillFor - .1) < 1e-9);
    left.pose = { ...leftPose, x: leftPose.x + 50 };
    advanceRallyFrame(match, .05, 100, controls);
    assert.equal(match.reason, settled ? null : 'kitchen', 'only unsettled follow-through restricts a later entry');
    assert.equal(match.server, settled ? 0 : 1);
    assert.deepEqual(match.score, [0, 0]);
  }
});

test('both volley follow-through paths resolve the earliest kitchen contact, independent of control order', () => {
  const footprints: PieceFootprints = JSON.parse(readFileSync('public/piece-footprints.json', 'utf8'));
  const footingAt = (p: SwingPose): Footing => ({ ...p, outline: pieceFootprint(footprints,
    { ...p, glyphId: 5, orientation: p.facingDeg - footprints.facingOffsetDeg })!.outline });
  const leftExtent = Math.max(...footingAt(pose(0, 0, 540)).outline.map(p => p.x));
  const rightExtent = -Math.min(...footingAt(pose(180, 0, 540)).outline.map(p => p.x));
  for (const firstSide of [0, 1] as const) for (const reverseControls of [false, true]) {
    const match = createMatch();
    Object.assign(match, { phase: 'rally', rally: 5, lastHitter: 1, receiver: 0,
      ball: { x: 1050, y: 540, z: 150, vx: -700, vy: 0, vz: 0 } });
    const poses = [pose(0, COURT.kitchenLeft - leftExtent - (firstSide === 0 ? 1 : 25), 540),
      pose(180, COURT.kitchenRight + rightExtent + (firstSide === 1 ? 1 : 25), 540)];
    match.volleyGuards = poses.map(p => ({ x: p.x, y: p.y, facingDeg: p.facingDeg,
      anchorX: p.x, anchorY: p.y, anchorFacing: p.facingDeg, stillFor: 0 })) as Match['volleyGuards'];
    const controls: RallyControl[] = poses.map((p, side) => ({ side: side as 0 | 1,
      pose: { ...p, x: p.x + (side ? -40 : 40) }, controller: new SwingController(), footingAt }));
    if (reverseControls) controls.reverse();
    const result = advanceRallyFrame(match, .05, 50, controls);
    assert.equal(result.point, true); assert.equal(match.reason, 'kitchen');
    assert.equal(match.pointWinner, 1 - firstSide);
    assert.deepEqual(match.score, firstSide === 0 ? [0, 0] : [1, 0]);
  }
});
