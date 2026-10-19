/**
 * Generator Registry & Span Lattice Builder
 * Collects all valid generator and transducer candidates for every substring S[i..j].
 */

import { evaluateCharsetGenerators } from './charset.js';
import { evaluateDictionaryGenerators } from './dictionary.js';
import { evaluateKeyboardGenerator } from './keyboard.js';
import { evaluatePatternGenerators } from './patterns.js';
import { buildPiiDictionary, evaluatePiiGenerator } from './pii.js';

export const DEFAULT_ATTACKER_CONFIG = {
  useDictionary: true,
  useKeyboard: true,
  useL33t: true,
  usePatterns: true,
  usePii: true,
  useCharFreq: true
};

/**
 * Builds the directed acyclic multigraph of candidate segment emissions over password S
 * @param {string} password
 * @param {object} [attackerConfig]
 * @param {object} [piiContext]
 * @returns {Array<Array<object>>} edgesByStart[i] = list of candidate edges starting at index i
 */
export function buildSpanLattice(password, attackerConfig = {}, piiContext = {}) {
  const config = { ...DEFAULT_ATTACKER_CONFIG, ...attackerConfig };
  const n = password.length;
  const edgesByStart = Array.from({ length: n }, () => []);
  const piiTokens = config.usePii ? buildPiiDictionary(piiContext) : [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j <= n; j++) {
      const spanEdges = [];

      // 1. Personal Information & Edit Distance Priors (m_pii)
      const piiCands = evaluatePiiGenerator(password, i, j, config, piiTokens);
      spanEdges.push(...piiCands);

      // 2. Lexical & Dictionary + Transducers (m_dict-f, T_case, T_sub, T_edit)
      const dictCands = evaluateDictionaryGenerators(password, i, j, config);
      spanEdges.push(...dictCands);

      // 3. Spatial Keyboard Walks (m_walk)
      const walkCands = evaluateKeyboardGenerator(password, i, j, config);
      spanEdges.push(...walkCands);

      // 4. Sequences & Repetitions (m_seq, m_rep)
      const patCands = evaluatePatternGenerators(password, i, j, config);
      spanEdges.push(...patCands);

      // 5. Character-Level Fallbacks (m_freq, m_unif)
      const charCands = evaluateCharsetGenerators(password, i, j, config);
      spanEdges.push(...charCands);

      // Deduplicate by (category, moduleId) keeping lowest bit-cost per module type on [i..j]
      const bestByModule = new Map();
      for (const edge of spanEdges) {
        const key = `${edge.category}:${edge.moduleId}`;
        const existing = bestByModule.get(key);
        if (!existing || edge.totalDataBits < existing.totalDataBits) {
          bestByModule.set(key, edge);
        }
      }

      for (const edge of bestByModule.values()) {
        edgesByStart[i].push(edge);
      }
    }
  }

  return edgesByStart;
}