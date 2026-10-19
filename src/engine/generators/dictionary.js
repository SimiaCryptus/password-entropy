/**
 * Lexical & Dictionary Generators (m_dict-f, m_dict-u)
 * Composes with Case (T_case), L33t (T_sub), and Edit Distance (T_edit) transducers.
 */

import { lookupWord, getTopDictionaryWords } from '../../data/dictionary.js';
import { generateNormalizedForms, evaluateEditDistanceTransducer, computeCaseModifier } from './transducers.js';

const TOP_WORDS_FOR_FUZZY = getTopDictionaryWords(180);

/**
 * Evaluates dictionary matches (exact, case-modified, l33t-substituted, or fuzzy-edited)
 * for span S[start..end]
 * @param {string} password
 * @param {number} start
 * @param {number} end
 * @param {object} config
 * @returns {Array}
 */
export function evaluateDictionaryGenerators(password, start, end, config) {
  if (config.useDictionary === false) return [];

  const span = password.slice(start, end);
  if (span.length < 3 || span.length > 16) return [];

  const candidates = [];
  const allowL33t = config.useL33t !== false;

  // 1. Direct & Inverse-Transducer Dictionary Lookup
  const forms = generateNormalizedForms(span, allowL33t);

  for (const form of forms) {
    const entry = lookupWord(form.plainWord);
    if (!entry) continue;

    const baseBits = entry.zipfBits;
    const totalDataBits = baseBits + form.transducerBits;

    const layers = [
      {
        type: 'base',
        module: 'm_dict-f',
        title: `Dictionary Word`,
        detail: `"${entry.word}" (rank #${entry.rank})`,
        formula: `-log₂ P_dict("${entry.word}")`,
        bits: baseBits
      }
    ];

    if (form.caseLayer) layers.push(form.caseLayer);
    if (form.l33tLayer) layers.push(form.l33tLayer);

    const hasMut = Boolean(form.caseLayer || form.l33tLayer);
    candidates.push({
      start,
      end,
      token: span,
      category: 'dict',
      moduleId: hasMut ? 'm_dict+T' : 'm_dict-f',
      moduleName: hasMut ? 'Mutated Dict Word' : 'Dictionary Word',
      baseBits,
      totalDataBits,
      summary: hasMut ? `Dict("${entry.word}") + Mut` : `Dict("${entry.word}")`,
      layers
    });
  }

  // 2. Fuzzy / Edit Distance Dictionary Match (d = 1) for spans >= 5 chars when no exact/l33t match was found
  if (candidates.length === 0 && span.length >= 5 && span.length <= 12 && allowL33t) {
    const lower = span.toLowerCase();
    if (/^[a-z0-9@$!]+$/.test(lower)) {
      for (const top of TOP_WORDS_FOR_FUZZY) {
        if (Math.abs(top.word.length - lower.length) > 1) continue;
        const edit = evaluateEditDistanceTransducer(top.word, lower, 1);
        if (edit) {
          const entry = lookupWord(top.word);
          const caseMod = computeCaseModifier(span);
          const baseBits = entry.zipfBits;
          const totalDataBits = baseBits + edit.bitCost + caseMod.bits;

          const layers = [
            {
              type: 'base',
              module: 'm_dict-f',
              title: 'Dictionary Word',
              detail: `"${entry.word}" (rank #${entry.rank})`,
              formula: `-log₂ P_dict("${entry.word}")`,
              bits: baseBits
            },
            {
              type: 'edit',
              module: 'T_edit',
              title: `Edit Transducer (d=${edit.distance})`,
              detail: edit.editDesc,
              formula: `L_γ(1) + log₂(|s|) + log₂(|Σ|)`,
              bits: edit.bitCost
            }
          ];

          if (caseMod.bits > 0) {
            layers.push({
              type: 'case',
              module: 'T_case',
              title: 'Case Modifier',
              detail: caseMod.detail,
              formula: caseMod.formula,
              bits: caseMod.bits
            });
          }

          candidates.push({
            start,
            end,
            token: span,
            category: 'dict',
            moduleId: 'm_dict+edit',
            moduleName: 'Fuzzy Dict Word',
            baseBits,
            totalDataBits,
            summary: `Dict("${entry.word}") + Edit(d=1)`,
            layers
          });
          break;
        }
      }
    }
  }

  return candidates;
}