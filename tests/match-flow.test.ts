import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Board,BoardContactPhase,createMatch,serveBall,serveFromBottom,ballDisplay,draws,frames,texts,
  batch,pauses,resumes,roster,rosterCallbacks,replacementRequests,addRequests,errors,
  snapshot,tick,until,poses,contact,move,tap,newContactId,type Side} from './match-harness';

test('assembled game plays a real two-human match, survives repeated menu epochs, and waits for rematch',async()=>{
  await import('../src/runtime');
  const restoredMatch=createMatch();restoredMatch.score=[3,4];
  let lastSaved:any=null;
  Object.assign(BoardPlatform.state,{
    load:()=>({version:2,match:restoredMatch,sides:[
      {sessionId:91,playerId:'local-left',side:1},{sessionId:92,playerId:'local-right',side:0},
    ]}),
    save:(value:unknown)=>{lastSaved=value;},
  });
  const returningPlayer=roster.pop()!;
  let menuAction:((id:string)=>void)|null=null;
  Object.assign(BoardPlatform.menu,{onButton:(callback:(id:string)=>void)=>{menuAction=callback;return()=>{};}});
  await import('../src/main');
  for(let i=0;i<30&&!frames.size;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(frames.size,'game finishes its asynchronous font/geometry startup');
  tick(4);assert.equal(snapshot().mode,'title');assert.ok(draws>5);

  // Pieces may already be on the glass when Continue is chosen after title help.
  // Saved ownership must win over placement order, including a player rejoining later.
  const {BUTTONS}=await import('../src/view');
  const titleHelp=BUTTONS.help[0];tap(titleHelp.x+titleHelp.width/2,titleHelp.y+titleHelp.height/2);
  assert.equal(snapshot().mode,'help');
  batch!(poses.map(p=>contact(p,BoardContactPhase.Began)));tick(2);
  assert.equal(snapshot().placementCount,2);
  const titleBack=BUTTONS.back[0];tap(titleBack.x+titleBack.width/2,titleBack.y+titleBack.height/2);
  const continueButton=BUTTONS.continue[0];tap(continueButton.x+continueButton.width/2,continueButton.y+continueButton.height/2);
  assert.equal(snapshot().mode,'setup');assert.deepEqual(snapshot().match.score,[3,4]);
  assert.deepEqual(snapshot().seats.map(s=>[s.sessionId,s.side,s.pieceId]),[[11,1,2]],'Continue binds the saved right seat to the right piece');
  roster.push(returningPlayer);for(const callback of rosterCallbacks)callback();tick(65);
  assert.equal(snapshot().mode,'play');
  assert.deepEqual(snapshot().seats.map(s=>[s.sessionId,s.side,s.pieceId]),[[11,1,2],[22,0,1]],'late roster joins retain their saved side');
  assert.deepEqual(lastSaved.sides,[
    {sessionId:11,playerId:'local-left',side:1},{sessionId:22,playerId:'local-right',side:0},
  ],'future restores use stable player IDs despite changed session IDs');

  // Return to a fresh setup through real menu/lift input for the complete match below.
  assert.ok(menuAction);(menuAction as (id:string)=>void)('setup');
  batch!(poses.map(p=>contact(p,BoardContactPhase.Ended)));tick(14);
  roster.pop();for(const callback of rosterCallbacks)callback();
  poses[0].id=newContactId();poses[1].id=newContactId();
  batch!([contact(poses[0],BoardContactPhase.Began)]);tick(2);
  assert.equal(snapshot().mode,'setup');
  // A fresh position outside the tracking-gap radius is a new placement.
  // Keep matching glyphs to exercise duplicate-piece ownership for the whole match.
  poses[1].y=600;
  batch!([contact(poses[1],BoardContactPhase.Began)]);tick(3);
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(addRequests,1,'placing a piece at a free edge opens the roster selector once');
  tick(60);assert.equal(addRequests,1,'dismissing the selector does not reopen it every frame');
  roster.push(returningPlayer);for(const callback of rosterCallbacks)callback();tick(65);
  assert.equal(snapshot().mode,'play');assert.equal(snapshot().match.phase,'serve');
  assert.deepEqual(snapshot().seats.map(s=>[s.sessionId,s.side,s.present]),[[11,0,true],[22,1,true]]);
  const placementCount=snapshot().placementCount;
  tick(30);assert.equal(snapshot().match.phase,'serve','stationary overlapping racket cannot serve itself');

  move(0,{orientation:262});tick();
  assert.equal(snapshot().match.phase,'rally');assert.equal(snapshot().match.lastHitter,0);
  assert.ok(snapshot().match.ball.vx>0);assert.equal(snapshot().match.rally,1);

  // Help is a view of the same rally. Moving or twisting while it is open carries no strike intent back.
  const beforeHelp=snapshot();assert.ok(menuAction,'main registered its platform menu actions');
  (menuAction as (id:string)=>void)('help');tick(90);
  assert.equal(snapshot().mode,'help');assert.deepEqual(snapshot().match,beforeHelp.match,'help time freezes the live ball');
  move(0,{orientation:300});move(1,{orientation:120});tick(3);
  assert.deepEqual(snapshot().match,beforeHelp.match,'piece gestures in help cannot alter the rally');
  const back=BUTTONS.back[0];tap(back.x+back.width/2,back.y+back.height/2);
  assert.equal(snapshot().mode,'play');assert.deepEqual(snapshot().match,beforeHelp.match,'Back restores the same match immediately');
  tick(2);assert.equal(snapshot().match.rally,1,'return from help cannot fabricate a hit from old rotation');
  move(0,{orientation:272});move(1,{orientation:90});tick(); // prepare while the ball is still away from the right receiver

  // All three menu epochs change contact IDs while retaining the same physical pieces.
  for(let cycle=0;cycle<3;cycle++){
    const before=snapshot(),poseBefore=poses.map(p=>({...p}));
    for(const pause of pauses)pause();tick(30);
    assert.equal(snapshot().running,false);
    assert.deepEqual(snapshot().match,before.match,'menu time cannot move the ball or score');
    for(const resume of resumes)resume();tick(2);
    for(let side=0;side<2;side++)poses[side]={...poseBefore[side],id:newContactId()};
    batch!(poses.map(p=>contact(p,BoardContactPhase.Began)));tick(2);
    const after=snapshot();assert.equal(after.running,true);assert.equal(after.placementCount,placementCount,'redetection has no second splash');
    assert.deepEqual(after.seats.map(s=>s.pieceId),before.seats.map(s=>s.pieceId),'ownership survives fresh native IDs');
    assert.equal(after.match.rally,1,'menu return never invents another swing');assert.deepEqual(after.match.score,[0,0]);
  }
  // Resume before the queued frame runs: cancellation must leave exactly one loop.
  for(const pause of pauses)pause();for(const resume of resumes)resume();
  batch!(poses.map(p=>contact(p,BoardContactPhase.Began)));tick(2);
  assert.equal(frames.size,1);

  // The opening serve and its return must each bounce before a legal hit.
  until(s=>s.match.groundBounces===1,'serve bounces in the diagonal right service box');
  let b=ballDisplay(snapshot().match.ball);
  move(1,{x:b.x+5,y:b.y-170,orientation:90});tick();
  assert.equal(snapshot().match.rally,1,'translation alone never returns');
  move(1,{orientation:92});tick();
  assert.equal(snapshot().match.lastHitter,1);assert.equal(snapshot().match.rally,2);
  until(s=>s.match.groundBounces===1,'return of serve bounces on the left');
  b=ballDisplay(snapshot().match.ball);move(0,{x:b.x-5,y:b.y+170,orientation:270});tick();
  move(0,{orientation:272});tick();
  assert.equal(snapshot().match.lastHitter,0);assert.equal(snapshot().match.rally,3);
  until(s=>s.match.phase==='point','missed return awards the serving player');
  assert.deepEqual(snapshot().match.score,[1,0]);assert.equal(snapshot().match.server,0);
  assert.equal(snapshot().match.pointScored,true);assert.equal(snapshot().match.bestRally,3);
  until(s=>s.match.phase==='serve','the same server prepares from the odd-score court');
  assert.deepEqual(snapshot().match.ball,serveBall(0,1));
  tick(120);assert.equal(snapshot().match.phase,'serve','the next ball waits for a deliberate serve');

  function serveCurrent() {
    const m=snapshot().match,side=m.server,bottom=serveFromBottom(side,m.score[side]);
    const x=side===0?270:1650,y=bottom?720:360;
    const angle=side===0?(bottom?260:100):(bottom?280:80);
    const direction=(side===0)===bottom?1:-1;
    move(side,{x:side===0?650:1270,y:540});tick(); // move clear before changing facing
    move(side,{orientation:angle});tick(2);
    move(side,{x,y});tick();
    assert.equal(snapshot().match.phase,'serve','translation cannot start a serve');
    move(side,{orientation:angle+direction*2});tick();
    assert.equal(snapshot().match.phase,'rally');assert.equal(snapshot().match.lastHitter,side);
  }

  // A receiving rally win only transfers service. First the left player serves out;
  // then the right player does the same, restoring service without inventing points.
  for(const side of [0,1] as const){
    const m=snapshot().match;assert.equal(m.server,side);
    const bottom=serveFromBottom(side,m.score[side]),y=bottom?720:360;
    const angle=side===0?(bottom?260:100):(bottom?280:80);
    const direction=(side===0)===bottom?-1:1; // a backwards tangent
    move(side,{x:side===0?650:1270,y:540});tick();move(side,{orientation:angle});tick(2);
    move(side,{x:side===0?270:1650,y});tick();move(side,{orientation:angle+direction*2});tick();
    until(s=>s.match.phase==='point','a backwards serve goes out');
    assert.equal(snapshot().match.pointScored,false);assert.deepEqual(snapshot().match.score,[1,0]);
    assert.ok(texts.some(t=>t.includes('SIDE OUT')),'side out is communicated instead of +1');
    until(s=>s.match.phase==='serve','side out readies the new server');
    assert.equal(snapshot().match.server,1-side);
  }
  // Win the remaining ten points with actual legal alternating-court serves and missed returns.
  for(let expected=2;expected<=11;expected++){
    serveCurrent();
    until(s=>s.match.phase==='point'||s.match.phase==='over',`missed serve awards point ${expected}`);
    assert.deepEqual(snapshot().match.score,[expected,0]);assert.equal(snapshot().match.pointScored,true);
    if(expected<11)until(s=>s.match.phase==='serve','the scoring server keeps the serve');
  }
  assert.equal(snapshot().mode,'over');assert.equal(snapshot().match.winner,0);assert.equal(snapshot().match.bestRally,3);
  const result=snapshot();tick(600);
  assert.deepEqual(snapshot().match,result.match,'final score waits for a shared decision indefinitely');
  assert.equal(snapshot().placementCount,placementCount);

  const button=BUTTONS.rematch[0];tap(button.x+button.width/2,button.y+button.height/2);tick(2);
  assert.equal(snapshot().mode,'play');assert.equal(snapshot().match.phase,'serve');assert.deepEqual(snapshot().match.score,[0,0]);
  assert.equal(snapshot().match.bestRally,0);assert.equal(snapshot().placementCount,placementCount,'rematch preserves pieces without arrival effects');
  assert.deepEqual(snapshot().seats.map(s=>[s.sessionId,s.pieceId]),result.seats.map(s=>[s.sessionId,s.pieceId]));
  tick(30);assert.equal(snapshot().match.phase,'serve');

  // Real menu actions arrive while tracking is paused and all identities look absent.
  // Even a slow redetection (longer than the normal lift debounce) is not confirmation to reseat.
  const beforeSetup=snapshot();
  for(const pause of pauses)pause();tick(30);
  assert.equal(snapshot().running,false);
  (menuAction as (id:string)=>void)('setup');
  for(const resume of resumes)resume();tick(20); // 333 ms without contacts exceeds the 150 ms lift debounce
  assert.equal(snapshot().mode,'setup');
  assert.deepEqual(snapshot().seats.map(s=>[s.side,s.pieceId]),[[null,null],[null,null]]);
  for(let side=0;side<2;side++)poses[side]={...poses[side],id:newContactId()};
  batch!(poses.map(p=>contact(p,BoardContactPhase.Began)));tick(120);
  assert.equal(snapshot().mode,'setup','existing pieces cannot instantly restart after Change setup');
  assert.deepEqual(snapshot().seats.map(s=>[s.side,s.pieceId]),[[null,null],[null,null]]);
  assert.deepEqual(snapshot().match.score,[0,0]);
  assert.equal(snapshot().placementCount,beforeSetup.placementCount,'menu redetection is not a real replacement or a second splash');

  // Presence has now armed the lift requirement. Another menu epoch must disarm that evidence,
  // or its delayed redetection looks like a genuine lift and silently starts a fresh match.
  for(let cycle=0;cycle<2;cycle++){
    for(const pause of pauses)pause();tick(30);
    assert.equal(snapshot().running,false);
    for(const resume of resumes)resume();tick(20);
    assert.equal(snapshot().mode,'setup');
    for(let side=0;side<2;side++)poses[side]={...poses[side],id:newContactId()};
    batch!(poses.map(p=>contact(p,BoardContactPhase.Began)));tick(6);
    assert.equal(snapshot().mode,'setup','a repeated menu cannot confirm the required physical lift');
    assert.deepEqual(snapshot().seats.map(s=>[s.side,s.pieceId]),[[null,null],[null,null]]);
    assert.equal(snapshot().placementCount,beforeSetup.placementCount,'each resume preserves the same placement identities');
  }

  const leftPlayer=BUTTONS.leftPlayer[0];tap(leftPlayer.x+leftPlayer.width/2,leftPlayer.y+leftPlayer.height/2);
  for(let i=0;i<8;i++)await Promise.resolve();tick();
  assert.deepEqual(replacementRequests,[11],'setup replacement targets the roster session, not active profile -1');
  assert.equal(snapshot().seats[0].name,'New left human');assert.equal(snapshot().seats[0].sessionId,11);
  assert.equal(snapshot().seats[1].name,'Right human');assert.equal(snapshot().mode,'setup');

  // A real lift of the first piece confirms only that side; the other must still lift and replace.
  batch!([contact(poses[0],BoardContactPhase.Ended)]);tick(14);
  poses[0]={...poses[0],id:newContactId(),x:270,y:720,orientation:260};
  batch!([contact(poses[0],BoardContactPhase.Began)]);tick(3);
  assert.equal(snapshot().mode,'setup','one confirmation does not start a two-person match');
  assert.equal(snapshot().seats[0].side,0);assert.equal(snapshot().seats[1].side,null);
  batch!([contact(poses[1],BoardContactPhase.Ended)]);tick(14);
  poses[1]={...poses[1],id:newContactId(),x:1650,y:360,orientation:80};
  batch!([contact(poses[1],BoardContactPhase.Began)]);tick(3);
  assert.equal(snapshot().mode,'play');assert.equal(snapshot().match.phase,'serve');
  assert.deepEqual(snapshot().match.score,[0,0]);assert.equal(snapshot().match.rally,0);
  assert.deepEqual(snapshot().seats.map(s=>[s.sessionId,s.side,s.present]),[[11,0,true],[22,1,true]]);
  tick(30);assert.equal(snapshot().match.phase,'serve','setup replacement and re-placement do not launch the ball');
  assert.deepEqual(errors,[]);
});
