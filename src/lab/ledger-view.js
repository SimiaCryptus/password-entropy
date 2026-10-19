/**
 * The "Entropy Ledger" View
 * Renders the dual-layered comparison bar (Naive vs. Honest MDL Entropy),
 * Model Cost L(pi) vs. Data Cost L(S | pi) breakdown, crack-time estimates,
 * and "The Human Predictability Tax" callout.
 */

import { formatCrackTime } from '../engine/coding.js';

/**
 * Renders the Entropy Ledger metrics and dual comparison meter
 * @param {HTMLElement} container
 * @param {object} snapshot
 */
export function renderLedgerView(container, snapshot) {
  const { solution, displayedDerivation, isPreviewingAlternative } = snapshot;

  const activeBits = isPreviewingAlternative
    ? displayedDerivation.totalBits
    : solution.honestBits;

  const modelBits = displayedDerivation.modelBits;
  const dataBits = displayedDerivation.dataBits;
  const naiveBits = solution.naiveBits;
  const taxBits = Math.max(0, naiveBits - activeBits);
  const taxPercent = naiveBits > 0 ? Math.round((taxBits / naiveBits) * 100) : 0;

  const honestCrack = formatCrackTime(activeBits);
  const naiveCrack = formatCrackTime(naiveBits);

  // Scale horizontal meter cleanly (up to max of 100 bits or naiveBits)
  const scaleMax = Math.max(90, naiveBits * 1.06, activeBits * 1.06);
  const naiveWidthPct = Math.min(100, (naiveBits / scaleMax) * 100);
  const honestWidthPct = Math.min(100, (activeBits / scaleMax) * 100);
  const modelWidthPct = activeBits > 0 ? (modelBits / activeBits) * 100 : 0;

  container.innerHTML = `
    <div class="ledger-grid">
      <!-- Honest MDL Score Card -->
      <div class="ledger-stat-card honest-card" data-tier="${honestCrack.tier}">
        <div class="stat-header">
          <span class="stat-title">
            ${isPreviewingAlternative ? `Previewing: ${displayedDerivation.label}` : 'Honest MDL Entropy H*(S)'}
          </span>
          <span class="stat-pill" data-tier="${honestCrack.tier}">${honestCrack.label}</span>
        </div>
        <div class="stat-value-row">
          <span class="stat-big-number">${activeBits.toFixed(1)}</span>
          <span class="stat-unit">bits</span>
        </div>
        <div class="stat-sub-breakdown">
          <span class="sub-item model-cost" title="Bits required to specify the sequence of generator transitions">
            <i class="dot model-dot"></i>Model L(π): <strong>${modelBits.toFixed(1)}b</strong>
          </span>
          <span class="sub-plus">+</span>
          <span class="sub-item data-cost" title="Bits required to parameterize generators & transducers to emit S">
            <i class="dot data-dot"></i>Data L(S|π): <strong>${dataBits.toFixed(1)}b</strong>
          </span>
        </div>
      </div>

      <!-- Naive Entropy Score Card -->
      <div class="ledger-stat-card naive-card">
        <div class="stat-header">
          <span class="stat-title">Naive Pool Entropy H_naive</span>
          <span class="stat-pill naive-pill">${naiveCrack.label}</span>
        </div>
        <div class="stat-value-row">
          <span class="stat-big-number muted-num">${naiveBits.toFixed(1)}</span>
          <span class="stat-unit">bits</span>
        </div>
        <div class="stat-sub-breakdown">
          <span>Pool size: <strong>${solution.naive.poolSize} chars</strong> (${solution.naive.bitsPerChar.toFixed(2)} b/char × ${solution.password.length})</span>
        </div>
      </div>

      <!-- Human Predictability Tax Callout -->
      <div class="ledger-stat-card tax-card">
        <div class="stat-header">
          <span class="stat-title">The Human Predictability Tax</span>
          <span class="stat-pill tax-pill">-${taxPercent}% compressed</span>
        </div>
        <div class="stat-value-row">
          <span class="stat-big-number tax-num">-${taxBits.toFixed(1)}</span>
          <span class="stat-unit">bits lost</span>
        </div>
        <div class="stat-sub-breakdown">
          <span>Attacker saves <strong>2<sup>${Math.round(taxBits)}</sup>×</strong> work via MDL compression</span>
        </div>
      </div>
    </div>

    <!-- Dual-Layered Horizontal Comparison Meter -->
    <div class="dual-meter-container">
      <div class="dual-meter-header">
        <div class="meter-legend">
          <span class="legend-item"><i class="swatch honest-model-swatch"></i>Model Cost L(π)</span>
          <span class="legend-item"><i class="swatch honest-data-swatch"></i>Data Cost L(S|π)</span>
          <span class="legend-item"><i class="swatch tax-swatch"></i>Human Predictability Tax (${taxBits.toFixed(1)} bits)</span>
        </div>
        <span class="meter-scale-note">Scale: 0 — ${Math.round(scaleMax)} bits (NIST/ High-Security threshold: 64b)</span>
      </div>

      <div class="dual-meter-track">
        <!-- Background Ghost Bar: Naive Entropy -->
        <div class="meter-ghost-naive" style="width: ${naiveWidthPct}%" title="Naive Entropy: ${naiveBits.toFixed(1)} bits">
          ${taxBits >= 8 ? `<span class="tax-gap-label">Predictability Tax: -${taxBits.toFixed(1)} bits</span>` : ''}
        </div>

        <!-- Foreground Solid Bar: Honest MDL Entropy (split into Model + Data cost) -->
        <div class="meter-solid-honest" data-tier="${honestCrack.tier}" style="width: ${honestWidthPct}%">
          <div class="meter-segment-model" style="width: ${modelWidthPct}%" title="Model Transition Cost L(π): ${modelBits.toFixed(1)} bits"></div>
          <div class="meter-segment-data" style="width: ${100 - modelWidthPct}%" title="Emission Data Cost L(S|π): ${dataBits.toFixed(1)} bits"></div>
        </div>

        <!-- 64-bit Reference Marker -->
        <div class="meter-threshold-marker" style="left: ${Math.min(98, (64 / scaleMax) * 100)}%" title="64-bit Recommended Security Target">
          <span>64b target</span>
        </div>
      </div>
    </div>
  `;
}