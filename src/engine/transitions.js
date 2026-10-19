/**
 * Markov State-Transition Matrix P(m_i | m_{i-1})
 * Models typical human password structures:
 * e.g. START -> Dictionary -> Sequence/Digits -> Symbol -> END
 * Costs are given in bits: -log2 P(m_i | m_{i-1}).
 */

// Categories: 'START', 'dict', 'pii', 'walk', 'seq', 'rep', 'charset', 'symbol_tail'
const TRANSITION_PROB_MATRIX = {
  START: {
    dict: 0.42,       // ~1.25 bits: Most passwords start with a word
    pii: 0.24,        // ~2.06 bits: Or personal info
    walk: 0.12,       // ~3.06 bits: Or a keyboard walk
    seq: 0.08,        // ~3.64 bits: Or a sequence/year
    charset: 0.12,    // ~3.06 bits: Or raw characters
    rep: 0.02         // ~5.64 bits
  },
  dict: {
    seq: 0.34,        // ~1.55 bits: Word followed by numbers/year/sequence (e.g., "password123")
    dict: 0.28,       // ~1.84 bits: Multi-word passphrase ("correct" -> "horse")
    charset: 0.20,    // ~2.32 bits: Word followed by trailing symbol/digits ("dragon!")
    pii: 0.08,        // ~3.64 bits
    walk: 0.05,       // ~4.32 bits
    rep: 0.05         // ~4.32 bits
  },
  pii: {
    seq: 0.36,        // ~1.47 bits: Name + birth year/sequence
    charset: 0.24,    // ~2.06 bits: Name + symbol/digits
    dict: 0.20,       // ~2.32 bits
    pii: 0.12,        // ~3.06 bits
    walk: 0.04,
    rep: 0.04
  },
  walk: {
    seq: 0.25,
    charset: 0.25,
    walk: 0.22,
    dict: 0.16,
    pii: 0.06,
    rep: 0.06
  },
  seq: {
    charset: 0.44,    // ~1.18 bits: Sequence/Year followed by '!' or symbol ("123!")
    dict: 0.20,
    seq: 0.14,
    pii: 0.10,
    walk: 0.06,
    rep: 0.06
  },
  rep: {
    charset: 0.35,
    dict: 0.25,
    seq: 0.20,
    pii: 0.08,
    walk: 0.06,
    rep: 0.06
  },
  charset: {
    dict: 0.28,
    seq: 0.26,
    charset: 0.22,
    pii: 0.10,
    walk: 0.08,
    rep: 0.06
  }
};

/**
 * Computes the transition cost in bits -log2 P(toCategory | fromCategory)
 * @param {string} fromCategory
 * @param {string} toCategory
 * @returns {{ bits: number, prob: number, label: string }}
 */
export function getTransitionCost(fromCategory, toCategory) {
  const fromKey = TRANSITION_PROB_MATRIX[fromCategory] ? fromCategory : 'charset';
  const row = TRANSITION_PROB_MATRIX[fromKey];
  const prob = row[toCategory] || 0.05;
  const bits = -Math.log2(prob);

  return {
    bits,
    prob,
    label: `${fromCategory === 'START' ? 'START' : fromCategory} → ${toCategory}`
  };
}