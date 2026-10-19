/**
 * Main Bootstrap & Event Coordinator for the Honest Password Entropy Lab
 */

import './component/honest-password-input.js';
import { labStore, PRESET_SCENARIOS } from './lab/state.js';
import { renderLedgerView } from './lab/ledger-view.js';
import { renderRibbonView } from './lab/ribbon-view.js';
import { renderAttackerPanel } from './lab/attacker-panel.js';
import { renderHypothesesView } from './lab/hypotheses-view.js';
import { renderAdvisorView } from './lab/advisor-view.js';
import { samplePassphraseWords } from './data/dictionary.js';

document.addEventListener('DOMContentLoaded', () => {
  const pwdInput = document.getElementById('labPasswordInput');
  const toggleVisBtn = document.getElementById('labToggleVisBtn');
  const randomPassBtn = document.getElementById('labRandomPassBtn');
  const presetBar = document.getElementById('presetChipsBar');
  const presetDescEl = document.getElementById('presetScenarioDesc');
  const charRulerEl = document.getElementById('passwordCharRuler');

  const ledgerContainer = document.getElementById('ledgerMount');
  const ribbonContainer = document.getElementById('ribbonMount');
  const attackerContainer = document.getElementById('attackerMount');
  const hypothesesContainer = document.getElementById('hypothesesMount');
  const advisorContainer = document.getElementById('advisorMount');

  // Mode tabs (Adversarial Lab vs. Reusable Web Component Demo)
  const tabButtons = document.querySelectorAll('[data-tab-target]');
  const tabPanels = document.querySelectorAll('.tab-view-panel');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tabTarget;
      tabButtons.forEach(b => b.classList.toggle('active', b === btn));
      tabPanels.forEach(panel => {
        panel.style.display = panel.id === targetId ? 'block' : 'none';
      });
    });
  });

  // Render preset scenario chips
  function renderPresets(activePresetId) {
    presetBar.innerHTML = PRESET_SCENARIOS.map(preset => `
      <button
        type="button"
        class="preset-chip ${preset.id === activePresetId ? 'active' : ''}"
        data-preset-id="${preset.id}"
      >
        <span class="preset-chip-badge">${preset.badge}</span>
        <code class="preset-chip-pwd">${preset.label}</code>
      </button>
    `).join('');

    presetBar.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        labStore.loadPreset(chip.dataset.presetId);
      });
    });
  }

  // Render character index ruler underneath input
  function renderCharRuler(password) {
    if (!password) {
      charRulerEl.innerHTML = '<span class="ruler-empty">0 chars</span>';
      return;
    }
    const cells = password.split('').map((ch, i) => `
      <span class="ruler-cell">
        <span class="ruler-char">${ch === ' ' ? '␣' : ch.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>
        <span class="ruler-idx">${i}</span>
      </span>
    `).join('');
    charRulerEl.innerHTML = cells;
  }

  // Primary password input events
  pwdInput.addEventListener('input', (e) => {
    labStore.setPassword(e.target.value, 'Custom password evaluation under Minimum Description Length.');
  });

  let isPasswordVisible = true;
  toggleVisBtn.addEventListener('click', () => {
    isPasswordVisible = !isPasswordVisible;
    pwdInput.type = isPasswordVisible ? 'text' : 'password';
    toggleVisBtn.textContent = isPasswordVisible ? 'Hide' : 'Show';
  });

  randomPassBtn.addEventListener('click', () => {
    const words = samplePassphraseWords(4);
    labStore.setPassword(
      words.join('-'),
      'Generated 4-word diceware passphrase (~60 bits Honest MDL Entropy).'
    );
  });

  // Subscribe all views to the reactive store
  labStore.subscribe((snapshot) => {
    if (document.activeElement !== pwdInput && pwdInput.value !== snapshot.password) {
      pwdInput.value = snapshot.password;
    }

    renderPresets(snapshot.activePresetId);
    renderCharRuler(snapshot.password);

    if (presetDescEl) {
      presetDescEl.textContent = snapshot.presetDescription || '';
    }

    renderLedgerView(ledgerContainer, snapshot);

    renderRibbonView(ribbonContainer, snapshot, () => {
      labStore.togglePinHypothesis(null);
      labStore.setPreviewHypothesis(null);
    });

    renderAdvisorView(advisorContainer, snapshot, (newPwd, desc) => {
      labStore.setPassword(newPwd, desc);
    });

    renderAttackerPanel(attackerContainer, snapshot, {
      onToggleModule: (key, enabled) => labStore.toggleAttackerModule(key, enabled),
      onUpdatePii: (field, val) => labStore.updatePiiField(field, val),
      onSelectPreset: (presetId) => labStore.loadPreset(presetId)
    });

    renderHypothesesView(hypothesesContainer, snapshot, {
      onHoverHypothesis: (hypId) => labStore.setPreviewHypothesis(hypId),
      onPinHypothesis: (hypId) => labStore.togglePinHypothesis(hypId)
    });
  });

  // Wire Web Component Showcase event log
  const demoComponent = document.getElementById('showcasePasswordComponent');
  const demoEventLog = document.getElementById('componentEventPayload');
  if (demoComponent && demoEventLog) {
    demoComponent.addEventListener('entropy-change', (e) => {
      const { honestBits, naiveBits, taxBits, isStrong, recommendation } = e.detail;
      demoEventLog.textContent = JSON.stringify({
        honestBits: Number(honestBits.toFixed(2)),
        naiveBits: Number(naiveBits.toFixed(2)),
        humanPredictabilityTaxBits: Number(taxBits.toFixed(2)),
        meetsMinimumThreshold: isStrong,
        segments: e.detail.derivation.segments.map(s => ({
          token: s.token,
          generator: s.moduleId,
          bits: Number(s.totalSegmentBits.toFixed(2))
        })),
        topCounterfactual: recommendation ? {
          title: recommendation.title,
          deltaBits: Number(recommendation.deltaBits.toFixed(2)),
          suggestedPassword: recommendation.newPassword
        } : null
      }, null, 2);
    });
  }
});