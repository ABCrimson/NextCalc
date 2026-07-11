/**
 * Deterministic string-seeded RNG for reproducible problem generation.
 *
 * - `createSeededRandom(seed)` — xmur3 string hash feeding a mulberry32
 *   stream: the same seed string always yields the identical sequence.
 * - `randomSeedString()` — mints a fresh shareable seed using the Web
 *   Crypto API (`globalThis.crypto.getRandomValues`, available in both
 *   Node 24+ and every browser). Math.random is deliberately never used.
 */

/**
 * xmur3 string hash. Produces a 32-bit hash generator from an arbitrary
 * string; successive calls yield further decorrelated 32-bit values,
 * which makes it a good seeder for mulberry32.
 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * mulberry32 PRNG. Fast, high-quality 32-bit generator returning floats
 * in [0, 1).
 */
function mulberry32(a: number): () => number {
  let state = a >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a deterministic random stream from a seed string.
 *
 * @example
 * const rng = createSeededRandom('abc123');
 * rng(); // always the same first value for 'abc123'
 */
export function createSeededRandom(seed: string): () => number {
  const hash = xmur3(seed);
  return mulberry32(hash());
}

/** Charset for minted seeds: unambiguous lowercase base-32 (no 0/1/l/o). */
const SEED_CHARSET = 'abcdefghijkmnpqrstuvwxyz23456789';

/**
 * Mint a random seed string using the platform CSPRNG.
 * 32-character alphabet means each byte maps bias-free via `& 31`.
 */
export function randomSeedString(length = 8): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) {
    out += SEED_CHARSET[byte & 31];
  }
  return out;
}
