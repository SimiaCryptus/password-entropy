/**
 * Probabilistic L33tspeak & Common Character Substitution Tables (T_sub)
 * Maps observed substituted symbols/digits back to candidate plaintext letters
 * along with their conditional substitution probability P(sub | plain).
 */

// Forward conditional probabilities P(substituted_char | base_letter)
// Conditional on a user applying a l33t substitution to a word
export const L33T_SUBSTITUTIONS = {
  '@': [
    { plain: 'a', prob: 0.82, label: 'a→@' }
  ],
  '4': [
    { plain: 'a', prob: 0.65, label: 'a→4' }
  ],
  '0': [
    { plain: 'o', prob: 0.88, label: 'o→0' }
  ],
  '3': [
    { plain: 'e', prob: 0.84, label: 'e→3' }
  ],
  '1': [
    { plain: 'i', prob: 0.55, label: 'i→1' },
    { plain: 'l', prob: 0.42, label: 'l→1' }
  ],
  '!': [
    { plain: 'i', prob: 0.52, label: 'i→!' },
    { plain: 'l', prob: 0.25, label: 'l→!' }
  ],
  '$': [
    { plain: 's', prob: 0.80, label: 's→$' }
  ],
  '5': [
    { plain: 's', prob: 0.68, label: 's→5' }
  ],
  '7': [
    { plain: 't', prob: 0.65, label: 't→7' }
  ],
  '+': [
    { plain: 't', prob: 0.35, label: 't→+' }
  ],
  '8': [
    { plain: 'b', prob: 0.45, label: 'b→8' }
  ],
  '9': [
    { plain: 'g', prob: 0.40, label: 'g→9' }
  ],
  '6': [
    { plain: 'g', prob: 0.32, label: 'g→6' },
    { plain: 'b', prob: 0.25, label: 'b→6' }
  ],
  '2': [
    { plain: 'z', prob: 0.42, label: 'z→2' }
  ],
  '(': [
    { plain: 'c', prob: 0.30, label: 'c→(' }
  ]
};

/**
 * Generates inverse-l33t candidate strings for an observed token.
 * Limits branching factor so long tokens remain fast.
 * @param {string} token
 * @returns {Array<{ plain: string, subs: Array<{ pos: number, from: string, to: string, prob: number, label: string }>, bitCost: number }>}
 */
export function expandInverseL33t(token) {
  const lower = token.toLowerCase();
  const subPositions = [];

  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    if (L33T_SUBSTITUTIONS[ch]) {
      subPositions.push(i);
    }
  }

  // If no l33t characters or too many (likely pure digits/symbols), skip
  if (subPositions.length === 0 || subPositions.length > 6) {
    return [];
  }

  // Must contain at least one letter or be a known word length >= 3
  if (token.length < 3) return [];

  const results = [];

  function backtrack(idx, currentChars, currentSubs) {
    if (results.length >= 24) return;
    if (idx === subPositions.length) {
      if (currentSubs.length > 0) {
        // Base invocation overhead of enabling l33t transducer (~1.2 bits) + sum of -log2(P)
        let bitCost = 1.2;
        for (const s of currentSubs) {
          bitCost += -Math.log2(s.prob);
        }
        results.push({
          plain: currentChars.join(''),
          subs: [...currentSubs],
          bitCost
        });
      }
      return;
    }

    const pos = subPositions[idx];
    const obsChar = lower[pos];
    const candidates = L33T_SUBSTITUTIONS[obsChar];

    // Option 1: Substitute with each candidate letter
    for (const cand of candidates) {
      currentChars[pos] = cand.plain;
      currentSubs.push({
        pos,
        from: cand.plain,
        to: token[pos],
        prob: cand.prob,
        label: cand.label
      });
      backtrack(idx + 1, currentChars, currentSubs);
      currentSubs.pop();
    }

    // Option 2: Leave character as-is (in case a trailing digit is part of a word or partial l33t)
    currentChars[pos] = obsChar;
    backtrack(idx + 1, currentChars, currentSubs);
  }

  backtrack(0, lower.split(''), []);
  return results;
}