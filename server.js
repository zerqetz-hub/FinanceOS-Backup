'use strict';

/**
 * server.js — FinanceOS v5.5 entry point.
 *
 * Perubahan v5.4:
 *   - Tambah helmet untuk security headers
 *   - trust proxy = 1 agar req.ip benar di Railway (behind reverse proxy)
 *   - Health check reuse pool yang sudah ada (tidak buat Pool baru tiap request)
 *   - Konsistensi versi string
 */

require('./instrument');

const express = require('express');
const helmet  = require('helmet');
const path    = require('path');
const db      = require('./database');
const auth    = require('./auth');

const { errorMiddleware } = require('./errors');

const authRoutes       = require('./routes/auth.routes');
const dataRoutes       = require('./routes/data.routes');
const checkpointRoutes = require('./routes/checkpoint.routes');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── TRUST PROXY ─────────────────────────────────────────────────────────────
// Railway menempatkan app di belakang reverse proxy.
// Tanpa ini req.ip selalu mengembalikan IP proxy, bukan IP user.
app.set('trust proxy', 1);

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

// Security headers (helmet). contentSecurityPolicy dinonaktifkan agar
// CDN scripts (Chart.js, XLSX) tetap bisa dimuat oleh browser.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '2mb' }));

// Static files dengan cache headers
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    const file = path.basename(filePath);
    if (file === 'index.html')                           res.setHeader('Cache-Control', 'no-store');
    else if (file === 'app.css' || file.endsWith('.js')) res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));

// Auth middleware — menyimpan req.userId untuk semua route /api/* yang protected
app.use(auth.requireAuth);

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
// Endpoint publik — tidak perlu auth. Reuse pool dari database.js.
app.get('/health', async (_req, res) => {
  try {
    await db.ping();
    res.json({
      status:    'ok',
      version:   process.env.npm_package_version || '5.4.0',
      timestamp: new Date().toISOString(),
      database:  'connected',
    });
  } catch (e) {
    res.status(503).json({
      status:    'error',
      timestamp: new Date().toISOString(),
      database:  'disconnected',
      error:     e.message,
    });
  }
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────

app.use('/api/auth',            authRoutes);
app.use('/api',                 dataRoutes);
app.use('/api/checkpoint',      checkpointRoutes);
app.use('/api/checkpoints',     checkpointRoutes);

// ─── SENTRY ERROR HANDLER ─────────────────────────────────────────────────────
const Sentry = require('./instrument');
if (process.env.SENTRY_DSN && Sentry?.setupExpressErrorHandler) {
  Sentry.setupExpressErrorHandler(app);
}

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
// Terpusat di errors.js — menangani AppError (termasuk NotFoundError) dan error umum
app.use(errorMiddleware);

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ─── START ────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await db.initSchema();
    console.log('✅  Database schema siap.');
    app.listen(PORT, () => {
      console.log(`\n🚀  FinanceOS v5.5 berjalan di http://localhost:${PORT}`);
      console.log(`🗄️   Database  : PostgreSQL (${process.env.DATABASE_URL ? 'Railway' : 'lokal'})`);
      console.log(`🔐  Auth      : Multi-user (email + password)`);
      console.log(`🛡️   Helmet   : aktif (security headers)`);
      console.log(`📡  Routes    : auth | data | checkpoint`);
      console.log(`🛡️   Sentry   : ${process.env.SENTRY_DSN ? 'aktif' : 'tidak aktif (set SENTRY_DSN)'}\n`);
    });
  } catch (e) {
    console.error('❌  Gagal start server:', e.message);
    console.error('    Pastikan DATABASE_URL sudah diset dan PostgreSQL dapat dijangkau.');
    process.exit(1);
  }
}

start();
