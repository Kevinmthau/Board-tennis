import './style.css';
import { Board, BoardContactPhase, BoardContactType, BoardPlayerType, type BoardContact, type BoardPlayer } from '@board.fun/web-sdk';
import { clientToWorld, createSurface, loadTitleFont, startInput } from './runtime';
import { loadPieceFootprints, pieceFootprint, frontPoint, type PieceFootprints } from './piece-footprints';
import { noteContacts, pickPlayer, seated, selectorOpen } from './seats';
import { PieceTracker, type TrackedPiece } from './tracking';
import { SwingController, type SwingPose } from './swing';
import { createMatch, nextServe, canStrike, inOwnHalf, type Match, type Side } from './tennis';
import { advanceRallyFrame, type RallyControl } from './rally-frame';
import { Splashes, Particles, Trail, PopTexts } from './fx';
import { hit } from './howto';
import { drawGame, loadGameArt, BUTTONS, type GameView, type RacketView } from './view';
import { sound, startAmbience } from './sound';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = createSurface(canvas);
type Mode = GameView['mode'];
type Seat = { player: BoardPlayer; side: Side | null; pieceId: number | null };
let mode: Mode = 'title', helpReturn: Mode = 'title';
let match = createMatch();
let seats: Seat[] = [];
let footprints: PieceFootprints | null = null;
const tracker = new PieceTracker();
const contacts = new Map<number, BoardContact>();
const swings = [new SwingController(), new SwingController()];
const epochs = new Map<number, number>();
// A menu temporarily hides pieces. Confirm their redetection before accepting a real lift.
const setupLiftRequired = new Map<number, boolean>();
const splashes = new Splashes(), particles = new Particles(180), pops = new PopTexts();
const trail = new Trail({ color: '#e9f583', width: 14, life: .2, glow: false });
let taps: { x: number; y: number }[] = [];
let running = true, last = 0, rosterAt = -Infinity, savedAt = 0;
let saved: { match: Match; sides: { sessionId: number; side: Side }[] } | null = null;
let continuing = false, pendingSelector = false, placementCount = 0;
const browser = !!(window as any).BoardSDK?.__simulated;
const pieceFor = (s: Seat) => tracker.identities.find(p => p.id === s.pieceId);
const ready = () => seats.length === 2 && seats.every(s => s.side !== null && pieceFor(s)?.present);
const resetSwings = () => { swings.forEach(s => s.reset()); epochs.clear(); };

function syncRoster() {
  const before = seats;
  seats = seated().filter(p => p.type !== BoardPlayerType.AI).slice(0, 2).map(player => {
    const old = before.find(s => s.player.sessionId === player.sessionId);
    return old ? { ...old, player } : { player, side: null, pieceId: null };
  });
  for (const p of tracker.identities) if (!seats.some(s => s.player.sessionId === p.owner)) p.owner = null;
  if (mode === 'setup') bindPieces();
}

async function addPlayer(replace?: number) {
  if (selectorOpen() || pendingSelector) return;
  pendingSelector = true;
  try { await pickPlayer([], replace); syncRoster(); }
  finally { pendingSelector = false; }
}

function sideAt(p: TrackedPiece): Side | null {
  if (p.x < 760) return 0;
  if (p.x > 1160) return 1;
  return null;
}
function bindPieces() {
  for (const p of tracker.identities) {
    if (!p.present || p.glyphId > 8 || setupLiftRequired.has(p.id) || seats.some(s => s.pieceId === p.id)) continue;
    const side = sideAt(p);
    if (side === null) continue;
    const held = seats.find(s => s.side === side);
    if (held && pieceFor(held)?.present) continue;
    const seat = held ?? seats.find(s => s.side === null);
    if (!seat) continue;
    const old = pieceFor(seat);
    if (old) old.owner = null;
    seat.side = side; seat.pieceId = p.id; p.owner = seat.player.sessionId;
    swings[side].reset();
  }
}

