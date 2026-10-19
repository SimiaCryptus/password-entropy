/**
 * Empirical Character Frequencies & Character Set Pools
 * Derived from natural English text and leaked password corpora (RockYou / HIBP distributions).
 */

// Relative unigram weights for lowercase letters (English + password biases)
const LOWER_WEIGHTS = {
  e: 0.118, a: 0.092, r: 0.071, i: 0.069, o: 0.068, t: 0.065, n: 0.063, s: 0.062,
  l: 0.056, c: 0.041, u: 0.034, d: 0.033, p: 0.031, m: 0.030, h: 0.029, g: 0.024,
  b: 0.021, y: 0.020, f: 0.016, w: 0.015, k: 0.014, v: 0.011, x: 0.005, z: 0.005,
  j: 0.004, q: 0.003
};

// Relative weights for digits in passwords (strong preference for 1, 2, 0, 9, 3)
const DIGIT_WEIGHTS = {
  '1': 0.215, '2': 0.145, '0': 0.125, '3': 0.105, '9': 0.090,
  '7': 0.075, '8': 0.070, '4': 0.065, '5': 0.060, '6': 0.050
};

// Relative weights for symbols in passwords ('!' and '@' dominate heavily)
const SYMBOL_WEIGHTS = {
  '!': 0.340, '@': 0.180, '#': 0.100, '$': 0.085, '_': 0.065, '.': 0.055,
  '*': 0.035, '&': 0.030, '?': 0.025, '-': 0.022, '%': 0.018, '+': 0.012,
  '=': 0.008, '/': 0.006, '^': 0.005, '~': 0.004
};

// High-probability bigrams in English / common tokens (reduces bit cost when adjacent)
export const COMMON_BIGRAMS = {
  th: 3.1, he: 3.2, in: 3.3, er: 3.3, an: 3.4, re: 3.5, on: 3.5, at: 3.6,
  en: 3.6, nd: 3.7, ti: 3.7, es: 3.7, or: 3.7, te: 3.8, of: 3.9, ed: 3.8,
  is: 3.9, it: 3.9, al: 3.9, ar: 3.9, st: 3.8, to: 3.9, nt: 4.0, ng: 4.0,
  se: 4.0, ha: 4.0, as: 4.0, ou: 4.0, io: 4.1, le: 4.0, ve: 4.1, co: 4.1,
  me: 4.1, de: 4.1, hi: 4.2, ri: 4.2, ro: 4.2, ic: 4.2, ne: 4.2, ea: 4.2,
  ra: 4.2, ce: 4.2, li: 4.2, ch: 4.2, ll: 4.2, be: 4.3, ma: 4.3, si: 4.3,
  om: 4.3, ur: 4.3,
  '12': 2.2, '23': 2.4, '00': 2.5, '99': 2.8, '19': 2.5, '20': 2.4,
  '!!': 2.2, '!@': 2.9
};

/**
 * Returns character class for a single character
 * @param {string} ch
 * @returns {'lower'|'upper'|'digit'|'symbol'}
 */
export function getCharClass(ch) {
  const code = ch.charCodeAt(0);
  if (code >= 97 && code <= 122) return 'lower';
  if (code >= 65 && code <= 90) return 'upper';
  if (code >= 48 && code <= 57) return 'digit';
  return 'symbol';
}

/**
 * Computes the character pool size for a string under traditional naive pool rules
 * @param {string} str
 * @returns {{ poolSize: number, classes: string[] }}
 */
export function detectCharacterPool(str) {
  let hasLower = false;
  let hasUpper = false;
  let hasDigit = false;
  let hasSymbol = false;

  for (let i = 0; i < str.length; i++) {
    const cls = getCharClass(str[i]);
    if (cls === 'lower') hasLower = true;
    else if (cls === 'upper') hasUpper = true;
    else if (cls === 'digit') hasDigit = true;
    else hasSymbol = true;
  }

  let poolSize = 0;
  const classes = [];
  if (hasLower) { poolSize += 26; classes.push('lowercase (26)'); }
  if (hasUpper) { poolSize += 26; classes.push('uppercase (26)'); }
  if (hasDigit) { poolSize += 10; classes.push('digits (10)'); }
  if (hasSymbol) { poolSize += 33; classes.push('symbols (33)'); }

  return { poolSize: Math.max(poolSize, 1), classes };
}

/**
 * Computes corpus-weighted bit cost for a character, optionally conditioned on previous character
 * @param {string} ch
 * @param {string|null} prevCh
 * @returns {number} Cost in bits
 */
export function getCorpusCharCost(ch, prevCh = null) {
  const cls = getCharClass(ch);
  const lower = ch.toLowerCase();

  // Check bigram discount first
  if (prevCh) {
    const bi = (prevCh + ch).toLowerCase();
    if (COMMON_BIGRAMS[bi] !== undefined) {
      const casePenalty = (cls === 'upper' && getCharClass(prevCh) !== 'upper') ? 1.1 : 0;
      return COMMON_BIGRAMS[bi] + casePenalty;
    }
  }

  // Class selection prior in typical passwords:
  // lowercase: 0.56, digit: 0.22, uppercase: 0.14, symbol: 0.08
  if (cls === 'lower') {
    const pClass = 0.56;
    const pChar = LOWER_WEIGHTS[ch] || (1 / 26);
    return -Math.log2(pClass * pChar);
  }

  if (cls === 'upper') {
    const pClass = 0.14;
    const pChar = LOWER_WEIGHTS[lower] || (1 / 26);
    return -Math.log2(pClass * pChar);
  }

  if (cls === 'digit') {
    const pClass = 0.22;
    const pChar = DIGIT_WEIGHTS[ch] || 0.05;
    return -Math.log2(pClass * pChar);
  }

  // Symbol
  const pClass = 0.08;
  const pChar = SYMBOL_WEIGHTS[ch] || 0.008;
  return -Math.log2(pClass * pChar);
}