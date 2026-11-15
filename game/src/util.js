'use strict';
/* Small helpers shared by the whole game. No network, no dependencies. */

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/* mulberry32: a tiny deterministic PRNG. Same seed, same stream, every run. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Pick a value in [lo, hi) from a PRNG function. */
function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

/* Format an integer with a thousands separator, e.g. 1234567 -> "1,234,567". */
function fmtInt(n) {
  return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
