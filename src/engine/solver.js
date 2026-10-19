/**
 * K-Best Lattice Solver (Viterbi / DAG Shortest-Path Dynamic Programming)
 * Finds the Minimum Description Length (MDL) derivation:
 *   H*(S) = min_pi ( L(pi) + L(S | pi) )
 * Plus runner-up competing hypotheses for the Competing Hypotheses Explorer.
 */

import { buildSpanLattice, DEFAULT_ATTACKER_CONFIG } from './generators/index.js';
import { getTransitionCost } from './transitions.js';
import { computeNaiveEntropy } from './naive.js';

/**
 * Solves the DAG lattice for the optimal MDL derivation and runner-up hypotheses
 * @param {string} password
 * @param {object} [attackerConfig]
 * @param {object} [piiContext]
 * @param {number} [kBest=6]
 * @returns {{
 *   password: string,
 *   honestBits: number,
 *   modelBits: number,
 *   dataBits: number,
 *   naiveBits: number,
 *   taxBits: number,
 *   taxPercent: number,
 *   optimal: object,
 *   hypotheses: Array<object>,
 *   naive: object
 * }}
 */
export function solvePasswordMDL(password, attackerConfig = {}, piiContext = {}, kBest = 6) {
  const naive = computeNaiveEntropy(password);

  if (!password || password.length === 0) {
    const emptyOpt = {
      id: 'empty',
      label: 'Empty Password',
      totalBits: 0,
      modelBits: 0,
      dataBits: 0,
      segments: []
    };
    return {
      password: '',
      honestBits: 0,
      modelBits: 0,
      dataBits: 0,
      naiveBits: 0,
      taxBits: 0,
      taxPercent: 0,
      optimal: emptyOpt,
      hypotheses: [],
      naive
    };
  }

  const config = { ...DEFAULT_ATTACKER_CONFIG, ...attackerConfig };
  const n = password.length;
  const edgesByStart = buildSpanLattice(password, config, piiContext);

  // dp[pos] stores an array of top partial paths reaching index `pos`
  // Each state: { pos, lastCategory, totalBits, modelBits, dataBits, segments, signature }
  const BEAM_WIDTH = 14;
  const dp = Array.from({ length: n + 1 }, () => []);

  dp[0].push({
    pos: 0,
    lastCategory: 'START',
    totalBits: 0,
    modelBits: 0,
    dataBits: 0,
    segments: [],
    signature: ''
  });

  for (let i = 0; i < n; i++) {
    const incomingStates = dp[i];
    if (incomingStates.length === 0) continue;

    const outgoingEdges = edgesByStart[i];

    for (const state of incomingStates) {
      for (const edge of outgoingEdges) {
        // Merge consecutive raw charset segments only if we don't already have a direct edge covering both
        // (Avoids artificially fracturing a random string into 1-char segments with repeated transition costs)
        if (state.lastCategory === 'charset' && edge.category === 'charset' && state.segments.length > 0) {
          const prevSeg = state.segments[state.segments.length - 1];
          if (prevSeg.moduleId === edge.moduleId && (edge.end - prevSeg.start) <= 8) {
            continue;
          }
        }

        const trans = getTransitionCost(state.lastCategory, edge.category);
        const segBits = trans.bits + edge.totalDataBits;
        const nextTotal = state.totalBits + segBits;
        const nextModel = state.modelBits + trans.bits;
        const nextData = state.dataBits + edge.totalDataBits;

        const segmentRecord = {
          ...edge,
          transitionBits: trans.bits,
          transitionProb: trans.prob,
          transitionLabel: trans.label,
          totalSegmentBits: segBits
        };

        const nextSig = state.signature
          ? `${state.signature}|${edge.start}-${edge.end}:${edge.moduleId}`
          : `${edge.start}-${edge.end}:${edge.moduleId}`;

        dp[edge.end].push({
          pos: edge.end,
          lastCategory: edge.category,
          totalBits: nextTotal,
          modelBits: nextModel,
          dataBits: nextData,
          segments: [...state.segments, segmentRecord],
          signature: nextSig
        });
      }
    }

    // Prune beam at each subsequent position
    for (let pos = i + 1; pos <= n; pos++) {
      if (dp[pos].length > BEAM_WIDTH) {
        dp[pos].sort((a, b) => a.totalBits - b.totalBits);
        const kept = [];
        const seenSigs = new Set();
        for (const item of dp[pos]) {
          if (!seenSigs.has(item.signature)) {
            seenSigs.add(item.signature);
            kept.push(item);
            if (kept.length >= BEAM_WIDTH) break;
          }
        }
        dp[pos] = kept;
      }
    }
  }

  // Sort complete derivations at dp[n]
  const finalPaths = dp[n].sort((a, b) => a.totalBits - b.totalBits);

  // Select distinct structural hypotheses for the Competing Hypotheses Explorer
  const distinctHypotheses = [];
  const seenStructures = new Set();

  for (const path of finalPaths) {
    // Structural key based on segment boundaries & module types
    const structKey = path.segments.map(s => `${s.start}-${s.end}:${s.category}`).join('|');
    if (!seenStructures.has(structKey)) {
      seenStructures.add(structKey);
      distinctHypotheses.push({
        id: `hyp-${distinctHypotheses.length + 1}`,
        rank: distinctHypotheses.length + 1,
        label: distinctHypotheses.length === 0 ? 'Optimal MDL Model' : `Runner-Up Model #${distinctHypotheses.length + 1}`,
        totalBits: path.totalBits,
        modelBits: path.modelBits,
        dataBits: path.dataBits,
        segments: path.segments
      });
      if (distinctHypotheses.length >= kBest - 1) break;
    }
  }

  // Always append the Naive Model as a reference hypothesis if not identical
  distinctHypotheses.push({
    ...naive.derivation,
    rank: distinctHypotheses.length + 1
  });

  const optimal = distinctHypotheses[0];
  // Cap honest entropy at naive entropy if a tiny 1-char password has transition overhead > naive pool
  const honestBits = Math.min(optimal.totalBits, naive.bits);
  const taxBits = Math.max(0, naive.bits - honestBits);
  const taxPercent = naive.bits > 0 ? Math.round((taxBits / naive.bits) * 100) : 0;

  return {
    password,
    honestBits,
    modelBits: optimal.modelBits,
    dataBits: optimal.dataBits,
    naiveBits: naive.bits,
    taxBits,
    taxPercent,
    optimal,
    hypotheses: distinctHypotheses,
    naive
  };
}