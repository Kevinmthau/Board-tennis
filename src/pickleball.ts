/** Singles pickleball. Physical controllers supply strikes; rules never move a piece. */
export type Side = 0 | 1;
export type MatchPhase = 'serve' | 'rally' | 'point' | 'over';
export const FAULTS = {
  'double-bounce': 'Two ground bounces', short: 'Shot did not cross', out: 'Ball out',
  net: 'Ball hit the net', 'serve-box': 'Serve must land diagonally',
  'serve-kitchen': 'Serve touched the kitchen', 'serve-foot': 'Serve behind your baseline',
  'two-bounce': 'Let the opening shot bounce', kitchen: 'No volley from the kitchen',
  missed: 'Return missed',
} as const;
export type PointReason = keyof typeof FAULTS | null;
export interface Point { x: number; y: number }
export interface Ball extends Point { vx: number; vy: number; z: number; vz: number }
export interface GroundBounce extends Point { age: number }
export interface Footing { outline: readonly Point[]; x: number; y: number; facingDeg: number }
export interface VolleyGuard extends Point {
  facingDeg: number; stillFor: number; anchorX: number; anchorY: number; anchorFacing: number;
}
export interface Outcome { winner: Side; reason: Exclude<PointReason, null> }
export interface Match {
  phase: MatchPhase; ball: Ball; receiver: Side; lastHitter: Side | null; crossedNet: boolean;
  groundBounces: 0 | 1 | 2; gravity: number; bounceSerial: number; lastBounce: GroundBounce | null;
  shotTime: number; score: [number, number]; rally: number; bestRally: number; server: Side;
  winner: Side | null; pointWinner: Side | null; reason: PointReason; pointTimer: number;
  pointScored: boolean; volleyGuards: [VolleyGuard | null, VolleyGuard | null]; pendingOutcome: Outcome | null;
}
const scale = 1200 / 44;
export const COURT = { left: 360, right: 1560, top: 540 - 10 * scale, bottom: 540 + 10 * scale,
  net: 960, middle: 540, kitchenLeft: 960 - 7 * scale, kitchenRight: 960 + 7 * scale } as const;
export const BALL_RADIUS = 18;
export const POINT_DELAY = 1.4;
export const PICKLEBALL = {
  pointsToWin: 11, leadToWin: 2, receiverSpeed: 220,
  slowStartLeft: 760, slowStartRight: 1160, slowFullLeft: 600, slowFullRight: 1320,
  maximumStep: 1 / 120, netCrossTimeout: 8, landingLeft: 600, landingRight: 1320,
  arcHeight: 180, rebound: .45, netHeight: 2.8333333333 * scale,
  volleySettleSeconds: .2, settleDistance: 16, settleAngle: 8,
} as const;
export const opponent = (side: Side): Side => side === 0 ? 1 : 0;
export const inOwnHalf = (side: Side, x: number): boolean => Number.isFinite(x)
  && (side === 0 ? x < COURT.net : x > COURT.net);
/** Screen y increases downward. The left player's right-hand service court is the lower one. */
export const serveFromBottom = (side: Side, score: number): boolean => (score % 2 === 0) === (side === 0);
export function serveBall(side: Side, score = 0): Ball {
  return { x: side === 0 ? 240 : 1680, y: serveFromBottom(side, score) ? 550 : 530, vx: 0, vy: 0, z: 0, vz: 0 };
}
export function serviceTarget(match: Match) {
  const bottom = !serveFromBottom(match.server, match.score[match.server]);
  return { left: match.server === 0 ? COURT.kitchenRight : COURT.left,
    right: match.server === 0 ? COURT.right : COURT.kitchenLeft,
    // Both service boxes include the entire six-pixel centerline.
    top: bottom ? COURT.middle - 3 : COURT.top, bottom: bottom ? COURT.bottom : COURT.middle + 3 };
}
export function createMatch(server: Side = 0): Match {
  return { phase: 'serve', ball: serveBall(server), receiver: server, lastHitter: null,
    crossedNet: false, groundBounces: 0, gravity: 800, bounceSerial: 0, lastBounce: null,
    shotTime: 0, score: [0, 0], rally: 0, bestRally: 0, server,
    winner: null, pointWinner: null, reason: null, pointTimer: 0, pointScored: false,
    volleyGuards: [null, null], pendingOutcome: null };
}
export const mustBounce = (match: Match): boolean => match.phase === 'rally' && match.rally <= 2 && match.groundBounces === 0;
/** Illegal volleys still make contact and fault. Do not silently disable their collision. */
export function canAttempt(match: Match, side: Side): boolean {
  return match.receiver === side && inOwnHalf(side, match.ball.x)
    && (match.phase === 'serve' || (match.phase === 'rally' && match.crossedNet && match.groundBounces < 2));
}
export const canStrike = (match: Match, side: Side): boolean => canAttempt(match, side) && !mustBounce(match);
export const onCourt = (p: Point): boolean => p.x >= COURT.left && p.x <= COURT.right
  && p.y >= COURT.top && p.y <= COURT.bottom;

