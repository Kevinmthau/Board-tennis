/** Pure arcade tennis rules. Physical controllers supply strikes; this module never moves a piece. */
export type Side = 0 | 1;
export type MatchPhase = 'serve' | 'rally' | 'point' | 'over';
export type PointReason = 'double-bounce' | 'short' | null;
export interface Ball { x: number; y: number; vx: number; vy: number; z: number; vz: number }
export interface GroundBounce { x: number; y: number; age: number }
export interface Match {
  phase: MatchPhase;
  ball: Ball;
  receiver: Side;
  lastHitter: Side | null;
  crossedNet: boolean;
  groundBounces: 0 | 1 | 2;
  gravity: number;
  bounceSerial: number;
  lastBounce: GroundBounce | null;
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
  maximumStep: 1 / 120, netCrossTimeout: 8, landingLeft: 470, landingRight: 1450,
  arcHeight: 180, rebound: .6,
} as const;
export const opponent = (side: Side): Side => side === 0 ? 1 : 0;
export const inOwnHalf = (side: Side, x: number): boolean => Number.isFinite(x)
  && (side === 0 ? x < COURT.net : x > COURT.net);
const serveBall = (side: Side): Ball => ({ x: side === 0 ? 500 : 1420, y: 540, vx: 0, vy: 0, z: 0, vz: 0 });

export function createMatch(server: Side = 0): Match {
  return { phase: 'serve', ball: serveBall(server), receiver: server, lastHitter: null,
    crossedNet: false, groundBounces: 0, gravity: 800, bounceSerial: 0, lastBounce: null,
    shotTime: 0, score: [0, 0], rally: 0, bestRally: 0, server,
    winner: null, pointWinner: null, reason: null, pointTimer: 0 };
}

/** Volleys and returns after one bounce are legal, once the ball crosses the net. */
export function canStrike(match: Match, side: Side): boolean {
  return match.receiver === side && inOwnHalf(side, match.ball.x)
    && (match.phase === 'serve' || (match.phase === 'rally' && match.crossedNet && match.groundBounces < 2));
}

/** Plan only height: horizontal direction and speed remain the measured racket tangent.
 * The first landing is in the receiving half, including a bank off the hitter's own wall.
 * Flight and planar travel share the slowdown clock so assistance cannot make the ball land short. */
function launchArc(match: Match): void {
  const b = match.ball;
  const target = match.receiver === 0 ? TENNIS.landingLeft : TENNIS.landingRight;
  const toward = (target - b.x) * b.vx > 0;
  const wall = b.vx < 0 ? COURT.left + BALL_RADIUS : COURT.right - BALL_RADIUS;
  const distance = toward ? Math.abs(target - b.x) : Math.abs(wall - b.x) + Math.abs(target - wall);
  const duration = Math.min(TENNIS.netCrossTimeout, Math.max(.45, distance / Math.max(1e-9, Math.abs(b.vx))));
  const height = Math.max(TENNIS.arcHeight, b.z + 35);
  const roots = Math.sqrt(height) + Math.sqrt(height - b.z);
  match.gravity = 2 * roots * roots / (duration * duration);
  b.vz = Math.sqrt(2 * match.gravity * (height - b.z));
}

