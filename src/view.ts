import { gameFont } from './runtime';
import { drawTitle } from './title';
import type { Box } from './howto';
import { bake } from './fx';
import { travelScale, type Match, type Side } from './tennis';
import type { SwingPose } from './swing';

export interface RacketView { pose: SwingPose; side: Side; active: boolean; glyphId: number }
export interface GameView {
  mode: 'title' | 'setup' | 'help' | 'play' | 'over'; now: number; match: Match; browser: boolean; canContinue: boolean;
  seats: { name: string; side: Side | null; present: boolean; glyphId: number }[];
  rackets: RacketView[]; missing: boolean; drawEffects: () => void;
}
type Key = 'play'|'continue'|'help'|'back'|'add'|'leftPlayer'|'rightPlayer'|'rematch'|'setup';
export const BUTTONS: Record<Key, Box[]> = { play: [], continue: [], help: [], back: [], add: [], leftPlayer: [], rightPlayer: [], rematch: [], setup: [] };
const C = { green: '#174c43', deep: '#123d37', blue: '#3184b4', blueLight: '#3c92bf', blueDark: '#26749f',
  cream: '#fff1ca', faded: '#b7d4cc', white: '#fff9e6', lime: '#e6f36f', coral: '#ff9c7d', leaf: '#37735a', ink: '#163e3a' };
const TEAM = [C.coral, C.cream];
const TAU = Math.PI * 2;
let court: CanvasImageSource | null = null;
const art = new Map<number, HTMLImageElement>();
let missingArt = false;
type Frame = { cx: number; cy: number; angle: number; native: boolean; side?: Side };
const BROWSER: Frame = { cx: 960, cy: 540, angle: 0, native: false };
const NATIVE: Frame[] = [{ cx: 480, cy: 540, angle: Math.PI / 2, native: true, side: 0 }, { cx: 1440, cy: 540, angle: -Math.PI / 2, native: true, side: 1 }];

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 24) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
function text(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, size = 48, color = C.cream, max = Infinity, floor = size >= 48 ? 48 : 32) {
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = size;
  ctx.font = gameFont(px);
  while (px > floor && ctx.measureText(label).width > max) ctx.font = gameFont(--px);
  const lines: string[] = [];
  let row = '';
  for (const word of label.split(' ')) {
    const next = row ? `${row} ${word}` : word;
    if (ctx.measureText(next).width <= max) { row = next; continue; }
    if (row) { lines.push(row); row = ''; }
    // Long profile-name components wrap as well; every character stays visible.
    for (const char of word) {
      if (row && ctx.measureText(row + char).width > max) { lines.push(row); row = ''; }
      row += char;
    }
  }
  if (row || !lines.length) lines.push(row);
  if (lines.length > 2 && ctx.measureText(label).width <= max * 2) {
    // Balance a long multi-part profile name into the HUD's two-line space.
    let split = Math.floor(label.length / 2);
    while (split > 1 && ctx.measureText(label.slice(0, split)).width > max) split--;
    while (split < label.length - 1 && ctx.measureText(label.slice(split)).width > max) split++;
    lines.splice(0, lines.length, label.slice(0, split).trimEnd(), label.slice(split).trimStart());
  }
  const leading = px * 1.04;
  lines.forEach((row, i) => ctx.fillText(row, x, y + (i - (lines.length - 1) / 2) * leading));
}
function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
/** Keep the visible ball centered on the strike coordinate. Height reads through
 * perspective size and a displaced ground shadow, so players never aim at an invisible ball. */
