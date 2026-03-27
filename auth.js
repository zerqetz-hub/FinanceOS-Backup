'use strict';

const crypto = require('crypto');
const db     = require('./database');

const SESSION_TTL_MS  = 2 * 60 * 60 * 1000;
const COOKIE_NAME     = 'ku_session';
const TOKEN_RE        = /^[a-f0-9]{64}$/;
const _attempts       = new Map();
const MAX_ATTEMPTS    = 5;
const LOCKOUT_MS      = 15 * 60 * 1000;

// Bersihkan entri kadaluarsa setiap 5 menit agar _attempts Map tidak tumbuh tanpa batas
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of _attempts) {
    if (now > rec.resetAt) _attempts.delete(ip);
  }
}, 5 * 60 * 1000).unref();

function _pbkdf2(password, salt) {
  return new Promise((resolve, reject) =>
    crypto.pbkdf2(password, salt, 100_000, 64, 'sha512', (err, key) =>
      err ? reject(err) : resolve(key.toString('hex'))
    )
  );
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = await _pbkdf2(password, salt);
  return { hash, salt };
}

async function verifyPassword(password, storedHash, storedSalt) {
  const hash = await _pbkdf2(password, storedSalt);
  try { return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash)); }
  catch { return false; }
}

function _parseCookie(header = '') {
  const match = header.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([a-f0-9]{64})`));
  return match ? match[1] : null;
}

function buildSetCookie(token) {
  const maxAge = Math.round(SESSION_TTL_MS / 1000);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

function buildClearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

function getTokenFromRequest(req) {
  return _parseCookie(req.headers.cookie);
}

// ─── RATE LIMITER ─────────────────────────────────────────────────────────────
// Fix: pakai req.ip (benar setelah trust proxy = 1), bukan req.socket.remoteAddress
function _getIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function canAttempt(req) {
  const ip = _getIp(req);
  const rec = _attempts.get(ip);
  if (!rec || Date.now() > rec.resetAt) { _attempts.delete(ip); return true; }
  return rec.count < MAX_ATTEMPTS;
}

function recordFailure(req) {
  const ip = _getIp(req);
  const now = Date.now();
  const rec = _attempts.get(ip) || { count: 0, resetAt: now + LOCKOUT_MS };
  rec.count++;
  _attempts.set(ip, rec);
}

function clearAttempts(req) { _attempts.delete(_getIp(req)); }

function lockoutSeconds(req) {
  const ip = _getIp(req);
  const rec = _attempts.get(ip);
  if (!rec || Date.now() > rec.resetAt) return 0;
  return Math.ceil((rec.resetAt - Date.now()) / 1000);
}

async function requireAuth(req, res, next) {
  const PUBLIC = ['/api/auth/status','/api/auth/register','/api/auth/login','/api/auth/logout'];
  if (!req.path.startsWith('/api/') || PUBLIC.includes(req.path)) return next();
  const token = getTokenFromRequest(req);
  if (!token || !TOKEN_RE.test(token))
    return res.status(401).json({ error: 'Sesi tidak valid. Silakan login kembali.', code: 'AUTH_REQUIRED' });
  try {
    const userId = await db.validateSession(token);
    if (!userId)
      return res.status(401).json({ error: 'Sesi tidak valid. Silakan login kembali.', code: 'AUTH_REQUIRED' });
    req.userId = userId;
    next();
  } catch (e) {
    console.error('requireAuth error:', e.message);
    res.status(500).json({ error: 'Server error saat validasi sesi.' });
  }
}

function validatePasswordRules(password) {
  if (typeof password !== 'string') return 'Password harus string';
  if (password.length < 8)          return 'Password minimal 8 karakter';
  if (password.length > 128)        return 'Password maksimal 128 karakter';
  if (!/[A-Za-z]/.test(password))   return 'Password harus mengandung huruf';
  if (!/[0-9]/.test(password))      return 'Password harus mengandung angka';
  return null;
}

// Fix: whitelist MIME — SVG diblokir karena bisa mengandung XSS
function validateAvatarMime(dataUri) {
  const ALLOWED = ['data:image/jpeg;', 'data:image/png;', 'data:image/webp;'];
  return ALLOWED.some(prefix => dataUri.startsWith(prefix));
}

/**
 * Validasi avatar data URI: cek MIME dan ukuran.
 * Returns null jika valid, atau string pesan error jika tidak valid.
 */
function validateAvatar(dataUri) {
  if (!dataUri || typeof dataUri !== 'string' || dataUri.length === 0)
    return 'Data avatar wajib diisi.';
  if (!validateAvatarMime(dataUri))
    return 'Format avatar tidak didukung. Gunakan JPEG, PNG, atau WebP.';
  if (dataUri.length > 270000)
    return 'Ukuran foto terlalu besar. Maksimal ~200KB.';
  return null;
}

module.exports = {
  hashPassword, verifyPassword,
  buildSetCookie, buildClearCookie, getTokenFromRequest,
  canAttempt, recordFailure, clearAttempts, lockoutSeconds,
  requireAuth, validatePasswordRules, validateAvatarMime, validateAvatar,
};
