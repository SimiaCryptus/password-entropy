/**
 * Relational & Mutation Operators (Transducers):
 * 1. T_case: Case Modifiers (Lowercase, Title Case, ALL CAPS, End-Cap, Combinatorial Mask)
 * 2. T_sub: L33tspeak probabilistic character substitutions (a->@, o->0, e->3, etc.)
 * 3. T_edit: Damerau-Levenshtein / Hamming edit distance transducer (d <= 2)
 */

import { combinationCost, eliasGammaCost } from '../coding.js';
import { expandInverseL33t } from '../../data/l33t-table.js';

/**
 * Computes the MDL bit-cost of the capitalization state for an observed token
 * @param {string} token
 * @returns {{ bits: number, type: string, detail: string, formula: string }}
 */
export function computeCaseModifier(token) {
  let letterCount = 0;
  let upperCount = 0;
  let firstIsUpper = false;
  let lastIsUpper = false;

  for (let i = 0; i < token.length; i++) {
    const code = token.charCodeAt(i);
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;
    if (isUpper || isLower) {
      letterCount++;
      if (isUpper) {
        upperCount++;
        if (letterCount === 1) firstIsUpper = true;
        lastIsUpper = true;
      } else {
        lastIsUpper = false;
      }
    }
  }

  if (letterCount === 0 || upperCount === 0) {
    return { bits: 0, type: 'lowercase', detail: 'All lowercase', formula: '0b' };
  }

  if (upperCount === 1 && firstIsUpper) {
    return {
      bits: 1.5,
      type: 'title',
      detail: `Title Case ("${token[0]}")`,
      formula: '-log₂ P(TitleCase)'
    };
  }

  if (upperCount === letterCount && letterCount > 1) {
    return {
      bits: 1.8,
      type: 'allcaps',
      detail: 'ALL CAPS modifier',
      formula: '-log₂ P(ALLCAPS)'
    };
  }

  if (upperCount === 1 && lastIsUpper) {
    return {
      bits: 2.5,
      type: 'endcap',
      detail: 'Final letter capitalized',
      formula: '-log₂ P(EndCap)'
    };
  }

  // Arbitrary mixed case mask: C(n, k) + Elias gamma for k
  const maskBits = combinationCost(letterCount, upperCount) + eliasGammaCost(upperCount);
  return {
    bits: maskBits,
    type: 'mixed',
    detail: `Mixed Case (${upperCount}/${letterCount} upper)`,
    formula: `log₂ C(${letterCount},${upperCount}) + L_γ(${upperCount})`
  };
}

/**
 * Generates all inverse-transducer candidates (plain + case + l33t) for an observed token
 * @param {string} token
 * @param {boolean} allowL33t
 * @returns {Array<{ plainWord: string, caseLayer: object|null, l33tLayer: object|null, transducerBits: number }>}
 */
export function generateNormalizedForms(token, allowL33t = true) {
  const results = [];
  const caseMod = computeCaseModifier(token);
  const caseLayer = caseMod.bits > 0 ? {
    type: 'case',
    module: 'T_case',
    title: 'Case Modifier',
    detail: caseMod.detail,
    formula: caseMod.formula,
    bits: caseMod.bits
  } : null;

  const lower = token.toLowerCase();

  // 1. Direct alphabetic form (no l33t)
  if (/^[a-z]+$/.test(lower)) {
    results.push({
      plainWord: lower,
      caseLayer,
      l33tLayer: null,
      transducerBits: caseMod.bits
    });
  }

  // 2. Inverse L33tspeak expansion (if enabled)
  if (allowL33t) {
    const l33tExpansions = expandInverseL33t(token);
    for (const exp of l33tExpansions) {
      if (!/^[a-z]+$/.test(exp.plain)) continue;
      const subDesc = exp.subs.map(s => s.label).join(', ');
      const l33tLayer = {
        type: 'l33t',
        module: 'T_sub',
        title: 'L33t Transducer',
        detail: subDesc,
        formula: `∑ -log₂ P(s'ⱼ | sⱼ)`,
        bits: exp.bitCost
      };

      results.push({
        plainWord: exp.plain,
        caseLayer,
        l33tLayer,
        transducerBits: caseMod.bits + exp.bitCost
      });
    }
  }

  return results;
}

/**
 * Computes Damerau-Levenshtein edit distance and edit operations between source string and target string
 * Early exits if distance exceeds maxDist.
 * @param {string} source Known reference token (e.g., previous password or dictionary word)
 * @param {string} target Observed span in current password
 * @param {number} [maxDist=2]
 * @returns {null | { distance: number, editDesc: string, bitCost: number }}
 */
export function evaluateEditDistanceTransducer(source, target, maxDist = 2) {
  if (!source || !target) return null;
  if (source === target) return null; // Exact match is handled without edit transducer
  const m = source.length;
  const n = target.length;
  if (Math.abs(m - n) > maxDist) return null;
  if (n < 4 || m < 4) return null;

  // Standard DP matrix for Damerau-Levenshtein
  const dp = Array.from({ length: m + 1 }, () => new Int16Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    let rowMin = 999;
    for (let j = 1; j <= n; j++) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1;
      let val = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && source[i - 1] === target[j - 2] && source[i - 2] === target[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + cost); // transposition
      }
      dp[i][j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return null;
  }

  const d = dp[m][n];
  if (d === 0 || d > maxDist) return null;

  // Summarize edits for UI explanation
  const diffs = [];
  if (m === n) {
    for (let i = 0; i < m; i++) {
      if (source[i] !== target[i]) {
        diffs.push(`pos ${i + 1}: '${source[i]}'→'${target[i]}'`);
      }
    }
  } else if (n > m) {
    diffs.push(`+${n - m} char insertion`);
  } else {
    diffs.push(`-${m - n} char deletion`);
  }

  const editDesc = diffs.length > 0 ? diffs.slice(0, 2).join(', ') : `${d} char edit${d > 1 ? 's' : ''}`;

  // Mathematical cost from idea.md Section 2.3.F:
  // Cost(s' | s) = L_N(d) + d * (log2(|s|) + log2(|Sigma|))
  // For predictable incremental edits (e.g., 2024 -> 2025), the alphabet of the changed digit is small (~10)
  const isDigitBump = m === n && d === 1 && /\d/.test(target) && (() => {
    for (let i = 0; i < m; i++) {
      if (source[i] !== target[i]) {
        return /\d/.test(source[i]) && /\d/.test(target[i]) && Math.abs(Number(target[i]) - Number(source[i])) === 1;
      }
    }
    return false;
  })();

  const posBits = Math.log2(Math.max(2, m));
  const charBits = isDigitBump ? 1.5 : 4.7; // Incremental digit bump vs general char substitution
  const bitCost = eliasGammaCost(d) + d * (posBits + charBits);

  return {
    distance: d,
    editDesc: isDigitBump ? `Incremented digit (${editDesc})` : editDesc,
    bitCost
  };
}