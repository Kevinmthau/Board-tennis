import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '@board.fun/web-sdk';

test('audio initialized during a native pause stays suspended until resume', async () => {
  const pause: (() => void)[] = [], resume: (() => void)[] = [];
  Object.assign(Board.application, {
    onPause: (callback: () => void) => { pause.push(callback); return () => {}; },
    onResume: (callback: () => void) => { resume.push(callback); return () => {}; },
  });
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = { addEventListener() {} };
  g.document = { hidden: false, addEventListener() {} };
  let suspends = 0, resumes = 0;
  g.AudioContext = class {
    state = 'running'; destination = {};
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    addEventListener() {}
    suspend() { this.state = 'suspended'; suspends++; return Promise.resolve(); }
    resume() { this.state = 'running'; resumes++; return Promise.resolve(); }
  };
  const { gameAudio, unlockAudio } = await import('../src/runtime');
  pause.forEach(callback => callback());
  const audio = gameAudio();
  assert.equal(suspends, 1, 'a pause received before font/art loading still governs lazy audio');
  assert.equal(audio.ctx.state, 'suspended');
  unlockAudio(); assert.equal(resumes, 0, 'touches while paused cannot restart audio');
  resume.forEach(callback => callback());
  assert.equal(audio.ctx.state, 'running'); assert.equal(resumes, 1);
  pause.forEach(callback => callback());
  assert.equal(audio.ctx.state, 'suspended'); assert.equal(suspends, 2);
});
