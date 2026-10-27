import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Board,BoardContactPhase,BoardContactType,BoardPlayerType,type BoardContact} from '@board.fun/web-sdk';
import type {Match,Side} from '../src/tennis';

// An assembled-game walk. Only normal SDK contact batches, clock ticks and menu callbacks
// control the game. The public snapshot is read-only evidence, never a test back door.
type Snapshot={mode:string;match:Match;placementCount:number;running:boolean;
  seats:{sessionId:number;name:string;side:Side|null;pieceId:number|null;present:boolean}[]};
type Pose={id:number;glyph:number;x:number;y:number;orientation:number};
const g=globalThis as unknown as Record<string,unknown>;
let now=1000,raf:((ms:number)=>void)|null=null,draws=0;
const texts:string[]=[];
const recorder=()=>new Proxy({}as Record<string,unknown>,{
  get(state,key){
    if(typeof key!=='string')return undefined;
    if(key==='canvas')return {width:1920,height:1080};
    if(key in state)return state[key];
    return (...args:unknown[])=>{
      draws++;
      if(key==='fillText')texts.push(String(args[0]));
      if(key==='measureText'){
        const width=String(args[0]).length*.6*(parseFloat(String(state.font))||32);
        return {width,actualBoundingBoxAscent:30,actualBoundingBoxDescent:8,actualBoundingBoxLeft:0,actualBoundingBoxRight:width};
      }
      if(key==='getTransform')return {a:1,b:0,c:0,d:1,e:0,f:0};
      return {addColorStop(){}};
    };
  },
  set(state,key,value){if(typeof key==='string')state[key]=value;return true;},
});
const listeners:[string,Function][]=[];
const listen=(type:string,fn:Function)=>listeners.push([type,fn]);
const fakeCanvas=()=>({width:0,height:0,style:{},getContext:()=>recorder(),
  getBoundingClientRect:()=>({left:0,top:0,width:1920,height:1080}),addEventListener:listen,removeEventListener(){}});
