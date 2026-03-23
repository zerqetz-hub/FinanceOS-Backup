'use strict';

/**
 * instrument.js — Sentry error monitoring setup.
 *
 * Di-require pertama di server.js sebelum semua modul lain.
 * Tanpa SENTRY_DSN: tidak aktif, app berjalan normal.
 * Dengan SENTRY_DSN: semua error otomatis tercatat di dashboard Sentry.
 *
 * Setup:
 *   1. Daftar gratis di https://sentry.io
 *   2. Buat project → pilih "Node.js"
 *   3. Salin DSN → Railway Variables → SENTRY_DSN = <nilai DSN>
 */

let Sentry = null;

if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn:              process.env.SENTRY_DSN,
      environment:      process.env.NODE_ENV || 'development',
      release:          process.env.npm_package_version || '5.2.0',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
      // Filter data sensitif sebelum dikirim ke Sentry
      beforeSend(event) {
        if (event.request?.cookies)                      event.request.cookies = '[Filtered]';
        if (event.request?.headers?.cookie)              event.request.headers.cookie = '[Filtered]';
        if (event.request?.headers?.authorization)       event.request.headers.authorization = '[Filtered]';
        return event;
      },
    });
    console.log('✅  Sentry aktif — error monitoring berjalan');
  } catch (e) {
    console.warn('⚠️  Sentry gagal diinisialisasi:', e.message);
    Sentry = null;
  }
} else {
  console.log('ℹ️   Sentry tidak aktif (SENTRY_DSN belum diset di Railway Variables)');
}

module.exports = Sentry;
