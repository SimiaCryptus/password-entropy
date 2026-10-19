/**
 * Competing Hypotheses Explorer
 * Displays the top K distinct structural derivations evaluated by the lattice solver
 * (Optimal MDL Model, Runner-up interpretations, and the Naive Random Model).
 * Supports hover and click-to-pin previewing directly on the main Segmentation Ribbon.
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders the Competing Hypotheses Explorer list
 * @param {HTMLElement} container
 * @param {object} snapshot
 * @param {object} actions
 */
export function renderHypothesesView(container, snapshot, actions) {
  const { solution, displayedDerivation, pinnedHypothesisId } = snapshot;
  const hypotheses = solution.hypotheses;

  if (!hypotheses || hypotheses.length === 0) {
    container.innerHTML = '';
    return;
  }

  const maxBits = Math.max(...hypotheses.map(h => h.totalBits), 1);

  const rowsHtml = hypotheses.map((hyp, index) => {
    const isOptimal = index === 0;
    const isSelected = displayedDerivation.id === hyp.id;
    const isPinned = pinnedHypothesisId === hyp.id;
    const widthPct = Math.min(100, Math.max(6, (hyp.totalBits / maxBits) * 100));

    const segSummaryPills = hyp.segments.map(s => `
      <span class="hyp-seg-chip cat-${s.category}">
        <span class="chip-mod">${escapeHtml(s.summary)}</span>
        <span class="chip-bits">${s.totalSegmentBits.toFixed(1)}b</span>
      </span>
    `).join('<span class="hyp-plus">+</span>');

    return `
      <div
        class="hypothesis-row ${isSelected ? 'is-selected' : ''} ${isPinned ? 'is-pinned' : ''}"
        data-hyp-id="${hyp.id}"
      >
        <div class="hyp-left-col">
          <div class="hyp-title-line">
            <span class="hyp-rank-badge ${isOptimal ? 'optimal-rank' : hyp.isNaiveReference ? 'naive-rank' : ''}">
              #${index + 1}
            </span>
            <span class="hyp-name">${escapeHtml(hyp.label)}</span>
            ${isOptimal ? '<span class="hyp-status-tag optimal-tag">Optimal MDL (Selected)</span>' : ''}
            ${isPinned ? '<span class="hyp-status-tag pinned-tag">Pinned Preview</span>' : ''}
          </div>
          <div class="hyp-segments-chain">
            ${segSummaryPills}
          </div>
        </div>

        <div class="hyp-right-col">
          <div class="hyp-bits-readout">
            <span class="hyp-total-bits">${hyp.totalBits.toFixed(1)} bits</span>
            <span class="hyp-sub-bits">
              L(π)=${hyp.modelBits.toFixed(1)}b · L(S|π)=${hyp.dataBits.toFixed(1)}b
            </span>
          </div>
          <div class="hyp-mini-bar-track">
            <div class="hyp-mini-bar-fill ${isOptimal ? 'fill-optimal' : ''}" style="width: ${widthPct}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="attacker-card hypotheses-card">
      <div class="card-header">
        <div>
          <h3 class="section-title">Competing Hypotheses Explorer (Π(S))</h3>
          <p class="section-subtitle">
            Hover or click any runner-up derivation below to preview how that model segments the password on the Parse Ribbon above
          </p>
        </div>
      </div>
      <div class="hypotheses-list">
        ${rowsHtml}
      </div>
    </div>
  `;

  container.querySelectorAll('.hypothesis-row').forEach(row => {
    const hypId = row.dataset.hypId;
    row.addEventListener('mouseenter', () => actions.onHoverHypothesis(hypId));
    row.addEventListener('mouseleave', () => actions.onHoverHypothesis(null));
    row.addEventListener('click', () => actions.onPinHypothesis(hypId));
  });
}