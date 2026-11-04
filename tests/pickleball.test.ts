import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pieceFootprint } from '../src/piece-footprints';
import { COURT, PICKLEBALL, POINT_DELAY, canStrike, createMatch, inOwnHalf, nextServe,
  stepMatch, strike, travelScale, serveBall, serveSetup, serviceTarget, legalServeFooting, inKitchen,
  observeVolleyFooting, type Match, type Side, type Footing } from '../src/pickleball';

function advance(match: Match, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 120) stepMatch(match, 1 / 120);
}
function until(match: Match, done: () => boolean) {
  for (let i = 0; i < 2400 && !done(); i++) stepMatch(match, 1 / 120);
  assert.ok(done(), JSON.stringify(match));
}
function landing(match: Match, x: number, y: number, count: 0 | 1 = 0) {
  match.phase = 'rally'; match.lastHitter = match.server; match.receiver = match.server === 0 ? 1 : 0;
  match.rally = Math.max(1, match.rally); match.crossedNet = true; match.groundBounces = count; match.gravity = 800;
  match.ball = { x, y, vx: 0, vy: 0, z: .001, vz: -100 };
  stepMatch(match, .01);
}
function win(match: Match, side: Side) {
  match.phase = 'rally'; match.lastHitter = side; match.receiver = side === 0 ? 1 : 0;
  match.crossedNet = true; match.groundBounces = 1; match.gravity = 800; match.rally = 3;
  match.ball = { x: side === 0 ? 1500 : 420, y: 540, vx: 0, vy: 0, z: .001, vz: -100 };
  stepMatch(match, .01);
}
const foot = (x: number, y = 540, r = 5): Footing => ({ x, y, facingDeg: 0,
  outline: [{x:x-r,y:y-r},{x:x+r,y:y-r},{x:x+r,y:y+r},{x:x-r,y:y+r}] });

test('serve waits, has a score-dependent spot, and only the server can start', () => {
  for (const server of [0, 1] as const) {
    const m = createMatch(server); advance(m, 30);
    assert.equal(m.phase, 'serve'); assert.deepEqual(m.ball, serveBall(server));
    assert.ok(canStrike(m, server)); assert.equal(canStrike(m, server === 0 ? 1 : 0), false);
    assert.equal(strike(m, server, {vx:server ? -700 : 700,vy:server ? 120 : -120}), true);
    assert.equal(m.rally, 1); assert.equal(m.lastHitter, server);
  }
});

test('only the server scores; receiving winners take service without a point', () => {
  for (const server of [0, 1] as const) for (const winner of [0, 1] as const) {
    const m = createMatch(server); win(m, winner);
    assert.equal(m.phase, 'point'); assert.equal(m.pointWinner, winner);
    assert.equal(m.score[winner], server === winner ? 1 : 0);
    assert.equal(m.pointScored, server === winner); assert.equal(m.server, winner);
    assert.equal(nextServe(m), false); stepMatch(m, POINT_DELAY); assert.equal(nextServe(m), true);
    assert.deepEqual(m.ball, serveBall(winner, m.score[winner])); assert.equal(m.receiver, winner);
  }
});

test('11-10 continues, 12-10 wins, and the final result never advances itself', () => {
  const m = createMatch(); m.score = [10,10]; win(m, 0);
  assert.deepEqual(m.score, [11,10]); assert.equal(m.phase, 'point');
  stepMatch(m, POINT_DELAY); nextServe(m); win(m, 0);
  assert.equal(m.phase, 'over'); assert.equal(m.winner, 0); assert.deepEqual(m.score, [12,10]);
  const final = JSON.stringify(m); advance(m, 60); assert.equal(nextServe(m), false); assert.equal(JSON.stringify(m), final);
  assert.deepEqual(createMatch().score, [0,0]);
});

