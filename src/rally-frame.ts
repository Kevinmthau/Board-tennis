import { canStrike, inOwnHalf, stepMatch, strike, type Match, type Side, type MotionPoint } from './tennis';
import { type Point, type SwingHit, type SwingPose, SwingController } from './swing';

export interface RallyControl { side: Side; pose: SwingPose | null; controller: SwingController }
export interface RallyFrameResult {
  hit: { side: Side; shot: SwingHit; at: Point } | null;
  /** True only when this frame commits a point, including a match-ending point. */
  point: boolean;
}
const copyMatch = (match: Match): Match => ({ ...match, ball: { ...match.ball }, score: [...match.score] });

/** Resolve the receiving frame before committing a point.
 * Controller epochs and physical presence are the caller's responsibility; a null pose clears intent.
 * No save, sound, or live score sees the provisional physics result. */
export function advanceRallyFrame(match: Match, dt: number, now: number,
  controls: readonly RallyControl[]): RallyFrameResult {
  const result: RallyFrameResult = { hit: null, point: false };
  const duration = Number.isFinite(dt) ? Math.max(0, Math.min(.25, dt)) : 0;
  const preview = copyMatch(match);
  const trace: MotionPoint[] = [];
  stepMatch(preview, duration, trace);
  const exited = match.phase === 'rally' && (preview.phase === 'point' || preview.phase === 'over');
  const path = trace.length
    ? trace.map(p => ({ x: p.x, y: p.y, timeMs: now - duration * 1000 + p.time * 1000 }))
    : [{ x: preview.ball.x, y: preview.ball.y, timeMs: now }];
  // A boundary preview has already changed phase. Eligibility belongs to the incoming rally.
  const eligible = exited ? { ...preview, phase: match.phase } : preview;
  for (const { side, pose, controller } of controls) {
    const enabled = !!pose && inOwnHalf(side, pose.x) && (canStrike(match, side) || canStrike(eligible, side));
    const shot = controller.updateAlong(pose, now, enabled, path);
    if (!shot || result.hit) continue;
    const returned = copyMatch(match);
    returned.ball.x = shot.contactPosition.x; returned.ball.y = shot.contactPosition.y;
    if (returned.phase === 'rally' && inOwnHalf(side, returned.ball.x)) returned.crossedNet = true;
    if (!strike(returned, side, shot)) {
      // A contact before a newly crossed net is not a legal return and cannot consume possession.
      controller.reset(); controller.update(pose, preview.ball, now, enabled);
      continue;
    }
    result.hit = { side, shot, at: { ...shot.contactPosition } };
    const remaining = Math.max(0, Math.min(duration, (now - shot.contactTimeMs) / 1000));
    stepMatch(returned, remaining);
    Object.assign(preview, returned);
  }
  result.point = (match.phase === 'rally' || !!result.hit)
    && (preview.phase === 'point' || preview.phase === 'over');
  Object.assign(match, preview);
  return result;
}