/** No direction correction: the measured tangent is the shot, including a backwards shot. */
export function strike(match: Match, side: Side, hit: { vx: number; vy: number }): boolean {
  if (!canStrike(match, side) || !Number.isFinite(hit.vx) || !Number.isFinite(hit.vy)
    || Math.hypot(hit.vx, hit.vy) <= 0) return false;
  match.ball.vx = hit.vx; match.ball.vy = hit.vy;
  match.phase = 'rally'; match.lastHitter = side; match.receiver = opponent(side);
  match.crossedNet = false; match.groundBounces = 0; match.shotTime = 0; match.rally++;
  launchArc(match);
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
  if ((match.receiver === 0 && vx > 0) || (match.receiver === 1 && vx < 0)) {
    return inOwnHalf(match.receiver, x) ? TENNIS.receiverSpeed / speed : 1;
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
  match.ball.vx = 0; match.ball.vy = 0; match.ball.vz = 0;
  if (match.score[side] >= TENNIS.pointsToWin
    && match.score[side] - match.score[opponent(side)] >= TENNIS.leadToWin) {
    match.phase = 'over'; match.winner = side;
  } else match.phase = 'point';
}

interface Boundary { t: number; kind: 'end' | 'wall' }
function firstBoundary(match: Match, dx: number, dy: number): Boundary | null {
  const b = match.ball, events: Boundary[] = [];
  if (dx < 0) events.push({ t: (COURT.left + BALL_RADIUS - b.x) / dx, kind: 'end' });
  if (dx > 0) events.push({ t: (COURT.right - BALL_RADIUS - b.x) / dx, kind: 'end' });
  if (dy < 0) events.push({ t: (COURT.top + BALL_RADIUS - b.y) / dy, kind: 'wall' });
  if (dy > 0) events.push({ t: (COURT.bottom - BALL_RADIUS - b.y) / dy, kind: 'wall' });
  return events.filter(e => e.t >= 0 && e.t <= 1).sort((a, b) => a.t - b.t)[0] ?? null;
}

/** Time to the descending ground intersection, measured on the same clock as planar travel. */
function timeToGround(match: Match): number {
  const { z, vz } = match.ball;
  return (vz + Math.sqrt(vz * vz + 2 * match.gravity * Math.max(0, z))) / match.gravity;
}

/** Piecewise positions, including exact wall touches and the final landing, for swept racket contact. */
export interface MotionPoint { time: number; x: number; y: number; z: number }

/** Advance in bounded substeps so receiver easing is independent of the display frame rate. */
export function stepMatch(match: Match, dt: number, trace?: MotionPoint[]): number {
  if (!Number.isFinite(dt) || dt <= 0 || match.phase === 'over' || match.phase === 'serve') return 0;
  if (match.phase === 'point') {
    match.pointTimer += dt;
    if (match.lastBounce) match.lastBounce.age += dt;
    return dt;
  }
  // The caller freezes time for menus and missing pieces. Do not catch up minutes after a suspended tab.
  let remaining = Math.min(dt, 0.25);
  let elapsed = 0;
  trace?.push({ time: 0, x: match.ball.x, y: match.ball.y, z: match.ball.z });
  while (remaining > 1e-9 && match.phase === 'rally') {
    if (!match.crossedNet && match.shotTime >= TENNIS.netCrossTimeout - 1e-9) {
      awardPoint(match, opponent(match.lastHitter ?? match.server), 'short'); return elapsed;
    }
    const scale = travelScale(match);
    const groundTime = timeToGround(match) / scale;
    const step = Math.min(remaining, TENNIS.maximumStep, groundTime,
      match.crossedNet ? Infinity : TENNIS.netCrossTimeout - match.shotTime);
    const dx = match.ball.vx * step * scale, dy = match.ball.vy * step * scale;
    const boundary = firstBoundary(match, dx, dy);
    const fraction = boundary?.t ?? 1;
    const oldX = match.ball.x;
    const spent = step * fraction, flightTime = spent * scale;
    match.ball.x += dx * fraction; match.ball.y += dy * fraction;
    match.ball.z = Math.max(0, match.ball.z + match.ball.vz * flightTime - .5 * match.gravity * flightTime * flightTime);
    match.ball.vz -= match.gravity * flightTime;
    if (!match.crossedNet && (match.receiver === 1
      ? oldX <= COURT.net && match.ball.x > COURT.net
      : oldX >= COURT.net && match.ball.x < COURT.net)) match.crossedNet = true;
    elapsed += spent; remaining -= spent; match.shotTime += spent;
    if (match.lastBounce) match.lastBounce.age += spent;
    trace?.push({ time: elapsed, x: match.ball.x, y: match.ball.y, z: match.ball.z });
    if (boundary?.kind === 'end') match.ball.vx = -match.ball.vx;
    if (boundary?.kind === 'wall') match.ball.vy = -match.ball.vy;
    if (spent >= groundTime - 1e-9) {
      match.ball.z = 0;
      if (!match.crossedNet) {
        awardPoint(match, opponent(match.lastHitter ?? match.server), 'short'); return elapsed;
      }
      match.groundBounces = match.groundBounces === 0 ? 1 : 2;
      match.bounceSerial++;
      match.lastBounce = { x: match.ball.x, y: match.ball.y, age: 0 };
      if (match.groundBounces === 2) {
        awardPoint(match, match.lastHitter ?? opponent(match.receiver), 'double-bounce'); return elapsed;
      }
      match.ball.vz = Math.abs(match.ball.vz) * TENNIS.rebound;
    }
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
  match.crossedNet = false; match.groundBounces = 0; match.lastBounce = null;
  match.shotTime = 0; match.rally = 0; match.pointTimer = 0;
  return true;
}
