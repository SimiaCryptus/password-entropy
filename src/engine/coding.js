/**
 * Information-Theoretic & Universal Coding Primitives
 * Implements Minimum Description Length (MDL) integer and probability encodings.
 */

const EPSILON = 1e-12;

/**
 * Safe base-2 logarithm
 * @param {number} x
 * @returns {number}
 */
export function log2(x) {
  return Math.log2(Math.max(x, EPSILON));
}

/**
 * Shannon information cost in bits for an event of probability p: I(p) = -log2(p)
 * @param {number} prob
 * @returns {number}
 */
export function shannonCost(prob) {
  const p = Math.min(1, Math.max(prob, EPSILON));
  return -Math.log2(p);
}

/**
 * Elias Gamma universal code length for positive integers n >= 1:
 * L_gamma(n) = 2 * floor(log2(n)) + 1
 * @param {number} n
 * @returns {number}
 */
export function eliasGammaCost(n) {
  const k = Math.max(1, Math.floor(n));
  return 2 * Math.floor(Math.log2(k)) + 1;
}

/**
 * Elias Delta universal code length for positive integers n >= 1:
 * L_delta(n) = floor(log2(n)) + 2 * floor(log2(floor(log2(n)) + 1)) + 1
 * @param {number} n
 * @returns {number}
 */
export function eliasDeltaCost(n) {
  const k = Math.max(1, Math.floor(n));
  const len = Math.floor(Math.log2(k));
  return len + 2 * Math.floor(Math.log2(len + 1)) + 1;
}

/**
 * Log2 of binomial coefficient C(n, k) = n! / (k! (n - k)!)
 * Used for encoding subset positions (e.g., which k characters in a length-n token are modified)
 * @param {number} n
 * @param {number} k
 * @returns {number}
 */
export function combinationCost(n, k) {
  if (k <= 0 || k >= n || n <= 1) return 0;
  const m = Math.min(k, n - k);
  let bits = 0;
  for (let i = 1; i <= m; i++) {
    bits += Math.log2((n - m + i) / i);
  }
  return bits;
}

/**
 * Round bit values cleanly for display and ledger accounting
 * @param {number} bits
 * @param {number} [decimals=1]
 * @returns {number}
 */
export function roundBits(bits, decimals = 1) {
  const factor = Math.pow(10, decimals);
  return Math.round(bits * factor) / factor;
}

/**
 * Formats crack time at a specified offline attack rate (default 10^10 guesses/sec, e.g., high-end GPU rig)
 * Expected guesses for average case = 2^(bits - 1), or worst-case 2^bits. We use 0.5 * 2^bits.
 * @param {number} bits
 * @param {number} [guessesPerSec=1e10]
 * @returns {{ label: string, tier: string, seconds: number }}
 */
export function formatCrackTime(bits, guessesPerSec = 1e10) {
  if (bits <= 0) {
    return { label: 'Instant (< 1 ms)', tier: 'critical', seconds: 0 };
  }
  const clampedBits = Math.min(bits, 256);
  const guesses = Math.pow(2, Math.max(0, clampedBits - 1));
  const seconds = guesses / guessesPerSec;

  if (seconds < 0.001) {
    return { label: 'Instant (< 1 ms)', tier: 'critical', seconds };
  }
  if (seconds < 1) {
    return { label: `${Math.max(1, Math.round(seconds * 1000))} ms`, tier: 'critical', seconds };
  }
  if (seconds < 60) {
    return { label: `${seconds.toFixed(1)} seconds`, tier: 'weak', seconds };
  }
  const minutes = seconds / 60;
  if (minutes < 60) {
    return { label: `${Math.round(minutes)} minutes`, tier: 'weak', seconds };
  }
  const hours = minutes / 60;
  if (hours < 24) {
    return { label: `${hours.toFixed(1)} hours`, tier: 'moderate', seconds };
  }
  const days = hours / 24;
  if (days < 365.25) {
    return { label: `${Math.round(days)} days`, tier: 'moderate', seconds };
  }
  const years = days / 365.25;
  if (years < 1000) {
    return { label: `${years < 10 ? years.toFixed(1) : Math.round(years)} years`, tier: 'strong', seconds };
  }
  if (years < 1e6) {
    return { label: `${(years / 1e3).toFixed(1)}k years`, tier: 'strong', seconds };
  }
  if (years < 1e9) {
    return { label: `${(years / 1e6).toFixed(1)}M years`, tier: 'fortress', seconds };
  }
  if (years < 1e12) {
    return { label: `${(years / 1e9).toFixed(1)}B years`, tier: 'fortress', seconds };
  }
  return { label: '> Heat death of universe', tier: 'fortress', seconds };
}