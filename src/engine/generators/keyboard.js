/**
 * Keyboard & Spatial Walk Generator (m_walk)
 * Models physical keyboard walks on QWERTY, Dvorak, and Numpad coordinate graphs.
 * Cost = log2(|V|) [start key] + (turns + 1) * log2(deg(v)) [direction vectors] + L_N(length) [Elias gamma length]
 */

import { analyzeKeyboardWalk } from '../../data/keyboards.js';
import { eliasGammaCost } from '../coding.js';

const LOG2_DEGREE = Math.log2(8); // 3.0 bits per direction vector on 8-neighbor grid

/**
 * Evaluates spatial keyboard walk for span S[start..end]
 * @param {string} password
 * @param {number} start
 * @param {number} end
 * @param {object} config
 * @returns {Array}
 */
export function evaluateKeyboardGenerator(password, start, end, config) {
  if (config.useKeyboard === false) return [];

  const span = password.slice(start, end);
  if (span.length < 3) return [];

  const walk = analyzeKeyboardWalk(span);
  if (!walk) return [];

  const startKeyCost = Math.log2(walk.keyCount); // ~5.55 bits for 47-key layout
  const directionCost = (1 + walk.turns * 0.85) * LOG2_DEGREE;
  const lengthCost = eliasGammaCost(span.length - 2);
  const baseBits = startKeyCost + directionCost + lengthCost;

  // If Shift state was toggled during or at the start of the walk, add a modifier layer
  const shiftBits = walk.shiftChanges > 0 ? 1.5 * walk.shiftChanges : 0;
  const totalDataBits = baseBits + shiftBits;

  const layers = [
    {
      type: 'base',
      module: 'm_walk',
      title: `${walk.layout} Walk`,
      detail: `${walk.pathDesc}, len ${span.length}`,
      formula: `log₂(${walk.keyCount}) + dir + L_γ(${span.length - 2})`,
      bits: baseBits
    }
  ];

  if (shiftBits > 0) {
    layers.push({
      type: 'case',
      module: 'm_mod',
      title: 'Shift Key Modifier',
      detail: `${walk.shiftChanges} Shift state toggle${walk.shiftChanges > 1 ? 's' : ''}`,
      formula: `${walk.shiftChanges} × 1.5b`,
      bits: shiftBits
    });
  }

  return [
    {
      start,
      end,
      token: span,
      category: 'walk',
      moduleId: 'm_walk',
      moduleName: 'Keyboard Walk',
      baseBits,
      totalDataBits,
      summary: `${walk.layout} Walk "${span}"`,
      layers
    }
  ];
}