import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Board,BoardContactPhase,BoardContactType,BoardPlayerType,type BoardContact} from '@board.fun/web-sdk';
import {createMatch,serveBall,serveFromBottom,type Match,type Side} from '../src/pickleball';
import {ballDisplay} from '../src/ball-display';

// An assembled-game walk. Only normal SDK contact batches, clock ticks and menu callbacks
// control the game. The public snapshot is read-only evidence, never a test back door.
type Snapshot={mode:string;match:Match;placementCount:number;running:boolean;
  seats:{sessionId:number;name:string;side:Side|null;pieceId:number|null;present:boolean}[]};
type Pose={id:number;glyph:number;x:number;y:number;orientation:number};
const g=globalThis as unknown as Record<string,unknown>;
let now=1000,draws=0,nextFrame=1;
const frames=new Map<number,(ms:number)=>void>();
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
g.requestAnimationFrame=(callback:(ms:number)=>void)=>{const id=nextFrame++;frames.set(id,callback);return id;};
g.cancelAnimationFrame=(id:number)=>{frames.delete(id);};
g.document={title:'Twist Pickleball',hidden:false,fonts:{add(){},size:0,ready:Promise.resolve()},
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
let addRequests=0;
Object.assign(Board.session,{areServicesReady:()=>true,isReady:()=>true,getPlayers:()=>roster,getPlayerCount:()=>roster.length,
  getActiveProfile:()=>({...roster[0],sessionId:-1}),onPlayersChanged:(fn:Function)=>{rosterCallbacks.push(fn);return()=>{};},onActiveProfileChanged:()=>()=>{},
  setAIPlayerTypes(){throw new Error('A two-human game must not register AI');},presentAddPlayer:async()=>{addRequests++;return false;},
  presentReplacePlayer:async(sessionId:number)=>{
    replacementRequests.push(sessionId);
    const index=roster.findIndex(p=>p.sessionId===sessionId);if(index<0)return false;
    roster[index]={...roster[index],playerId:'replacement-human',name:'New left human'};
    for(const callback of [...rosterCallbacks])callback();return true;
  }});
const errors:unknown[]=[];
process.on('unhandledRejection',e=>errors.push(e));
const snapshot=():Snapshot=>win.TwistPickleballState;
function tick(count=1){
  for(let i=0;i<count;i++){
    now+=1000/60;const pending=[...frames.values()];frames.clear();texts.length=0;
    for(const next of pending)next(now);
    assert.ok(frames.size<=1,'pause/resume must never create concurrent animation loops');
  }
}
function until(predicate:(s:Snapshot)=>boolean,message:string,maxFrames=1800){
  for(let i=0;i<maxFrames;i++){if(predicate(snapshot()))return;tick();}
  assert.fail(`${message}; last state ${JSON.stringify(snapshot())}`);
}
let nextContact=100;
const poses:[Pose,Pose]=[
  {id:nextContact++,glyph:5,x:270,y:720,orientation:260},
  {id:nextContact++,glyph:5,x:1650,y:360,orientation:80},
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

export const newContactId=()=>nextContact++;
export {Board,BoardContactPhase,createMatch,serveBall,serveFromBottom,ballDisplay,draws,frames,texts,
  batch,pauses,resumes,roster,rosterCallbacks,replacementRequests,addRequests,errors,
  snapshot,tick,until,poses,contact,move,tap};
export type {Side};
