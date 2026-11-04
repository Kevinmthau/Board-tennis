import { gameFont } from './runtime';
import { drawTitle } from './title';
import type { Box } from './howto';
import { bake } from './fx';
import { COURT, PICKLEBALL, FAULTS, mustBounce, serviceTarget, serveSetup, travelScale, type Match, type Side } from './pickleball';
import { ballDisplay } from './ball-display';
import type { SwingPose } from './swing';

export interface RacketView { pose: SwingPose; side: Side; active: boolean; glyphId: number }
export interface GameView {
  helpPage?: number;
  mode: 'title' | 'setup' | 'help' | 'play' | 'over'; now: number; match: Match; browser: boolean; canContinue: boolean;
  seats: { name: string; side: Side | null; present: boolean; glyphId: number }[];
  rackets: RacketView[]; missing: boolean; drawEffects: () => void;
}
type Key = 'play'|'continue'|'help'|'back'|'add'|'leftPlayer'|'rightPlayer'|'rematch'|'setup'|'helpNext'|'helpPrev';
export const BUTTONS: Record<Key, Box[]> = { play: [], continue: [], help: [], back: [], add: [], leftPlayer: [], rightPlayer: [], rematch: [], setup: [], helpNext: [], helpPrev: [] };
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
function text(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, size = 48, color = C.cream, max = Infinity, floor = size >= 48 ? 48 : 32, maxLines = 2) {
  label = label.replace(/\s+/g, ' ').trim();
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
    // Long profile-name components wrap within the same bounded text slot.
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
  if (lines.length > maxLines) {
    lines.length = maxLines;
    const chars = Array.from(lines[maxLines - 1].trimEnd());
    while (chars.length && ctx.measureText(chars.join('') + '…').width > max) chars.pop();
    lines[maxLines - 1] = chars.join('').trimEnd() + '…';
  }
  const ink = lines.map(row => ctx.measureText(row));
  // Accents and descenders can exceed the font's nominal line height.
  const leading = Math.max(px * 1.12, ...ink.slice(1).map((m, i) => ink[i].actualBoundingBoxDescent + m.actualBoundingBoxAscent + px * .16));
  const height = (lines.length - 1) * leading + ink[0].actualBoundingBoxAscent + ink[ink.length - 1].actualBoundingBoxDescent;
  const firstBaseline = y - height / 2 + ink[0].actualBoundingBoxAscent;
  lines.forEach((row, i) => ctx.fillText(row, x, firstBaseline + i * leading));
}
function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function ballShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, height: number) {
  const lift = Math.max(0, Math.min(360, height));
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#082f40'; ctx.globalAlpha *= .46 - Math.min(.19, lift / 1800);
  ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.35 + lift * .07, radius * .7 + lift * .035, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha *= .55;
  ctx.beginPath(); ctx.ellipse(0, 0, radius * .95 + lift * .035, radius * .5 + lift * .018, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function ballBody(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, stretch = 1) {
  const opacity = ctx.globalAlpha;
  ctx.save(); ctx.translate(x, y); ctx.scale(stretch, 1 / Math.sqrt(stretch));
  ctx.fillStyle = '#98ad2e'; ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#f8ffb4'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.lime; ctx.beginPath(); ctx.arc(-radius * .06, -radius * .09, radius * .94, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fffbd8'; ctx.globalAlpha = opacity * .7; ctx.beginPath(); ctx.ellipse(-radius * .28, -radius * .34, radius * .3, radius * .18, -.7, 0, TAU); ctx.fill(); ctx.globalAlpha = opacity;
  // A perforated plastic pickleball, rather than tennis-ball seams.
  ctx.fillStyle = '#788c23';
  for (const [hx, hy, r] of [[0, 0, .18], [-.5, .16, .14], [.46, .12, .14], [-.16, .53, .13], [.22, -.48, .13]]) {
    ctx.beginPath(); ctx.ellipse(radius * hx, radius * hy, radius * r, radius * r * .8, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function ball(ctx: CanvasRenderingContext2D, x: number, y: number, radius = 18) {
  ballShadow(ctx, x, y + 8, radius, 0); ballBody(ctx, x, y, radius);
}
function airborneBall(ctx: CanvasRenderingContext2D, x: number, y: number, height: number, radius = 18, stretch = 1, local = false) {
  // Help is drawn in a seat's local frame; project it through a court-space anchor.
  const ox = local ? 960 : 0, oy = local ? 540 : 0;
  const display = ballDisplay({ x: x + ox, y: y + oy, z: height }, radius);
  ballShadow(ctx, x, y, radius, height);
  ballBody(ctx, display.x - ox, display.y - oy, display.radius, stretch);
}
function groundImpact(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, count: 1 | 2 = 1, facing = 0, badge = true, badgeAt?: { x: number; y: number }) {
  if (age < 0 || age > .8) return;
  const t = age / .8, burst = Math.min(1, age / .42), color = count === 2 ? C.coral : C.lime;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 9 * (1 - t) + 2;
  ctx.globalAlpha = (1 - t) * .95;
  ctx.beginPath(); ctx.ellipse(x, y, 24 + burst * 105, 16 + burst * 68, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = C.white; ctx.lineWidth = 4 * (1 - t) + 1;
  ctx.beginPath(); ctx.ellipse(x, y, 15 + burst * 70, 10 + burst * 45, 0, 0, TAU); ctx.stroke();
  if (age < .35) {
    ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const angle = i * TAU / 8, inner = 32 + burst * 76, outer = inner + 20 * (1 - burst);
      line(ctx, x + Math.cos(angle) * inner, y + Math.sin(angle) * inner * .65,
        x + Math.cos(angle) * outer, y + Math.sin(angle) * outer * .65, color, 6);
    }
    ctx.fillStyle = C.white; ctx.globalAlpha = .44 * (1 - age / .35);
    ctx.beginPath(); ctx.ellipse(x, y, 36 + burst * 34, 23 + burst * 22, 0, 0, TAU); ctx.fill();
  }
  if (badge) {
    ctx.globalAlpha = Math.min(1, (1 - t) * 2.5);
    // Keep the landing readable under a rising ball, and keep text inside the glass.
    ctx.translate(badgeAt?.x ?? Math.max(88, Math.min(1832, x)), badgeAt?.y ?? Math.max(88, Math.min(992, y + 90)));
    ctx.rotate(facing);
    ctx.fillStyle = C.deep; ctx.beginPath(); ctx.arc(0, 0, 35, 0, TAU); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.stroke();
    text(ctx, String(count), 0, 0, 48, color);
  }
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
    const ground = ctx.createLinearGradient(0, 0, 1920, 1080);
    ground.addColorStop(0, '#286957'); ground.addColorStop(1, '#174c43');
    ctx.fillStyle = ground; ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = C.blue;
    ctx.fillRect(COURT.left, COURT.top, COURT.right - COURT.left, COURT.bottom - COURT.top);
    ctx.fillStyle = '#256d88';
    ctx.fillRect(COURT.kitchenLeft, COURT.top, COURT.kitchenRight - COURT.kitchenLeft, COURT.bottom - COURT.top);
    let seed = 137;
    for (let i = 0; i < 5400; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0; const x = (seed >>> 0) / 4294967296 * 1920;
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0; const y = (seed >>> 0) / 4294967296 * 1080;
      ctx.fillStyle = i % 2 ? 'rgba(255,255,220,.035)' : 'rgba(8,52,68,.045)'; ctx.fillRect(x, y, 2, 2);
    }
    // Rule coordinates are the outside edges of the boundary lines; lines count as in.
    ctx.strokeStyle = C.cream; ctx.lineWidth = 6;
    ctx.strokeRect(COURT.left + 3, COURT.top + 3, COURT.right - COURT.left - 6, COURT.bottom - COURT.top - 6);
    for (const x of [COURT.kitchenLeft + 3, COURT.kitchenRight - 3]) line(ctx, x, COURT.top, x, COURT.bottom, C.cream, 6);
    line(ctx, COURT.left, 540, COURT.kitchenLeft, 540, C.cream, 6);
    line(ctx, COURT.kitchenRight, 540, COURT.right, 540, C.cream, 6);
    ctx.fillStyle = 'rgba(11,45,47,.18)'; ctx.fillRect(961, COURT.top, 17, COURT.bottom - COURT.top);
    ctx.fillStyle = '#174d56'; ctx.fillRect(954, COURT.top, 12, COURT.bottom - COURT.top);
    for (let y = COURT.top; y < COURT.bottom; y += 13) line(ctx, 953, y, 969, y + 3, '#8fb5b6', 1);
    line(ctx, 959, COURT.top, 959, COURT.bottom, C.white, 5);

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

    drawTitle(ctx, { x: f.native ? -330 : -540, y: -290, width: f.native ? 660 : 1080, height: f.native ? 240 : 320 }, { ink: C.cream });
    if (f.native) {
      paddle(ctx, -260, 52, 110, -.4, C.coral); paddle(ctx, 260, 52, 110, .4, C.cream);

      ball(ctx, Math.sin(v.now / 850) * 105, 60, 29);

      if (v.canContinue) button(ctx, f, 'continue', { x: -180, y: 140, width: 360, height: 120 }, 'CONTINUE', true);
      button(ctx, f, 'play', { x: -366, y: 282, width: 350, height: 120 }, v.canContinue ? 'NEW MATCH' : 'PLAY', !v.canContinue);
      button(ctx, f, 'help', { x: 16, y: 282, width: 350, height: 120 }, 'HOW TO PLAY');
    } else {
      paddle(ctx, -550, -20, 220, -.4, C.coral); paddle(ctx, 550, -20, 220, .4, C.cream);

      ball(ctx, Math.sin(v.now / 1000) * 150, 98, 25);

      const buttons = v.canContinue ? [{ key: 'continue' as Key, label: 'CONTINUE', primary: true }, { key: 'play' as Key, label: 'NEW MATCH', primary: false }, { key: 'help' as Key, label: 'HOW TO PLAY', primary: false }]
        : [{ key: 'play' as Key, label: 'PLAY', primary: true }, { key: 'help' as Key, label: 'HOW TO PLAY', primary: false }];
      const bw = v.canContinue ? 360 : 420, gap = 28, total = buttons.length * bw + (buttons.length - 1) * gap;
      buttons.forEach((b, i) => button(ctx, f, b.key, { x: -total / 2 + i * (bw + gap), y: 282, width: bw, height: 120 }, b.label, b.primary));
    }
  });
}
/** Original paddle key art. These are sports equipment, never substitutes for physical Board pieces. */
function paddle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, color: string) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = '#102f2b'; round(ctx, -size * .12, size * .2, size * .24, size * .65, size * .08); ctx.fill();
  ctx.fillStyle = color; round(ctx, -size * .46, -size * .65, size * .92, size * 1.05, size * .23); ctx.fill();
  ctx.strokeStyle = C.deep; ctx.lineWidth = size * .035; ctx.stroke();
  ctx.fillStyle = C.blueDark; round(ctx, -size * .33, -size * .5, size * .66, size * .72, size * .17); ctx.fill();
  line(ctx, -size * .22, -size * .3, size * .22, size * .04, C.cream, size * .06);
  ctx.restore();
}
/** Separate 1536×864 composition for the library card; the export does not include home buttons. */
export function drawTitleCard(ctx: CanvasRenderingContext2D) {
  if (!court) makeCourt();
  ctx.drawImage(court!, 0, 0, 1536, 864);
  ctx.fillStyle = 'rgba(15,49,42,.82)'; ctx.fillRect(0, 0, 1536, 864);
  drawTitle(ctx, { x: 168, y: 20, width: 1200, height: 430 }, { ink: C.cream });
  paddle(ctx, 350, 565, 270, -.4, C.coral); paddle(ctx, 1186, 565, 270, .4, C.cream);
  ball(ctx, 768, 590, 78);
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
      piece(ctx, s?.glyphId ?? (side === 0 ? 5 : 1), x, -52, f.native ? 230 : 245);
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
export const HELP = [
  { title: 'A TWIST IS YOUR SWING', lines: ['Use any two Sports pieces.', 'Slide beside the raised ball.', 'Twist the line through it. Faster hits harder.'] },
  { title: 'SERVE DIAGONALLY', lines: ['Keep your piece behind the baseline.', 'Even: serve right. Odd: serve left.', 'One try. Clear the kitchen. Land diagonally.'] },
  { title: 'TWO OPENING BOUNCES', lines: ['Let the serve bounce before returning.', 'Let its return bounce on the other side.', 'Then volleys are allowed.'] },
  { title: 'STAY OUT TO VOLLEY', lines: ['No volley with your piece in the kitchen.', 'The line counts. Stay out through your swing.', 'You may enter to hit a ball that bounced.'] },
  { title: 'KEEP THE BALL IN', lines: ['Land inside the lines. Lines count as in.', 'The net and out-of-bounds shots are faults.', 'Two bounces lose. No wall rebounds.'] },
  { title: 'ONLY THE SERVER SCORES', lines: ['Win a serving rally: score and serve again.', 'Win as receiver: side out. Take the serve.', `First to ${PICKLEBALL.pointsToWin}, win by ${PICKLEBALL.leadToWin}. Then choose Rematch.`] },
] as const;
function help(ctx: CanvasRenderingContext2D, v: GameView, f: Frame) {
  at(ctx, f, () => {
    const page = Math.max(0, Math.min(HELP.length - 1, v.helpPage ?? 0)), lesson = HELP[page];
    panel(ctx, f.native ? -420 : -760, -430, f.native ? 840 : 1520, 860);
    text(ctx, lesson.title, 0, -350, f.native ? 40 : 56, C.cream, f.native ? 770 : 1320, 32, 1);
    const t = (v.now % 4000) / 4000;
    if (page === 0) {
      const px = -170, py = -10;
      piece(ctx, 5, px, py, 150);
      const swing = Math.min(1, Math.max(0, (t - .15) / .28)), angle = (-120 + swing * 60) * Math.PI / 180;
      line(ctx, px + Math.cos(angle) * 90, py + Math.sin(angle) * 90,
        px + Math.cos(angle) * 210, py + Math.sin(angle) * 210, C.cream, 7);
      const flight = Math.min(1, Math.max(0, (t - .29) / .5));
      airborneBall(ctx, px + flight * 420, py - 125, 110 * Math.sin(flight * Math.PI), 20, 1, true);
    } else {
      const left = -300, right = 300, top = -250, bottom = 10, kitchen = 95;
      ctx.fillStyle = C.blue; ctx.fillRect(left, top, right - left, bottom - top);
      ctx.fillStyle = '#256d88'; ctx.fillRect(-kitchen, top, kitchen * 2, bottom - top);
      ctx.strokeStyle = C.cream; ctx.lineWidth = 4; ctx.strokeRect(left, top, right - left, bottom - top);
      for (const x of [-kitchen, 0, kitchen]) line(ctx, x, top, x, bottom, C.cream, 4);
      line(ctx, left, -120, -kitchen, -120, C.cream, 3); line(ctx, kitchen, -120, right, -120, C.cream, 3);
      if (page === 1) {
        ctx.fillStyle = 'rgba(230,243,111,.3)'; ctx.fillRect(kitchen, top, right - kitchen, 130);
        ball(ctx, -340 + t * 590, -50 - t * 140, 14);
      } else if (page === 2) {
        const half = t < .5, u = (t % .5) * 2, x = half ? -240 + u * 480 : 240 - u * 480;
        const hop = u < .8 ? Math.sin(u / .8 * Math.PI) * 60 : Math.sin((u - .8) / .2 * Math.PI) * 25;
        ball(ctx, x, -120 - hop, 14);
        if (u > .8) groundImpact(ctx, half ? 144 : -144, -120, (u - .8) * 2, 1, 0, false);
      } else if (page === 3) {
        const illegal = t >= .5;
        piece(ctx, 5, illegal ? -35 : -170, -115, 95);
        text(ctx, illegal ? 'FAULT' : 'VOLLEY', 185, -110, 32, illegal ? C.coral : C.lime);
      } else if (page === 4) {
        ball(ctx, -240 + t * 480, -120 - t * 200, 14);
        if (t > .65) text(ctx, 'OUT', 210, -105, 32, C.coral);
      } else {
        text(ctx, t < .5 ? 'SERVER +1' : 'SIDE OUT', 0, -170, 40, C.lime);
        text(ctx, t < .5 ? '1 — 0' : '1 — 0', 0, -80, 48);
      }
    }
    lesson.lines.forEach((label, i) => text(ctx, label, 0, 100 + i * 58, f.native ? 32 : 40,
      i === 2 ? C.faded : C.cream, f.native ? 760 : 1320, 32, 1));
    for (let i = 0; i < HELP.length; i++) { ctx.fillStyle = i === page ? C.lime : '#548375'; ctx.beginPath(); ctx.arc((i - 2.5) * 28, 270, 6, 0, TAU); ctx.fill(); }
    if (page > 0) button(ctx, f, 'helpPrev', { x: -380, y: 302, width: 220, height: 120 }, 'PREV');
    button(ctx, f, 'back', { x: -140, y: 302, width: 280, height: 120 }, 'BACK');
    button(ctx, f, 'helpNext', { x: 160, y: 302, width: 220, height: 120 }, page === HELP.length - 1 ? 'DONE' : 'NEXT', true);
  });
}

function hud(ctx: CanvasRenderingContext2D, v: GameView) {
  if (v.browser) {
    for (const side of [0, 1] as Side[]) {
      const x = side === 0 ? 440 : 1480, s = seatFor(v, side);
      ctx.fillStyle = C.deep; round(ctx, x - 300, 50, 600, 128, 25); ctx.fill();
      ctx.fillStyle = TEAM[side]; round(ctx, x - 300, 50, 12, 128, 5); ctx.fill();
      text(ctx, s?.name ?? 'Player', x - 60, 114, 48, TEAM[side], 390);
      text(ctx, String(v.match.score[side]), x + 218, 114, 76, C.cream, 132, 48, 1);
    }
    text(ctx, `FIRST TO ${PICKLEBALL.pointsToWin}`, 960, 86, 48, C.cream);
    text(ctx, 'WIN BY 2', 960, 143, 48, C.faded);
  } else {
    for (const side of [0, 1] as Side[]) {
      // Use the corners of the service lane, leaving both serving halves and the ball clear.
      ctx.save(); ctx.translate(serveSetup(side).x, COURT.middle); ctx.rotate(side === 0 ? Math.PI / 2 : -Math.PI / 2);
      text(ctx, seatFor(v, side)?.name ?? 'Player', 388, 0, 48, TEAM[side], 208);
      text(ctx, String(v.match.score[side]), -388, 0, 88, C.cream, 208, 48, 1);
      ctx.restore();
    }
  }
}
function statusText(ctx: CanvasRenderingContext2D, v: GameView, label: string, second?: string) {
  if (v.browser) {
    text(ctx, label, 960, second ? 950 : 979, 48, C.cream, 1720, 48, 1);
    if (second) text(ctx, second, 960, 1008, 48, C.faded, 1720);
  } else {
    for (const f of NATIVE) at(ctx, f, () => { text(ctx, label, 0, 110, 48, C.cream, 760); if (second) text(ctx, second, 0, 50, 48, C.faded, 760); });
  }
}
export function pointPopPosition(side: Side, browser: boolean) {
  return { x: browser ? side === 0 ? 420 : 1500 : side === 0 ? 640 : 1280, y: 540 };
}
function bounceBadgePosition(v: GameView, x: number, y: number) {
  // Reserve the HUD and instruction slots so a court contact never covers their text.
  const zones: Box[] = v.browser
    ? [{ x: 160, y: 48, width: 1600, height: 132 }, { x: 48, y: 920, width: 1824, height: 112 }]
    : [48, COURT.right].flatMap(x => [48, 820].map(y => ({ x, y, width: 168, height: 212 }))).concat([
      { x: 330, y: 140, width: 145, height: 800 }, { x: 1445, y: 140, width: 145, height: 800 }]);
  if (v.match.phase === 'point' && v.match.pointWinner !== null) {
    const pop = pointPopPosition(v.match.pointWinner, v.browser);
    zones.push(v.browser ? { x: pop.x - 110, y: pop.y - 190, width: 220, height: 300 }
      : { x: pop.x - (v.match.pointWinner === 0 ? 100 : 190), y: pop.y - 110, width: 290, height: 220 });
  }
  const clampX = (n: number) => Math.max(88, Math.min(1832, n));
  const clampY = (n: number) => Math.max(88, Math.min(992, n));
  const preferred = { x: clampX(x), y: clampY(y + 90) }, pad = 44;
  const xs = [preferred.x, ...zones.flatMap(z => [clampX(z.x - pad), clampX(z.x + z.width + pad)])];
  const ys = [preferred.y, ...zones.flatMap(z => [clampY(z.y - pad), clampY(z.y + z.height + pad)])];
  let best = preferred, distance = Infinity;
  for (const cx of xs) for (const cy of ys) {
    if (zones.some(z => cx + pad > z.x && cx - pad < z.x + z.width && cy + pad > z.y && cy - pad < z.y + z.height)) continue;
    const d = (cx - preferred.x) ** 2 + (cy - preferred.y) ** 2;
    if (d < distance) { best = { x: cx, y: cy }; distance = d; }
  }
  return best;
}
function play(ctx: CanvasRenderingContext2D, v: GameView) {
  hud(ctx, v);
  const m = v.match;
  if (m.phase === 'serve') {
    const box = serviceTarget(m), setup = serveSetup(m.server, m.score[m.server]);
    ctx.save(); ctx.globalAlpha = .18 + .06 * Math.sin(v.now / 400); ctx.fillStyle = C.lime;
    ctx.fillRect(box.left + 6, box.top + 6, box.right - box.left - 12, box.bottom - box.top - 12);
    // A fixed service area requests a legal position; it never follows a physical piece.
    ctx.fillRect(setup.x - 78, setup.y - 90, 156, 180);
    ctx.restore();
  }

  if (m.phase === 'rally' && travelScale(m) < .7) {
    // Discreet boundary ticks mark the receiving window without following the controller.
    const x = m.receiver === 0 ? COURT.left - 24 : COURT.right + 24;
    ctx.save(); ctx.globalAlpha = .4;
    line(ctx, x, COURT.top + 12, x, COURT.top + 72, C.lime, 6);
    line(ctx, x, COURT.bottom - 72, x, COURT.bottom - 12, C.lime, 6); ctx.restore();
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
  if (m.lastBounce && m.lastBounce.age <= .8) {
    const count = m.groundBounces === 2 ? 2 : 1;
    const side = count === 2 ? m.receiver : m.lastBounce.x < 960 ? 0 : 1;
    groundImpact(ctx, m.lastBounce.x, m.lastBounce.y, m.lastBounce.age, count, v.browser ? 0 : NATIVE[side].angle,
      !v.missing, bounceBadgePosition(v, m.lastBounce.x, m.lastBounce.y));
  }
  const impactAge = m.lastBounce?.age ?? Infinity;
  if (m.phase !== 'over' && (m.phase !== 'point' || impactAge < .5)) {
    const squash = m.ball.z < 38 ? .72 * Math.max(0, 1 - impactAge / .18) : 0;
    ctx.save();
    if (m.phase === 'point') ctx.globalAlpha = Math.max(0, 1 - impactAge / .5);
    airborneBall(ctx, m.ball.x, m.ball.y, m.ball.z, 18, 1 + squash);
    ctx.restore();
  }
  if (v.missing) {
    ctx.fillStyle = 'rgba(13,49,44,.55)'; ctx.fillRect(0, 0, 1920, 1080);
    for (const side of [0, 1] as Side[]) {
      const s = seatFor(v, side);
      const f = v.browser ? { ...BROWSER, cx: side === 0 ? 550 : 1370 } : NATIVE[side];
      at(ctx, f, () => {
        // Keep the native pause heading above the artwork, clear of the return instruction.
        if (f.native) text(ctx, 'Rally paused', 0, -215, 48, C.cream, 760);
        if (s?.present) return;
        piece(ctx, s?.glyphId ?? 5, 0, -40, 190);
        text(ctx, 'Return your piece', 0, 126, 48, C.cream, 720);
      });
    }
    if (v.browser) statusText(ctx, v, 'Rally paused');
    return;
  }
  if (m.phase === 'serve') {
    const name = seatFor(v, m.server)?.name ?? (m.server === 0 ? 'Left player' : 'Right player');
    if (v.browser) statusText(ctx, v, `SERVE · ${name}`, 'Serve diagonally · one attempt');
    else for (const f of NATIVE) at(ctx, f, () => {
      text(ctx, f.side === m.server ? 'YOUR SERVE' : 'GET READY', 0, 110, 48);
      if (f.side === m.server) text(ctx, m.score[m.server] % 2 === 0 ? 'Serve from your right' : 'Serve from your left', 0, 50, 48, C.faded, 760);
    });
  } else if (m.phase === 'rally') {
    if (mustBounce(m)) {
      if (v.browser) statusText(ctx, v, m.rally === 1 ? 'LET THE SERVE BOUNCE' : 'LET THE RETURN BOUNCE');
      else at(ctx, NATIVE[m.receiver], () => text(ctx, 'LET IT BOUNCE', 0, 110, 48, C.lime, 760));
    } else if (m.groundBounces === 1) {
      if (v.browser) text(ctx, '1 BOUNCE · RETURN IT!', m.receiver === 0 ? 490 : 1430, 980, 48, C.lime, 860);
      else at(ctx, NATIVE[m.receiver], () => text(ctx, '1 BOUNCE · RETURN IT!', 0, 110, 48, C.lime, 760));
    } else if (v.browser) statusText(ctx, v, m.rally > 1 ? `${m.rally} SHOT RALLY` : 'RALLY ON');
  }
  else if (m.phase === 'point' && m.pendingOutcome) {
    statusText(ctx, v, 'Finish your swing', 'Keep clear of the kitchen');
  } else if (m.phase === 'point') {
    const name = seatFor(v, m.pointWinner ?? 0)?.name ?? 'Player';
    const reason = m.reason ? FAULTS[m.reason] : 'Finish your swing';
    if (v.browser) statusText(ctx, v, `${m.pointScored ? 'POINT' : 'SIDE OUT'} · ${name}`, reason);
    else for (const f of NATIVE) at(ctx, f, () => {
      text(ctx, m.pointScored ? (f.side === m.pointWinner ? 'YOUR POINT' : 'OPPONENT POINT') : 'SIDE OUT', 0, 110, 48);
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
    text(ctx, `${v.match.score[0]}   —   ${v.match.score[1]}`, 0, -60, f.native ? 112 : 144, C.cream, f.native ? 750 : 1280, 48, 1);
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
