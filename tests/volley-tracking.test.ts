import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoardContactPhase,createMatch,frames,batch,snapshot,tick,poses,contact,tap} from './match-harness';

test('unclassified contacts cannot settle a volley using a frozen pose', async()=>{
  await import('../src/runtime');
  const pending=createMatch();
  Object.assign(pending,{phase:'point',rally:4,receiver:1,lastHitter:0});
  pending.volleyGuards[0]={x:700,y:540,facingDeg:0,anchorX:700,anchorY:540,anchorFacing:0,stillFor:0};
  pending.pendingOutcome={winner:0,reason:'double-bounce'};
  Object.assign(BoardPlatform.state,{
    load:()=>({version:3,match:pending,sides:[
      {sessionId:11,playerId:'local-left',side:0},{sessionId:22,playerId:'local-right',side:1}]}),
    save() {},
  });
  await import('../src/main');
  for(let i=0;i<30&&!frames.size;i++)await new Promise(resolve=>setTimeout(resolve,10));
  tick();
  const {BUTTONS}=await import('../src/view');
  const button=BUTTONS.continue[0];
  tap(button.x+button.width/2,button.y+button.height/2);
  assert.equal(snapshot().mode,'setup');
  Object.assign(poses[0],{x:700,y:540,orientation:0});
  batch!(poses.map(p=>contact(p,BoardContactPhase.Began)));tick();
  assert.equal(snapshot().mode,'play');
  // The real runtime retains the piece's identity while its glyph classification flaps.
  // Native position moves inside the kitchen, but the tracker deliberately freezes the pose.
  batch!([{...contact(poses[0]),glyphId:0,x:800}]);tick(13);
  const duringGap=structuredClone(snapshot().match);
  Object.assign(poses[0],{x:800});batch!([contact(poses[0])]);tick();
  const afterRecovery=snapshot().match;
  assert.ok(duringGap.pendingOutcome,'A classification gap must not manufacture .2 seconds of observed rest.');
  assert.equal(afterRecovery.reason,'kitchen','The recovered footprint has entered the kitchen during follow-through.');
  assert.deepEqual(afterRecovery.score,[0,0]);
});