/** Convex rectangular kitchen against the actual polygon, including boundary contact. */
export function inKitchen(outline: readonly Point[]): boolean {
  const inside = (p: Point) => p.x >= COURT.kitchenLeft && p.x <= COURT.kitchenRight
    && p.y >= COURT.top && p.y <= COURT.bottom;
  if (outline.some(inside)) return true;
  // Clip each outline edge to the kitchen. Also catches a piece spanning a corner with no vertex inside.
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    let lo = 0, hi = 1;
    for (const [start, delta, min, max] of [[a.x, b.x - a.x, COURT.kitchenLeft, COURT.kitchenRight],
      [a.y, b.y - a.y, COURT.top, COURT.bottom]]) {
      if (delta === 0) { if (start < min || start > max) hi = -1; }
      else { const t0 = (min - start) / delta, t1 = (max - start) / delta;
        lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1)); }
    }
    if (lo <= hi) return true;
  }
  // Physical Sports footprints cannot surround the entire kitchen.
  return false;
}
export function legalServeFooting(match: Match, footprint: readonly Point[]): boolean {
  const bottom = serveFromBottom(match.server, match.score[match.server]);
  return footprint.length > 0 && footprint.every(p => (match.server === 0 ? p.x < COURT.left : p.x > COURT.right)
    && p.y >= (bottom ? COURT.middle : COURT.top) && p.y <= (bottom ? COURT.bottom : COURT.middle));
}
function finishOutcome(match: Match, outcome: Outcome): void {
  const side = outcome.winner;
  match.pointScored = side === match.server;
  if (match.pointScored) match.score[side]++;
  else match.server = side;
  match.pointWinner = side; match.reason = outcome.reason; match.pointTimer = 0;
  match.pendingOutcome = null;
  if (match.score[side] >= PICKLEBALL.pointsToWin && match.score[side] - match.score[opponent(side)] >= PICKLEBALL.leadToWin
    && match.pointScored) { match.phase = 'over'; match.winner = side; }
  else match.phase = 'point';
}
function awardRally(match: Match, side: Side, reason: Exclude<PointReason, null>): void {
  match.ball.vx = 0; match.ball.vy = 0; match.ball.vz = 0;
  const outcome = { winner: side, reason };
  if (match.volleyGuards.some(Boolean)) { match.phase = 'point'; match.pendingOutcome = outcome; }
  else finishOutcome(match, outcome);
}
/** Called on observed poses only. Missing input and menu time never manufacture a settled volley. */
export function observeVolleyFooting(match: Match, side: Side, footing: Footing, dt: number): void {
  const guard = match.volleyGuards[side];
  if (!guard) return;
  if (inKitchen(footing.outline)) {
    match.volleyGuards = [null, null];
    awardRally(match, opponent(side), 'kitchen');
    return;
  }
  const turn = Math.abs(((footing.facingDeg - guard.anchorFacing + 540) % 360 + 360) % 360 - 180);
  // An anchored rest window tolerates ordinary sensor noise without treating slow drift as endless rest.
  const still = Math.hypot(footing.x - guard.anchorX, footing.y - guard.anchorY) <= PICKLEBALL.settleDistance
    && turn <= PICKLEBALL.settleAngle;
  guard.stillFor = still ? guard.stillFor + dt : 0;
  if (!still) { guard.anchorX = footing.x; guard.anchorY = footing.y; guard.anchorFacing = footing.facingDeg; }
  guard.x = footing.x; guard.y = footing.y; guard.facingDeg = footing.facingDeg;
  if (guard.stillFor >= PICKLEBALL.volleySettleSeconds) match.volleyGuards[side] = null;
  if (match.pendingOutcome && !match.volleyGuards.some(Boolean)) finishOutcome(match, match.pendingOutcome);
}
/** Plan height only. No wall banks and no horizontal direction correction. */
function launchArc(match: Match): void {
  const b = match.ball, target = match.receiver === 0 ? PICKLEBALL.landingLeft : PICKLEBALL.landingRight;
  const toward = (target - b.x) * b.vx > 0;
  const duration = toward
    ? Math.min(PICKLEBALL.netCrossTimeout, Math.max(.45, Math.abs((target - b.x) / b.vx))) : 1.2;
  const height = Math.max(PICKLEBALL.arcHeight, b.z + 35);
  const roots = Math.sqrt(height) + Math.sqrt(height - b.z);
  match.gravity = 2 * roots * roots / (duration * duration);
  b.vz = Math.sqrt(2 * match.gravity * (height - b.z));
}
/** Returns true for a consumed swing, including an illegal swing that ends the rally. */
export function strike(match: Match, side: Side, hit: { vx: number; vy: number }, footing?: Footing): boolean {
  if (!canAttempt(match, side) || !Number.isFinite(hit.vx) || !Number.isFinite(hit.vy)
    || Math.hypot(hit.vx, hit.vy) <= 0) return false;
  const serving = match.phase === 'serve';
  if (serving && footing && !legalServeFooting(match, footing.outline)) {
    awardRally(match, opponent(side), 'serve-foot'); return true;
  }
  if (mustBounce(match)) { awardRally(match, opponent(side), 'two-bounce'); return true; }
  const volley = !serving && match.groundBounces === 0;
  if (volley && footing && inKitchen(footing.outline)) {
    awardRally(match, opponent(side), 'kitchen'); return true;
  }
  if (volley && footing) match.volleyGuards[side] = { x: footing.x, y: footing.y, facingDeg: footing.facingDeg,
    anchorX: footing.x, anchorY: footing.y, anchorFacing: footing.facingDeg, stillFor: 0 };
  match.ball.vx = hit.vx; match.ball.vy = hit.vy;
  match.phase = 'rally'; match.lastHitter = side; match.receiver = opponent(side);
  match.crossedNet = false; match.groundBounces = 0; match.shotTime = 0; match.rally++;
  launchArc(match); match.bestRally = Math.max(match.bestRally, match.rally);
  match.pointWinner = null; match.reason = null; match.pointScored = false;
  return true;
}
/** Both flight and planar motion share the same assisted clock. */
export function travelScale(match: Match): number {
  if (match.phase !== 'rally' || !match.crossedNet) return 1;
  const { x, vx, vy } = match.ball, speed = Math.hypot(vx, vy);
  if (speed <= PICKLEBALL.receiverSpeed) return 1;
  const raw = match.receiver === 0
    ? (PICKLEBALL.slowStartLeft - x) / (PICKLEBALL.slowStartLeft - PICKLEBALL.slowFullLeft)
    : (x - PICKLEBALL.slowStartRight) / (PICKLEBALL.slowFullRight - PICKLEBALL.slowStartRight);
  const t = Math.max(0, Math.min(1, raw)), ease = t * t * (3 - 2 * t);
  return 1 - ease * (1 - PICKLEBALL.receiverSpeed / speed);
}
interface Boundary { t: number; kind: 'edge' | 'net' }
function firstBoundary(match: Match, dx: number, dy: number): Boundary | null {
  const b = match.ball, events: Boundary[] = [];
  if (dx < 0) events.push({ t: (BALL_RADIUS - b.x) / dx, kind: 'edge' });
  if (dx > 0) events.push({ t: (1920 - BALL_RADIUS - b.x) / dx, kind: 'edge' });
  if (dy < 0) events.push({ t: (BALL_RADIUS - b.y) / dy, kind: 'edge' });
  if (dy > 0) events.push({ t: (1080 - BALL_RADIUS - b.y) / dy, kind: 'edge' });
  if (!match.crossedNet && dx !== 0 && (COURT.net - b.x) * dx >= 0)
    events.push({ t: (COURT.net - b.x) / dx, kind: 'net' });
  return events.filter(e => e.t >= 0 && e.t <= 1).sort((a, b) => a.t - b.t)[0] ?? null;
}
function timeToGround(match: Match): number {
  const { z, vz } = match.ball;
  return (vz + Math.sqrt(vz * vz + 2 * match.gravity * Math.max(0, z))) / match.gravity;
}
export interface MotionPoint { time: number; x: number; y: number; z: number }
export function stepMatch(match: Match, dt: number, trace?: MotionPoint[]): number {
  if (!Number.isFinite(dt) || dt <= 0 || match.phase === 'over' || match.phase === 'serve') return 0;
  if (match.phase === 'point') {
    if (!match.pendingOutcome) match.pointTimer += dt;
    if (match.lastBounce) match.lastBounce.age += dt;
    return dt;
  }
  let remaining = Math.min(dt, .25), elapsed = 0;
  trace?.push({ time: 0, x: match.ball.x, y: match.ball.y, z: match.ball.z });
  while (remaining > 1e-9 && match.phase === 'rally') {
    const hitter = match.lastHitter ?? match.server;
    if (!match.crossedNet && match.shotTime >= PICKLEBALL.netCrossTimeout - 1e-9) {
      awardRally(match, opponent(hitter), 'short'); return elapsed;
    }
    const speedScale = travelScale(match), groundTime = timeToGround(match) / speedScale;
    const step = Math.min(remaining, PICKLEBALL.maximumStep, groundTime,
      match.crossedNet ? Infinity : PICKLEBALL.netCrossTimeout - match.shotTime);
    const dx = match.ball.vx * step * speedScale, dy = match.ball.vy * step * speedScale;
    const boundary = firstBoundary(match, dx, dy), fraction = boundary?.t ?? 1;
    const spent = step * fraction, flightTime = spent * speedScale;
    match.ball.x += dx * fraction; match.ball.y += dy * fraction;
    match.ball.z = Math.max(0, match.ball.z + match.ball.vz * flightTime - .5 * match.gravity * flightTime ** 2);
    match.ball.vz -= match.gravity * flightTime;
    elapsed += spent; remaining -= spent; match.shotTime += spent;
    if (match.lastBounce) match.lastBounce.age += spent;
    trace?.push({ time: elapsed, x: match.ball.x, y: match.ball.y, z: match.ball.z });
    if (boundary?.kind === 'edge') {
      awardRally(match, match.groundBounces ? hitter : opponent(hitter), match.groundBounces ? 'missed' : 'out');
      return elapsed;
    }
    if (boundary?.kind === 'net') {
      if (match.ball.y >= COURT.top && match.ball.y <= COURT.bottom && match.ball.z < PICKLEBALL.netHeight) {
        awardRally(match, opponent(hitter), 'net'); return elapsed;
      }
      match.crossedNet = true;
    }
    if (spent >= groundTime - 1e-9) {
      match.ball.z = 0; match.bounceSerial++;
      match.lastBounce = { x: match.ball.x, y: match.ball.y, age: 0 };
      if (match.groundBounces === 1) {
        match.groundBounces = 2; awardRally(match, hitter, 'double-bounce'); return elapsed;
      }
      if (!onCourt(match.ball)) { awardRally(match, opponent(hitter), 'out'); return elapsed; }
      if (!match.crossedNet || !inOwnHalf(match.receiver, match.ball.x)) {
        awardRally(match, opponent(hitter), 'short'); return elapsed;
      }
      if (match.rally === 1) {
        if (match.ball.x >= COURT.kitchenLeft && match.ball.x <= COURT.kitchenRight) {
          awardRally(match, opponent(hitter), 'serve-kitchen'); return elapsed;
        }
        const box = serviceTarget(match);
        if (match.ball.y < box.top || match.ball.y > box.bottom) {
          awardRally(match, opponent(hitter), 'serve-box'); return elapsed;
        }
      }
      match.groundBounces = 1;
      match.ball.vz = Math.abs(match.ball.vz) * PICKLEBALL.rebound;
    }
  }
  return elapsed;
}
export function nextServe(match: Match): boolean {
  if (match.phase !== 'point' || match.pendingOutcome || match.pointTimer < POINT_DELAY) return false;
  match.ball = serveBall(match.server, match.score[match.server]);
  match.phase = 'serve'; match.receiver = match.server; match.lastHitter = null;
  match.crossedNet = false; match.groundBounces = 0; match.lastBounce = null;
  match.shotTime = 0; match.rally = 0; match.pointTimer = 0; match.pointWinner = null;
  match.reason = null; match.pointScored = false; match.volleyGuards = [null, null];
  return true;
}
