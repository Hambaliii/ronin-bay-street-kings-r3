// Seeded RNG (mulberry32) — all world randomness flows through here.
let s = 1;
export function srand(seed) { s = (seed >>> 0) || 1; }
export function rnd() {
  s = (s + 0x6D2B79F5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function rr(a, b) { return a + rnd() * (b - a); }
export function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
export function pick(arr) { return arr[Math.floor(rnd() * arr.length) % arr.length]; }
export function chance(p) { return rnd() < p; }
