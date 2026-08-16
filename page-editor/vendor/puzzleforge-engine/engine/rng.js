/**
 * Seeded randomness for reproducible generation.
 *
 * Generation is synchronous and single-threaded, and the puzzle modules + shared
 * helpers + theme word-selection all draw entropy from the global `Math.random`.
 * Rather than thread an RNG argument through every module, `withSeed` swaps a
 * deterministic PRNG in for `Math.random` for the duration of a synchronous
 * call, then restores the original — so the same seed reproduces the same
 * puzzle/book without touching any generator.
 *
 * Nesting-safe (saves and restores whatever was installed, not the original),
 * and restores even if the body throws.
 */

// mulberry32 — small, fast, deterministic. Not cryptographic.
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

/**
 * Run `fn` with `Math.random` replaced by a PRNG seeded from `seed`.
 * @param {number} seed
 * @param {function} fn synchronous function
 * @returns {*} fn's return value
 */
function withSeed(seed, fn) {
  const prng = mulberry32(seed >>> 0);
  const original = Math.random;
  Math.random = prng;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

module.exports = { mulberry32, withSeed };
