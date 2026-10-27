import { gameFont } from './runtime';
import { drawTitle } from './title';
import { drawButton, type Box } from './howto';
import type { Match, Side } from './tennis';
import type { SwingPose } from './swing';
export interface RacketView { pose: SwingPose; side: Side; active: boolean; glyphId: number }
export interface GameView {
  mode: 'title' | 'setup' | 'help' | 'play' | 'over'; now: number; match: Match; browser: boolean; canContinue: boolean;
  seats: { name: string; side: Side | null; present: boolean; glyphId: number }[];
  rackets: RacketView[]; missing: boolean; drawEffects: () => void;
}
export const BUTTONS: Record<'play'|'continue'|'help'|'back'|'add'|'leftPlayer'|'rightPlayer'|'rematch'|'setup', Box[]> = {
  play: [{ x: 490, y: 730, width: 440, height: 140 }], continue: [{ x: 490, y: 900, width: 440, height: 120 }],
  help: [{ x: 990, y: 730, width: 440, height: 140 }], back: [{ x: 760, y: 880, width: 400, height: 140 }],
  add: [{ x: 740, y: 760, width: 440, height: 140 }], leftPlayer: [{ x: 220, y: 760, width: 440, height: 140 }],
  rightPlayer: [{ x: 1260, y: 760, width: 440, height: 140 }], rematch: [{ x: 490, y: 730, width: 440, height: 140 }],
  setup: [{ x: 990, y: 730, width: 440, height: 140 }],
};
export async function loadGameArt() {}
export function drawGame(ctx: CanvasRenderingContext2D, v: GameView) {
  ctx.fillStyle = '#205744'; ctx.fillRect(0, 0, 1920, 1080);
  ctx.fillStyle = '#3279a4'; ctx.fillRect(260, 190, 1400, 700);
  ctx.strokeStyle = '#fff0c6'; ctx.lineWidth = 5; ctx.strokeRect(260, 190, 1400, 700);
  ctx.beginPath(); ctx.moveTo(960, 190); ctx.lineTo(960, 890); ctx.stroke();
  ctx.fillStyle = '#fff0c6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = gameFont(48);
  if (v.mode === 'title') { drawTitle(ctx, { x: 370, y: 140, width: 1180, height: 450 }); drawButton(ctx, BUTTONS.play[0], 'PLAY'); drawButton(ctx, BUTTONS.help[0], 'HOW TO PLAY'); }
  if (v.mode === 'setup') { ctx.fillText('Place one Sports piece at each end', 960, 360); ctx.fillText(`${v.seats.length} of 2 players`, 960, 460); drawButton(ctx, BUTTONS.add[0], 'ADD PLAYER'); }
  if (v.mode === 'play' || v.mode === 'over') {
    ctx.font = gameFont(72); ctx.fillText(`${v.match.score[0]}    —    ${v.match.score[1]}`, 960, 110);
    for (const r of v.rackets) { const a = r.pose.facingDeg * Math.PI / 180; ctx.strokeStyle = r.active ? '#fff0c6' : '#a8bab2'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(r.pose.x + Math.cos(a) * r.pose.frontReach, r.pose.y + Math.sin(a) * r.pose.frontReach); ctx.lineTo(r.pose.x + Math.cos(a) * 240, r.pose.y + Math.sin(a) * 240); ctx.stroke(); }
    ctx.fillStyle = '#effb77'; ctx.beginPath(); ctx.arc(v.match.ball.x, v.match.ball.y, 18, 0, Math.PI * 2); ctx.fill();
    ctx.font = gameFont(48); if (v.match.phase === 'serve') ctx.fillText('Twist through the ball to serve', 960, 970);
    if (v.missing) ctx.fillText('Return both Sports pieces', 960, 540);
  }
  if (v.mode === 'help') { ctx.fillText('Slide beside the ball. Twist the line through it.', 960, 450); drawButton(ctx, BUTTONS.back[0], 'BACK'); }
  if (v.mode === 'over') { ctx.fillText('MATCH WON', 960, 430); drawButton(ctx, BUTTONS.rematch[0], 'REMATCH'); drawButton(ctx, BUTTONS.setup[0], 'CHANGE SETUP'); }
  v.drawEffects();
}
