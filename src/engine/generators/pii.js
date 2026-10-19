/**
 * Contextual & User-Specific Priors (m_pii)
 * Models attacker knowledge of personal metadata:
 * Name, Username, Birthdate/Year, Pet/Partner Name, and Previous Password.
 * Supports Case, L33t, and Edit Distance (T_edit) transducers!
 */

import { generateNormalizedForms, evaluateEditDistanceTransducer, computeCaseModifier } from './transducers.js';

/**
 * Extracts structured PII tokens and priors from user context object
 * @param {object} context
 * @returns {Array<{ value: string, raw: string, label: string, priorBits: number, allowFuzzy: boolean }>}
 */
export function buildPiiDictionary(context = {}) {
  const tokens = [];
  const seen = new Set();

  function addToken(raw, label, priorBits, allowFuzzy = false) {
    if (!raw || typeof raw !== 'string') return;
    const trimmed = raw.trim();
    if (trimmed.length < 2) return;
    const key = `${label}:${trimmed.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);

    tokens.push({
      value: trimmed.toLowerCase(),
      raw: trimmed,
      label,
      priorBits,
      allowFuzzy
    });
  }

  // 1. Previous Password (highest priority for both exact substring and fuzzy edit-distance!)
  if (context.previousPassword) {
    addToken(context.previousPassword, 'Previous Password', 2.0, true);
  }

  // 2. Username / Email prefix
  if (context.username) {
    const cleanUser = context.username.split('@')[0];
    addToken(cleanUser, 'Username', 2.8, true);
    // Also split username on dots/underscores/numbers
    const parts = cleanUser.split(/[._\-0-9]+/).filter(p => p.length >= 3);
    for (const p of parts) {
      addToken(p, 'Username Part', 3.4, false);
    }
  }

  // 3. Full Name & First/Last parts
  if (context.name) {
    const parts = context.name.trim().split(/\s+/);
    for (const p of parts) {
      if (p.length >= 2) addToken(p, 'Personal Name', 2.9, true);
    }
    const joined = parts.join('');
    if (parts.length > 1 && joined.length >= 4) {
      addToken(joined, 'Full Name', 3.1, true);
    }
  }

  // 4. Pet / Partner / Custom keyword
  if (context.pet) {
    const parts = context.pet.trim().split(/[\s,]+/);
    for (const p of parts) {
      if (p.length >= 2) addToken(p, 'Personal Keyword', 3.2, true);
    }
  }

  // 5. Birthdate / Year parts (e.g. "1994-07-15" -> "1994", "94", "0715", "1507")
  if (context.birthdate) {
    const digits = context.birthdate.replace(/\D/g, '');
    addToken(digits, 'Birthdate', 2.8, false);

    const yearMatch = context.birthdate.match(/(19\d{2}|20\d{2})/);
    if (yearMatch) {
      const yr = yearMatch[1];
      addToken(yr, 'Birth Year', 2.5, false);
      addToken(yr.slice(2), 'Birth Year (YY)', 3.2, false);
    }

    const parts = context.birthdate.split(/[-/.]/).filter(Boolean);
    if (parts.length === 3) {
      const [p0, p1, p2] = parts;
      if (p0.length === 4) {
        // YYYY-MM-DD
        addToken(`${p1}${p2}`, 'Birth Month/Day', 3.0, false);
        addToken(`${p2}${p1}`, 'Birth Day/Month', 3.2, false);
      } else if (p2.length === 4) {
        // MM/DD/YYYY
        addToken(`${p0}${p1}`, 'Birth Month/Day', 3.0, false);
      }
    }
  }

  return tokens;
}

/**
 * Evaluates PII matches and Edit-Distance mutations against PII for span S[start..end]
 * @param {string} password
 * @param {number} start
 * @param {number} end
 * @param {object} config
 * @param {Array} piiTokens
 * @returns {Array}
 */
export function evaluatePiiGenerator(password, start, end, config, piiTokens) {
  if (config.usePii === false || !piiTokens || piiTokens.length === 0) return [];

  const span = password.slice(start, end);
  if (span.length < 2) return [];

  const candidates = [];
  const allowL33t = config.useL33t !== false;
  const lowerSpan = span.toLowerCase();

  for (const pii of piiTokens) {
    // 1. Exact Raw Match (e.g., identical to Previous Password or exact case)
    if (span === pii.raw) {
      candidates.push({
        start,
        end,
        token: span,
        category: 'pii',
        moduleId: 'm_pii',
        moduleName: `PII (${pii.label})`,
        baseBits: pii.priorBits,
        totalDataBits: pii.priorBits,
        summary: `PII: ${pii.label} ("${span}")`,
        layers: [
          {
            type: 'base',
            module: 'm_pii',
            title: `Personal Info: ${pii.label}`,
            detail: `Matches known "${pii.raw}"`,
            formula: `-log₂ P_pii("${pii.raw}")`,
            bits: pii.priorBits
          }
        ]
      });
      continue;
    }

    // 2. Case-Insensitive or L33t Match against PII token
    if (span.length === pii.value.length) {
      const forms = generateNormalizedForms(span, allowL33t);
      for (const form of forms) {
        if (form.plainWord === pii.value) {
          const totalDataBits = pii.priorBits + form.transducerBits;
          const layers = [
            {
              type: 'base',
              module: 'm_pii',
              title: `Personal Info: ${pii.label}`,
              detail: `Base token "${pii.value}"`,
              formula: `-log₂ P_pii`,
              bits: pii.priorBits
            }
          ];
          if (form.caseLayer) layers.push(form.caseLayer);
          if (form.l33tLayer) layers.push(form.l33tLayer);

          candidates.push({
            start,
            end,
            token: span,
            category: 'pii',
            moduleId: 'm_pii+T',
            moduleName: `PII (${pii.label})`,
            baseBits: pii.priorBits,
            totalDataBits,
            summary: `PII: ${pii.label} ("${pii.value}")`,
            layers
          });
        }
      }
    }

    // 3. Fuzzy Edit Distance Match (T_edit) against Previous Password or Name (d <= 2)
    if (pii.allowFuzzy) {
      // Compare against raw first (preserves case/symbols in Previous Password like "Summer2024!" -> "Summer2025!")
      const rawEdit = evaluateEditDistanceTransducer(pii.raw, span, 2);
      if (rawEdit) {
        const totalDataBits = pii.priorBits + rawEdit.bitCost;
        candidates.push({
          start,
          end,
          token: span,
          category: 'pii',
          moduleId: 'm_pii+edit',
          moduleName: `${pii.label} + Edit`,
          baseBits: pii.priorBits,
          totalDataBits,
          summary: `${pii.label} + Edit(d=${rawEdit.distance})`,
          layers: [
            {
              type: 'base',
              module: 'm_pii',
              title: `Personal Info: ${pii.label}`,
              detail: `Reference "${pii.raw}"`,
              formula: `-log₂ P_pii`,
              bits: pii.priorBits
            },
            {
              type: 'edit',
              module: 'T_edit',
              title: `Edit Distance (d=${rawEdit.distance})`,
              detail: rawEdit.editDesc,
              formula: `L_γ(${rawEdit.distance}) + ${rawEdit.distance}·(pos + char)`,
              bits: rawEdit.bitCost
            }
          ]
        });
      } else if (lowerSpan !== pii.value) {
        // Compare lowercase normalized
        const lowerEdit = evaluateEditDistanceTransducer(pii.value, lowerSpan, 2);
        if (lowerEdit) {
          const caseMod = computeCaseModifier(span);
          const totalDataBits = pii.priorBits + lowerEdit.bitCost + caseMod.bits;
          const layers = [
            {
              type: 'base',
              module: 'm_pii',
              title: `Personal Info: ${pii.label}`,
              detail: `Reference "${pii.value}"`,
              formula: `-log₂ P_pii`,
              bits: pii.priorBits
            },
            {
              type: 'edit',
              module: 'T_edit',
              title: `Edit Distance (d=${lowerEdit.distance})`,
              detail: lowerEdit.editDesc,
              formula: `L_γ(${lowerEdit.distance}) + pos + char`,
              bits: lowerEdit.bitCost
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
            category: 'pii',
            moduleId: 'm_pii+edit',
            moduleName: `${pii.label} + Edit`,
            baseBits: pii.priorBits,
            totalDataBits,
            summary: `${pii.label} + Edit(d=${lowerEdit.distance})`,
            layers
          });
        }
      }
    }
  }

  return candidates;
}