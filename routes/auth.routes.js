'use strict';
// routes/auth.routes.js — register, login, logout, me, password, avatar, delete account

const router = require('express').Router();
const db     = require('../database');
const auth   = require('../auth');
const { validate, validateRegister } = require('../validators');

router.get('/status', async (req, res) => {
  const token = auth.getTokenFromRequest(req);
  if (!token) return res.json({ loggedIn: false });
  try {
    const userId = await db.validateSession(token);
    res.json({ loggedIn: !!userId });
  } catch { res.json({ loggedIn: false }); }
});

router.post('/register', validate(validateRegister), async (req, res) => {
  if (!auth.canAttempt(req)) {
    return res.status(429).json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${auth.lockoutSeconds(req)} detik.` });
  }
  try {
    const existing = await db.findUserByEmail(req.body.email);
    if (existing) { auth.recordFailure(req); return res.status(409).json({ error: 'Email sudah terdaftar.' }); }
    const { hash, salt } = await auth.hashPassword(req.body.password);
    const user = await db.createUser({
      email:        req.body.email,
      username:     (req.body.username || '').trim().slice(0, 40) || 'Pengguna',
      passwordHash: hash,
      passwordSalt: salt,
    });
    auth.clearAttempts(req);
    const token = await db.createSession(user.id);
    res.setHeader('Set-Cookie', auth.buildSetCookie(token));
    res.json({ ok: true, username: user.username });
  } catch (e) {
    auth.recordFailure(req);
    console.error('Register error:', e.message);
    res.status(500).json({ error: 'Gagal membuat akun.' });
  }
});

router.post('/login', async (req, res) => {
  if (!auth.canAttempt(req)) {
    return res.status(429).json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${auth.lockoutSeconds(req)} detik.` });
  }
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi.' });
  try {
    const user = await db.findUserByEmail(email);
    if (!user) { auth.recordFailure(req); return res.status(401).json({ error: 'Email atau password salah.' }); }
    const matched = await auth.verifyPassword(password, user.password_hash, user.password_salt);
    if (!matched) { auth.recordFailure(req); return res.status(401).json({ error: 'Email atau password salah.' }); }
    auth.clearAttempts(req);
    const token = await db.createSession(user.id);
    res.setHeader('Set-Cookie', auth.buildSetCookie(token));
    res.json({ ok: true, username: user.username });
  } catch (e) { console.error('Login error:', e.message); res.status(500).json({ error: 'Gagal login.' }); }
});

router.post('/logout', async (req, res) => {
  const token = auth.getTokenFromRequest(req);
  if (token) { try { await db.destroySession(token); } catch {} }
  res.setHeader('Set-Cookie', auth.buildClearCookie());
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  try {
    const user   = await db.findUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    const avatar = await db.getAvatar(req.userId);
    res.json({ id: user.id, email: user.email, username: user.username, avatar });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/auth/username — ganti display name
router.put('/username', async (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ error: 'Username wajib diisi.' });
  const trimmed = username.trim().slice(0, 40);
  try {
    await db.updateUsername(req.userId, trimmed);
    res.json({ ok: true, username: trimmed });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/password', async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Password lama dan baru wajib diisi.' });
  try {
    const user     = await db.findUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    const fullUser = await db.findUserByEmail(user.email);
    const matched  = await auth.verifyPassword(oldPassword, fullUser.password_hash, fullUser.password_salt);
    if (!matched) return res.status(401).json({ error: 'Password lama salah.' });
    const pwErr = auth.validatePasswordRules(newPassword);
    if (pwErr) return res.status(400).json({ error: pwErr });
    const { hash, salt } = await auth.hashPassword(newPassword);
    await db.updatePassword(req.userId, hash, salt);
    await db.destroyAllSessionsForUser(req.userId);
    res.setHeader('Set-Cookie', auth.buildClearCookie());
    res.json({ ok: true });
  } catch (e) { console.error('Change password error:', e.message); res.status(500).json({ error: e.message }); }
});

// Fix: whitelist MIME — hanya jpeg, png, webp. SVG diblokir karena bisa XSS.
router.put('/avatar', async (req, res) => {
  const { avatar } = req.body;
  if (!avatar) return res.status(400).json({ error: 'Data avatar wajib diisi.' });
  if (!auth.validateAvatarMime(avatar))
    return res.status(400).json({ error: 'Format avatar tidak valid. Gunakan JPEG, PNG, atau WebP.' });
  if (avatar.length > 270000) return res.status(400).json({ error: 'Ukuran foto terlalu besar. Maksimal ~200KB.' });
  try { await db.updateAvatar(req.userId, avatar); res.json({ ok: true, avatar }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/account', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Konfirmasi password wajib diisi.' });
  try {
    const user     = await db.findUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    const fullUser = await db.findUserByEmail(user.email);
    const matched  = await auth.verifyPassword(password, fullUser.password_hash, fullUser.password_salt);
    if (!matched) return res.status(401).json({ error: 'Password salah.' });
    await db.deleteUser(req.userId);
    res.setHeader('Set-Cookie', auth.buildClearCookie());
    res.json({ ok: true });
  } catch (e) { console.error('Delete account error:', e.message); res.status(500).json({ error: e.message }); }
});

module.exports = router;
