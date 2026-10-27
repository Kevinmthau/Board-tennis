/** Pure arcade tennis rules. Physical controllers supply strikes; this module never moves a piece. */
export type Side = 0 | 1;
export type MatchPhase = 'serve' | 'rally' | 'point' | 'over';
export type PointReason = 'baseline' | 'out' | null;
export interface Ball { x: number; y: number; vx: number; vy: number }
export interface Match {
  phase: MatchPhase;
  ball: Ball;
  receiver: Side;
  lastHitter: Side | null;
  crossedNet: boolean;
  score: [number, number];
  rally: number;
  bestRally: number;
  server: Side;
  winner: Side | null;
  pointWinner: Side | null;
  reason: PointReason;
  pointTimer: number;
}
export const COURT = { left: 260, right: 1660, top: 190, bottom: 890, net: 960 } as const;
export const BALL_RADIUS = 18;
export const POINT_DELAY = 1.4;
export const TENNIS = {
  pointsToWin: 7, leadToWin: 2, receiverSpeed: 220,
  slowStartLeft: 620, slowStartRight: 1300, slowFullLeft: 480, slowFullRight: 1440,
  maximumStep: 1 / 120,
} as const;
export const opponent = (side: Side): Side => side === 0 ? 1 : 0;
export const inOwnHalf = (side: Side, x: number): boolean => Number.isFinite(x)
  && (side === 0 ? x < COURT.net : x > COURT.net);
const serveBall = (side: Side): Ball => ({ x: side === 0 ? 500 : 1420, y: 540, vx: 0, vy: 0 });

export function createMatch(server: Side = 0): Match {
  return { phase: 'serve', ball: serveBall(server), receiver: server, lastHitter: null,
    crossedNet: false, score: [0, 0], rally: 0, bestRally: 0, server,
    winner: null, pointWinner: null, reason: null, pointTimer: 0 };
}

/** The receiver must wait for an actual crossing, and can hit only on their side of the net. */
export function canStrike(match: Match, side: Side): boolean {
  return match.receiver === side && inOwnHalf(side, match.ball.x)
    && (match.phase === 'serve' || (match.phase === 'rally' && match.crossedNet));
}

/** No direction correction: the measured tangent is the shot, including a backwards shot. */
export function strike(match: Match, side: Side, hit: { vx: number; vy: number }): boolean {
  if (!canStrike(match, side) || !Number.isFinite(hit.vx) || !Number.isFinite(hit.vy)
    || Math.hypot(hit.vx, hit.vy) <= 0) return false;
  match.ball.vx = hit.vx; match.ball.vy = hit.vy;
  match.phase = 'rally'; match.lastHitter = side; match.receiver = opponent(side);
  match.crossedNet = false; match.rally++;
  match.bestRally = Math.max(match.bestRally, match.rally);
  match.pointWinner = null; match.reason = null;
  return true;
}

/** Speed assistance changes travel rate, never the shot vector or its recorded power. */
export function travelScale(match: Match): number {
  if (match.phase !== 'rally' || !match.crossedNet) return 1;
  const { x, vx, vy } = match.ball;
  if ((match.receiver === 0 && vx >= 0) || (match.receiver === 1 && vx <= 0)) return 1;
  const speed = Math.hypot(vx, vy);
  if (speed <= TENNIS.receiverSpeed) return 1;
  const raw = match.receiver === 0
    ? (TENNIS.slowStartLeft - x) / (TENNIS.slowStartLeft - TENNIS.slowFullLeft)
    : (x - TENNIS.slowStartRight) / (TENNIS.slowFullRight - TENNIS.slowStartRight);
  const t = Math.max(0, Math.min(1, raw));
  const ease = t * t * (3 - 2 * t);
  return 1 - ease * (1 - TENNIS.receiverSpeed / speed);
}

function awardPoint(match: Match, side: Side, reason: Exclude<PointReason, null>): void {
  match.score[side]++;
  match.pointWinner = side; match.reason = reason; match.pointTimer = 0;
  match.server = opponent(side);
  match.ball.vx = 0; match.ball.vy = 0;
  if (match.score[side] >= TENNIS.pointsToWin
    && match.score[side] - match.score[opponent(side)] >= TENNIS.leadToWin) {
    match.phase = 'over'; match.winner = side;
  } else match.phase = 'point';
}

interface Exit { t: number; winner: Side; reason: Exclude<PointReason, null> }
function firstExit(match: Match, dx: number, dy: number): Exit | null {
  const b = match.ball, exits: Exit[] = [];
  // A ball still touching a painted boundary is in. Resolve the earliest crossing at corners.
  if (dx < 0) exits.push({ t: (COURT.left - BALL_RADIUS - b.x) / dx, winner: 1, reason: 'baseline' });
  if (dx > 0) exits.push({ t: (COURT.right + BALL_RADIUS - b.x) / dx, winner: 0, reason: 'baseline' });
  const outWinner = opponent(match.lastHitter ?? match.server);
  if (dy < 0) exits.push({ t: (COURT.top - BALL_RADIUS - b.y) / dy, winner: outWinner, reason: 'out' });
  if (dy > 0) exits.push({ t: (COURT.bottom + BALL_RADIUS - b.y) / dy, winner: outWinner, reason: 'out' });
  return exits.filter(e => e.t >= 0 && e.t <= 1).sort((a, b) => a.t - b.t)[0] ?? null;
}

/** Advance in bounded substeps so receiver easing is independent of the display frame rate. */
export function stepMatch(match: Match, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0 || match.phase === 'over' || match.phase === 'serve') return;
  if (match.phase === 'point') { match.pointTimer += dt; return; }
  // The caller freezes time for menus and missing pieces. Do not catch up minutes after a suspended tab.
  let remaining = Math.min(dt, 0.25);
  while (remaining > 1e-9 && match.phase === 'rally') {
    const step = Math.min(remaining, TENNIS.maximumStep);
    remaining -= step;
    const scale = travelScale(match);
    const dx = match.ball.vx * step * scale, dy = match.ball.vy * step * scale;
    const exit = firstExit(match, dx, dy);
    if (exit) {
      match.ball.x += dx * exit.t; match.ball.y += dy * exit.t;
      awardPoint(match, exit.winner, exit.reason);
      return;
    }
    const oldX = match.ball.x;
    match.ball.x += dx; match.ball.y += dy;
    if (!match.crossedNet && (match.receiver === 1
      ? oldX <= COURT.net && match.ball.x > COURT.net
      : oldX >= COURT.net && match.ball.x < COURT.net)) match.crossedNet = true;
  }
}

/** A point announcement may end, but play never restarts without a deliberate serving swing. */
export function nextServe(match: Match): boolean {
  if (match.phase !== 'point' || match.pointTimer < POINT_DELAY) return false;
  match.ball = serveBall(match.server);
  match.phase = 'serve'; match.receiver = match.server; match.lastHitter = null;
  match.crossedNet = false; match.rally = 0; match.pointTimer = 0;
  return true;
}
