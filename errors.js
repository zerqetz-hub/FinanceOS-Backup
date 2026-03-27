'use strict';

/**
 * errors.js — Custom error classes untuk KepingUang.
 *
 * Menggantikan pola fragile eAuto() yang mendeteksi 404 via string-matching
 * msg.includes('tidak ditemukan'). Kini setiap error punya kode numerik eksplisit.
 *
 * Usage di database layer:
 *   throw new NotFoundError('Asset tidak ditemukan');
 *   throw new ConflictError('Email sudah terdaftar');
 *   throw new ValidationError('Income harus angka positif');
 *
 * Usage di route handler:
 *   } catch (e) { next(e); }        // AppError langsung ditangani middleware
 *   atau pakai helper: handleErr(res, e)
 */

class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name   = this.constructor.name;
    this.status = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Data tidak ditemukan.') {
    super(404, message);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Data sudah ada.') {
    super(409, message);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Input tidak valid.') {
    super(400, message);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Tidak terautentikasi.') {
    super(401, message);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Akses ditolak.') {
    super(403, message);
  }
}

/**
 * Route error handler helper.
 * Pakai ini sebagai pengganti try/catch manual di setiap route:
 *
 *   router.get('/foo', routeHandler(async (req, res) => {
 *     const data = await db.getFoo(req.userId);
 *     res.json(data);
 *   }));
 */
function routeHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      next(e);
    }
  };
}

/**
 * Express error middleware — pasang setelah semua routes di server.js:
 *   app.use(errorMiddleware);
 */
function errorMiddleware(err, _req, res, _next) {
  const status  = err.status || 500;
  const message = err.message || 'Terjadi kesalahan pada server.';
  if (process.env.NODE_ENV !== 'production' && status >= 500) {
    console.error('[AppError]', err.stack);
  }
  res.status(status).json({ error: message });
}

module.exports = {
  AppError,
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  routeHandler,
  errorMiddleware,
};