test('singles serves use the server score parity on both ends, including after side out', () => {
  for (const server of [0,1] as const) for (const score of [0,1,2,9,10]) {
    const m = createMatch(server); m.score[server] = score;
    const b = serveBall(server, score), box = serviceTarget(m);
    assert.equal(b.y > 540, (score % 2 === 0) === (server === 0));
    assert.equal(box.top === COURT.middle - 3, b.y < 540);
    assert.equal(box.left, server === 0 ? COURT.kitchenRight : COURT.left);
  }
});

test('service first landings include baseline, sideline and centerline, but exclude the kitchen line', () => {
  for (const server of [0,1] as const) for (const score of [0,1]) {
    for (const place of ['center', 'baseline', 'sideline', 'centerline', 'centerline-edge', 'kitchen-line', 'wrong-box', 'out']) {
      const m = createMatch(server); m.score[server] = score;
      const box = serviceTarget(m), x = (box.left + box.right) / 2, y = (box.top + box.bottom) / 2;
      landing(m, place === 'baseline' ? (server ? COURT.left : COURT.right)
        : place === 'kitchen-line' ? (server ? COURT.kitchenLeft : COURT.kitchenRight) : x,
        place === 'sideline' ? (box.top > COURT.top ? COURT.bottom : COURT.top)
        : place === 'centerline' ? 540 : place === 'centerline-edge' ? (box.top > COURT.top ? 537 : 543) : place === 'wrong-box' ? 1080-y : place === 'out' ? COURT.top-1 : y);
      const legal = ['center','baseline','sideline','centerline','centerline-edge'].includes(place);
      assert.equal(m.phase, legal ? 'rally' : 'point', `${server}/${score}/${place}`);
      if (legal) assert.equal(m.groundBounces, 1);
      else { assert.equal(m.server, 1-server); assert.equal(m.pointScored, false); }
    }
  }
});

test('all Sports footprints enforce service feet without moving the physical pose', () => {
  const data = JSON.parse(readFileSync('public/piece-footprints.json','utf8'));
  for (let glyphId = 1; glyphId <= 8; glyphId++) for (const server of [0,1] as const) {
    const m = createMatch(server), p = { glyphId, ...serveSetup(server) };
    const fp = pieceFootprint(data, p)!;
    assert.ok(legalServeFooting(m, fp.outline), `${glyphId}/${server}`);
    assert.equal(legalServeFooting(m, pieceFootprint(data, {...p,x:server?1540:380})!.outline), false);
    assert.equal(legalServeFooting(m, pieceFootprint(data, {...p,y:540})!.outline), false);
  }
  const m = createMatch(); const p = foot(400,700); const original = structuredClone(p);
  assert.ok(strike(m,0,{vx:700,vy:-100},p)); assert.equal(m.reason,'serve-foot');
  assert.deepEqual(m.score,[0,0]); assert.equal(m.server,1); assert.deepEqual(p,original);
});

test('an early return of serve or early third shot is a fault, never a free volley', () => {
  for (const rally of [1,2]) {
    const m = createMatch(); m.phase='rally'; m.rally=rally; m.lastHitter=rally===1?0:1;
    const receiver = rally===1?1:0; m.receiver=receiver; m.crossedNet=true;
    m.ball={x:receiver?1400:520,y:500,vx:0,vy:0,z:80,vz:0};
    assert.equal(canStrike(m,receiver),false);
    assert.ok(strike(m,receiver,{vx:receiver?-700:700,vy:0}));
    assert.equal(m.reason,'two-bounce'); assert.equal(m.phase,'point'); assert.equal(m.pointWinner,1-receiver);
  }
});

test('opening ground returns alternate, then volleys are legal and reset the bounce count', () => {
  const m=createMatch(); strike(m,0,{vx:700,vy:-120});
  until(m,()=>m.groundBounces===1||m.phase!=='rally'); assert.equal(m.phase,'rally');
  assert.ok(canStrike(m,1)); const height=m.ball.z;
  assert.ok(strike(m,1,{vx:-700,vy:0})); assert.equal(m.ball.z,height); assert.equal(m.rally,2);
  until(m,()=>m.groundBounces===1||m.phase!=='rally'); assert.equal(m.phase,'rally');
  assert.ok(strike(m,0,{vx:700,vy:0})); assert.equal(m.rally,3);
  until(m,()=>m.crossedNet); assert.ok(canStrike(m,1));
  assert.ok(strike(m,1,{vx:-700,vy:0})); assert.equal(m.rally,4); assert.equal(m.groundBounces,0);
  assert.equal(strike(m,1,{vx:-700,vy:0}),false);
});

