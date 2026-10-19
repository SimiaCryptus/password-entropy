/**
 * Reactive State Store for the Interactive Adversarial Lab
 * Manages password, PII sandbox context, adversary capability toggles,
 * and currently previewed/pinned competing hypothesis.
 */

import { solvePasswordMDL } from '../engine/solver.js';
import { computeCounterfactuals } from '../engine/counterfactuals.js';
import { DEFAULT_ATTACKER_CONFIG } from '../engine/generators/index.js';

export const PRESET_SCENARIOS = [
  {
    id: 'layered-l33t',
    label: 'P@ssw0rd123!',
    badge: 'Stacked Transducers',
    password: 'P@ssw0rd123!',
    pii: {
      name: 'Alex Morgan',
      username: 'amorgan',
      birthdate: '1994-05-14',
      pet: 'Buster',
      previousPassword: ''
    },
    description: 'Classic enterprise password combining a top dictionary word, Title Case, L33tspeak (a→@, o→0), an ascending digit sequence (123), and a trailing bang (!).'
  },
  {
    id: 'xkcd-passphrase',
    label: 'correcthorsebatterystaple',
    badge: 'Multi-Word Passphrase',
    password: 'correcthorsebatterystaple',
    pii: {
      name: 'Alex Morgan',
      username: 'amorgan',
      birthdate: '1994-05-14',
      pet: 'Buster',
      previousPassword: ''
    },
    description: 'Four concatenated English words. Naive character entropy claims >117 bits, whereas Honest MDL prices the four Zipf-weighted lexical lookups + transitions at ~45 bits.'
  },
  {
    id: 'spatial-walk',
    label: '1qaz2wsx3edc',
    badge: '2D Keyboard Walk',
    password: '1qaz2wsx3edc',
    pii: {
      name: 'Alex Morgan',
      username: 'amorgan',
      birthdate: '1994-05-14',
      pet: 'Buster',
      previousPassword: ''
    },
    description: 'Appears to mix digits and letters arbitrarily, but traces three adjacent vertical columns down a standard QWERTY keyboard.'
  },
  {
    id: 'pii-rotation',
    label: 'Summer2024! → Summer2025!',
    badge: 'PII Edit Distance',
    password: 'Summer2025!',
    pii: {
      name: 'Alex Morgan',
      username: 'amorgan',
      birthdate: '1994-05-14',
      pet: 'Buster',
      previousPassword: 'Summer2024!'
    },
    description: 'Demonstrates forced 90-day password rotation where the user increments a single digit from their leaked Previous Password ("Summer2024!"), collapsing MDL entropy via the Edit Distance Transducer.'
  },
  {
    id: 'xkcd-troubador',
    label: 'Tr0ub4dor&3',
    badge: 'XKCD Classic',
    password: 'Tr0ub4dor&3',
    pii: {
      name: 'Alex Morgan',
      username: 'amorgan',
      birthdate: '1994-05-14',
      pet: 'Buster',
      previousPassword: ''
    },
    description: 'The iconic XKCD #936 password: a single dictionary word ("troubador") with Title Case, two l33t substitutions (o→0, a→4), and two trailing characters.'
  },
  {
    id: 'true-random',
    label: 'xK9#mP2$vLq7',
    badge: 'High-MDL Random',
    password: 'xK9#mP2$vLq7',
    pii: {
      name: 'Alex Morgan',
      username: 'amorgan',
      birthdate: '1994-05-14',
      pet: 'Buster',
      previousPassword: ''
    },
    description: 'Uncorrelated characters across all four character classes that resist dictionary, spatial, sequence, and PII compression.'
  }
];

class LabStateStore {
  constructor() {
    const initialPreset = PRESET_SCENARIOS[0];
    this.state = {
      password: initialPreset.password,
      activePresetId: initialPreset.id,
      presetDescription: initialPreset.description,
      attackerConfig: { ...DEFAULT_ATTACKER_CONFIG },
      piiContext: { ...initialPreset.pii },
      previewHypothesisId: null, // Temporary hover preview ID
      pinnedHypothesisId: null   // Clicked/locked hypothesis ID
    };
    this.listeners = new Set();
    this._recompute();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.getSnapshot());
    return () => this.listeners.delete(fn);
  }

  _notify() {
    const snap = this.getSnapshot();
    for (const fn of this.listeners) {
      fn(snap);
    }
  }

  _recompute() {
    const { password, attackerConfig, piiContext } = this.state;
    this.solution = solvePasswordMDL(password, attackerConfig, piiContext, 5);
    this.counterfactuals = computeCounterfactuals(password, attackerConfig, piiContext, this.solution);

    // Compute individual attacker module sensitivity deltas (how many bits each toggle saves the attacker)
    this.moduleDeltas = {};
    for (const key of Object.keys(DEFAULT_ATTACKER_CONFIG)) {
      const flippedConfig = { ...attackerConfig, [key]: !attackerConfig[key] };
      const altSol = solvePasswordMDL(password, flippedConfig, piiContext, 2);
      // Positive number = how many bits this attacker capability shaves off the password
      const withModuleBits = attackerConfig[key] ? this.solution.honestBits : altSol.honestBits;
      const withoutModuleBits = attackerConfig[key] ? altSol.honestBits : this.solution.honestBits;
      this.moduleDeltas[key] = Math.max(0, withoutModuleBits - withModuleBits);
    }
  }

  getSnapshot() {
    const activeHypId = this.state.previewHypothesisId || this.state.pinnedHypothesisId;
    let displayedDerivation = this.solution.optimal;

    if (activeHypId) {
      const found = this.solution.hypotheses.find(h => h.id === activeHypId);
      if (found) displayedDerivation = found;
    }

    return {
      ...this.state,
      solution: this.solution,
      displayedDerivation,
      isPreviewingAlternative: displayedDerivation.id !== this.solution.optimal.id,
      counterfactuals: this.counterfactuals,
      moduleDeltas: this.moduleDeltas
    };
  }

  setPassword(password, customDesc = null) {
    this.state.password = password;
    this.state.activePresetId = null;
    if (customDesc !== null) {
      this.state.presetDescription = customDesc;
    }
    this.state.previewHypothesisId = null;
    this.state.pinnedHypothesisId = null;
    this._recompute();
    this._notify();
  }

  loadPreset(presetId) {
    const preset = PRESET_SCENARIOS.find(p => p.id === presetId);
    if (!preset) return;
    this.state.password = preset.password;
    this.state.activePresetId = preset.id;
    this.state.presetDescription = preset.description;
    this.state.piiContext = { ...preset.pii };
    this.state.previewHypothesisId = null;
    this.state.pinnedHypothesisId = null;
    this._recompute();
    this._notify();
  }

  toggleAttackerModule(moduleKey, enabled) {
    this.state.attackerConfig = {
      ...this.state.attackerConfig,
      [moduleKey]: enabled
    };
    this.state.previewHypothesisId = null;
    this.state.pinnedHypothesisId = null;
    this._recompute();
    this._notify();
  }

  updatePiiField(field, value) {
    this.state.piiContext = {
      ...this.state.piiContext,
      [field]: value
    };
    this._recompute();
    this._notify();
  }

  setPreviewHypothesis(hypId) {
    if (this.state.previewHypothesisId === hypId) return;
    this.state.previewHypothesisId = hypId;
    this._notify();
  }

  togglePinHypothesis(hypId) {
    if (this.state.pinnedHypothesisId === hypId) {
      this.state.pinnedHypothesisId = null;
    } else {
      this.state.pinnedHypothesisId = hypId;
    }
    this._notify();
  }
}

export const labStore = new LabStateStore();