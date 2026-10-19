/**
 * Interactive Parse Tree & Multi-Layer Stacked Segmentation Ribbon
 * Visually decomposes the password into color-coded generator blocks,
 * vertical transducer stacks (Base -> Case -> L33t -> Edit),
 * and Markov state-transition bit-cost connectors.
 */

const CATEGORY_META = {
  dict:    { label: 'Lexical / Dict', badge: 'm_dict', colorClass: 'cat-dict' },
  walk:    { label: 'Keyboard Walk',  badge: 'm_walk', colorClass: 'cat-walk' },
  seq:     { label: 'Sequence',       badge: 'm_seq',  colorClass: 'cat-seq' },
  rep:     { label: 'Repetition',     badge: 'm_rep',  colorClass: 'cat-rep' },
  pii:     { label: 'Personal Info',  badge: 'm_pii',  colorClass: 'cat-pii' },
  charset: { label: 'Raw Charset',    badge: 'm_char', colorClass: 'cat-charset' }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders the Parse Tree & Multi-Layer Segmentation Ribbon
 * @param {HTMLElement} container
 * @param {object} snapshot
 * @param {function} onResetPreview
 */
export function renderRibbonView(container, snapshot, onResetPreview) {
  const { password, displayedDerivation, isPreviewingAlternative } = snapshot;

  if (!password || password.length === 0) {
    container.innerHTML = `
      <div class="empty-ribbon-state">
        Type a password above or choose a preset scenario to inspect its Minimum Description Length parse tree.
      </div>
    `;
    return;
  }

  const segments = displayedDerivation.segments;

  const blocksHtml = segments.map((seg, idx) => {
    const meta = CATEGORY_META[seg.category] || CATEGORY_META.charset;
    const charIndices = seg.end - seg.start === 1
      ? `idx ${seg.start}`
      : `idx ${seg.start}..${seg.end - 1}`;

    // Render vertical stack of layers (Base generator + any Case / L33t / Edit transducers)
    const layersHtml = seg.layers.map((layer, lIdx) => {
      const isBase = layer.type === 'base';
      const layerBadge = isBase ? 'Layer 1 · Base' : `Layer ${lIdx + 1} · Transducer`;
      return `
        <div class="stack-layer-card layer-type-${layer.type}">
          <div class="layer-top-row">
            <span class="layer-kind-badge">${layerBadge}</span>
            <span class="layer-module-code">${escapeHtml(layer.module)}</span>
            <span class="layer-bit-badge">+${layer.bits.toFixed(1)}b</span>
          </div>
          <div class="layer-title">${escapeHtml(layer.title)}</div>
          <div class="layer-detail">${escapeHtml(layer.detail)}</div>
          <div class="layer-formula">${escapeHtml(layer.formula)}</div>
        </div>
      `;
    }).join('<div class="stack-connector-line">↓</div>');

    return `
      <!-- Markov Transition Arrow -->
      <div class="transition-node" title="Markov State Transition Cost: -log₂ P(${escapeHtml(seg.transitionLabel)})">
        <div class="trans-arrow-line"></div>
        <div class="trans-pill">
          <span class="trans-label">${idx === 0 ? 'START →' : '→'}</span>
          <span class="trans-bits">+${seg.transitionBits.toFixed(1)}b</span>
        </div>
        <div class="trans-prob">P=${(seg.transitionProb ? (seg.transitionProb * 100).toFixed(0) : '100')}%</div>
      </div>

      <!-- Segment Column with Vertical Transducer Stack -->
      <div class="segment-column ${meta.colorClass}">
        <!-- Observed Token Header Pill -->
        <div class="segment-token-pill">
          <div class="token-meta-row">
            <span class="token-cat-tag">${meta.label}</span>
            <span class="token-pos-tag">${charIndices}</span>
          </div>
          <div class="token-chars">${escapeHtml(seg.token)}</div>
        </div>

        <!-- Vertical Stack of Generator & Transducer Layers -->
        <div class="segment-layers-stack">
          ${layersHtml}
        </div>

        <!-- Segment Bit-Cost Subtotal Footer -->
        <div class="segment-footer-total">
          <span class="seg-subtotal-label">Segment Total</span>
          <span class="seg-subtotal-value">
            ${seg.transitionBits.toFixed(1)}b + ${seg.totalDataBits.toFixed(1)}b = <strong>${seg.totalSegmentBits.toFixed(1)} bits</strong>
          </span>
        </div>
      </div>
    `;
  }).join('');

  // Build the exact MDL summation ledger equation string
  const equationParts = segments.map(seg =>
    `[${seg.transitionBits.toFixed(1)}b + ${seg.totalDataBits.toFixed(1)}b]`
  ).join(' + ');

  container.innerHTML = `
    <div class="ribbon-header-bar">
      <div class="ribbon-title-group">
        <h3 class="section-title">Parse Tree &amp; Multi-Layer Segmentation Ribbon</h3>
        <span class="section-subtitle">
          Optimal MDL derivation path π* showing base generators, stacked mutation transducers, and Markov transition costs
        </span>
      </div>
      ${isPreviewingAlternative ? `
        <div class="preview-banner">
          <span>Viewing Alternative Hypothesis: <strong>${escapeHtml(displayedDerivation.label)} (${displayedDerivation.totalBits.toFixed(1)} bits)</strong></span>
          <button type="button" class="reset-preview-btn" id="resetPreviewBtn">Return to Optimal Model</button>
        </div>
      ` : `
        <div class="color-legend-pills">
          <span class="legend-chip cat-dict">Dictionary</span>
          <span class="legend-chip cat-walk">Keyboard Walk</span>
          <span class="legend-chip cat-seq">Sequence / Repeat</span>
          <span class="legend-chip cat-pii">Personal Info (PII)</span>
          <span class="legend-chip cat-trans">Transducer Layer</span>
          <span class="legend-chip cat-charset">Raw Charset</span>
        </div>
      `}
    </div>

    <div class="ribbon-scroll-viewport">
      <div class="ribbon-flow-track">
        ${blocksHtml}
      </div>
    </div>

    <div class="mdl-equation-bar">
      <span class="eq-lhs">L(S, π) = ∑ (L(mᵢ | mᵢ₋₁) + L(sᵢ | mᵢ)) =</span>
      <span class="eq-terms">${equationParts}</span>
      <span class="eq-rhs">= <strong>${displayedDerivation.totalBits.toFixed(1)} bits</strong></span>
    </div>
  `;

  const resetBtn = container.querySelector('#resetPreviewBtn');
  if (resetBtn && onResetPreview) {
    resetBtn.addEventListener('click', onResetPreview);
  }
}