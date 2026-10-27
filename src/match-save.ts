import { createMatch, type Match, type Side } from './tennis';

export const SAVE_VERSION = 2;
export interface SavedMatch { match: Match; sides: { sessionId: number; side: Side }[] }
const side = (value: unknown): value is Side => value === 0 || value === 1;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const count = (value: unknown): value is number => nonnegative(value) && Number.isInteger(value);

/** Keep scores from the original wall-bounce game, restarting its active rally as a serve. */
export function readMatchSave(value: unknown): SavedMatch | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, any>, m = raw.match;
  if (![1, SAVE_VERSION].includes(raw.version) || !m || !Array.isArray(m.score) || m.score.length !== 2
    || !m.score.every(count) || !['serve', 'rally', 'point', 'over'].includes(m.phase)
    || !side(m.server) || !side(m.receiver) || !count(m.bestRally)
    || !Array.isArray(raw.sides) || !raw.sides.every((s: any) => s && Number.isFinite(s.sessionId) && side(s.side))) return null;
  const sides = raw.sides.map((s: any) => ({ sessionId: s.sessionId, side: s.side }));
  if (raw.version === 1) {
    const match = createMatch(m.phase === 'rally' ? m.receiver : m.server);
    match.score = [m.score[0], m.score[1]]; match.bestRally = m.bestRally;
    if (m.phase === 'over') {
      if (!side(m.winner)) return null;
      match.phase = 'over'; match.winner = m.winner; match.pointWinner = m.winner;
      match.rally = count(m.rally) ? m.rally : 0;
    }
    return { match, sides };
  }
  if (![m.ball?.x, m.ball?.y, m.ball?.vx, m.ball?.vy, m.ball?.vz].every(Number.isFinite)
    || !nonnegative(m.ball?.z) || !nonnegative(m.shotTime) || !nonnegative(m.pointTimer)
    || !Number.isFinite(m.gravity) || m.gravity <= 0
    || ![0, 1, 2].includes(m.groundBounces) || !count(m.bounceSerial) || !count(m.rally)
    || typeof m.crossedNet !== 'boolean' || !(m.lastHitter === null || side(m.lastHitter))
    || !(m.winner === null || side(m.winner)) || !(m.pointWinner === null || side(m.pointWinner))
    || (m.lastBounce !== null && (!m.lastBounce || ![m.lastBounce.x, m.lastBounce.y].every(Number.isFinite)
      || !nonnegative(m.lastBounce.age)))) return null;
  return { match: JSON.parse(JSON.stringify(m)) as Match, sides };
}
