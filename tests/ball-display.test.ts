import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ballDisplay } from '../src/ball-display';

test('a serve and ground impact stay on the court contact coordinate', () => {
  const ball = ballDisplay({ x: 500, y: 540, z: 0 });
  assert.equal(ball.x, 500); assert.equal(ball.y, 540);
  assert.equal(ball.groundX, ball.x); assert.equal(ball.groundY, ball.y);
  assert.equal(ball.radius, 18);
});

test('flight visibly separates the ball from its court shadow then returns to contact', () => {
  const start = ballDisplay({ x: 1000, y: 540, z: 0 });
  const high = ballDisplay({ x: 1000, y: 540, z: 180 });
  const rebound = ballDisplay({ x: 1000, y: 540, z: 64.8 });
  assert.ok(start.y - high.y > 150, 'the main arc is clearly elevated');
  assert.ok(start.y - rebound.y > 55, 'the smaller rebound is still visible');
  assert.equal(high.groundY, start.y); assert.equal(rebound.groundY, start.y);
  assert.equal(high.x, start.x, 'height cannot move a ball across the net');
});

test('a high ball remains visible at the upper and side walls', () => {
  for (const x of [18, 960, 1902]) {
    const ball = ballDisplay({ x, y: 18, z: 300 });
    assert.ok(ball.y - ball.radius >= 0);
    assert.ok(ball.x - ball.radius >= 0); assert.ok(ball.x + ball.radius <= 1920);
    assert.equal(ball.groundY, 18);
  }
});
