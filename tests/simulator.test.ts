import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {serveSetup} from '../src/pickleball';

// Run the real adapters at a small DOM boundary, including ordinary sensor wire frames.
function browser() {
  const elements:any[]=[],listeners=new Map<string,Function[]>();
  let now=0,frames:Function[]=[],playerChanges=0;
  class Element {
    style:Record<string,string>={};dataset:Record<string,string>={};children:any[]=[];
    attrs:Record<string,string>={};handlers=new Map<string,Function[]>();parent:Element|null=null;
    innerHTML='';textContent='';value='';tagName:string;className='';open=false;hidden=false;
    onclick?:Function;
    constructor(tag:string){this.tagName=tag.toUpperCase();elements.push(this);}
    setAttribute(k:string,v:any){this.attrs[k]=String(v);if(k==='data-board-sim')this.dataset.boardSim=String(v);}
    append(...children:any[]){for(const child of children){this.children.push(child);child.parent=this;}}
    appendChild(child:any){this.append(child);return child;}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;}
    addEventListener(type:string,cb:Function){this.handlers.set(type,[...(this.handlers.get(type)??[]),cb]);}
    querySelector(q:string){if(q==='.bs-label'||q==='.bs-menu'){const e=new Element('div');this.append(e);return e;}return null;}
    closest(q:string):Element|null{return q==='[data-board-sim]'&&this.dataset.boardSim!==undefined?this:this.parent?.closest(q)??null;}
    getBoundingClientRect(){return this.className==='tt-panel'?{left:0,top:570,width:1000,height:100}:{left:20,top:30,width:960,height:540};}
    setPointerCapture(){}
  }
  const body=new Element('body'),canvas=new Element('canvas');body.append(canvas);
  const document={body,documentElement:body,readyState:'complete',
    createElement:(tag:string)=>new Element(tag),createElementNS:(_ns:string,tag:string)=>new Element(tag),
    querySelector:(q:string)=>q==='#game'?canvas:q==='[data-board-sim="selector"]'?elements.find(e=>e.dataset.boardSim==='selector'&&e.parent):null,
    addEventListener(){},
  };
  const window:any={document,innerWidth:1000,innerHeight:670,performance:{now:()=>now},
    TwistPickleballState:{serveSetups:[serveSetup(0),serveSetup(1)]},
    __board:{onAppVisibility(){},onPauseResult(){},onPlayersChanged(){playerChanges++;},resolve(){},reject(){}},
    addEventListener:(type:string,cb:Function)=>listeners.set(type,[...(listeners.get(type)??[]),cb]),
    requestAnimationFrame:(cb:Function)=>{frames.push(cb);return frames.length;},location:{reload(){}},
  };
  const context=createContext({window,document,performance:window.performance,requestAnimationFrame:window.requestAnimationFrame,
    TextEncoder,MessageEvent,setTimeout,Date,console,fetch:async()=>({ok:false})});
  for(const file of ['browser-host.js','player-selector.js','pickleball-controls.js'])runInContext(readFileSync(`dev/${file}`,'utf8'),context);
  const dispatch=(type:string,props:any={})=>{
    const event={type,key:'',target:canvas,preventDefault(){},stopPropagation(){},...props};
    for(const cb of listeners.get(type)??[])cb(event);
    return event;
  };
  const tick=(count=1)=>{for(let i=0;i<count;i++){now+=1000/60;const batch=frames;frames=[];batch.forEach(cb=>cb(now));}};
  const click=(text:string)=>{
    const attached=(e:Element):boolean=>e===body||Boolean(e.parent&&attached(e.parent));
    const e=elements.find(e=>e.tagName==='BUTTON'&&e.textContent===text&&attached(e));assert.ok(e,`button ${text} exists`);e.onclick();
  };
  const eventFor=(target:any,pointerId:number,x:number,y:number)=>({pointerId,clientX:20+x/2,clientY:30+y/2,currentTarget:target,target,preventDefault(){},stopPropagation(){}});
  return {window,sim:window.BoardSDK.__sim,api:window.TwistPickleballSim,dispatch,tick,elements,canvas,click,eventFor,get playerChanges(){return playerChanges;}};
}

