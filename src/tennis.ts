/** Pure arcade tennis rules. Physical controllers supply strikes; this module never moves a piece. */
export type Side = 0 | 1;
export type MatchPhase = 'serve' | 'rally' | 'point' | 'over';
export type PointReason = 'baseline' | 'short' | null;
export interface Ball { x: number; y: number; vx: number; vy: number }
export interface Match {
  phase: MatchPhase;
  ball: Ball;
  receiver: Side;
  lastHitter: Side | null;
  crossedNet: boolean;
  backWallBounces: 0 | 1;
  shotTime: number;
  score: [number, number];
  rally: number;
  bestRally: number;
  server: Side;
  winner: Side | null;
  pointWinner: Side | null;
  reason: PointReason;
  pointTimer: number;
}
export const COURT = { left: 0, right: 1920, top: 0, bottom: 1080, net: 960 } as const;
export const BALL_RADIUS = 18;
export const POINT_DELAY = 1.4;
export const TENNIS = {
  pointsToWin: 7, leadToWin: 2, receiverSpeed: 220,
  slowStartLeft: 620, slowStartRight: 1300, slowFullLeft: 480, slowFullRight: 1440,
  maximumStep: 1 / 120, netCrossTimeout: 8,
} as const;
export const opponent = (side: Side): Side => side === 0 ? 1 : 0;
export const inOwnHalf = (side: Side, x: number): boolean => Number.isFinite(x)
  && (side === 0 ? x < COURT.net : x > COURT.net);
const serveBall = (side: Side): Ball => ({ x: side === 0 ? 500 : 1420, y: 540, vx: 0, vy: 0 });

export function createMatch(server: Side = 0): Match {
  return { phase: 'serve', ball: serveBall(server), receiver: server, lastHitter: null,
    crossedNet: false, backWallBounces: 0, shotTime: 0, score: [0, 0], rally: 0, bestRally: 0, server,
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
  match.crossedNet = false; match.backWallBounces = 0; match.shotTime = 0; match.rally++;
  match.bestRally = Math.max(match.bestRally, match.rally);
  match.pointWinner = null; match.reason = null;
  return true;
}

/** Speed assistance changes travel rate, never the shot vector or its recorded power. */
export function travelScale(match: Match): number {
  if (match.phase !== 'rally' || !match.crossedNet) return 1;
  const { x, vx, vy } = match.ball;
  const speed = Math.hypot(vx, vy);
  if (speed <= TENNIS.receiverSpeed) return 1;
  if ((match.receiver === 0 && vx >= 0) || (match.receiver === 1 && vx <= 0)) {
    return match.backWallBounces === 1 && inOwnHalf(match.receiver, x) ? TENNIS.receiverSpeed / speed : 1;
  }
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

interface Boundary { t: number; kind: 'end' | 'wall'; winner: Side }
function firstBoundary(match: Match, dx: number, dy: number): Boundary | null {
  const b = match.ball, events: Boundary[] = [];
  if (dx < 0) events.push({ t: (COURT.left + BALL_RADIUS - b.x) / dx, winner: 1, kind: 'end' });
  if (dx > 0) events.push({ t: (COURT.right - BALL_RADIUS - b.x) / dx, winner: 0, kind: 'end' });
  if (dy < 0) events.push({ t: (COURT.top + BALL_RADIUS - b.y) / dy, winner: 0, kind: 'wall' });
  if (dy > 0) events.push({ t: (COURT.bottom - BALL_RADIUS - b.y) / dy, winner: 0, kind: 'wall' });
  return events.filter(e => e.t >= 0 && e.t <= 1).sort((a, b) => a.t - b.t)[0] ?? null;
}

/** Piecewise positions, including exact wall touches, for swept racket contact within a frame. */
export interface MotionPoint { time: number; x: number; y: number }

/** Advance in bounded substeps so receiver easing is independent of the display frame rate. */
export function stepMatch(match: Match, dt: number, trace?: MotionPoint[]): number {
  if (!Number.isFinite(dt) || dt <= 0 || match.phase === 'over' || match.phase === 'serve') return 0;
  if (match.phase === 'point') { match.pointTimer += dt; return dt; }
  // The caller freezes time for menus and missing pieces. Do not catch up minutes after a suspended tab.
  let remaining = Math.min(dt, 0.25);
  let elapsed = 0;
  trace?.push({ time: 0, x: match.ball.x, y: match.ball.y });
  while (remaining > 1e-9 && match.phase === 'rally') {
    if (!match.crossedNet && match.shotTime >= TENNIS.netCrossTimeout - 1e-9) {
      awardPoint(match, opponent(match.lastHitter ?? match.server), 'short'); return elapsed;
    }
    const step = Math.min(remaining, TENNIS.maximumStep,
      match.crossedNet ? Infinity : TENNIS.netCrossTimeout - match.shotTime);
    const scale = travelScale(match);
    const dx = match.ball.vx * step * scale, dy = match.ball.vy * step * scale;
    const boundary = firstBoundary(match, dx, dy);
    const fraction = boundary?.t ?? 1;
    const oldX = match.ball.x;
    match.ball.x += dx * fraction; match.ball.y += dy * fraction;
    if (!match.crossedNet && (match.receiver === 1
      ? oldX <= COURT.net && match.ball.x > COURT.net
      : oldX >= COURT.net && match.ball.x < COURT.net)) match.crossedNet = true;
    const spent = step * fraction;
    elapsed += spent; remaining -= spent; match.shotTime += spent;
    trace?.push({ time: elapsed, x: match.ball.x, y: match.ball.y });
    if (boundary?.kind === 'end') {
      if (match.crossedNet && match.backWallBounces === 1) {
        awardPoint(match, opponent(match.receiver), 'baseline'); return elapsed;
      }
      if (match.crossedNet) match.backWallBounces = 1;
      match.ball.vx = -match.ball.vx;
    }
    if (boundary?.kind === 'wall') match.ball.vy = -match.ball.vy;
  }
  if (!match.crossedNet && match.shotTime >= TENNIS.netCrossTimeout - 1e-9) {
    awardPoint(match, opponent(match.lastHitter ?? match.server), 'short');
  }
  return elapsed;
}

/** A point announcement may end, but play never restarts without a deliberate serving swing. */
export function nextServe(match: Match): boolean {
  if (match.phase !== 'point' || match.pointTimer < POINT_DELAY) return false;
  match.ball = serveBall(match.server);
  match.phase = 'serve'; match.receiver = match.server; match.lastHitter = null;
  match.crossedNet = false; match.backWallBounces = 0; match.shotTime = 0; match.rally = 0; match.pointTimer = 0;
  return true;
}