const param=()=>({value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
const audioNode=()=>({connect(){},disconnect(){},start(){},stop(){},gain:param(),frequency:param(),detune:param(),Q:param()});
Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
g.requestAnimationFrame=(callback:(ms:number)=>void)=>{raf=callback;return 1;};
g.cancelAnimationFrame=()=>{raf=null;};
g.document={title:'Twist Tennis',hidden:false,fonts:{add(){},size:0,ready:Promise.resolve()},
  querySelector:()=>fakeCanvas(),createElement:()=>fakeCanvas(),addEventListener:listen,removeEventListener(){}};
g.FontFace=class{load(){return Promise.resolve(this);}};
g.AudioContext=class{
  state='running';sampleRate=48000;currentTime=0;destination={};
  createGain(){return audioNode();}createOscillator(){return audioNode();}createBiquadFilter(){return audioNode();}createBufferSource(){return audioNode();}
  createBuffer(_channels:number,length:number,sampleRate:number){return {length,sampleRate,getChannelData:()=>new Float32Array(length)};}
  decodeAudioData(){return Promise.resolve(this.createBuffer(1,1,48000));}
  addEventListener(){}resume(){return Promise.resolve();}suspend(){return Promise.resolve();}
};
g.fetch=async(url:string)=>{
  try{
    const body=readFileSync(`public/${String(url).split('?')[0].replace(/^\.?\//,'')}`);
    return {ok:true,status:200,json:async()=>JSON.parse(body.toString()),text:async()=>body.toString(),
      arrayBuffer:async()=>body.buffer.slice(body.byteOffset,body.byteOffset+body.byteLength)};
  }catch{return {ok:false,status:404,json:async()=>null,text:async()=>'',arrayBuffer:async()=>new ArrayBuffer(0)};}
};
const win:any={addEventListener:listen,removeEventListener(){},devicePixelRatio:1,BoardSDK:{__simulated:true}};
g.window=win;
let batch:((contacts:readonly BoardContact[])=>void)|null=null;
const pauses:Function[]=[],resumes:Function[]=[];
Object.assign(Board.input,{subscribe:(fn:typeof batch)=>{batch=fn;},unsubscribe:()=>{batch=null;},getActiveModel:()=> 'model.tflite'});
Object.assign(Board.application,{onPause:(fn:Function)=>{pauses.push(fn);return()=>{};},onResume:(fn:Function)=>{resumes.push(fn);return()=>{};}});
const roster=[
  {playerId:'local-left',sessionId:11,name:'Left human',type:BoardPlayerType.Profile,avatarId:'0'},
  {playerId:'local-right',sessionId:22,name:'Right human',type:BoardPlayerType.Guest,avatarId:'0'},
];
const rosterCallbacks:Function[]=[],replacementRequests:number[]=[];
Object.assign(Board.session,{areServicesReady:()=>true,isReady:()=>true,getPlayers:()=>roster,getPlayerCount:()=>roster.length,
  getActiveProfile:()=>({...roster[0],sessionId:-1}),onPlayersChanged:(fn:Function)=>{rosterCallbacks.push(fn);return()=>{};},onActiveProfileChanged:()=>()=>{},
  setAIPlayerTypes(){throw new Error('A two-human game must not register AI');},presentAddPlayer:async()=>false,
  presentReplacePlayer:async(sessionId:number)=>{
    replacementRequests.push(sessionId);
    const index=roster.findIndex(p=>p.sessionId===sessionId);if(index<0)return false;
    roster[index]={...roster[index],playerId:'replacement-human',name:'New left human'};
    for(const callback of [...rosterCallbacks])callback();return true;
  }});
const errors:unknown[]=[];
process.on('unhandledRejection',e=>errors.push(e));
const snapshot=():Snapshot=>win.TwistTennisState;
function tick(count=1){
  for(let i=0;i<count;i++){
    now+=1000/60;const next=raf;raf=null;texts.length=0;if(next)next(now);
  }
}
function until(predicate:(s:Snapshot)=>boolean,message:string,maxFrames=1800){
  for(let i=0;i<maxFrames;i++){if(predicate(snapshot()))return;tick();}
  assert.fail(`${message}; last state ${JSON.stringify(snapshot())}`);
}
let nextContact=100;
const poses:[Pose,Pose]=[
  {id:nextContact++,glyph:5,x:500,y:710,orientation:270},
  {id:nextContact++,glyph:5,x:1420,y:370,orientation:90},
];
function contact(p:Pose,phase=BoardContactPhase.Moved):BoardContact{
  return {contactId:p.id,glyphId:p.glyph,x:p.x,y:p.y,orientation:p.orientation,phase,type:BoardContactType.Glyph,isTouched:true}as BoardContact;
}
function move(side:Side,patch:Partial<Omit<Pose,'id'|'glyph'>>){Object.assign(poses[side],patch);batch!([contact(poses[side])]);}
function tap(x:number,y:number){
  const id=nextContact++;
  batch!([{contactId:id,glyphId:0,x,y,orientation:0,phase:BoardContactPhase.Began,type:BoardContactType.Finger,isTouched:true}as BoardContact]);
  tick();
  batch!([{contactId:id,glyphId:0,x,y,orientation:0,phase:BoardContactPhase.Ended,type:BoardContactType.Finger,isTouched:false}as BoardContact]);
}

test('assembled game plays a real two-human match, survives repeated menu epochs, and waits for rematch',async()=>{
  await import('../src/runtime');
  let menuAction:((id:string)=>void)|null=null;
  Object.assign(BoardPlatform.menu,{onButton:(callback:(id:string)=>void)=>{menuAction=callback;return()=>{};}});
  await import('../src/main');
  for(let i=0;i<30&&!raf;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(raf,'game finishes its asynchronous font/geometry startup');
  tick(4);assert.equal(snapshot().mode,'title');assert.ok(draws>5);
  batch!([contact(poses[0],BoardContactPhase.Began)]);tick(2);
  assert.equal(snapshot().mode,'setup');assert.equal(snapshot().placementCount,1);
  batch!([contact(poses[1],BoardContactPhase.Began)]);tick(3);
  assert.equal(snapshot().mode,'play');assert.equal(snapshot().match.phase,'serve');
  assert.deepEqual(snapshot().seats.map(s=>[s.sessionId,s.side,s.present]),[[11,0,true],[22,1,true]]);
  assert.equal(snapshot().placementCount,2,'same-glyph contacts have independent real identities');
  tick(30);assert.equal(snapshot().match.phase,'serve','stationary overlapping racket cannot serve itself');

  move(0,{orientation:272});tick();
  assert.equal(snapshot().match.phase,'rally');assert.equal(snapshot().match.lastHitter,0);
  assert.ok(snapshot().match.ball.vx>0);assert.equal(snapshot().match.rally,1);

  // Help is a view of the same rally. Moving or twisting while it is open carries no strike intent back.
  const {BUTTONS}=await import('../src/view');
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
    for(let side=0;side<2;side++)poses[side]={...poseBefore[side],id:nextContact++};
    batch!(poses.map(p=>contact(p,BoardContactPhase.Began)));tick(2);
    const after=snapshot();assert.equal(after.running,true);assert.equal(after.placementCount,2,'redetection has no second splash');
    assert.deepEqual(after.seats.map(s=>s.pieceId),before.seats.map(s=>s.pieceId),'ownership survives fresh native IDs');
    assert.equal(after.match.rally,1,'menu return never invents another swing');assert.deepEqual(after.match.score,[0,0]);
  }

  until(s=>s.match.crossedNet&&s.match.ball.x>=1380,'serve reaches the right receiver');
  let b=snapshot().match.ball;
  move(1,{x:b.x+5,y:b.y-170,orientation:90});tick();
  assert.equal(snapshot().match.rally,1,'sliding the receiving line over the moving ball is not a hit');
  move(1,{orientation:92});tick();
  assert.equal(snapshot().match.lastHitter,1);assert.equal(snapshot().match.rally,2);assert.ok(snapshot().match.ball.vx<0);
  move(0,{orientation:270});tick(); // prepare the next swing while the ball is still far away

  until(s=>s.match.crossedNet&&s.match.ball.x<=580,'return reaches the left receiver');
  b=snapshot().match.ball;move(0,{x:b.x-5,y:b.y+170,orientation:270});tick();
  assert.equal(snapshot().match.rally,2);move(0,{orientation:272});tick();
  assert.equal(snapshot().match.lastHitter,0);assert.equal(snapshot().match.rally,3);assert.ok(snapshot().match.ball.vx>0);
  until(s=>s.match.groundBounces===1,'the missed return lands once and rebounds');
  assert.equal(snapshot().match.phase,'rally');assert.equal(snapshot().match.receiver,1);
  assert.deepEqual(snapshot().match.score,[0,0],'first ground bounce gives a recovery chance');
  assert.ok(snapshot().match.ball.vz>0,'first ground bounce launches a new visible arc');
  until(s=>s.match.phase==='point','a second ground bounce without a return awards a point');
  assert.deepEqual(snapshot().match.score,[1,0]);assert.equal(snapshot().match.groundBounces,2);
  assert.equal(snapshot().match.server,1);assert.equal(snapshot().match.bestRally,3);
  until(s=>s.match.phase==='serve','point announcement ends at the conceding player serve');
  assert.equal(snapshot().match.ball.x,1420);assert.equal(snapshot().match.ball.y,540);
  tick(120);assert.equal(snapshot().match.phase,'serve','next point waits for an intentional serve');

  // Earn the remaining points through normal serves and returns. The right player serves,
  // the left player returns, and the right player lets the ball land twice.
  for(let expected=2;expected<=7;expected++){
    assert.equal(snapshot().match.phase,'serve');
    move(1,{x:1420,y:240});tick(); // translate clear without twisting an overlapping line
    move(1,{orientation:90});tick(2); // prepare the angle away from the serve ball
    move(1,{y:370});tick(); // slide into contact without rotation
    assert.equal(snapshot().match.phase,'serve','placement by translation cannot strike');
    move(1,{orientation:92});tick();
    assert.equal(snapshot().match.phase,'rally');assert.equal(snapshot().match.lastHitter,1);assert.ok(snapshot().match.ball.vx<0);
    move(0,{orientation:270});tick(); // prepare at the opposite end while the serve is far away
    until(s=>s.match.crossedNet&&s.match.ball.x<=580,`serve ${expected} reaches the left receiver`);
    b=snapshot().match.ball;move(0,{x:b.x-5,y:b.y+170,orientation:270});tick();
    move(0,{orientation:272});tick();
    assert.equal(snapshot().match.lastHitter,0);assert.equal(snapshot().match.rally,2);
    assert.equal(snapshot().match.groundBounces,0,'a fresh return resets the ground-bounce count');
    until(s=>s.match.phase==='point'||s.match.phase==='over',`the missed return awards point ${expected}`);
    assert.deepEqual(snapshot().match.score,[expected,0]);
    if(expected<7)until(s=>s.match.phase==='serve','following serve becomes ready');
  }
  assert.equal(snapshot().mode,'over');assert.equal(snapshot().match.winner,0);assert.equal(snapshot().match.bestRally,3);
  const result=snapshot();tick(600);
  assert.deepEqual(snapshot().match,result.match,'final score waits for a shared decision indefinitely');
  assert.equal(snapshot().placementCount,2);

  const button=BUTTONS.rematch[0];tap(button.x+button.width/2,button.y+button.height/2);tick(2);
  assert.equal(snapshot().mode,'play');assert.equal(snapshot().match.phase,'serve');assert.deepEqual(snapshot().match.score,[0,0]);
  assert.equal(snapshot().match.bestRally,0);assert.equal(snapshot().placementCount,2,'rematch preserves pieces without arrival effects');
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
  for(let side=0;side<2;side++)poses[side]={...poses[side],id:nextContact++};
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
    for(let side=0;side<2;side++)poses[side]={...poses[side],id:nextContact++};
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
  poses[0]={...poses[0],id:nextContact++,x:500,y:710,orientation:270};
  batch!([contact(poses[0],BoardContactPhase.Began)]);tick(3);
  assert.equal(snapshot().mode,'setup','one confirmation does not start a two-person match');
  assert.equal(snapshot().seats[0].side,0);assert.equal(snapshot().seats[1].side,null);
  batch!([contact(poses[1],BoardContactPhase.Ended)]);tick(14);
  poses[1]={...poses[1],id:nextContact++,x:1420,y:370,orientation:90};
  batch!([contact(poses[1],BoardContactPhase.Began)]);tick(3);
  assert.equal(snapshot().mode,'play');assert.equal(snapshot().match.phase,'serve');
  assert.deepEqual(snapshot().match.score,[0,0]);assert.equal(snapshot().match.rally,0);
  assert.deepEqual(snapshot().seats.map(s=>[s.sessionId,s.side,s.present]),[[11,0,true],[22,1,true]]);
  tick(30);assert.equal(snapshot().match.phase,'serve','setup replacement and re-placement do not launch the ball');
  assert.deepEqual(errors,[]);
});
