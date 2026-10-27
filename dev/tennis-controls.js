// Browser-only stand-ins for two physical Sports pieces. Every move enters through SDK contacts.
(() => {
  const host = window.BoardSDK;
  if (!host?.__simulated || !host.__sim?.contacts) return;
  const sim = host.__sim, svgNS = 'http://www.w3.org/2000/svg';
  const names = ['Baseball', 'Hockey', 'Cyclist', 'Soccer', 'Tennis', 'Football', 'Swimmer', 'Basketball'];
  const homes = [{ x:500,y:710,orientation:270 }, { x:1420,y:370,orientation:90 }];
  const bindings = [
    { up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',ccw:'KeyQ',cw:'KeyE',power:'ShiftLeft' },
    { up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',ccw:'Comma',cw:'Period',power:'ShiftRight' },
  ];
  const controlKeys = new Set(bindings.flatMap(binding => Object.values(binding)));
  const keys = new Set(), drags = new Map(), views = new Map();
  const sides = [null,null], previous = [null,null], choices = [], placeButtons = [];
  let nextId = 1000, selected = null, lastAt = 0, footprints = null, wasBlocked = false;
  const normal = angle => ((angle % 360) + 360) % 360;
  const delta = (a,b) => ((a-b+540)%360)-180;
  const contacts = () => sim.contacts().filter(c => c.glyph > 0);
  const current = id => contacts().find(c => c.id === id);
  const blocked = () => sim.menuOpen || sim.redetecting || Boolean(document.querySelector('[data-board-sim="selector"]'));
  const put = (piece,phase=2,touched=true) => sim.emit([{ id:piece.id,glyph:piece.glyph,x:piece.x,y:piece.y,orientation:normal(piece.orientation),phase,touched }]);
  const consume = event => { event.preventDefault();event.stopPropagation(); };
  const node = (tag,attrs={}) => {
    const el = document.createElementNS(svgNS,tag);
    for (const [name,value] of Object.entries(attrs)) el.setAttribute(name,value);
    return el;
  };
  const button = (label,action) => {
    const el = document.createElement('button');el.textContent=label;el.onclick=action;el.type='button';return el;
  };
  const root = document.createElement('div');root.dataset.boardSim='tennis';
  const style = document.createElement('style');
  style.textContent = `
    [data-board-sim="tennis"]{position:fixed;inset:0;pointer-events:none;z-index:2147483645;color:#f5efdb;font:14px system-ui,sans-serif}
    [data-board-sim="tennis"] .tt-panel{position:absolute;bottom:0;left:0;right:0;box-sizing:border-box;padding:9px 18px 12px;background:#082d31;border-top:1px solid #ffffff24;pointer-events:auto}
    [data-board-sim="tennis"] summary{cursor:pointer;font-weight:750;min-height:24px;line-height:24px;max-width:1080px;margin:auto}
    [data-board-sim="tennis"] .tt-content{max-width:1080px;margin:8px auto 0;display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:center}
    [data-board-sim="tennis"] .tt-side{border-left:3px solid #f18c72;padding-left:12px}
    [data-board-sim="tennis"] .tt-side.right{border-color:#e8dfb6}
    [data-board-sim="tennis"] .tt-instructions{font-size:13px;line-height:1.5;margin:4px 0 7px;color:#d4dfd3}
    [data-board-sim="tennis"] .tt-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    [data-board-sim="tennis"] button,[data-board-sim="tennis"] select{font:inherit;color:#103f42;background:#f5efdb;border:0;border-radius:6px;padding:7px 10px;cursor:pointer;min-height:34px}
    [data-board-sim="tennis"] button:focus-visible,[data-board-sim="tennis"] select:focus-visible{outline:3px solid #d9ee6d;outline-offset:3px}
    [data-board-sim="tennis"] .tt-global{font-size:12px;line-height:1.6;color:#bdcfc7}
    [data-board-sim="tennis"] .tt-status{margin:5px 0 0;font-size:12px;min-height:18px}
    @media(max-width:760px){[data-board-sim="tennis"] .tt-panel{padding:6px 10px 8px}[data-board-sim="tennis"] .tt-content{grid-template-columns:1fr 1fr;gap:8px}[data-board-sim="tennis"] .tt-global{grid-column:1/-1}[data-board-sim="tennis"] .tt-instructions{font-size:12px}[data-board-sim="tennis"] button,[data-board-sim="tennis"] select{padding:6px}}
  `;
  const surface = node('svg',{viewBox:'0 0 1920 1080',preserveAspectRatio:'none','aria-label':'Two virtual Sports pieces'});
  Object.assign(surface.style,{position:'fixed',overflow:'visible',touchAction:'none',pointerEvents:'none'});
  const panel = document.createElement('details');panel.className='tt-panel';panel.open=true;
  const summary = document.createElement('summary');summary.textContent='Browser controls · two players, one screen';panel.append(summary);
  const content = document.createElement('div');content.className='tt-content';panel.append(content);
  for (let side=0;side<2;side++) {
    const card = document.createElement('div');card.className=`tt-side${side?' right':''}`;
    const title = document.createElement('strong');title.textContent=side?'RIGHT PLAYER':'LEFT PLAYER';card.append(title);
    const hint = document.createElement('p');hint.className='tt-instructions';
    hint.textContent=side?'Arrows move · , / . twist · Right Shift hits harder':'WASD move · Q / E twist · Left Shift hits harder';card.append(hint);
    const row=document.createElement('div');row.className='tt-row';
    const choice=document.createElement('select');choice.setAttribute('aria-label',`${side?'Right':'Left'} Sports piece`);
    names.forEach((name,index)=>{const option=document.createElement('option');option.value=String(index+1);option.textContent=name;choice.append(option);});
    choice.value=side?'1':'5';choices.push(choice);row.append(choice);
    const place=button('Place piece',()=>api.placeForSide(side,Number(choice.value)));placeButtons.push(place);row.append(place);
    row.append(button('Lift',()=>api.lift(sides[side])));card.append(row);content.append(card);
  }
  const global=document.createElement('div');global.className='tt-global';
  global.append(button('Add second player',()=>{if(!blocked())host.presentAddPlayerSelector();}));
  const tip=document.createElement('div');tip.textContent='Drag a piece to move. Drag its white handle to twist. P: pause.';global.append(tip);
  const status=document.createElement('p');status.className='tt-status';global.append(status);content.append(global);
  root.append(style,surface,panel);

  // Reconcile fresh host contact IDs after menu redetection, without swapping equal-glyph players.
  function reconcile() {
    const all=contacts(),used=new Set();
    for(let side=0;side<2;side++) {
      const same=all.find(p=>p.id===sides[side]);
      if(same){previous[side]={...same};used.add(same.id);}
      else sides[side]=null;
    }
    for(let side=0;side<2;side++) {
      if(sides[side]!==null||!previous[side])continue;
      const old=previous[side];
      const match=all.filter(p=>!used.has(p.id)&&p.glyph===old.glyph&&Math.hypot(p.x-old.x,p.y-old.y)<140)
        .sort((a,b)=>Math.hypot(a.x-old.x,a.y-old.y)-Math.hypot(b.x-old.x,b.y-old.y))[0];
      if(match){sides[side]=match.id;previous[side]={...match};used.add(match.id);}
    }
    // Contacts made by the base host (shift-drag) can also be controlled with the keyboard.
    for(const piece of all) {
      if(used.has(piece.id))continue;
      const side=piece.x<960?0:1;
      if(sides[side]===null){sides[side]=piece.id;previous[side]={...piece};used.add(piece.id);}
    }
    if(selected!==null&&!all.some(p=>p.id===selected))selected=sides.find(id=>id!==null)??null;
  }
  const api = {
    place(glyph=5,x,y,orientation,requestedSide) {
      if(blocked())return null;
      reconcile();
      const side=requestedSide===0||requestedSide===1?requestedSide:Number.isFinite(x)?(x<960?0:1):sides[0]===null?0:1;
      if(sides[side]!==null){selected=sides[side];return sides[side];}
      if(contacts().length>=2)return null;
      const home=homes[side];
      glyph=Math.max(1,Math.min(8,Math.trunc(glyph)));
      if(!Number.isFinite(glyph))return null;
      nextId=Math.max(nextId,...contacts().map(p=>p.id+1));
      const piece={id:nextId++,glyph,x:x??home.x,y:y??home.y,orientation:orientation??home.orientation};
      if(![piece.x,piece.y,piece.orientation].every(Number.isFinite))return null;
      put(piece,1,false);sides[side]=piece.id;previous[side]={...piece};selected=piece.id;return piece.id;
    },
    placeForSide(side,glyph=side?1:5){return side===0||side===1?api.place(glyph,undefined,undefined,undefined,side):null;},
    move(id,x,y,orientation,touched=false) {
      const piece=current(id);if(!piece||blocked()||![x,y,orientation].every(Number.isFinite))return false;
      put({...piece,x,y,orientation},2,touched);return true;
    },
    lift(id=selected) {
      const piece=current(id);if(!piece||blocked())return false;
      put(piece,3,false);const side=sides.indexOf(id);if(side>=0){sides[side]=null;previous[side]=null;}
      if(selected===id)selected=null;
      for(const [pointer,drag]of drags)if(drag.id===id)drags.delete(pointer);
      return true;
    },
    pieces:()=>contacts(),
    select(id){if(!current(id))return false;selected=id;return true;},
    get selected(){return selected;},
    get sides(){reconcile();return [...sides];},
    get isDragging(){return drags.size>0;},
  };
  window.TwistTennisSim=api;
  const clientPoint = event => {
    const r=document.querySelector('#game')?.getBoundingClientRect()??surface.getBoundingClientRect();
    return {x:(event.clientX-r.left)*1920/r.width,y:(event.clientY-r.top)*1080/r.height};
  };
  function endDrag(pointerId) {
    const drag=drags.get(pointerId);if(!drag)return;
    const piece=current(drag.id);if(piece&&!blocked())put(piece,2,false);
    drags.delete(pointerId);
  }
  function releaseControls() {
    keys.clear();for(const id of [...drags.keys()])endDrag(id);
  }
  function startDrag(event,id,kind) {
    if(blocked()||[...drags.values()].some(d=>d.id===id))return;
    const piece=current(id);if(!piece)return;
    consume(event);selected=id;
    const at=clientPoint(event);
    drags.set(event.pointerId,{id,kind,offsetX:at.x-piece.x,offsetY:at.y-piece.y,
      angle:Math.atan2(at.y-piece.y,at.x-piece.x)*180/Math.PI,orientation:piece.orientation});
    put(piece,2,true);event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function drawPiece(piece) {
    let view=views.get(piece.id);
    if(!view) {
      const group=node('g',{'data-piece-id':piece.id});
      const body=node('g',{role:'button',tabindex:'0','aria-label':`${names[piece.glyph-1]} piece: drag to move`});
      body.style.cssText='pointer-events:all;cursor:grab;touch-action:none';
      const shape=node('path',{fill:'#f18c72',stroke:'#163b3f','stroke-width':'5'});
      const face=node('path',{d:'M 39 -18 Q 57 0 39 18 M 20 -20 L 26 -20 M 20 20 L 26 20',fill:'none',stroke:'#163b3f','stroke-width':'6','stroke-linecap':'round'});
      const front=node('path',{d:'M 57 -11 L 72 0 L 57 11 Z',fill:'#fff9e9',stroke:'#163b3f','stroke-width':'3'});
      const label=node('text',{x:'-16',y:'14','text-anchor':'middle',fill:'#163b3f','font-family':'system-ui,sans-serif','font-size':'36','font-weight':'800'});
      body.append(shape,face,front,label);
      body.addEventListener('pointerdown',e=>startDrag(e,piece.id,'move'));
      body.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){consume(e);selected=piece.id;}});
      const handle=node('g',{role:'button',tabindex:'0','aria-label':`${names[piece.glyph-1]} rotation handle: drag to twist`});
      handle.style.cssText='pointer-events:all;cursor:crosshair;touch-action:none';
      handle.append(node('path',{d:'M -75 0 L -140 0',stroke:'#fff9e9','stroke-width':'4','stroke-dasharray':'7 7'}));
      handle.append(node('circle',{cx:'-140',cy:'0',r:'60',fill:'transparent'}));
      handle.append(node('circle',{cx:'-140',cy:'0',r:'27',fill:'#fff9e9',stroke:'#163b3f','stroke-width':'4'}));
      handle.append(node('path',{d:'M -148 8 A 11 11 0 1 1 -130 5 M -130 -3 L -130 6 L -139 5',fill:'none',stroke:'#163b3f','stroke-width':'3.5','stroke-linecap':'round','stroke-linejoin':'round'}));
      handle.addEventListener('pointerdown',e=>startDrag(e,piece.id,'turn'));
      group.append(handle,body);surface.append(group);view={group,shape,label,handle};views.set(piece.id,view);
    }
    const side=sides.indexOf(piece.id);
    view.group.setAttribute('transform',`translate(${piece.x} ${piece.y}) rotate(${piece.orientation})`);
    view.shape.setAttribute('fill',side===1?'#e8dfb6':'#f18c72');view.label.textContent=side===1?'R':'L';
    const shape=footprints?.pieces[String(piece.glyph)];
    view.shape.setAttribute('d',shape?shape.outlineMm.map(([x,y],i)=>`${i?'L':'M'}${-y*3.6},${-x*3.6}`).join(' ')+' Z':'M 65 0 C 65 78 -66 78 -66 0 C -66 -78 65 -78 65 0 Z');
    view.group.style.opacity=blocked()?'0.45':'1';
  }
  function clampPosition(piece,x,y) {
    const side=sides.indexOf(piece.id),left=side===1?1070:250,right=side===1?1670:850;
    return {...piece,x:Math.min(right,Math.max(left,x)),y:Math.min(840,Math.max(240,y))};
  }
  window.addEventListener('pointermove',event=>{
    const drag=drags.get(event.pointerId);if(!drag)return;consume(event);
    if(blocked()){endDrag(event.pointerId);return;}
    const piece=current(drag.id);if(!piece){drags.delete(event.pointerId);return;}
    const at=clientPoint(event);
    if(drag.kind==='move')put(clampPosition(piece,at.x-drag.offsetX,at.y-drag.offsetY),2,true);
    else put({...piece,orientation:normal(drag.orientation+delta(Math.atan2(at.y-piece.y,at.x-piece.x)*180/Math.PI,drag.angle))},2,true);
  },{capture:true,passive:false});
  for(const type of ['pointerup','pointercancel'])window.addEventListener(type,event=>{
    if(drags.has(event.pointerId)){consume(event);endDrag(event.pointerId);}
  },{capture:true,passive:false});
  const code = event => event.code||({q:'KeyQ',e:'KeyE',w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',',':'Comma','.':'Period',Shift:'ShiftLeft'}[event.key]??event.key);
  window.addEventListener('keydown',event=>{
    if(blocked()||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName??''))return;
    const key=code(event);
    if(controlKeys.has(key)){keys.add(key);consume(event);}
    if(key==='Backspace'){consume(event);api.lift();}
  },{capture:true});
  window.addEventListener('keyup',event=>{
    const key=code(event);keys.delete(key);
    for(let side=0;side<2;side++)if(Object.values(bindings[side]).includes(key)){
      const piece=current(sides[side]);if(piece&&!blocked())put(piece,2,false);
    }
  },{capture:true});
  window.addEventListener('blur',releaseControls);
  function fitCanvas() {
    const canvas=document.querySelector('#game');if(!canvas)return;
    const vw=window.innerWidth||1920,vh=window.innerHeight||1080;
    const panelHeight=panel.getBoundingClientRect().height;
    const available=Math.max(120,vh-panelHeight);
    const width=Math.min(vw,available*16/9),height=width*9/16;
    Object.assign(canvas.style,{position:'fixed',left:`${(vw-width)/2}px`,top:`${(available-height)/2}px`,width:`${width}px`,height:`${height}px`});
    const r=canvas.getBoundingClientRect();
    Object.assign(surface.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});
  }
  function frame(time) {
    const dt=lastAt?Math.min(.05,(time-lastAt)/1000):0;lastAt=time;
    const isBlocked=blocked();if(isBlocked&&!wasBlocked)releaseControls();wasBlocked=isBlocked;
    reconcile();
    if(!isBlocked)for(let side=0;side<2;side++){
      const piece=current(sides[side]),binding=bindings[side];
      if(!piece||[...drags.values()].some(d=>d.id===piece.id))continue;
      let dx=Number(keys.has(binding.right))-Number(keys.has(binding.left)),dy=Number(keys.has(binding.down))-Number(keys.has(binding.up));
      const turn=Number(keys.has(binding.cw))-Number(keys.has(binding.ccw));
      if(dx||dy||turn){
        const length=Math.hypot(dx,dy)||1;dx/=length;dy/=length;
        const moved=clampPosition(piece,piece.x+dx*400*dt,piece.y+dy*400*dt);
        put({...moved,orientation:normal(piece.orientation+turn*(keys.has(binding.power)?480:180)*dt)},2,true);
      }
    }
    const all=contacts();
    for(const [id,view]of views)if(!all.some(p=>p.id===id)){view.group.remove();views.delete(id);}
    all.forEach(drawPiece);
    for(let side=0;side<2;side++)placeButtons[side].textContent=sides[side]===null?'Place piece':'Piece ready';
    const state=window.TwistTennisState;
    status.textContent=state?.mode==='play'?'Line touching the ball? E / . sends it forward.':'Add the second player, then place one piece at each end.';
    fitCanvas();requestAnimationFrame(frame);
  }
  const install=()=>{(document.body??document.documentElement).append(root);document.body.style.background='#082d31';requestAnimationFrame(frame);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  fetch('piece-footprints.json').then(r=>r.ok?r.json():null).then(data=>{footprints=data;}).catch(()=>{});
})();