test('each side explicitly places one Sports piece; duplicate glyphs remain separate',()=>{
  const b=browser(),left=b.api.placeForSide(0,5),right=b.api.placeForSide(1,5);b.tick();
  assert.notEqual(left,right);assert.equal(b.api.pieces().length,2);
  assert.equal(b.api.pieces()[0].x,serveSetup(0).x);assert.equal(b.api.pieces()[0].y,720);assert.equal(b.api.pieces()[0].orientation,260);
  assert.equal(b.api.pieces()[1].x,serveSetup(1).x);assert.equal(b.api.pieces()[1].orientation,80);
  assert.equal(b.api.placeForSide(0,3),left,'placing an occupied side does not silently replace its piece');
  assert.equal(b.api.lift(left),true);assert.equal(b.api.pieces().length,1);assert.equal(b.api.pieces()[0].id,right);
  assert.equal(b.api.placeForSide(0,3)!==null,true);
});

test('both players move and rotate simultaneously with independent power keys',()=>{
  const b=browser(),left=b.api.placeForSide(0),right=b.api.placeForSide(1);b.tick();
  for(const code of ['KeyD','KeyW','KeyE','ArrowLeft','ArrowDown','Period','ShiftRight'])b.dispatch('keydown',{code});
  b.tick(15);
  const l=b.api.pieces().find((p:any)=>p.id===left),r=b.api.pieces().find((p:any)=>p.id===right);
  assert.ok(l.x>serveSetup(0).x&&l.y<720);assert.ok(r.x<serveSetup(1).x&&r.y>360);
  assert.ok(Math.abs(l.orientation-305)<1e-8);assert.ok(Math.abs(r.orientation-200)<1e-8);
  assert.ok(Math.abs(Math.hypot(l.x-serveSetup(0).x,l.y-720)-100)<1e-8,'diagonal movement is normalized');
  for(const code of ['KeyD','KeyW','KeyE','ArrowLeft','ArrowDown','Period','ShiftRight'])b.dispatch('keyup',{code});
  b.tick(5);assert.equal(b.api.pieces().find((p:any)=>p.id===left).orientation,l.orientation);
});

test('keyboard and pointer movement stay in the assigned half',()=>{
  const b=browser(),left=b.api.placeForSide(0),right=b.api.placeForSide(1);b.tick();
  b.dispatch('keydown',{code:'KeyD'});b.dispatch('keydown',{code:'ArrowLeft'});b.tick(300);
  assert.equal(b.api.pieces().find((p:any)=>p.id===left).x,850);
  assert.equal(b.api.pieces().find((p:any)=>p.id===right).x,1070);
});

test('two touch pointers can twist both pieces independently with no jump when grabbed',()=>{
  const b=browser(),left=b.api.placeForSide(0),right=b.api.placeForSide(1);b.tick();
  const handles=b.elements.filter(e=>(e.attrs['aria-label']??'').includes('rotation handle'));
  const leftHome=serveSetup(0),rightHome=serveSetup(1);
  const first=b.eventFor(handles[0],1,leftHome.x-140,leftHome.y),second=b.eventFor(handles[1],2,rightHome.x-140,rightHome.y);
  handles[0].handlers.get('pointerdown')[0](first);handles[1].handlers.get('pointerdown')[0](second);
  assert.equal(b.api.pieces().find((p:any)=>p.id===left).orientation,260);
  assert.equal(b.api.pieces().find((p:any)=>p.id===right).orientation,80);
  b.dispatch('pointermove',b.eventFor(handles[0],1,leftHome.x,leftHome.y-140));
  b.dispatch('pointermove',b.eventFor(handles[1],2,rightHome.x,rightHome.y+140));
  assert.equal(b.api.pieces().find((p:any)=>p.id===left).orientation,350);
  assert.equal(b.api.pieces().find((p:any)=>p.id===right).orientation,350);
  b.dispatch('pointerup',first);assert.equal(b.api.isDragging,true);
  b.dispatch('pointercancel',second);assert.equal(b.api.isDragging,false);
});

