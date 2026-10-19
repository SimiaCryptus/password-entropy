/**
 * Reusable Web Component: <honest-password-input>
 * A self-contained, drop-in Custom Element for any HTML form that provides:
 * - Real-time Honest MDL vs. Naive entropy metering
 * - Inline color-coded token segmentation pills
 * - Counterfactual recommendation with 1-click apply
 * - High-MDL Passphrase / Password generator button
 */

import { solvePasswordMDL } from '../engine/solver.js';
import { computeCounterfactuals } from '../engine/counterfactuals.js';
import { formatCrackTime } from '../engine/coding.js';
import { samplePassphraseWords } from '../data/dictionary.js';

const COMPONENT_STYLES = `
  :host {
    display: block;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e2e8f0;
    --bg-surface: #0f172a;
    --bg-input: #090d16;
    --border-color: #1e293b;
    --text-primary: #f8fafc;
    --text-muted: #94a3b8;
    --accent-blue: #38bdf8;
    --accent-emerald: #10b981;
    --accent-amber: #f59e0b;
    --accent-rose: #f43f5e;
    --accent-purple: #a855f7;
  }

  .hpi-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px;
    box-sizing: border-box;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35);
  }

  .hpi-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 0.82rem;
  }

  .hpi-label {
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: 0.01em;
  }

  .hpi-crack-badge {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-muted);
  }

  .hpi-crack-badge[data-tier="critical"] { color: #fda4af; background: rgba(244, 63, 94, 0.15); }
  .hpi-crack-badge[data-tier="weak"]     { color: #fcd34d; background: rgba(245, 158, 11, 0.15); }
  .hpi-crack-badge[data-tier="moderate"] { color: #7dd3fc; background: rgba(56, 189, 248, 0.15); }
  .hpi-crack-badge[data-tier="strong"],
  .hpi-crack-badge[data-tier="fortress"] { color: #6ee7b7; background: rgba(16, 185, 129, 0.15); }

  .hpi-input-row {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--bg-input);
    border: 1px solid #334155;
    border-radius: 8px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .hpi-input-row:focus-within {
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
  }

  .hpi-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.98rem;
    padding: 10px 12px;
    outline: none;
    width: 100%;
  }

  .hpi-actions {
    display: flex;
    gap: 4px;
    padding-right: 8px;
  }

  .hpi-icon-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--text-muted);
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .hpi-icon-btn:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.12);
  }

  .hpi-meter-wrap {
    margin-top: 12px;
  }

  .hpi-meter-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    margin-bottom: 5px;
    color: var(--text-muted);
  }

  .hpi-meter-honest {
    color: var(--text-primary);
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
  }

  .hpi-meter-track {
    position: relative;
    height: 10px;
    background: #1e293b;
    border-radius: 999px;
    overflow: hidden;
  }

  .hpi-bar-naive {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      -45deg,
      rgba(148, 163, 184, 0.25),
      rgba(148, 163, 184, 0.25) 5px,
      rgba(148, 163, 184, 0.12) 5px,
      rgba(148, 163, 184, 0.12) 10px
    );
    border-right: 2px dashed rgba(203, 213, 225, 0.55);
    transition: width 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .hpi-bar-honest {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    border-radius: 999px;
    background: var(--accent-blue);
    transition: width 0.25s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.2s ease;
  }

  .hpi-bar-honest[data-tier="critical"] { background: #f43f5e; }
  .hpi-bar-honest[data-tier="weak"]     { background: #f59e0b; }
  .hpi-bar-honest[data-tier="moderate"] { background: #38bdf8; }
  .hpi-bar-honest[data-tier="strong"],
  .hpi-bar-honest[data-tier="fortress"] { background: #10b981; }

  .hpi-ribbon {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }

  .hpi-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.74rem;
    font-family: 'JetBrains Mono', monospace;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
  }

  .hpi-pill[data-cat="dict"]    { border-color: rgba(56, 189, 248, 0.45); background: rgba(56, 189, 248, 0.12); color: #bae6fd; }
  .hpi-pill[data-cat="walk"]    { border-color: rgba(245, 158, 11, 0.45); background: rgba(245, 158, 11, 0.12); color: #fde68a; }
  .hpi-pill[data-cat="seq"],
  .hpi-pill[data-cat="rep"]     { border-color: rgba(45, 212, 191, 0.45); background: rgba(45, 212, 191, 0.12); color: #99f6e4; }
  .hpi-pill[data-cat="pii"]     { border-color: rgba(244, 63, 94, 0.55); background: rgba(244, 63, 94, 0.16); color: #fecdd3; }
  .hpi-pill[data-cat="charset"] { border-color: rgba(16, 185, 129, 0.45); background: rgba(16, 185, 129, 0.12); color: #a7f3d0; }

  .hpi-pill-bits {
    opacity: 0.78;
    font-size: 0.68rem;
  }

  .hpi-tip {
    margin-top: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.2);
    font-size: 0.76rem;
    color: #cbd5e1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .hpi-tip-btn {
    background: rgba(56, 189, 248, 0.18);
    border: 1px solid rgba(56, 189, 248, 0.4);
    color: #e0f2fe;
    border-radius: 5px;
    padding: 3px 8px;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .hpi-tip-btn:hover {
    background: rgba(56, 189, 248, 0.3);
  }
`;

