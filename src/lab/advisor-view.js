/**
 * Actionable Counterfactual Feedback View
 * Displays causal, gradient-based password improvements computed by perturbing
 * the weakest segments in the optimal parse tree, with one-click "Apply Edit" buttons.
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders the Counterfactual Advisor cards
 * @param {HTMLElement} container
 * @param {object} snapshot
 * @param {function} onApplyPassword
 */
export function renderAdvisorView(container, snapshot, onApplyPassword) {
  const { counterfactuals, solution } = snapshot;

  if (!solution.password) {
    container.innerHTML = '';
    return;
  }

  if (counterfactuals.length === 0) {
    container.innerHTML = `
      <div class="attacker-card advisor-card">
        <div class="card-header">
          <div>
            <h3 class="section-title">Counterfactual Parse-Tree Advisor</h3>
            <p class="section-subtitle">No low-cost pattern bottlenecks detected — this password resists compression across all active generator modules.</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const cardsHtml = counterfactuals.map((item, idx) => `
    <div class="advisor-suggestion-card">
      <div class="suggestion-top">
        <span class="suggestion-title">${escapeHtml(item.title)}</span>
        <span class="suggestion-delta-badge">+${item.deltaBits.toFixed(1)} bits</span>
      </div>
      <p class="suggestion-explanation">${escapeHtml(item.explanation)}</p>
      <div class="suggestion-Bottom">
        <div class="suggestion-preview-code">
          <span class="preview-label">Result:</span>
          <code>${escapeHtml(item.newPassword)}</code>
          <span class="preview-new-bits">(${item.newBits.toFixed(1)}b)</span>
        </div>
        <button
          type="button"
          class="apply-edit-btn"
          data-new-pwd-idx="${idx}"
        >
          Apply Edit →
        </button>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="attacker-card advisor-card">
      <div class="card-header">
        <div>
          <h3 class="section-title">Actionable Counterfactual Feedback (Parse-Tree Gradients)</h3>
          <p class="section-subtitle">
            Targeted edits that fracture the cheapest segments in your password's MDL parse tree
          </p>
        </div>
      </div>
      <div class="advisor-cards-grid">
        ${cardsHtml}
      </div>
    </div>
  `;

  container.querySelectorAll('.apply-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.newPwdIdx, 10);
      const target = counterfactuals[idx];
      if (target && onApplyPassword) {
        onApplyPassword(target.newPassword, `Applied counterfactual edit: ${target.title}`);
      }
    });
  });
}