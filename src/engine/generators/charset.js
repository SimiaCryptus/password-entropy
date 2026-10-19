/**
 * Character-Level Generators:
 * 1. m_unif: Uniform character selection from active pool
 * 2. m_freq: Corpus-weighted unigram/bigram natural language & password frequency model
 */

import { getCharClass, getCorpusCharCost } from '../../data/char-frequencies.js';

/**
 * Generates character-level fallback emissions for span S[start..end]
 * Only emits spans up to length 8 (since longer random spans decompose into adjacent spans with zero extra per-char overhead)
 * OR the full string span for reference.
 * @param {string} password
 * @param {number} start
 * @param {number} end
 * @param {object} config
 * @returns {Array}
 */
export function evaluateCharsetGenerators(password, start, end, config) {
  const span = password.slice(start, end);
  const len = span.length;

  // Limit arbitrary substring explosion for raw charsets while always allowing single-class runs or short spans
  if (len > 8 && !(start === 0 && end === password.length)) {
    // Allow if all characters share the same class (e.g. a run of digits or lowercase)
    const firstCls = getCharClass(span[0]);
    for (let i = 1; i < len; i++) {
      if (getCharClass(span[i]) !== firstCls) return [];
    }
  }

  const candidates = [];

  // Determine minimal character class pool for this specific span
  let hasLower = false, hasUpper = false, hasDigit = false, hasSymbol = false;
  for (let i = 0; i < len; i++) {
    const cls = getCharClass(span[i]);
    if (cls === 'lower') hasLower = true;
    else if (cls === 'upper') hasUpper = true;
    else if (cls === 'digit') hasDigit = true;
    else hasSymbol = true;
  }

  let spanPool = 0;
  let poolDesc = '';
  if (hasLower && !hasUpper && !hasDigit && !hasSymbol) {
    spanPool = 26; poolDesc = 'a-z (26)';
  } else if (!hasLower && hasUpper && !hasDigit && !hasSymbol) {
    spanPool = 26; poolDesc = 'A-Z (26)';
  } else if (!hasLower && !hasUpper && hasDigit && !hasSymbol) {
    spanPool = 10; poolDesc = '0-9 (10)';
  } else if (!hasLower && !hasUpper && !hasDigit && hasSymbol) {
    spanPool = 33; poolDesc = 'symbols (33)';
  } else {
    if (hasLower) spanPool += 26;
    if (hasUpper) spanPool += 26;
    if (hasDigit) spanPool += 10;
    if (hasSymbol) spanPool += 33;
    poolDesc = `mixed (${spanPool})`;
  }

  // 1. Uniform Charset Generator (m_unif)
  const uniformBits = len * Math.log2(spanPool);
  candidates.push({
    start,
    end,
    token: span,
    category: 'charset',
    moduleId: 'm_unif',
    moduleName: 'Uniform Charset',
    baseBits: uniformBits,
    totalDataBits: uniformBits,
    summary: `Uniform [${poolDesc}] × ${len}`,
    layers: [
      {
        type: 'base',
        module: 'm_unif',
        title: 'Uniform Charset',
        detail: `${len} char${len > 1 ? 's' : ''} from ${poolDesc}`,
        formula: `${len} × log₂(${spanPool})`,
        bits: uniformBits
      }
    ]
  });

  // 2. Corpus-Weighted Charset Generator (m_freq)
  if (config.useCharFreq !== false) {
    let freqBits = 0;
    for (let i = 0; i < len; i++) {
      const prev = i > 0 ? span[i - 1] : null;
      freqBits += getCorpusCharCost(span[i], prev);
    }

    // Special recognition for single trailing '!' or '@' (extremely common password suffix)
    let detailText = `Corpus frequency (${len} char${len > 1 ? 's' : ''})`;
    if (len === 1 && end === password.length && (span === '!' || span === '@')) {
      freqBits = span === '!' ? 1.55 : 2.45;
      detailText = `Common trailing symbol "${span}"`;
    }

    candidates.push({
      start,
      end,
      token: span,
      category: 'charset',
      moduleId: 'm_freq',
      moduleName: 'Corpus Frequency',
      baseBits: freqBits,
      totalDataBits: freqBits,
      summary: len === 1 && end === password.length && (span === '!' || span === '@')
        ? `Trailing "${span}"`
        : `Corpus Freq "${span}"`,
      layers: [
        {
          type: 'base',
          module: 'm_freq',
          title: 'Corpus-Weighted Chars',
          detail: detailText,
          formula: `∑ -log₂ P(cᵢ)`,
          bits: freqBits
        }
      ]
    });
  }

  return candidates;
}