function ball(ctx: CanvasRenderingContext2D, x: number, y: number, radius = 18, stretch = 1, height = 0) {
  const lift = Math.max(0, Math.min(260, height));
  const size = radius * (1 + Math.min(.7, lift / 360));
  const opacity = ctx.globalAlpha;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#0d3e47'; ctx.globalAlpha = opacity * (.32 - Math.min(.17, lift / 1400));
  ctx.beginPath(); ctx.ellipse(6 + lift * .22, 10 + lift * .42, radius + lift * .065, radius * .55 + lift * .032, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = opacity; ctx.scale(stretch, 1 / Math.sqrt(stretch));
  ctx.fillStyle = '#b7ce42'; ctx.beginPath(); ctx.arc(0, 0, size, 0, TAU); ctx.fill();
  ctx.fillStyle = C.lime; ctx.beginPath(); ctx.arc(-size * .06, -size * .09, size * .94, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f6fbb2'; ctx.globalAlpha = opacity * .46; ctx.beginPath(); ctx.ellipse(-size * .28, -size * .34, size * .3, size * .18, -.7, 0, TAU); ctx.fill(); ctx.globalAlpha = opacity;
  ctx.strokeStyle = '#fffbd8'; ctx.lineWidth = Math.max(2, size * .09);
  ctx.beginPath(); ctx.arc(-size * .72, 0, size * .78, -.95, .95); ctx.stroke();
  ctx.beginPath(); ctx.arc(size * .72, 0, size * .78, Math.PI - .95, Math.PI + .95); ctx.stroke();
  ctx.restore();
}
function groundImpact(ctx: CanvasRenderingContext2D, x: number, y: number, age: number) {
  if (age < 0 || age > .55) return;
  const t = age / .55;
  ctx.save(); ctx.globalAlpha = (1 - t) * .72; ctx.strokeStyle = C.cream; ctx.lineWidth = 4 * (1 - t) + 1;
  ctx.beginPath(); ctx.ellipse(x, y, 23 + t * 66, 15 + t * 42, 0, 0, TAU); ctx.stroke();
  ctx.globalAlpha = (1 - t) * .24; ctx.fillStyle = C.lime;
  ctx.beginPath(); ctx.ellipse(x, y, 20 + t * 26, 11 + t * 15, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function piece(ctx: CanvasRenderingContext2D, glyph: number, x: number, y: number, height: number) {
  const image = art.get(glyph) ?? art.get(5);
  if (!image) {
    if (missingArt) text(ctx, 'Piece art unavailable', x, y, 32, C.cream, 460);
    return;
  }
  const width = image.naturalWidth / image.naturalHeight * height;
  ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
}
function at(ctx: CanvasRenderingContext2D, f: Frame, draw: () => void) {
  ctx.save(); ctx.translate(f.cx, f.cy); ctx.rotate(f.angle); draw(); ctx.restore();
}
function worldBox(f: Frame, b: Box): Box {
  if (!f.angle) return { x: f.cx + b.x, y: f.cy + b.y, width: b.width, height: b.height };
  return f.angle > 0 ? { x: f.cx - b.y - b.height, y: f.cy + b.x, width: b.height, height: b.width }
    : { x: f.cx + b.y, y: f.cy - b.x - b.width, width: b.height, height: b.width };
}
function button(ctx: CanvasRenderingContext2D, f: Frame, key: Key, b: Box, label: string, primary = false) {
  BUTTONS[key].push(worldBox(f, b));
  ctx.fillStyle = primary ? C.cream : '#286255'; round(ctx, b.x, b.y + 6, b.width, b.height); ctx.fill();
  ctx.fillStyle = primary ? C.lime : '#236055'; round(ctx, b.x, b.y, b.width, b.height); ctx.fill();
  if (!primary) { ctx.strokeStyle = '#548375'; ctx.lineWidth = 2; ctx.stroke(); }
  text(ctx, label, b.x + b.width / 2, b.y + b.height / 2, 40, primary ? C.ink : C.cream, b.width - 36);
}
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(9,42,38,.18)'; round(ctx, x + 10, y + 12, w, h, 38); ctx.fill();
  ctx.fillStyle = C.green; round(ctx, x, y, w, h, 38); ctx.fill();
  ctx.strokeStyle = '#4e7c65'; ctx.lineWidth = 2; ctx.stroke();
}
function makeCourt() {
  court = bake(1920, 1080, ctx => {
    // The whole glass is the court. All four physical edges can rebound the ball.
    const ground = ctx.createLinearGradient(0, 0, 1920, 1080);
    ground.addColorStop(0, '#338bb9'); ground.addColorStop(.5, '#3183b0'); ground.addColorStop(1, '#2879a4');
    ctx.fillStyle = ground; ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = 'rgba(255,249,218,.025)';
    for (let x = 0; x < 1920; x += 320) ctx.fillRect(x, 0, 160, 1080);
    let seed = 137;
    for (let i = 0; i < 5400; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0; const x = (seed >>> 0) / 4294967296 * 1920;
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0; const y = (seed >>> 0) / 4294967296 * 1080;
      ctx.fillStyle = i % 2 ? 'rgba(255,255,220,.035)' : 'rgba(8,52,68,.045)'; ctx.fillRect(x, y, 2, 2);
    }
    // Flush wall strips describe the rebound surface, without an inset court rectangle.
    ctx.fillStyle = '#205b78'; ctx.fillRect(0, 0, 1920, 13); ctx.fillRect(0, 1067, 1920, 13);
    line(ctx, 0, 13, 1920, 13, C.cream, 4); line(ctx, 0, 1067, 1920, 1067, C.cream, 4);
    ctx.fillStyle = C.coral; ctx.fillRect(0, 0, 10, 1080);
    ctx.fillStyle = C.cream; ctx.fillRect(1910, 0, 10, 1080);
    // Top-down net and its shallow shadow share the exact rules center.
    ctx.fillStyle = 'rgba(11,45,47,.18)'; ctx.fillRect(961, 0, 17, 1080);
    ctx.fillStyle = '#174d56'; ctx.fillRect(954, 0, 12, 1080);
    for (let y = 6; y < 1080; y += 13) line(ctx, 953, y, 969, y + 3, '#8fb5b6', 1);
    line(ctx, 959, 0, 959, 1080, C.white, 5);
    for (const y of [20, 1060]) { ctx.fillStyle = C.deep; ctx.beginPath(); ctx.arc(960, y, 12, 0, TAU); ctx.fill(); ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(957, y - 2, 5, 0, TAU); ctx.fill(); }
  });
}
export async function loadGameArt() {
  makeCourt();
  if (typeof Image === 'undefined') return;
  await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(glyph => new Promise<void>(resolve => {
    const image = new Image(); image.onload = () => { art.set(glyph, image); resolve(); };
    image.onerror = () => { missingArt = true; resolve(); }; image.src = `piece-art/${glyph}.png`;
  })));
}

function titleScreen(ctx: CanvasRenderingContext2D, v: GameView, f: Frame) {
  at(ctx, f, () => {
    const w = f.native ? 840 : 1520;
    panel(ctx, -w / 2, -410, w, 820);
    text(ctx, 'TWO PLAYERS · ONE COURT', 0, -347, 32, C.faded);
    drawTitle(ctx, { x: f.native ? -330 : -540, y: -290, width: f.native ? 660 : 1080, height: f.native ? 240 : 320 }, { ink: C.cream });
    if (f.native) {
      piece(ctx, 5, -280, 36, 155); piece(ctx, 1, 280, 36, 155);
      ball(ctx, Math.sin(v.now / 850) * 105, 60, 29);
      text(ctx, 'Slide. Twist. Rally.', 0, 174, 48);
      text(ctx, 'Any two Sports pieces', 0, 228, 32, C.faded);
      button(ctx, f, 'play', { x: -366, y: 282, width: 350, height: 120 }, v.canContinue ? 'NEW MATCH' : 'PLAY', true);
      button(ctx, f, v.canContinue ? 'continue' : 'help', { x: 16, y: 282, width: 350, height: 120 }, v.canContinue ? 'CONTINUE' : 'HOW TO PLAY');
    } else {
      piece(ctx, 5, -610, -45, 290); piece(ctx, 1, 610, -45, 290);
      ball(ctx, Math.sin(v.now / 1000) * 150, 98, 25);
      text(ctx, 'Slide. Twist. Rally.', 0, 176, 56);
      text(ctx, 'Any two Sports pieces. First to 7.', 0, 242, 32, C.faded);
      const buttons = v.canContinue ? [{ key: 'continue' as Key, label: 'CONTINUE', primary: true }, { key: 'play' as Key, label: 'NEW MATCH', primary: false }, { key: 'help' as Key, label: 'HOW TO PLAY', primary: false }]
        : [{ key: 'play' as Key, label: 'PLAY', primary: true }, { key: 'help' as Key, label: 'HOW TO PLAY', primary: false }];
      const bw = v.canContinue ? 360 : 420, gap = 28, total = buttons.length * bw + (buttons.length - 1) * gap;
      buttons.forEach((b, i) => button(ctx, f, b.key, { x: -total / 2 + i * (bw + gap), y: 282, width: bw, height: 120 }, b.label, b.primary));
    }
  });
}
function seatFor(v: GameView, side: Side) {
  const taken = v.seats.find(s => s.side === side);
  if (taken) return taken;
  const free = ([0, 1] as Side[]).filter(n => !v.seats.some(s => s.side === n));
  return v.seats.filter(s => s.side === null)[free.indexOf(side)];
}
function setup(ctx: CanvasRenderingContext2D, v: GameView, f: Frame) {
  at(ctx, f, () => {
    panel(ctx, f.native ? -420 : -760, -410, f.native ? 840 : 1520, 820);
    text(ctx, 'TAKE THE COURT', 0, -328, f.native ? 56 : 72);
    text(ctx, v.seats.length < 2 ? 'Choose two players, then place your pieces.' : 'Lift and place a Sports piece at each end.', 0, -248, 32, C.faded, f.native ? 760 : 1320);
    const sides: Side[] = f.native ? [f.side!] : [0, 1];
    for (const side of sides) {
      const x = f.native ? 0 : side === 0 ? -390 : 390, s = seatFor(v, side);
      piece(ctx, s?.glyphId ?? (side === 0 ? 5 : 1), x, -42, f.native ? 230 : 245);
      text(ctx, s?.name ?? 'PLAYER NEEDED', x, 124, 48, TEAM[side], f.native ? 710 : 650, 32);
      text(ctx, s?.present ? 'READY' : side === 0 ? 'Place at the left end' : 'Place at the right end', x, 187, 32, s?.present ? C.lime : C.faded);
    }
    if (v.seats.length < 2) button(ctx, f, 'add', { x: -220, y: 268, width: 440, height: 120 }, 'ADD PLAYER', true);
    else {
      const side = f.side ?? 0;
      button(ctx, f, side === 0 ? 'leftPlayer' : 'rightPlayer', { x: f.native ? -366 : -640, y: 268, width: f.native ? 350 : 400, height: 120 }, f.native ? 'CHANGE PLAYER' : 'LEFT PLAYER');
      if (!f.native) button(ctx, f, 'rightPlayer', { x: 240, y: 268, width: 400, height: 120 }, 'RIGHT PLAYER');
      button(ctx, f, 'help', { x: f.native ? 16 : -200, y: 268, width: f.native ? 350 : 400, height: 120 }, 'HOW TO PLAY', true);
    }
  });
}
function help(ctx: CanvasRenderingContext2D, v: GameView, f: Frame) {
  at(ctx, f, () => {
    panel(ctx, f.native ? -420 : -760, -430, f.native ? 840 : 1520, 860);
    text(ctx, 'A TWIST IS YOUR SWING', 0, -350, f.native ? 48 : 64);
    if (f.native) text(ctx, 'Return before the second bounce.', 0, -291, 32, C.faded);
    const px = f.native ? -100 : -280, py = -20;
    piece(ctx, 5, px, py + (f.native ? 52 : 22), f.native ? 170 : 210);
    // Real clockwise line sweep: facing up, then rightward tangent at contact.
    const t = (v.now % 3200) / 3200;
    const swing = Math.min(1, Math.max(0, (t - .15) / .28));
    const angle = (-120 + swing * 60) * Math.PI / 180;
    const sx = px + Math.cos(angle) * 96, sy = py + Math.sin(angle) * 96;
    line(ctx, sx, sy, px + Math.cos(angle) * 240, py + Math.sin(angle) * 240, C.cream, 7);
    const contact = .15 + .28 * .5, flight = Math.min(1, Math.max(0, (t - contact) / .5));
    const distance = f.native ? 320 : 610, bounceAt = .6;
    const arcT = flight < bounceAt ? flight / bounceAt : (flight - bounceAt) / (1 - bounceAt);
    const height = flight > 0 && flight < 1 ? 4 * arcT * (1 - arcT) * (flight < bounceAt ? 130 : 58) : 0;
    if (flight >= bounceAt) groundImpact(ctx, px + distance * bounceAt, py - 180, (flight - bounceAt) * 1.6);
    ball(ctx, px + flight * distance, py - 180, 20, 1, height);
    if (f.native) {
      text(ctx, 'Slide beside the ball.', 0, 150, 40);
      text(ctx, 'Twist your line through it.', 0, 204, 40);
      text(ctx, 'Faster twist. Harder shot.', 0, 258, 32, C.faded);
    } else {
      text(ctx, 'Slide beside the ball.', 0, 150, 48);
      text(ctx, 'Twist the line through it. The ball leaves sideways.', 0, 215, 40);
      text(ctx, 'Return before the second ground bounce. Walls stay in play.', 0, 275, 32, C.faded);
    }
    button(ctx, f, 'back', { x: -200, y: 302, width: 400, height: 120 }, 'BACK TO GAME', true);
  });
}
function hud(ctx: CanvasRenderingContext2D, v: GameView) {
  if (v.browser) {
    for (const side of [0, 1] as Side[]) {
      const x = side === 0 ? 545 : 1375, s = seatFor(v, side);
      ctx.fillStyle = C.deep; round(ctx, x - 310, 50, 620, 110, 25); ctx.fill();
      ctx.fillStyle = TEAM[side]; round(ctx, x - 310, 50, 12, 110, 5); ctx.fill();
      text(ctx, s?.name ?? 'Player', x - 42, 105, 48, TEAM[side], 460);
      text(ctx, String(v.match.score[side]), x + 238, 105, 76);
    }
    text(ctx, 'FIRST TO 7', 960, 77, 32, C.cream);
    text(ctx, 'WIN BY 2', 960, 121, 32, C.faded);
  } else {
    for (const side of [0, 1] as Side[]) {
      ctx.save(); ctx.translate(side === 0 ? 155 : 1765, 540); ctx.rotate(side === 0 ? Math.PI / 2 : -Math.PI / 2);
      text(ctx, seatFor(v, side)?.name ?? 'Player', 0, 58, 48, TEAM[side], 680);
      text(ctx, String(v.match.score[side]), 0, -37, 88);
      ctx.restore();
    }
  }
}
function statusText(ctx: CanvasRenderingContext2D, v: GameView, label: string, second?: string) {
  if (v.browser) {
    text(ctx, label, 960, second ? 950 : 979, 48, C.cream, 1720);
    if (second) text(ctx, second, 960, 1008, 48, C.faded, 1720);
  } else {
    for (const f of NATIVE) at(ctx, f, () => { text(ctx, label, 0, 110, 48, C.cream, 760); if (second) text(ctx, second, 0, 50, 48, C.faded, 760); });
  }
}
function play(ctx: CanvasRenderingContext2D, v: GameView) {
  hud(ctx, v);
  const m = v.match;
  if (m.phase === 'rally' && travelScale(m) < .7) {
    // Discreet boundary ticks mark the receiving window without following the controller.
    const x = m.receiver === 0 ? 320 : 1600;
    ctx.save(); ctx.globalAlpha = .4; line(ctx, x, 278, x, 338, C.lime, 6); line(ctx, x, 742, x, 802, C.lime, 6); ctx.restore();
  }
  for (const r of v.rackets) {
    const a = r.pose.facingDeg * Math.PI / 180;
    const x1 = r.pose.x + Math.cos(a) * r.pose.frontReach, y1 = r.pose.y + Math.sin(a) * r.pose.frontReach;
    const x2 = r.pose.x + Math.cos(a) * 240, y2 = r.pose.y + Math.sin(a) * 240;
    ctx.lineCap = 'round'; line(ctx, x1 + 2, y1 + 3, x2 + 2, y2 + 3, 'rgba(16,53,55,.35)', 10);
    line(ctx, x1, y1, x2, y2, r.active ? C.white : '#aac8bf', 6);
    ctx.fillStyle = r.active ? C.lime : '#aac8bf'; ctx.beginPath(); ctx.arc(x2, y2, 5, 0, TAU); ctx.fill(); ctx.lineCap = 'butt';
  }
  v.drawEffects();
  if (m.phase === 'serve') {
    ctx.save(); ctx.globalAlpha = .25 + .12 * Math.sin(v.now / 250); ctx.strokeStyle = C.lime; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(m.ball.x, m.ball.y, 29 + 4 * Math.sin(v.now / 250), 0, TAU); ctx.stroke(); ctx.restore();
  }
  if (m.lastBounce) groundImpact(ctx, m.lastBounce.x, m.lastBounce.y, m.lastBounce.age);
  const impactAge = m.lastBounce?.age ?? Infinity;
  if (m.phase !== 'over' && (m.phase !== 'point' || impactAge < .35)) {
    const squash = m.ball.z < 22 ? .32 * Math.max(0, 1 - impactAge / .12) : 0;
    ctx.save();
    if (m.phase === 'point') ctx.globalAlpha = Math.max(0, 1 - impactAge / .35);
    ball(ctx, m.ball.x, m.ball.y, 18, 1 + squash, m.ball.z);
    ctx.restore();
  }
  if (v.missing) {
    ctx.fillStyle = 'rgba(13,49,44,.55)'; ctx.fillRect(0, 0, 1920, 1080);
    for (const side of [0, 1] as Side[]) {
      const s = seatFor(v, side); if (s?.present) continue;
      const f = v.browser ? { ...BROWSER, cx: side === 0 ? 550 : 1370 } : NATIVE[side];
      at(ctx, f, () => { piece(ctx, s?.glyphId ?? 5, 0, -40, 190); text(ctx, 'Return your piece', 0, 126, 48, C.cream, 720); });
    }
    statusText(ctx, v, 'Rally paused'); return;
  }
  if (m.phase === 'serve') {
    const name = seatFor(v, m.server)?.name ?? (m.server === 0 ? 'Left player' : 'Right player');
    if (v.browser) statusText(ctx, v, `${name} serves`, 'Twist through the ball');
    else for (const f of NATIVE) at(ctx, f, () => {
      text(ctx, f.side === m.server ? 'YOUR SERVE' : 'GET READY', 0, 110, 48);
      if (f.side === m.server) text(ctx, 'Twist through the ball', 0, 50, 48, C.faded, 760);
    });
  } else if (m.phase === 'rally') {
    if (m.groundBounces === 1) {
      if (v.browser) text(ctx, '1 BOUNCE · RETURN IT!', m.receiver === 0 ? 490 : 1430, 980, 48, C.lime, 860);
      else at(ctx, NATIVE[m.receiver], () => text(ctx, '1 BOUNCE · RETURN IT!', 0, 110, 48, C.lime, 760));
    } else if (v.browser) statusText(ctx, v, m.rally > 1 ? `${m.rally} SHOT RALLY` : 'RALLY ON');
  }
  else if (m.phase === 'point') {
    const name = seatFor(v, m.pointWinner ?? 0)?.name ?? 'Player';
    const reason = m.reason === 'short' ? 'Shot did not cross' : 'Two ground bounces';
    if (v.browser) statusText(ctx, v, `POINT · ${name}`, reason);
    else for (const f of NATIVE) at(ctx, f, () => {
      text(ctx, f.side === m.pointWinner ? 'YOUR POINT' : 'OPPONENT POINT', 0, 110, 48);
      text(ctx, reason, 0, 50, 48, C.faded, 760);
    });
  }
}
function result(ctx: CanvasRenderingContext2D, v: GameView, f: Frame) {
  at(ctx, f, () => {
    panel(ctx, f.native ? -420 : -710, -395, f.native ? 840 : 1420, 790);
    const side = v.match.winner ?? 0;
    text(ctx, 'MATCH WON', 0, -300, 48, C.faded);
    text(ctx, seatFor(v, side)?.name ?? 'Player', 0, -195, f.native ? 72 : 96, TEAM[side], f.native ? 750 : 1280);
    text(ctx, `${v.match.score[0]}   —   ${v.match.score[1]}`, 0, -60, f.native ? 112 : 144);
    text(ctx, `Best rally: ${v.match.bestRally} shots`, 0, 93, 40, C.faded);
    text(ctx, 'Another match?', 0, 185, 48);
    button(ctx, f, 'rematch', { x: f.native ? -366 : -450, y: 261, width: f.native ? 350 : 420, height: 120 }, 'REMATCH', true);
    button(ctx, f, 'setup', { x: f.native ? 16 : 30, y: 261, width: f.native ? 350 : 420, height: 120 }, 'CHANGE SETUP');
  });
}
export function drawGame(ctx: CanvasRenderingContext2D, v: GameView) {
  for (const key of Object.keys(BUTTONS) as Key[]) BUTTONS[key] = [];
  if (!court) makeCourt();
  ctx.drawImage(court!, 0, 0);
  const frames = v.browser ? [BROWSER] : NATIVE;
  if (v.mode === 'play') { play(ctx, v); return; }
  ctx.fillStyle = 'rgba(15,49,42,.28)'; ctx.fillRect(0, 0, 1920, 1080);
  if (v.mode === 'title') frames.forEach(f => titleScreen(ctx, v, f));
  if (v.mode === 'setup') frames.forEach(f => setup(ctx, v, f));
  if (v.mode === 'help') frames.forEach(f => help(ctx, v, f));
  if (v.mode === 'over') frames.forEach(f => result(ctx, v, f));
  v.drawEffects();
}
