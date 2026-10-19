/**
 * Traditional Naive Entropy Calculator
 * Computes classic pool-based Shannon entropy: L * log2(|Pool|)
 * as well as Empirical Character Shannon Entropy.
 */

import { detectCharacterPool } from '../data/char-frequencies.js';

/**
 * Computes naive pool-based entropy for comparison with Honest MDL Entropy
 * @param {string} password
 * @returns {{
 *   bits: number,
 *   poolSize: number,
 *   classes: string[],
 *   bitsPerChar: number,
 *   derivation: object
 * }}
 */
export function computeNaiveEntropy(password) {
  if (!password || password.length === 0) {
    return {
      bits: 0,
      poolSize: 0,
      classes: [],
      bitsPerChar: 0,
      derivation: {
        id: 'naive',
        label: 'Naive Pool-Based Model',
        totalBits: 0,
        modelBits: 0,
        dataBits: 0,
        segments: []
      }
    };
  }

  const { poolSize, classes } = detectCharacterPool(password);
  const bitsPerChar = Math.log2(poolSize);
  const bits = password.length * bitsPerChar;

  // Construct a compatible derivation object so the UI can preview the Naive Model on the ribbon
  const derivation = {
    id: 'naive-model',
    label: 'Naive Random Charset Model',
    isNaiveReference: true,
    totalBits: bits,
    modelBits: 0,
    dataBits: bits,
    segments: [
      {
        start: 0,
        end: password.length,
        token: password,
        category: 'charset',
        moduleId: 'm_unif',
        moduleName: 'Naive Random Pool',
        baseBits: bits,
        totalDataBits: bits,
        transitionBits: 0,
        transitionLabel: 'Uniform Assumption (0b)',
        totalSegmentBits: bits,
        summary: `Uniform Pool (${poolSize}) × ${password.length}`,
        layers: [
          {
            type: 'base',
            module: 'm_unif',
            title: 'Naive Uniform Pool',
            detail: `${password.length} chars × log₂(${poolSize}) [${classes.join(' + ')}]`,
            formula: `${password.length} × ${bitsPerChar.toFixed(2)}b`,
            bits
          }
        ]
      }
    ]
  };

  return {
    bits,
    poolSize,
    classes,
    bitsPerChar,
    derivation
  };
}