function save() {
  if (mode !== 'play' && mode !== 'over') return;
  BoardPlatform.state.save({ version: 1, match: JSON.parse(JSON.stringify(match)),
    sides: seats.filter(s => s.side !== null).map(s => ({ sessionId: s.player.sessionId, side: s.side! })) });
}
function readSave() {
  const value = BoardPlatform.state.load() as any;
  if (value?.version !== 1 || !Array.isArray(value.match?.score) || value.match.score.length !== 2
    || !value.match.score.every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0)
    || !['serve', 'rally', 'point', 'over'].includes(value.match?.phase)
    || ![value.match?.ball?.x, value.match?.ball?.y, value.match?.ball?.vx, value.match?.ball?.vy].every(Number.isFinite)
    || !Array.isArray(value.sides)) return;
  value.match.backWallBounces = value.match.backWallBounces === 1 ? 1 : 0;
  value.match.shotTime = Number.isFinite(value.match.shotTime) && value.match.shotTime >= 0 ? value.match.shotTime : 0;
  saved = value;
}
function enterSetup(restore = false) {
  mode = 'setup'; continuing = restore;
  resetSwings(); trail.clear();
  syncRoster();
  if (restore && saved) {
    match = JSON.parse(JSON.stringify(saved.match));
    for (const s of seats) s.side = saved.sides.find(p => p.sessionId === s.player.sessionId)?.side ?? s.side;
  } else match = createMatch();
  bindPieces();
}
function rematch() { match = createMatch(); continuing = false; mode = 'setup'; resetSwings(); trail.clear(); }
function changeSetup() {
  for (const p of tracker.identities) { p.owner = null; setupLiftRequired.set(p.id, p.present); }
  seats.forEach(s => { s.side = null; s.pieceId = null; });
  enterSetup();
}
function openHelp() { if (mode === 'help') return; helpReturn = mode; mode = 'help'; resetSwings(); }
function closeHelp() { mode = helpReturn; resetSwings(); }

startInput((batch, active) => {
  noteContacts(batch);
  contacts.clear();
  for (const c of active.values()) if (c.type === BoardContactType.Glyph) contacts.set(c.contactId, c);
  for (const c of batch) if (c.type === BoardContactType.Finger && c.phase === BoardContactPhase.Began) taps.push({ x: c.x, y: c.y });
}, () => {
  // Menu absence is not a physical lift, including repeated menus while setup is waiting.
  for (const id of setupLiftRequired.keys()) setupLiftRequired.set(id, false);
  tracker.paused(performance.now()); contacts.clear(); taps = []; resetSwings(); save();
});
canvas.addEventListener('pointerdown', e => {
  if (!browser) taps.push(clientToWorld(canvas, e.clientX, e.clientY));
});

