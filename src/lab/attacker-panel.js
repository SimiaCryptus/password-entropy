/**
 * Interactive "Attacker Knowledge" Panel (Model Awareness & Kerckhoffs Simulator)
 * Provides:
 * 1. Adversary Sophistication Toggles (enable/disable generator modules in M with live bit deltas)
 * 2. Personal Context Sandbox (Name, Username, Birthdate, Pet/Keyword, Previous Password)
 */

const MODULE_TOGGLE_DEFS = [
  {
    key: 'useDictionary',
    title: 'Knows English & Leaked Password Dictionary',
    code: 'm_dict-f',
    desc: 'Zipf-weighted dictionary of common English words, names, and top leaked password roots.'
  },
  {
    key: 'useL33t',
    title: 'Knows L33tspeak & Case Mutation Transducers',
    code: 'T_sub / T_case',
    desc: 'Inverts common substitutions (a→@, o→0, e→3, s→$) and Title/ALL-CAPS modifiers.'
  },
  {
    key: 'useKeyboard',
    title: 'Knows Spatial Keyboard Layouts (QWERTY / Dvorak)',
    code: 'm_walk',
    desc: 'Models physical keyboard adjacency graphs to compress straight walks and column sweeps.'
  },
  {
    key: 'usePatterns',
    title: 'Knows Sequences, Calendar Years & Repetitions',
    code: 'm_seq / m_rep',
    desc: 'Compresses arithmetic sequences (1234, abcd), years (1990–2029), and repeated tokens.'
  },
  {
    key: 'usePii',
    title: 'Knows Personal Context & Edit-Distance Mutations',
    code: 'm_pii / T_edit',
    desc: 'Uses target metadata and Damerau-Levenshtein fuzzy matching (d ≤ 2) against Previous Password.'
  },
  {
    key: 'useCharFreq',
    title: 'Knows Natural Character & Symbol Frequencies',
    code: 'm_freq',
    desc: 'Weights raw characters by corpus frequency (e.g., trailing "!" costs far less than "~").'
  }
];

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}

/**
 * Initializes the Attacker Knowledge Panel once and updates values/deltas reactively
 * @param {HTMLElement} container
 * @param {object} snapshot
 * @param {object} actions
 */
