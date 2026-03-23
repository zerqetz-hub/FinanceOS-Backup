// ── auth.js — register, login, logout (multi-user email edition) ──────────────
// @requires api.js (API), ui.js (showToast)
'use strict';

// ─── OVERLAY & SCREEN SWITCHER ────────────────────────────────────────────────

function showLoginOverlay() {
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('authOverlay').style.display   = 'flex';
}

function hideLoginOverlay() {
  document.getElementById('authOverlay').style.display = 'none';
}

/**
 * screen: 'login' | 'register'
 * Juga mengosongkan error dan reset tombol saat berpindah layar.
 */
function showAuthScreen(screen) {
  document.getElementById('authRegisterScreen').style.display = screen === 'register' ? 'block' : 'none';
  document.getElementById('authLoginScreen').style.display    = screen === 'login'    ? 'block' : 'none';

  // Hapus pesan error saat pindah layar
  ['registerErr','loginErr'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function togglePw(inputId, btn) {
  const inp  = document.getElementById(inputId);
  const show = inp.type === 'password';
  inp.type        = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

function _validatePw(pw) {
  if (pw.length < 8)         return 'Password minimal 8 karakter';
  if (!/[A-Za-z]/.test(pw)) return 'Password harus mengandung huruf';
  if (!/[0-9]/.test(pw))    return 'Password harus mengandung angka';
  return null;
}

function _setBtn(btnId, disabled, text) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled     = disabled;
  btn.textContent  = text;
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────

async function authRegister(e) {
  e.preventDefault();
  const email  = (document.getElementById('regEmail')?.value  || '').trim();
  const name   = (document.getElementById('regName')?.value   || '').trim();
  const pw     = document.getElementById('regPw')?.value  || '';
  const pw2    = document.getElementById('regPw2')?.value || '';
  const errEl  = document.getElementById('registerErr');
  errEl.textContent = '';

  // Validasi sisi klien sebelum kirim ke server
  if (!email || !email.includes('@')) { errEl.textContent = 'Email tidak valid.'; return; }
  const pwErr = _validatePw(pw);
  if (pwErr)            { errEl.textContent = pwErr;                    return; }
  if (pw !== pw2)       { errEl.textContent = 'Password tidak cocok.';  return; }

  _setBtn('registerBtn', true, 'Mendaftar...');
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw, username: name }),
    });
    const data = await res.json();
    if (data.ok) {
      await bootApp();
    } else {
      errEl.textContent = data.error || 'Gagal mendaftar.';
    }
  } catch {
    errEl.textContent = 'Gagal menghubungi server.';
  } finally {
    _setBtn('registerBtn', false, 'Daftar & Masuk');
  }
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

async function authLogin(e) {
  e.preventDefault();
  const email  = (document.getElementById('loginEmail')?.value || '').trim();
  const pw     = document.getElementById('loginPw')?.value || '';
  const errEl  = document.getElementById('loginErr');
  errEl.textContent = '';

  if (!email || !pw) { errEl.textContent = 'Email dan password wajib diisi.'; return; }

  _setBtn('loginBtn', true, 'Masuk...');
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw }),
    });
    const data = await res.json();
    if (data.ok) {
      document.getElementById('loginPw').value = '';
      await bootApp();
    } else {
      errEl.textContent = data.error || 'Email atau password salah.';
      document.getElementById('loginPw').value = '';
      document.getElementById('loginPw').focus();
    }
  } catch {
    errEl.textContent = 'Gagal menghubungi server.';
  } finally {
    _setBtn('loginBtn', false, 'Masuk');
  }
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

async function authLogout() {
  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
  location.reload();
}