function poseOf(p: TrackedPiece): SwingPose | null {
  const fp = pieceFootprint(footprints, p);
  if (!fp) return null;
  const front = frontPoint(fp, 6);
  return { x: p.x, y: p.y, facingDeg: fp.facingDeg, frontReach: Math.hypot(front.x - p.x, front.y - p.y) };
}
function rackets(): RacketView[] {
  return seats.flatMap(s => {
    const p = pieceFor(s);
    if (s.side === null || !p?.present) return [];
    const pose = poseOf(p);
    return pose ? [{ pose, side: s.side, active: canStrike(match, s.side) && inOwnHalf(s.side, p.x), glyphId: p.glyphId }] : [];
  });
}
function scoreMoment() {
  const side = match.pointWinner;
  if (side === null) return;
  const x = side === 0 ? 420 : 1500;
  particles.burst(x, 540, { count: match.phase === 'over' ? 70 : 36, color: side === 0 ? '#ff997c' : '#fff0c6', speed: 280, life: .9, glow: false });
  pops.pop(x, 540, '+1', { size: 96, color: '#fff0c6', face: browser ? 'bottom' : side === 0 ? 'left' : 'right' });
  sound(match.phase === 'over' ? 'win' : 'point');
  resetSwings(); trail.clear(); save();
}
function update(now: number, dt: number) {
  const changed = tracker.update([...contacts.values()].filter(c => c.glyphId <= 8), now);
  for (const p of tracker.identities) if (setupLiftRequired.has(p.id)) {
    if (p.present) setupLiftRequired.set(p.id, true);
    else if (p.lifted && setupLiftRequired.get(p.id)) setupLiftRequired.delete(p.id);
  }
  for (const p of changed.arrivals) {
    const fp = pieceFootprint(footprints, p);
    splashes.at(p.x, p.y, { inner: fp?.radiusPx ?? 90, color: '#f4e8b7', sound: () => sound('place'), sparks: particles });
    placementCount++;
    if (mode === 'title') enterSetup();
  }
  if (mode === 'setup' || mode === 'play' || mode === 'over') bindPieces();
  if (mode === 'setup' && now - rosterAt > 1000) { syncRoster(); rosterAt = now; }
  const tapped = (key: keyof typeof BUTTONS) => BUTTONS[key].some(b => taps.some(p => hit(b, p.x, p.y)));
  if (mode === 'title') {
    if (tapped('play')) enterSetup();
    else if (tapped('continue') && saved) enterSetup(true);
    else if (tapped('help')) openHelp();
  } else if (mode === 'help') {
    if (tapped('back')) closeHelp();
  } else if (mode === 'setup') {
    if (tapped('add')) void addPlayer();
    if (tapped('leftPlayer')) { const s = seats.find(s => s.side === 0) ?? seats[0]; void addPlayer(s?.player.sessionId); }
    if (tapped('rightPlayer')) { const s = seats.find(s => s.side === 1); void addPlayer(s?.player.sessionId); }
    if (tapped('help')) openHelp();
    if (ready()) { mode = match.phase === 'over' && continuing ? 'over' : 'play'; resetSwings(); save(); }
  } else if (mode === 'over') {
    if (tapped('rematch')) rematch();
    else if (tapped('setup')) changeSetup();
  } else if (mode === 'play') {
    const missing = seats.length !== 2 || seats.some(s => !pieceFor(s) || pieceFor(s)!.lifted);
    if (!missing) {
      const controls: RallyControl[] = [];
      for (const s of seats) {
        if (s.side === null) continue;
        const p = pieceFor(s);
        if (!p?.present) { swings[s.side].reset(); continue; }
        if (epochs.get(p.id) !== p.epoch) { swings[s.side].reset(); epochs.set(p.id, p.epoch); }
        controls.push({ side: s.side, pose: poseOf(p), controller: swings[s.side] });
      }
      const result = advanceRallyFrame(match, dt, now, controls);
      if (result.hit) {
        sound('hit', result.hit.shot.speed);
        particles.burst(result.hit.at.x, result.hit.at.y, { count: 10, color: '#f3faab', speed: 180, life: .24, glow: false });
        trail.clear(); save();
      }
      if (result.point) scoreMoment();
      if (match.phase === 'point' && nextServe(match)) { resetSwings(); trail.clear(); save(); }
      if (match.phase === 'rally') trail.push(match.ball.x, match.ball.y);
      if (match.phase === 'over') { mode = 'over'; save(); }
    } else resetSwings();
  }
  splashes.update(dt); particles.update(dt); trail.update(dt); pops.update(dt);
  if (now - savedAt > 500) { save(); savedAt = now; }
  taps = [];
}

function view(now: number): GameView {
  return { mode, now, match, browser, canContinue: !!saved,
    seats: seats.map(s => ({ name: s.player.name, side: s.side, present: !!pieceFor(s)?.present, glyphId: pieceFor(s)?.glyphId ?? 5 })),
    rackets: rackets(), missing: mode === 'play' && (seats.length !== 2 || seats.some(s => !pieceFor(s) || pieceFor(s)!.lifted)),
    drawEffects: () => { trail.draw(ctx); particles.draw(ctx); splashes.draw(ctx); pops.draw(ctx); } };
}
Object.defineProperty(window, 'TwistTennisState', { configurable: true, get: () => JSON.parse(JSON.stringify({
  mode, match, seats: seats.map(s => ({ sessionId: s.player.sessionId, name: s.player.name, side: s.side, pieceId: s.pieceId, present: !!pieceFor(s)?.present })),
  placementCount, running,
})) });
const frame = (now: number) => {
  if (!running) return;
  const dt = Math.min(.05, last ? (now - last) / 1000 : 0); last = now;
  update(now, dt); drawGame(ctx, view(now)); requestAnimationFrame(frame);
};
Board.application.onPause(() => { running = false; save(); });
Board.application.onResume(() => {
  tracker.resumed(performance.now()); resetSwings();
  if (!running) { running = true; last = 0; requestAnimationFrame(frame); }
});
void (async () => {
  await BoardPlatform.state.ready();
  readSave(); BoardPlatform.state.onRestore(readSave);
  syncRoster();
  if (Board.isOnDevice) Board.session.onPlayersChanged(syncRoster);
  [footprints] = await Promise.all([loadPieceFootprints(), loadTitleFont(), loadGameArt()]);
  BoardPlatform.menu.setButtons([{ id: 'help', title: 'How to play', icon: 'square' }, { id: 'setup', title: 'Change setup', icon: 'left_arrow' }]);
  BoardPlatform.menu.onButton(id => { if (id === 'help') openHelp(); if (id === 'setup') changeSetup(); });
  startAmbience(); requestAnimationFrame(frame);
})();