export class HonestPasswordInput extends HTMLElement {
  static get observedAttributes() {
    return ['value', 'placeholder', 'label', 'min-bits', 'show-ribbon', 'context'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._value = this.getAttribute('value') || '';
    this._context = {};
    this._visible = true;
    this._lastSuggestion = null;
  }

  connectedCallback() {
    this._parseContextAttr();
    this._render();
    this._evaluate();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (name === 'value') {
      this._value = newVal || '';
      if (this._inputEl && this._inputEl.value !== this._value) {
        this._inputEl.value = this._value;
      }
      this._evaluate();
    } else if (name === 'context') {
      this._parseContextAttr();
      this._evaluate();
    } else if (this.isConnected) {
      this._render();
      this._evaluate();
    }
  }

  get value() {
    return this._value;
  }

  set value(val) {
    this._value = String(val ?? '');
    if (this._inputEl) {
      this._inputEl.value = this._value;
    }
    this._evaluate();
  }

  get context() {
    return this._context;
  }

  set context(ctx) {
    this._context = ctx && typeof ctx === 'object' ? ctx : {};
    this._evaluate();
  }

  _parseContextAttr() {
    const raw = this.getAttribute('context');
    if (raw) {
      try {
        this._context = JSON.parse(raw);
      } catch {
        this._context = {};
      }
    }
  }

  _render() {
    const label = this.getAttribute('label') || 'Password (MDL Audited)';
    const placeholder = this.getAttribute('placeholder') || 'Type a password to audit...';

    this.shadowRoot.innerHTML = `
      <style>${COMPONENT_STYLES}</style>
      <div class="hpi-card">
        <div class="hpi-header">
          <span class="hpi-label">${label}</span>
          <span class="hpi-crack-badge" id="crackBadge">Instant</span>
        </div>
        <div class="hpi-input-row">
          <input
            id="pwdInput"
            class="hpi-input"
            type="${this._visible ? 'text' : 'password'}"
            placeholder="${placeholder}"
            autocomplete="off"
            spellcheck="false"
          />
          <div class="hpi-actions">
            <button type="button" class="hpi-icon-btn" id="toggleVisBtn" title="Toggle visibility">
              ${this._visible ? 'Hide' : 'Show'}
            </button>
            <button type="button" class="hpi-icon-btn" id="genBtn" title="Generate high-MDL passphrase">
              🎲 Generate
            </button>
          </div>
        </div>

        <div class="hpi-meter-wrap">
          <div class="hpi-meter-labels">
            <span>Honest MDL: <strong class="hpi-meter-honest" id="honestBitsText">0.0 bits</strong></span>
            <span id="naiveBitsText">Naive: 0.0 bits (Tax: 0%)</span>
          </div>
          <div class="hpi-meter-track">
            <div class="hpi-bar-naive" id="naiveBar" style="width: 0%"></div>
            <div class="hpi-bar-honest" id="honestBar" style="width: 0%"></div>
          </div>
        </div>

        <div class="hpi-ribbon" id="miniRibbon"></div>
        <div class="hpi-tip" id="tipBox" style="display: none;">
          <span id="tipText"></span>
          <button type="button" class="hpi-tip-btn" id="applyTipBtn">Apply Edit</button>
        </div>
      </div>
    `;

    this._inputEl = this.shadowRoot.getElementById('pwdInput');
    this._inputEl.value = this._value;

    this._inputEl.addEventListener('input', (e) => {
      this._value = e.target.value;
      this._evaluate();
    });

    this.shadowRoot.getElementById('toggleVisBtn').addEventListener('click', () => {
      this._visible = !this._visible;
      this._inputEl.type = this._visible ? 'text' : 'password';
      this.shadowRoot.getElementById('toggleVisBtn').textContent = this._visible ? 'Hide' : 'Show';
    });

    this.shadowRoot.getElementById('genBtn').addEventListener('click', () => {
      const words = samplePassphraseWords(4);
      this.value = words.join('-');
    });

    this.shadowRoot.getElementById('applyTipBtn').addEventListener('click', () => {
      if (this._lastSuggestion) {
        this.value = this._lastSuggestion.newPassword;
      }
    });
  }

  _evaluate() {
    if (!this.shadowRoot || !this._inputEl) return;

    const sol = solvePasswordMDL(this._value, {}, this._context, 3);
    const suggestions = computeCounterfactuals(this._value, {}, this._context, sol);
    const crack = formatCrackTime(sol.honestBits);
    const minBits = parseFloat(this.getAttribute('min-bits') || '50');

    const honestBitsEl = this.shadowRoot.getElementById('honestBitsText');
    const naiveBitsEl = this.shadowRoot.getElementById('naiveBitsText');
    const honestBar = this.shadowRoot.getElementById('honestBar');
    const naiveBar = this.shadowRoot.getElementById('naiveBar');
    const crackBadge = this.shadowRoot.getElementById('crackBadge');
    const miniRibbon = this.shadowRoot.getElementById('miniRibbon');
    const tipBox = this.shadowRoot.getElementById('tipBox');
    const tipText = this.shadowRoot.getElementById('tipText');

    honestBitsEl.textContent = `${sol.honestBits.toFixed(1)} bits`;
    naiveBitsEl.textContent = `Naive: ${sol.naiveBits.toFixed(1)}b (Tax: -${sol.taxBits.toFixed(1)}b / ${sol.taxPercent}%)`;

    const scaleMax = Math.max(100, sol.naiveBits * 1.05);
    honestBar.style.width = `${Math.min(100, (sol.honestBits / scaleMax) * 100)}%`;
    naiveBar.style.width = `${Math.min(100, (sol.naiveBits / scaleMax) * 100)}%`;
    honestBar.setAttribute('data-tier', crack.tier);

    crackBadge.textContent = crack.label;
    crackBadge.setAttribute('data-tier', crack.tier);

    // Render mini segmentation pills
    if (this.getAttribute('show-ribbon') !== 'false') {
      miniRibbon.innerHTML = sol.optimal.segments.map(seg => `
        <span class="hpi-pill" data-cat="${seg.category}" title="${seg.summary}">
          <span>${this._escapeHtml(seg.token)}</span>
          <span class="hpi-pill-bits">${seg.totalSegmentBits.toFixed(1)}b</span>
        </span>
      `).join('');
    } else {
      miniRibbon.innerHTML = '';
    }

    // Render top counterfactual suggestion
    if (suggestions.length > 0) {
      this._lastSuggestion = suggestions[0];
      tipBox.style.display = 'flex';
      tipText.textContent = `💡 ${suggestions[0].title} (+${suggestions[0].deltaBits.toFixed(1)} bits)`;
    } else {
      this._lastSuggestion = null;
      tipBox.style.display = 'none';
    }

    this.dispatchEvent(new CustomEvent('entropy-change', {
      bubbles: true,
      composed: true,
      detail: {
        value: this._value,
        honestBits: sol.honestBits,
        naiveBits: sol.naiveBits,
        taxBits: sol.taxBits,
        derivation: sol.optimal,
        recommendation: suggestions[0] || null,
        isStrong: sol.honestBits >= minBits
      }
    }));
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

if (!customElements.get('honest-password-input')) {
  customElements.define('honest-password-input', HonestPasswordInput);
}