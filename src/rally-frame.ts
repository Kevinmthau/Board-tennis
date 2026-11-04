import { COURT, canAttempt, inKitchen, inOwnHalf, observeVolleyFooting, stepMatch, strike, type Match, type Side, type MotionPoint, type Footing } from './pickleball';
import { type Point, type SwingHit, type SwingPose, SwingController } from './swing';
import { ballDisplay } from './ball-display';

export interface RallyControl {
  side: Side; pose: SwingPose | null; controller: SwingController;
  /** World outline from pieceFootprint(), evaluated at the actual contact pose. */
  footingAt?: (pose: SwingPose) => Footing;
}
export interface RallyFrameResult {
  hit: { side: Side; shot: SwingHit; at: Point } | null;
  /** True only when this frame commits a point, including a match-ending point. */
  point: boolean;
}
const copyMatch = (match: Match): Match => ({ ...match, ball: { ...match.ball },
  lastBounce: match.lastBounce ? { ...match.lastBounce } : null, score: [...match.score],
  volleyGuards: match.volleyGuards.map(g => g ? { ...g } : null) as Match['volleyGuards'],
  pendingOutcome: match.pendingOutcome ? { ...match.pendingOutcome } : null });
const footing = (control: RallyControl, pose: SwingPose): Footing => control.footingAt?.(pose) ?? { ...pose, outline: [pose] };
function followThrough(match: Match, controls: readonly RallyControl[], dt: number, endFraction = 1) {
  const observations: { side: Side; at: number; feet: Footing }[] = [];
  for (const control of controls) {
    const guard = match.volleyGuards[control.side], pose = control.pose;
    if (!guard || !pose || dt <= 0) continue;
    const from = { ...guard }, turn = (((pose.facingDeg - from.facingDeg + 540) % 360 + 360) % 360 - 180) * endFraction;
    const dx = (pose.x - from.x) * endFraction, dy = (pose.y - from.y) * endFraction;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4), Math.ceil(Math.abs(turn) / 2));
    const feetAt = (t: number) => footing(control, { ...pose,
        x: from.x + dx * t, y: from.y + dy * t,
        facingDeg: from.facingDeg + turn * t });
    for (let i = 1; i <= steps; i++) {
      let t = i / steps, feet = feetAt(t);
      const enters = inKitchen(feet.outline);
      if (enters) {
        // Refine the first crossing so two players entering in one frame resolve by time.
        let lo = (i - 1) / steps, hi = t;
        for (let j = 0; j < 16; j++) {
          const mid = (lo + hi) / 2;
          if (inKitchen(feetAt(mid).outline)) hi = mid; else lo = mid;
        }
        t = hi; feet = feetAt(t);
      }
      observations.push({ side: control.side, at: dt * t, feet });
      if (enters) break;
    }
  }
  observations.sort((a, b) => a.at - b.at || a.side - b.side);
  const observedUntil = [0, 0];
  for (const { side, at, feet } of observations) {
    observeVolleyFooting(match, side, feet, at - observedUntil[side]);
    observedUntil[side] = at;
  }
}

/** Resolve the receiving frame before committing a point.
 * Controller epochs and physical presence are the caller's responsibility; a null pose clears intent.
 * No save, sound, or live score sees the provisional physics result. */
export function advanceRallyFrame(match: Match, dt: number, now: number,
  controls: readonly RallyControl[]): RallyFrameResult {
  const result: RallyFrameResult = { hit: null, point: false };
  const duration = Number.isFinite(dt) ? Math.max(0, Math.min(.25, dt)) : 0;
  const preview = copyMatch(match);
  followThrough(preview, controls, duration);
  const footingEnded = match.pointWinner === null && preview.pointWinner !== null;
  const trace: MotionPoint[] = [];
  stepMatch(preview, duration, trace);
  const exited = match.phase === 'rally' && (preview.phase === 'point' || preview.phase === 'over');
  const path = trace.length
    ? trace.map(p => ({ ...ballDisplay(p), timeMs: now - duration * 1000 + p.time * 1000 }))
    : [{ ...ballDisplay(preview.ball), timeMs: now }];
  // A boundary preview has already changed phase. Eligibility belongs to the incoming rally.
  const eligible = exited ? { ...preview, phase: match.phase } : preview;
  for (const control of controls) {
    const { side, pose, controller } = control;
    if (result.hit) { controller.reset(); continue; }
    const waitingForNet = match.phase === 'rally' && match.receiver === side && !match.crossedNet;
    const enabled = !footingEnded && !!pose && inOwnHalf(side, pose.x)
      && (canAttempt(match, side) || canAttempt(eligible, side));
    if (pose && inOwnHalf(side, pose.x) && waitingForNet && !enabled) {
      controller.observe(pose, ballDisplay(preview.ball), now);
      continue;
    }
    let notBeforeMs = -Infinity;
    if (waitingForNet) {
      const index = trace.findIndex(p => inOwnHalf(side, p.x));
      if (index > 0) {
        const a = trace[index - 1], b = trace[index];
        const crossing = a.time + (b.time - a.time) * (COURT.net - a.x) / (b.x - a.x);
        // Start just inside the receiver's half. Contact exactly on the net is not a return.
        // Stay beyond the physics loop's 1 ns termination tolerance as well as the net plane.
        notBeforeMs = now - duration * 1000 + crossing * 1000 + 1e-3;
      }
    }
    const shot = controller.updateAlong(pose, now, enabled, path, notBeforeMs);
    if (!shot || result.hit) continue;
    const contactElapsed = Math.max(0, Math.min(duration, (shot.contactTimeMs - (now - duration * 1000)) / 1000));
    // The second landing ends the possession immediately; a simultaneous or later twist cannot save it.
    if (exited && contactElapsed >= (trace.at(-1)?.time ?? 0) - 1e-9) continue;
    const returned = copyMatch(match);
    // Replaying a contact must retain the earlier player's observed motion and settling time.
    // Stop at the contact pose here; new volley guards receive only the remaining frame below.
    followThrough(returned, controls, contactElapsed, duration > 0 ? contactElapsed / duration : 0);
    stepMatch(returned, contactElapsed);
    // Sweep points are the lifted visible ball. Keep its stepped ground position and height
    // for the outgoing arc; copying the visible y here would teleport the landing path.
    if (returned.phase === 'rally' && inOwnHalf(side, returned.ball.x)) returned.crossedNet = true;
    if (!strike(returned, side, shot, footing(control, shot.contactPose))) {
      // A contact before a newly crossed net is not a legal return and cannot consume possession.
      controller.reset(); controller.update(pose, ballDisplay(preview.ball), now, enabled);
      continue;
    }
    result.hit = { side, shot, at: { ...shot.contactPosition } };
    const remaining = Math.max(0, Math.min(duration, (now - shot.contactTimeMs) / 1000));
    stepMatch(returned, remaining);
    followThrough(returned, controls, remaining);
    Object.assign(preview, returned);
  }
  result.point = match.pointWinner === null && preview.pointWinner !== null;
  Object.assign(match, preview);
  if (result.hit) {
    // A near-net volley can cross back in the same frame. Rearm its receiver now, even if
    // there was no intervening frame with disabled input to release the previous hit lock.
    for (const { side, pose, controller } of controls) {
      if (side !== result.hit.side && pose && inOwnHalf(side, pose.x)) {
        controller.observe(pose, ballDisplay(match.ball), now);
      }
    }
  }
  return result;
}
