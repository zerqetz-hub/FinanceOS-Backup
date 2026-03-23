// ── state.js — global state, Command-based undo/redo, load/save ──────────────
// @requires api.js (API), ui.js (showToast)
'use strict';

/** Global application state — loaded from server on boot. */
let S = {};

const HIST_MAX = 50;

// ─── COMMAND STACK ────────────────────────────────────────────────────────────
// Each entry: { label, revert: async fn, apply: async fn }
// revert() restores state before the operation (server + local S)
// apply()  re-applies the operation (server + local S)
let _undoCmds = [];
let _redoCmds = [];
let _cmdBusy  = false;  // prevent concurrent undo/redo

/**
 * Record a reversible command.
 * @param {string}   label   - Human-readable description, shown in toast.
 * @param {Function} revert  - Async fn that undoes the operation (server + S).
 * @param {Function} apply   - Async fn that re-does the operation (server + S).
 */
function pushCommand(label, revert, apply) {
  _undoCmds.push({ label, revert, apply });
  if (_undoCmds.length > HIST_MAX) _undoCmds.shift();
  _redoCmds = [];
  _syncHistBtns();
}

function _syncHistBtns() {
  const u = document.getElementById('undoBtn');
  const r = document.getElementById('redoBtn');
  const busy = _cmdBusy;
  if (u) {
    u.disabled = !_undoCmds.length || busy;
    const next = _undoCmds.length ? _undoCmds[_undoCmds.length - 1].label : null;
    u.title     = next ? `Undo: ${next} (Ctrl+Z)` : 'Undo (Ctrl+Z)';
    u.textContent = next ? `⟲ Undo: ${next}` : '⟲ Undo';
  }
  if (r) {
    r.disabled = !_redoCmds.length || busy;
    const next = _redoCmds.length ? _redoCmds[_redoCmds.length - 1].label : null;
    r.title     = next ? `Redo: ${next} (Ctrl+Y)` : 'Redo (Ctrl+Y)';
    r.textContent = next ? `⟳ Redo: ${next}` : '⟳ Redo';
  }
}

/** Execute undo: call revert(), refresh UI. */
async function historyUndo() {
  if (!_undoCmds.length || _cmdBusy) return;
  _cmdBusy = true;
  _syncHistBtns();
  const cmd = _undoCmds.pop();
  try {
    await cmd.revert();
    _redoCmds.push(cmd);
    renderAll();
    showToast(`↩ Undo: "${cmd.label}"`, 'success');
  } catch (e) {
    // Put it back if revert failed
    _undoCmds.push(cmd);
    showToast(`Undo gagal: ${e?.message || 'error server'}`, 'error');
  } finally {
    _cmdBusy = false;
    _syncHistBtns();
  }
}

/** Execute redo: call apply(), refresh UI. */
async function historyRedo() {
  if (!_redoCmds.length || _cmdBusy) return;
  _cmdBusy = true;
  _syncHistBtns();
  const cmd = _redoCmds.pop();
  try {
    await cmd.apply();
    _undoCmds.push(cmd);
    renderAll();
    showToast(`↪ Redo: "${cmd.label}"`, 'success');
  } catch (e) {
    _redoCmds.push(cmd);
    showToast(`Redo gagal: ${e?.message || 'error server'}`, 'error');
  } finally {
    _cmdBusy = false;
    _syncHistBtns();
  }
}

// Backward-compat shim: old pushHistory() snapshots are no longer used.
// Code that still calls pushHistory() is safe — it becomes a no-op.
function pushHistory() { /* replaced by pushCommand() */ }

// Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); historyUndo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); historyRedo(); }
});

// ─── LOAD / SAVE ─────────────────────────────────────────────────────────────
/** Default values for fields that may be absent from older data. */
const STATE_DEFAULTS = {
  currency: 'IDR',
  categories: {
    income:  ['Gaji','Freelance','Bisnis','Investasi','Bonus','Dividen','Lainnya'],
    expense: ['Makanan','Transport','Hiburan','Kesehatan','Utilities','Belanja','Lainnya']
  },
  budgets:      { Makanan:3500000, Transport:2000000, Hiburan:1500000, Kesehatan:1000000, Utilities:1200000, Belanja:2000000, Lainnya:800000 },
  cashflows:    [],
  assets:       [],
  debts:        [],
  goals:        [],
  transactions: [],
  paidDebts:    []
};

async function loadStore() {
  try {
    const raw = await API.get('/api/state');
    S = { ...STATE_DEFAULTS, ...raw };
    S.categories = { ...STATE_DEFAULTS.categories, ...S.categories };
    // Handle paginated transactions format
    if (raw.transactionsMeta) {
      S.transactionsMeta = raw.transactionsMeta;
    }
  } catch (e) {
    console.error('Gagal load data:', e);
    showToast('⚠️ Gagal konek ke server. Jalankan: npm start', 'error');
  }
}

async function syncSettings() {
  try {
    await API.put('/api/settings', { currency: S.currency, categories: S.categories });
    flashSave();
  } catch (e) { console.error('Gagal simpan settings:', e); }
}

async function syncPaidDebts() {
  try { await API.put('/api/paidDebts', S.paidDebts || []); } catch (e) {}
}

function flashSave() {
  const b = document.getElementById('saveBadge');
  if (!b) return;
  b.classList.add('show');
  clearTimeout(b._t);
  b._t = setTimeout(() => b.classList.remove('show'), 2000);
}
