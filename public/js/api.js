// ── api.js — HTTP request wrapper ───────────────────────────────────────────
'use strict';

/** Timeout in ms for every API call. */
const API_TIMEOUT_MS = 8000;

const API = {
  /** Internal: fetch with timeout and 401 redirect. */
  async _req(path, opts = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
    try {
      const r = await fetch(path, { ...opts, signal: ctrl.signal });
      clearTimeout(t);
      if (r.status === 401) {
        showLoginOverlay();
        showAuthScreen('login');
        throw new Error('AUTH_REQUIRED');
      }
      return r;
    } catch (e) { clearTimeout(t); throw e; }
  },

  /** GET → parsed JSON. */
  async get(path) {
    const r = await API._req(path);
    return r.json();
  },

  /** POST body → parsed JSON. */
  async post(path, body) {
    const r = await API._req(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return r.json();
  },

  /** PUT body → parsed JSON. */
  async put(path, body) {
    const r = await API._req(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return r.json();
  },

  /** DELETE → parsed JSON. */
  async del(path) {
    const r = await API._req(path, { method: 'DELETE' });
    return r.json();
  }
};
