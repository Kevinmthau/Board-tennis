import { gameAudio } from './runtime';
type Sound = 'place' | 'hit' | 'point' | 'win';
function tone(frequency: number, duration: number, delay = 0, volume = .08) {
  const { ctx, sfx } = gameAudio();
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + delay;
  o.type = 'sine'; o.frequency.setValueAtTime(frequency, t); o.frequency.exponentialRampToValueAtTime(frequency * .6, t + duration);
  g.gain.setValueAtTime(.001, t); g.gain.linearRampToValueAtTime(volume, t + .006); g.gain.exponentialRampToValueAtTime(.001, t + duration);
  o.connect(g); g.connect(sfx); o.start(t); o.stop(t + duration + .02);
}
export function sound(kind: Sound, power = 600) {
  if (kind === 'hit') { tone(280 + power * .15, .075, 0, .15); tone(110, .045, 0, .06); }
  if (kind === 'place') { tone(210, .14); tone(440, .16, .06, .035); }
  if (kind === 'point') [440, 554, 660].forEach((n, i) => tone(n, .22, i * .09));
  if (kind === 'win') [440, 554, 660, 880].forEach((n, i) => tone(n, .5, i * .14));
}
export function startAmbience() {
  const { ctx, music } = gameAudio();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), data = buffer.getChannelData(0);
  let low = 0, seed = 42;
  for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; low = .985 * low + .015 * (seed / 2147483648); data[i] = low * .09; }
  const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true; source.connect(music); source.start();
}
