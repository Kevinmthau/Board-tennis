/** One projection shared by rendering and racket input: hit the visible ball, not its shadow. */
export interface BallDisplay {
  x: number; y: number; groundX: number; groundY: number; radius: number; height: number;
}
export function ballDisplay(ball: { x: number; y: number; z: number }, radius = 18): BallDisplay {
  const height = Math.max(0, Math.min(360, Number.isFinite(ball.z) ? ball.z : 0));
  const edgeRoom = Math.max(radius, Math.min(ball.x, 1920 - ball.x));
  const size = Math.min(edgeRoom, radius * (1 + Math.min(.5, height / 360)));
  return { x: ball.x, y: Math.max(size, ball.y - height * .95),
    groundX: ball.x, groundY: ball.y, radius: size, height };
}