test('the kitchen prohibits volleys but allows ground strokes and counts the footprint edge', () => {
  for (const bounced of [false,true]) {
    const m=createMatch(); m.phase='rally'; m.rally=3; m.receiver=1; m.lastHitter=0; m.crossedNet=true;
    m.groundBounces=bounced?1:0; m.ball={x:1200,y:540,z:80,vx:0,vy:0,vz:0};
    assert.ok(strike(m,1,{vx:-700,vy:0},foot(COURT.kitchenRight+5)));
    assert.equal(m.phase,bounced?'rally':'point'); assert.equal(m.reason,bounced?null:'kitchen');
  }
  assert.ok(inKitchen(foot(COURT.kitchenLeft-5).outline));
  assert.equal(inKitchen(foot(COURT.kitchenLeft-6).outline),false);
  assert.equal(inKitchen(foot(COURT.net,COURT.top-6).outline),false);
});

function volley() {
  const m=createMatch(1); m.phase='rally'; m.rally=3; m.receiver=1; m.lastHitter=0; m.crossedNet=true;
  m.ball={x:1250,y:540,z:80,vx:0,vy:0,vz:0};
  strike(m,1,{vx:-700,vy:0},foot(1250)); return m;
}
test('kitchen follow-through remains a fault after a dead ball without announcing a provisional score', () => {
  const m=volley(); m.score=[0,10]; win(m,1);
  assert.equal(m.phase,'point'); assert.equal(m.pointWinner,null); assert.deepEqual(m.score,[0,10]); assert.ok(m.pendingOutcome);
  assert.equal(nextServe(m),false);
  observeVolleyFooting(m,1,foot(1100),.1);
  assert.equal(m.reason,'kitchen'); assert.equal(m.pointWinner,0); assert.equal(m.server,0);
  assert.equal(m.winner,null); assert.deepEqual(m.score,[0,10]);
});

test('a settled volley releases its pending winning point; missing time cannot settle it', () => {
  const m=volley(); m.score=[0,10]; win(m,1); advance(m,4);
  assert.ok(m.pendingOutcome); assert.equal(m.phase,'point');
  observeVolleyFooting(m,1,foot(1250),.1); assert.ok(m.pendingOutcome);
  observeVolleyFooting(m,1,foot(1250),.1);
  assert.equal(m.pendingOutcome,null); assert.equal(m.phase,'over'); assert.deepEqual(m.score,[0,11]);
});

test('out calls happen on the first landing; a second bounce out still belongs to the hitter', () => {
  for (const count of [0,1] as const) {
    const m=createMatch(); m.rally=3; landing(m,COURT.right+40,540,count);
    assert.equal(m.pointWinner,count?0:1); assert.equal(m.reason,count?'double-bounce':'out');
    assert.equal(m.score[0],count);
  }
});

test('the table edge ends a shot without a wall rebound, before or after its legal bounce', () => {
  for (const count of [0,1] as const) for (const edge of ['left','right','top','bottom']) {
    const m=createMatch(); m.phase='rally'; m.rally=3; m.lastHitter=0; m.receiver=1; m.crossedNet=true;
    m.groundBounces=count; m.gravity=800;
    m.ball={x:edge==='left'?19:edge==='right'?1901:1400,y:edge==='top'?19:edge==='bottom'?1061:540,
      vx:edge==='left'?-700:edge==='right'?700:0,vy:edge==='top'?-700:edge==='bottom'?700:0,z:180,vz:0};
    stepMatch(m,.05); assert.equal(m.phase,'point'); assert.equal(m.pointWinner,count?0:1);
    assert.equal(m.reason,count?'missed':'out'); assert.equal(m.ball.vx,0); assert.equal(m.ball.vy,0);
  }
});

