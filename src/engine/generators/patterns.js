/**
 * Common Pattern Generators:
 * 1. m_rep: Character repetition ("aaaa") or repeated substring ("passpass", "121212")
 * 2. m_seq: Arithmetic ASCII/digit sequences ("12345", "abcd", "9876") & Calendar Years/Dates ("2024", "1998")
 */

import { eliasGammaCost } from '../coding.js';
import { getCorpusCharCost } from '../../data/char-frequencies.js';

/**
 * Evaluates repetition and sequence generators for span S[start..end]
 * @param {string} password
 * @param {number} start
 * @param {number} end
 * @param {object} config
 * @returns {Array}
 */
export function evaluatePatternGenerators(password, start, end, config) {
  if (config.usePatterns === false) return [];

  const span = password.slice(start, end);
  const len = span.length;
  if (len < 3) return [];

  const candidates = [];

  // 1. Single-character repetition (e.g., "aaaa", "1111", "!!!!")
  let allSame = true;
  for (let i = 1; i < len; i++) {
    if (span[i] !== span[0]) {
      allSame = false;
      break;
    }
  }

  if (allSame) {
    const seedCost = getCorpusCharCost(span[0]);
    const repeatCost = eliasGammaCost(len);
    const totalBits = seedCost + repeatCost;

    candidates.push({
      start,
      end,
      token: span,
      category: 'rep',
      moduleId: 'm_rep',
      moduleName: 'Repetition',
      baseBits: totalBits,
      totalDataBits: totalBits,
      summary: `Repeat "${span[0]}" × ${len}`,
      layers: [
        {
          type: 'base',
          module: 'm_rep',
          title: 'Char Repetition',
          detail: `"${span[0]}" repeated ${len} times`,
          formula: `Cost("${span[0]}") + L_γ(${len})`,
          bits: totalBits
        }
      ]
    });
  }

  // 2. Repeated multi-char block within the span (e.g., "abcabc", "121212")
  if (!allSame && len >= 4) {
    for (let unitLen = 2; unitLen <= Math.floor(len / 2); unitLen++) {
      if (len % unitLen !== 0) continue;
      const unit = span.slice(0, unitLen);
      const count = len / unitLen;
      if (unit.repeat(count) === span) {
        let unitBits = 0;
        for (let k = 0; k < unit.length; k++) {
          unitBits += getCorpusCharCost(unit[k], k > 0 ? unit[k - 1] : null);
        }
        const repBits = eliasGammaCost(count);
        const totalBits = unitBits + repBits;

        candidates.push({
          start,
          end,
          token: span,
          category: 'rep',
          moduleId: 'm_rep',
          moduleName: 'Block Repetition',
          baseBits: totalBits,
          totalDataBits: totalBits,
          summary: `Repeat "${unit}" × ${count}`,
          layers: [
            {
              type: 'base',
              module: 'm_rep',
              title: 'Token Repetition',
              detail: `"${unit}" repeated ${count}×`,
              formula: `Cost("${unit}") + L_γ(${count})`,
              bits: totalBits
            }
          ]
        });
        break;
      }
    }
  }

  // 3. Calendar Year / Date Pattern (e.g., 1950..2035)
  if (len === 4 && /^\d{4}$/.test(span)) {
    const year = parseInt(span, 10);
    if (year >= 1950 && year <= 2035) {
      // Recent years (2020-2026) are drastically overrepresented in passwords (~4.8 bits), older years ~6.4 bits
      const isRecent = year >= 2018 && year <= 2027;
      const yearBits = isRecent ? 4.8 : 6.4;

      candidates.push({
        start,
        end,
        token: span,
        category: 'seq',
        moduleId: 'm_seq',
        moduleName: 'Calendar Year',
        baseBits: yearBits,
        totalDataBits: yearBits,
        summary: `Year "${span}"`,
        layers: [
          {
            type: 'base',
            module: 'm_seq',
            title: 'Calendar Year Prior',
            detail: isRecent ? `Recent year (${span})` : `Birth/calendar year (${span})`,
            formula: `-log₂ P_year(${span})`,
            bits: yearBits
          }
        ]
      });
    }
  }

  // 4. Arithmetic Sequence (e.g., "1234", "abcd", "9876", "2468")
  const lower = span.toLowerCase();
  const step = lower.charCodeAt(1) - lower.charCodeAt(0);
  if (step !== 0 && Math.abs(step) <= 2) {
    let isSeq = true;
    for (let i = 2; i < len; i++) {
      if (lower.charCodeAt(i) - lower.charCodeAt(i - 1) !== step) {
        isSeq = false;
        break;
      }
    }

    if (isSeq) {
      // Common start points ('1', '0', 'a', '9') cost fewer bits than arbitrary start points
      const first = lower[0];
      const startCost = (first === '1' || first === 'a' || first === '0' || first === '9') ? 1.8 : 4.2;
      const stepCost = step === 1 ? 0.6 : (step === -1 ? 1.4 : 2.4);
      const lenCost = eliasGammaCost(len - 2);
      const baseBits = startCost + stepCost + lenCost;

      // Check case modifier for alphabetic sequences
      let caseBits = 0;
      if (/[a-zA-Z]/.test(span) && span !== lower) {
        caseBits = span === span.toUpperCase() ? 1.8 : 1.5;
      }

      const totalDataBits = baseBits + caseBits;
      const dirDesc = step > 0 ? `ascending (+${step})` : `descending (${step})`;

      const layers = [
        {
          type: 'base',
          module: 'm_seq',
          title: 'Sequence Generator',
          detail: `${dirDesc} sequence, len ${len}`,
          formula: `start + step + L_γ(${len - 2})`,
          bits: baseBits
        }
      ];

      if (caseBits > 0) {
        layers.push({
          type: 'case',
          module: 'm_mod',
          title: 'Case Modifier',
          detail: 'Uppercase sequence modifier',
          formula: '1.8b',
          bits: caseBits
        });
      }

      candidates.push({
        start,
        end,
        token: span,
        category: 'seq',
        moduleId: 'm_seq',
        moduleName: 'Sequence',
        baseBits,
        totalDataBits,
        summary: `Sequence "${span}"`,
        layers
      });
    }
  }

  return candidates;
}