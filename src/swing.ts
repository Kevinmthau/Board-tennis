/** The putt-putt forehead line adapted to a live tennis ball.
 * Placement and sliding never hit. Both the racket and moving ball are swept for contact. */
export interface Point { x: number; y: number }
export interface SwingPose extends Point { facingDeg: number; frontReach: number }
export interface SwingHit {
  vx: number; vy: number; speed: number; angularSpeed: number; contactAngleDeg: number;
}
export type SwingStatus = 'missing' | 'ready' | 'spent';
export const SWING = {
  clubLength: 240, clubWidth: 6, ballRadius: 18, rotationNoiseDeg: 1,
  maximumGapMs: 100, speedWindowMs: 60,
  minimumAngularSpeed: 30, maximumAngularSpeed: 540, minimumBallSpeed: 480, maximumBallSpeed: 1100,
} as const;
const norm = (a: number) => ((a % 360) + 360) % 360;
export const shortAngleDelta = (a: number, b: number) => ((a - b + 540) % 360 + 360) % 360 - 180;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const finitePoint = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y);
const finite = (p: SwingPose) => finitePoint(p) && Number.isFinite(p.facingDeg)
  && Number.isFinite(p.frontReach) && p.frontReach >= 0 && p.frontReach < SWING.clubLength;
export function ballSpeedForTwist(degreesPerSecond: number): number {
  const t = Math.min(1, Math.max(0, (Math.abs(degreesPerSecond) - SWING.minimumAngularSpeed)
    / (SWING.maximumAngularSpeed - SWING.minimumAngularSpeed)));
  return SWING.minimumBallSpeed + t * (SWING.maximumBallSpeed - SWING.minimumBallSpeed);
}

/** Distance to the visible finite line, including the measured front of the piece. */
export function clubDistance(pose: SwingPose, ball: Point): number {
  const a = pose.facingDeg * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
  const bx = ball.x - pose.x, by = ball.y - pose.y;
  const along = Math.min(SWING.clubLength, Math.max(pose.frontReach, bx * dx + by * dy));
  return Math.hypot(bx - along * dx, by - along * dy);
}

/** Third argument is the current ball; the optional fourth supplies its previous position.
 * Every relative-motion substep is at most 4 px and every rotation substep at most 2 degrees. */
export function sweptClubContact(previous: SwingPose, current: SwingPose, ball: Point,
  previousBall: Point = ball): number | null {
  const delta = shortAngleDelta(current.facingDeg, previous.facingDeg);
  if (!finite(previous) || !finite(current) || !finitePoint(ball) || !finitePoint(previousBall)
    || Math.abs(delta) < 1e-8) return null;
  const radius = SWING.ballRadius + SWING.clubWidth / 2;
  const poseAt = (t: number): SwingPose => ({
    x: previous.x + (current.x - previous.x) * t,
    y: previous.y + (current.y - previous.y) * t,
    facingDeg: previous.facingDeg + delta * t,
    frontReach: previous.frontReach + (current.frontReach - previous.frontReach) * t,
  });
  const ballAt = (t: number): Point => ({
    x: previousBall.x + (ball.x - previousBall.x) * t,
    y: previousBall.y + (ball.y - previousBall.y) * t,
  });
  const touches = (t: number) => clubDistance(poseAt(t), ballAt(t)) <= radius;
  if (touches(0)) return norm(previous.facingDeg);
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / 2),
    Math.ceil((distance(previous, current) + distance(previousBall, ball)) / 4));
  for (let i = 1; i <= steps; i++) {
    if (!touches(i / steps)) continue;
    let lo = (i - 1) / steps, hi = i / steps;
    for (let j = 0; j < 14; j++) {
      const mid = (lo + hi) / 2;
      if (touches(mid)) hi = mid; else lo = mid;
    }
    return norm(previous.facingDeg + delta * hi);
  }
  return null;
}

type Sample = { t: number; angle: number };
export class SwingController {
  status: SwingStatus = 'missing';
  angularSpeed = 0;
  private previous: SwingPose | null = null;
  private previousBall: Point | null = null;
  private previousTime = 0;
  private unwrapped = 0;
  private motionAngle = 0;
  private motionTime = 0;
  private spent = false;
  private samples: Sample[] = [];

  /** New point, pause, tracking recovery, or inactive possession clears all strike intent. */
  reset(): void {
    this.previous = null; this.previousBall = null; this.samples = []; this.spent = false;
    this.angularSpeed = 0; this.status = 'missing';
  }

  private seed(pose: SwingPose, ball: Point, now: number): void {
    this.previous = { ...pose }; this.previousBall = { ...ball }; this.previousTime = now;
    this.unwrapped = this.motionAngle = pose.facingDeg; this.motionTime = now;
    this.samples = [{ t: now, angle: this.unwrapped }];
    this.angularSpeed = 0; this.status = 'ready';
  }

  update(pose: SwingPose | null, ball: Point, now: number, enabled = true): SwingHit | null {
    if (!enabled || !pose || !finite(pose) || !finitePoint(ball) || !Number.isFinite(now)) {
      this.reset(); return null;
    }
    // This lock belongs to one possession. Calling disabled between hits rearms it for a return.
    if (this.spent) { this.status = 'spent'; return null; }
    if (!this.previous || !this.previousBall) { this.seed(pose, ball, now); return null; }
    const previous = this.previous, previousBall = this.previousBall, dt = now - this.previousTime;
    if (dt <= 0) return null;
    if (dt > SWING.maximumGapMs) { this.seed(pose, ball, now); return null; }
    const delta = shortAngleDelta(pose.facingDeg, previous.facingDeg);
    this.previous = { ...pose }; this.previousBall = { ...ball }; this.previousTime = now;
    this.unwrapped += delta;
    this.samples.push({ t: now, angle: this.unwrapped });
    while (this.samples.length > 2 && this.samples[1].t < now - SWING.speedWindowMs) this.samples.shift();
    const meanT = this.samples.reduce((n, s) => n + s.t, 0) / this.samples.length;
    const meanA = this.samples.reduce((n, s) => n + s.angle, 0) / this.samples.length;
    let numerator = 0, denominator = 0;
    for (const s of this.samples) { numerator += (s.t - meanT) * (s.angle - meanA); denominator += (s.t - meanT) ** 2; }
    this.angularSpeed = denominator > 0 ? numerator / denominator * 1000 : 0;
    this.status = 'ready';
    const turn = this.unwrapped - this.motionAngle;
    if (Math.abs(turn) < SWING.rotationNoiseDeg) return null;
    const direction = Math.sign(turn);
    const directSpeed = Math.abs(turn) / Math.max(1, now - this.motionTime) * 1000;
    this.motionAngle = this.unwrapped; this.motionTime = now;
    // Use only this frame's relative sweep. Accumulated slow rotation cannot hit an old ball position.
    const contactAngle = sweptClubContact(previous, pose, ball, previousBall);
    if (contactAngle === null) return null;
    const measured = this.angularSpeed * direction > 0 ? Math.abs(this.angularSpeed) : directSpeed;
    this.angularSpeed = direction * measured;
    const speed = ballSpeedForTwist(measured), rad = contactAngle * Math.PI / 180;
    this.spent = true; this.status = 'spent';
    return { vx: -Math.sin(rad) * direction * speed, vy: Math.cos(rad) * direction * speed,
      speed, angularSpeed: this.angularSpeed, contactAngleDeg: contactAngle };
  }
}
