/**
 * Spatial Keyboard Coordinate Graphs (m_walk)
 * Models physical keyboard layouts (QWERTY, Dvorak, Numpad) as 2D grids
 * supporting horizontal, vertical, and diagonal adjacency walks, plus Shift layer.
 */

const QWERTY_ROWS = [
  { y: 0, xOffset: 0.0, normal: '`1234567890-=', shifted: '~!@#$%^&*()_+' },
  { y: 1, xOffset: 0.5, normal: 'qwertyuiop[]\\', shifted: 'QWERTYUIOP{}|' },
  { y: 2, xOffset: 0.75, normal: "asdfghjkl;'", shifted: 'ASDFGHJKL:"' },
  { y: 3, xOffset: 1.25, normal: 'zxcvbnm,./', shifted: 'ZXCVBNM<>?' }
];

const DVORAK_ROWS = [
  { y: 0, xOffset: 0.0, normal: '`1234567890[]', shifted: '~!@#$%^&*(){}' },
  { y: 1, xOffset: 0.5, normal: "',.pyfgcrl/=\\", shifted: '"<>PYFGCRL?+|' },
  { y: 2, xOffset: 0.75, normal: 'aoeuidhtns-', shifted: 'AOEUIDHTNS_' },
  { y: 3, xOffset: 1.25, normal: ';qjkxbmwvz', shifted: ':QJKXBMWVZ' }
];

const NUMPAD_ROWS = [
  { y: 0, xOffset: 0, normal: '789/', shifted: '789/' },
  { y: 1, xOffset: 0, normal: '456*', shifted: '456*' },
  { y: 2, xOffset: 0, normal: '123-', shifted: '123-' },
  { y: 3, xOffset: 0, normal: '0.+', shifted: '0.+' }
];

/**
 * Builds a fast coordinate lookup map for a layout definition
 * @param {string} name
 * @param {Array} rows
 * @param {number} keyCount
 */
function buildLayout(name, rows, keyCount) {
  const charToCoord = new Map();

  for (const row of rows) {
    for (let i = 0; i < row.normal.length; i++) {
      const x = row.xOffset + i;
      const y = row.y;
      const normChar = row.normal[i];
      const shiftChar = row.shifted[i];

      charToCoord.set(normChar, { x, y, shifted: false, base: normChar });
      if (shiftChar && shiftChar !== normChar) {
        charToCoord.set(shiftChar, { x, y, shifted: true, base: normChar });
      }
    }
  }

  return { name, charToCoord, keyCount };
}

export const KEYBOARD_LAYOUTS = [
  buildLayout('QWERTY', QWERTY_ROWS, 47),
  buildLayout('Dvorak', DVORAK_ROWS, 47),
  buildLayout('Numpad', NUMPAD_ROWS, 15)
];

/**
 * Checks if two key coordinates are physically adjacent on the keyboard
 * and returns a discrete direction bucket (0..7) so straight vs turning paths are detected.
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {string|null} Direction identifier or null if not adjacent
 */
export function getStepDirection(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  // Same physical key repeated is handled by m_rep, not spatial walk
  if (dx === 0 && dy === 0) return null;

  // Horizontal step on same row (e.g., q -> w -> e)
  if (dy === 0 && Math.abs(dx) === 1) {
    return dx > 0 ? 'E' : 'W';
  }

  // Vertical / staggered column step between adjacent rows (e.g., 1 -> q -> a -> z)
  if (Math.abs(dy) === 1 && Math.abs(dx) <= 1.25) {
    const vDir = dy > 0 ? 'S' : 'N';
    if (dx >= -0.6 && dx <= 0.6) {
      // Standard staggered column alignment (e.g., 1->q is +0.5, q->a is +0.25, a->z is +0.5)
      return `${vDir}-col`;
    }
    return dx > 0 ? `${vDir}E` : `${vDir}W`;
  }

  return null;
}

/**
 * Evaluates whether a string span forms a contiguous spatial walk or multi-column sweep
 * on any known keyboard layout.
 * Also detects parallel shifted column walks like `1qaz2wsx3edc`!
 * @param {string} span
 * @returns {null | { layout: string, turns: number, shiftChanges: number, isColumnSweep: boolean, pathDesc: string, keyCount: number }}
 */
export function analyzeKeyboardWalk(span) {
  if (span.length < 3) return null;

  let bestWalk = null;

  for (const layout of KEYBOARD_LAYOUTS) {
    const coords = [];
    let allFound = true;
    for (let i = 0; i < span.length; i++) {
      const c = layout.charToCoord.get(span[i]);
      if (!c) {
        allFound = false;
        break;
      }
      coords.push(c);
    }
    if (!allFound) continue;

    let turns = 0;
    let shiftChanges = coords[0].shifted ? 1 : 0;
    let prevDir = null;
    let validContiguous = true;
    let columnJumps = 0;

    for (let i = 1; i < coords.length; i++) {
      if (coords[i].shifted !== coords[i - 1].shifted) {
        shiftChanges++;
      }

      const dir = getStepDirection(coords[i - 1], coords[i]);
      if (dir) {
        if (prevDir !== null && dir !== prevDir) {
          turns++;
        }
        prevDir = dir;
      } else {
        // Check if this is an adjacent-column wrap (like `1qaz2wsx` jumping from 'z' (row 3) back to '2' (row 0, +1 col))
        const dy = coords[i].y - coords[i - 1].y;
        const dx = coords[i].x - coords[i - 1].x;
        if (Math.abs(dy) >= 2 && Math.abs(dx) <= 1.5 && i >= 3) {
          columnJumps++;
          turns++;
          prevDir = null;
        } else {
          validContiguous = false;
          break;
        }
      }
    }

    if (!validContiguous) continue;

    // Filter out false positives where almost every step is a random turn in a short English word
    // Unless it's a very clean straight/column walk (turns <= floor((len - 2) / 2))
    if (turns > Math.floor((span.length - 1) / 2)) continue;

    const candidate = {
      layout: layout.name,
      turns,
      shiftChanges,
      isColumnSweep: columnJumps > 0,
      keyCount: layout.keyCount,
      pathDesc: columnJumps > 0
        ? `${layout.name} column sweep (${columnJumps + 1} cols)`
        : turns === 0
          ? `${layout.name} straight walk`
          : `${layout.name} walk (${turns} turn${turns > 1 ? 's' : ''})`
    };

    if (!bestWalk || (candidate.turns + candidate.shiftChanges) < (bestWalk.turns + bestWalk.shiftChanges)) {
      bestWalk = candidate;
    }
  }

  return bestWalk;
}