test('net crossings below the net fault in either direction, including the exact crossing frame', () => {
  for (const side of [0,1] as const) for (const z of [10,150]) {
    const m=createMatch(side); m.phase='rally'; m.rally=3; m.lastHitter=side; m.receiver=side?0:1;
    m.ball={x:side?961:959,y:540,vx:side?-700:700,vy:0,z,vz:0};
    stepMatch(m,.01); assert.equal(m.phase,z===10?'point':'rally');
    if(z===10){assert.equal(m.reason,'net');assert.equal(m.pointWinner,1-side);}else assert.ok(m.crossedNet);
  }
});

test('backwards and vertical shots retain their tangent and end without wall banks or stalls', () => {
  for (const [vx,vy] of [[-700,0],[0,-700],[0,.001]]) {
    const m=createMatch(); strike(m,0,{vx,vy}); assert.equal(m.ball.vx,vx);assert.equal(m.ball.vy,vy);
    until(m,()=>m.phase!=='rally'); assert.equal(m.phase,'point');assert.equal(m.server,1);assert.deepEqual(m.score,[0,0]);
  }
});

test('arc and bounce timing agree at 30, 60 and 120 display frames per second', () => {
  const outcomes=[30,60,120].map(hz=>{const m=createMatch();strike(m,0,{vx:900,vy:-150});
    for(let i=0;i<2400&&m.phase==='rally';i++)stepMatch(m,1/hz);return m;});
  for(const m of outcomes){assert.deepEqual(m.score,[1,0]);assert.equal(m.reason,'double-bounce');
    assert.ok(Math.abs(m.shotTime-outcomes[0].shotTime)<1e-8);assert.ok(Math.abs(m.ball.x-outcomes[0].ball.x)<1e-8);}
});

test('receiver slowdown is symmetric and changes neither the tangent nor landing location', () => {
  for (const side of [0,1] as const) {
    const m=createMatch(side);strike(m,side,{vx:side?-1000:1000,vy:0});m.crossedNet=true;m.rally=3;
    m.ball.x=side?PICKLEBALL.slowStartLeft:PICKLEBALL.slowStartRight;assert.equal(travelScale(m),1);
    m.ball.x=side?680:1240;assert.ok(Math.abs(travelScale(m)-.61)<1e-10);
    m.ball.x=side?600:1320;assert.ok(Math.abs(travelScale(m)-.22)<1e-10);
    const vx=m.ball.vx; stepMatch(m,.05);assert.equal(m.ball.vx,vx);
  }
  for(const vx of [480,1100]){const m=createMatch();strike(m,0,{vx,vy:-vx*.18});
    until(m,()=>m.groundBounces===1||m.phase!=='rally');assert.equal(m.phase,'rally');
    assert.ok(Math.abs(m.lastBounce!.x-PICKLEBALL.landingRight)<1e-6);}
});

test('invalid times, shots, and pauses cannot corrupt or advance the match', () => {
  const m=createMatch(), initial=JSON.stringify(m);
  for(const dt of [NaN,Infinity,-1,0])stepMatch(m,dt);
  for(const vx of [NaN,Infinity,-Infinity])assert.equal(strike(m,0,{vx,vy:0}),false);
  assert.equal(strike(m,0,{vx:0,vy:0}),false);assert.equal(JSON.stringify(m),initial);
  assert.equal(inOwnHalf(0,NaN),false);assert.equal(inOwnHalf(1,960),false);
});

test('a stationary piece with tracking noise can finish its volley and release the outcome', () => {
  const m=volley();win(m,1);
  for(let i=0;i<18;i++) {
    const p=foot(1250+(i%2?3:-3),540+(i%3-1)*3);p.facingDeg=i%2?3:357;
    observeVolleyFooting(m,1,p,1/60);
  }
  assert.equal(m.pendingOutcome,null);assert.equal(m.pointScored,true);assert.deepEqual(m.score,[0,1]);
});