test('native-like mouse coordinates scale to the canvas and controls do not inject fingers',()=>{
  const b=browser();b.dispatch('pointerdown',{pointerId:1,clientX:270,clientY:385,shiftKey:true});b.tick();
  assert.equal(b.sim.contacts()[0].x,500);assert.equal(b.sim.contacts()[0].y,710);
  const control=b.elements.find(e=>e.dataset.boardSim==='pickleball');
  b.dispatch('pointerdown',{pointerId:2,clientX:200,clientY:100,target:control});
  assert.equal(b.sim.contacts().length,1);assert.equal(b.api.sides[0],b.sim.contacts()[0].id);
});

test('pause freezes both pieces and recovers same-glyph sides under new contact IDs',()=>{
  const b=browser(),left=b.api.placeForSide(0,5),right=b.api.placeForSide(1,5);b.tick();
  b.dispatch('keydown',{code:'KeyE'});b.dispatch('keydown',{code:'Period'});b.tick(2);
  const before=b.api.pieces();b.dispatch('keydown',{key:'p',code:'KeyP'});b.tick(5);
  assert.equal(b.sim.menuOpen,true);assert.equal(b.api.move(left,700,700,180),false);
  b.dispatch('keydown',{key:'p',code:'KeyP'});b.tick(10);
  const after=b.api.pieces(),ids=b.api.sides;
  assert.notEqual(ids[0],left);assert.notEqual(ids[1],right);
  assert.equal(after.find((p:any)=>p.id===ids[0]).x,serveSetup(0).x);assert.equal(after.find((p:any)=>p.id===ids[1]).x,serveSetup(1).x);
  b.tick(30);
  assert.equal(b.api.pieces().find((p:any)=>p.x===serveSetup(0).x).orientation,before.find((p:any)=>p.x===serveSetup(0).x).orientation);
  assert.equal(b.api.pieces().find((p:any)=>p.x===serveSetup(1).x).orientation,before.find((p:any)=>p.x===serveSetup(1).x).orientation);
});

test('blur clears held keyboard motion and all active touch drags',()=>{
  const b=browser();b.api.placeForSide(0);b.tick();b.dispatch('keydown',{code:'KeyE'});b.tick(2);
  const handle=b.elements.find(e=>(e.attrs['aria-label']??'').includes('rotation handle'));
  handle.handlers.get('pointerdown')[0](b.eventFor(handle,1,130,720));
  b.dispatch('blur');assert.equal(b.api.isDragging,false);
  const angle=b.api.pieces()[0].orientation;b.tick(30);assert.equal(b.api.pieces()[0].orientation,angle);
});

test('placing a piece never creates a roster player; selector requires a human choice',()=>{
  const b=browser(),host=b.window.BoardSDK;
  const before=JSON.parse(host.getPlayers()).length;
  b.api.placeForSide(0);b.api.placeForSide(1);b.tick();assert.equal(JSON.parse(host.getPlayers()).length,before);
  b.click('Add second player');assert.equal(JSON.parse(host.getPlayers()).length,before);
  b.click('Cancel');assert.equal(JSON.parse(host.getPlayers()).length,before);
  b.click('Add second player');b.click('Player 2 · Local player');
  assert.equal(JSON.parse(host.getPlayers()).length,2);assert.ok(b.playerChanges>=1);
  b.click('Add second player');assert.ok(b.elements.some(e=>e.textContent==='Two players are already seated.'));
});

test('browser canvas preserves its aspect ratio and leaves space below for controls',()=>{
  const b=browser();b.tick();
  const width=parseFloat(b.canvas.style.width),height=parseFloat(b.canvas.style.height),top=parseFloat(b.canvas.style.top);
  assert.equal(width/height,16/9);assert.ok(top+height<=570);
});

test('web build inserts adapters only into the standalone web output',()=>{
  const source=readFileSync('scripts/build-web.mjs','utf8');
  assert.match(source,/web-dist/);assert.match(source,/pickleball-controls\.js/);
  const vite=readFileSync('vite.config.ts','utf8');assert.match(vite,/apply: "serve"/);
  const pack=readFileSync('scripts/pack.mjs','utf8');assert.doesNotMatch(pack,/pickleball-controls\.js/);
});