export function renderAttackerPanel(container, snapshot, actions) {
  const { attackerConfig, piiContext, moduleDeltas } = snapshot;

  // If not yet initialized in DOM, build structure so typing in PII inputs preserves focus
  if (!container.dataset.initialized) {
    container.dataset.initialized = 'true';

    const togglesHtml = MODULE_TOGGLE_DEFS.map(mod => `
      <label class="attacker-toggle-row" for="toggle-${mod.key}">
        <div class="toggle-check-col">
          <input
            type="checkbox"
            id="toggle-${mod.key}"
            data-module-key="${mod.key}"
            ${attackerConfig[mod.key] ? 'checked' : ''}
          />
          <span class="custom-checkbox"></span>
        </div>
        <div class="toggle-info-col">
          <div class="toggle-title-line">
            <span class="toggle-title">${mod.title}</span>
            <code class="toggle-code">${mod.code}</code>
          </div>
          <p class="toggle-desc">${mod.desc}</p>
        </div>
        <div class="toggle-delta-col">
          <span class="delta-badge" id="delta-${mod.key}">0.0b</span>
        </div>
      </label>
    `).join('');

    container.innerHTML = `
      <div class="panel-split-grid">
        <!-- Left: Adversary Sophistication Toggles -->
        <div class="attacker-card">
          <div class="card-header">
            <div>
              <h3 class="section-title">Adversary Sophistication Toggles (Library 𝓜)</h3>
              <p class="section-subtitle">
                Uncheck modules to simulate a naive attacker and see how many bits each model saves the adversary
              </p>
            </div>
          </div>
          <div class="toggles-list">
            ${togglesHtml}
          </div>
        </div>

        <!-- Right: Personal Context Sandbox -->
        <div class="attacker-card">
          <div class="card-header">
            <div>
              <h3 class="section-title">Personal Context Sandbox (m_pii &amp; T_edit)</h3>
              <p class="section-subtitle">
                Simulate targeted spear-phishing or credential stuffing where the attacker knows user metadata or a leaked previous password
              </p>
            </div>
          </div>

          <div class="pii-form-grid">
            <div class="pii-field">
              <label for="pii-previousPassword">
                Leaked Previous Password <span class="field-tag">Triggers T_edit (d ≤ 2)</span>
              </label>
              <input
                type="text"
                id="pii-previousPassword"
                data-pii-field="previousPassword"
                placeholder="e.g. Summer2024! or P@ssw0rd122!"
                value="${escapeAttr(piiContext.previousPassword)}"
                autocomplete="off"
              />
            </div>

            <div class="pii-row-2col">
              <div class="pii-field">
                <label for="pii-name">Full Name</label>
                <input
                  type="text"
                  id="pii-name"
                  data-pii-field="name"
                  placeholder="e.g. Alex Morgan"
                  value="${escapeAttr(piiContext.name)}"
                  autocomplete="off"
                />
              </div>
              <div class="pii-field">
                <label for="pii-username">Username / Email</label>
                <input
                  type="text"
                  id="pii-username"
                  data-pii-field="username"
                  placeholder="e.g. amorgan"
                  value="${escapeAttr(piiContext.username)}"
                  autocomplete="off"
                />
              </div>
            </div>

            <div class="pii-row-2col">
              <div class="pii-field">
                <label for="pii-birthdate">Birthdate / Year</label>
                <input
                  type="text"
                  id="pii-birthdate"
                  data-pii-field="birthdate"
                  placeholder="e.g. 1994-05-14"
                  value="${escapeAttr(piiContext.birthdate)}"
                  autocomplete="off"
                />
              </div>
              <div class="pii-field">
                <label for="pii-pet">Pet / Partner / Team</label>
                <input
                  type="text"
                  id="pii-pet"
                  data-pii-field="pet"
                  placeholder="e.g. Buster"
                  value="${escapeAttr(piiContext.pet)}"
                  autocomplete="off"
                />
              </div>
            </div>

            <div class="pii-quick-tip">
              <strong>Try this:</strong> While testing <code>P@ssw0rd123!</code>, type <code>P@ssw0rd122!</code> into <em>Leaked Previous Password</em> above to watch the Edit Distance Transducer collapse the entire parse tree to ~10 bits!
              <button type="button" class="inline-demo-btn" id="triggerEditDemoBtn">Run Rotation Demo</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Wire checkbox listeners
    container.querySelectorAll('input[data-module-key]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        actions.onToggleModule(e.target.dataset.moduleKey, e.target.checked);
      });
    });

    // Wire PII text input listeners
    container.querySelectorAll('input[data-pii-field]').forEach(input => {
      input.addEventListener('input', (e) => {
        actions.onUpdatePii(e.target.dataset.piiField, e.target.value);
      });
    });

    const demoBtn = container.querySelector('#triggerEditDemoBtn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        actions.onSelectPreset('pii-rotation');
      });
    }
  }

  // Update checkbox states, delta badges, and PII input values (if not currently focused)
  for (const mod of MODULE_TOGGLE_DEFS) {
    const cb = container.querySelector(`#toggle-${mod.key}`);
    if (cb) cb.checked = Boolean(attackerConfig[mod.key]);

    const badge = container.querySelector(`#delta-${mod.key}`);
    if (badge) {
      const delta = moduleDeltas[mod.key] || 0;
      if (delta >= 0.5) {
        badge.textContent = `-${delta.toFixed(1)}b impact`;
        badge.classList.add('active-impact');
      } else {
        badge.textContent = `0.0b impact`;
        badge.classList.remove('active-impact');
      }
    }
  }

  container.querySelectorAll('input[data-pii-field]').forEach(input => {
    const field = input.dataset.piiField;
    const newVal = piiContext[field] || '';
    if (document.activeElement !== input && input.value !== newVal) {
      input.value = newVal;
    }
  });
}