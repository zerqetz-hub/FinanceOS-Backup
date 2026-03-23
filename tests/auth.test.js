'use strict';
/**
 * tests/auth.test.js
 * Unit tests untuk auth helpers: password hashing, validatePasswordRules, validateAvatar, rate limiter
 */

const auth = require('../auth');

// ─── validatePasswordRules ────────────────────────────────────────────────────
describe('validatePasswordRules', () => {
  test('valid password returns null', () => {
    expect(auth.validatePasswordRules('Password1')).toBeNull();
    expect(auth.validatePasswordRules('abc12345')).toBeNull();
    expect(auth.validatePasswordRules('A'.repeat(128) + '1')).not.toBeNull(); // too long
  });

  test('returns error for non-string', () => {
    expect(auth.validatePasswordRules(12345)).not.toBeNull();
  });

  test('returns error for too short', () => {
    const r = auth.validatePasswordRules('ab1');
    expect(r).toContain('8 karakter');
  });

  test('returns error for too long', () => {
    const r = auth.validatePasswordRules('a'.repeat(129));
    expect(r).toContain('128');
  });

  test('returns error if no letter', () => {
    const r = auth.validatePasswordRules('12345678');
    expect(r).toContain('huruf');
  });

  test('returns error if no number', () => {
    const r = auth.validatePasswordRules('abcdefgh');
    expect(r).toContain('angka');
  });

  test('exactly 8 chars with letter+number passes', () => {
    expect(auth.validatePasswordRules('abcdef12')).toBeNull();
  });

  test('exactly 128 chars passes', () => {
    const pw = 'a'.repeat(127) + '1';
    expect(auth.validatePasswordRules(pw)).toBeNull();
  });
});

// ─── validateAvatar ───────────────────────────────────────────────────────────
describe('validateAvatar', () => {
  test('valid JPEG data URI passes', () => {
    expect(auth.validateAvatar('data:image/jpeg;base64,/9j/')).toBeNull();
  });

  test('valid PNG data URI passes', () => {
    expect(auth.validateAvatar('data:image/png;base64,iVBORw0K')).toBeNull();
  });

  test('valid WebP data URI passes', () => {
    expect(auth.validateAvatar('data:image/webp;base64,UklGR')).toBeNull();
  });

  test('SVG data URI rejected (XSS risk)', () => {
    const r = auth.validateAvatar('data:image/svg+xml;base64,PHN2Zy');
    expect(r).not.toBeNull();
    expect(r).toContain('tidak didukung');
  });

  test('null rejected', () => {
    expect(auth.validateAvatar(null)).not.toBeNull();
  });

  test('empty string rejected', () => {
    expect(auth.validateAvatar('')).not.toBeNull();
  });

  test('oversized avatar rejected', () => {
    const bigAvatar = 'data:image/jpeg;base64,' + 'A'.repeat(270001);
    expect(auth.validateAvatar(bigAvatar)).not.toBeNull();
  });

  test('exactly at size limit passes', () => {
    const okAvatar = 'data:image/jpeg;' + 'A'.repeat(269984); // under limit
    expect(auth.validateAvatar(okAvatar)).toBeNull();
  });
});

// ─── hashPassword + verifyPassword ───────────────────────────────────────────
describe('hashPassword and verifyPassword', () => {
  test('hash produces different salt each time', async () => {
    const r1 = await auth.hashPassword('Password1');
    const r2 = await auth.hashPassword('Password1');
    expect(r1.salt).not.toBe(r2.salt);
    expect(r1.hash).not.toBe(r2.hash);
  });

  test('verifyPassword returns true for correct password', async () => {
    const { hash, salt } = await auth.hashPassword('MyPass123');
    const result = await auth.verifyPassword('MyPass123', hash, salt);
    expect(result).toBe(true);
  });

  test('verifyPassword returns false for wrong password', async () => {
    const { hash, salt } = await auth.hashPassword('MyPass123');
    const result = await auth.verifyPassword('WrongPass1', hash, salt);
    expect(result).toBe(false);
  });

  test('verifyPassword returns false for wrong salt', async () => {
    const { hash } = await auth.hashPassword('MyPass123');
    const { salt: wrongSalt } = await auth.hashPassword('OtherPass1');
    const result = await auth.verifyPassword('MyPass123', hash, wrongSalt);
    expect(result).toBe(false);
  });
}, 15_000); // PBKDF2 100k iterations needs time

// ─── Rate limiter ─────────────────────────────────────────────────────────────
describe('rate limiter', () => {
  const ip = '10.0.0.1-test-' + Date.now();

  afterEach(() => auth.clearAttempts(ip));

  test('canAttempt returns true for fresh IP', () => {
    expect(auth.canAttempt(ip)).toBe(true);
  });

  test('blocks after MAX_ATTEMPTS failures', () => {
    for (let i = 0; i < 5; i++) auth.recordFailure(ip);
    expect(auth.canAttempt(ip)).toBe(false);
  });

  test('lockoutSeconds returns positive after max failures', () => {
    for (let i = 0; i < 5; i++) auth.recordFailure(ip);
    expect(auth.lockoutSeconds(ip)).toBeGreaterThan(0);
  });

  test('clearAttempts resets lockout', () => {
    for (let i = 0; i < 5; i++) auth.recordFailure(ip);
    auth.clearAttempts(ip);
    expect(auth.canAttempt(ip)).toBe(true);
    expect(auth.lockoutSeconds(ip)).toBe(0);
  });
});

// ─── buildSetCookie / buildClearCookie ───────────────────────────────────────
describe('cookie builders', () => {
  test('buildSetCookie contains token and HttpOnly', () => {
    const cookie = auth.buildSetCookie('a'.repeat(64));
    expect(cookie).toContain('a'.repeat(64));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  test('buildClearCookie has Max-Age=0', () => {
    const cookie = auth.buildClearCookie();
    expect(cookie).toContain('Max-Age=0');
  });
});
