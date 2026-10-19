/**
 * Counterfactual Perturbation & Gradient Engine
 * Identifies the weakest/cheapest segments in the user's password parse tree
 * and evaluates targeted edits S -> S' that break predictable patterns to maximize Delta H*(S).
 */

import { solvePasswordMDL } from './solver.js';

// High-entropy disruption characters that break sequences, walks, and dictionary matches
const DISRUPTION_CHARS = ['9', '7', '#', '?', 'K', 'v', 'Z', '&', 'X'];

/**
 * Computes the top actionable counterfactual recommendations for a password
 * @param {string} password
 * @param {object} [attackerConfig]
 * @param {object} [piiContext]
 * @param {object} [currentSolution]
 * @returns {Array<{
 *   title: string,
 *   explanation: string,
 *   targetToken: string,
 *   newPassword: string,
 *   currentBits: number,
 *   newBits: number,
 *   deltaBits: number
 * }>}
 */
export function computeCounterfactuals(password, attackerConfig = {}, piiContext = {}, currentSolution = null) {
  if (!password || password.length === 0) return [];

  const sol = currentSolution || solvePasswordMDL(password, attackerConfig, piiContext);
  const baseBits = sol.honestBits;
  const segments = sol.optimal.segments;

  const candidates = [];
  const testedPasswords = new Set([password]);

  function testCandidate(newPwd, title, explanation, targetToken) {
    if (!newPwd || testedPasswords.has(newPwd)) return;
    testedPasswords.add(newPwd);

    const newSol = solvePasswordMDL(newPwd, attackerConfig, piiContext, 2);
    const deltaBits = newSol.honestBits - baseBits;

    if (deltaBits > 1.5) {
      candidates.push({
        title,
        explanation,
        targetToken,
        newPassword: newPwd,
        currentBits: baseBits,
        newBits: newSol.honestBits,
        deltaBits
      });
    }
  }

  // 1. Inspect each segment in the optimal parse tree to find compressible patterns
  for (const seg of segments) {
    const segLen = seg.end - seg.start;
    const midOffset = seg.start + Math.floor(segLen / 2);
    const midChar = password[midOffset];

    if (seg.category === 'walk') {
      const replacement = midChar === '9' ? '7' : (/\d/.test(midChar) ? '8' : 'K');
      const mutated = password.slice(0, midOffset) + replacement + password.slice(midOffset + 1);
      testCandidate(
        mutated,
        `Fracture Keyboard Walk "${seg.token}"`,
        `The segment "${seg.token}" costs only ${seg.totalDataBits.toFixed(1)} bits because it traces a physical keyboard walk. Replacing '${midChar}' with '${replacement}' breaks the spatial path.`,
        seg.token
      );
    } else if (seg.category === 'seq') {
      const replacement = midChar === '8' ? '3' : '8';
      const mutated = password.slice(0, midOffset) + replacement + password.slice(midOffset + 1);
      testCandidate(
        mutated,
        `Break Predictable Sequence "${seg.token}"`,
        `The segment "${seg.token}" costs only ${seg.totalDataBits.toFixed(1)} bits as a predictable sequence/year. Changing '${midChar}' → '${replacement}' forces character-level evaluation.`,
        seg.token
      );
    } else if (seg.category === 'rep') {
      const replacement = midChar === 'X' ? '9' : 'X';
      const mutated = password.slice(0, midOffset) + replacement + password.slice(midOffset + 1);
      testCandidate(
        mutated,
        `Break Repetition "${seg.token}"`,
        `The repeated segment "${seg.token}" compresses to ${seg.totalDataBits.toFixed(1)} bits. Replacing '${midChar}' → '${replacement}' eliminates the repeat run.`,
        seg.token
      );
    } else if (seg.category === 'pii') {
      const insertChar = '7#';
      const mutated = password.slice(0, midOffset) + insertChar + password.slice(midOffset);
      testCandidate(
        mutated,
        `Eliminate Personal Info Match "${seg.token}"`,
        `The segment "${seg.token}" matches attacker-known personal context (${seg.totalDataBits.toFixed(1)} bits). Injecting "${insertChar}" inside it breaks the personal prior and edit-distance link.`,
        seg.token
      );
    } else if (seg.category === 'dict' && segLen >= 4) {
      // Insert a non-l33t consonant/symbol inside the dictionary word to split it into two non-words
      const disruptor = midChar === 'q' ? 'x' : 'q';
      const mutated = password.slice(0, midOffset) + disruptor.toUpperCase() + password.slice(midOffset);
      testCandidate(
        mutated,
        `Split Dictionary Word "${seg.token}"`,
        `"${seg.token}" compresses to ${seg.totalDataBits.toFixed(1)} bits via dictionary/transducer lookup. Inserting '${disruptor.toUpperCase()}' in the middle fractures the lexical match.`,
        seg.token
      );
    } else if (seg.category === 'charset' && segLen === 1 && seg.end === password.length && (seg.token === '!' || seg.token === '@')) {
      const replacement = '~';
      const mutated = password.slice(0, seg.start) + replacement;
      testCandidate(
        mutated,
        `Replace Predictable Trailing "${seg.token}"`,
        `A trailing "${seg.token}" is the #1 most common symbol in leaked passwords (${seg.totalDataBits.toFixed(1)} bits). Using a less common symbol like '${replacement}' or moving it inward adds entropy.`,
        seg.token
      );
    }
  }

  // 2. If the password is short (< 12 chars), also evaluate appending an unpredictable 2-char token or extra word
  if (password.length < 12 || candidates.length < 2) {
    const insertPos = Math.max(1, Math.floor(password.length / 2));
    const infixPwd = password.slice(0, insertPos) + '9#v' + password.slice(insertPos);
    testCandidate(
      infixPwd,
      `Inject Uncorrelated Infix "9#v"`,
      `Inserting a short uncorrelated token ("9#v") at position ${insertPos + 1} adds both transition overhead and uncompressed character entropy.`,
      password
    );
  }

  candidates.sort((a, b) => b.deltaBits - a.deltaBits);
  return candidates.slice(0, 3);
}