'use strict';
/**
 * tests/errors.test.js
 * Unit tests untuk AppError hierarchy dan routeHandler
 */

const {
  AppError,
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  routeHandler,
  errorMiddleware,
} = require('../errors');

// ─── AppError hierarchy ───────────────────────────────────────────────────────
describe('AppError hierarchy', () => {
  test('AppError has correct status and message', () => {
    const e = new AppError(422, 'Unprocessable');
    expect(e.status).toBe(422);
    expect(e.message).toBe('Unprocessable');
    expect(e instanceof Error).toBe(true);
  });

  test('NotFoundError status is 404', () => {
    const e = new NotFoundError();
    expect(e.status).toBe(404);
    expect(e.message).toBe('Data tidak ditemukan.');
  });

  test('NotFoundError accepts custom message', () => {
    const e = new NotFoundError('Asset tidak ditemukan.');
    expect(e.message).toBe('Asset tidak ditemukan.');
  });

  test('ConflictError status is 409', () => {
    expect(new ConflictError().status).toBe(409);
  });

  test('ValidationError status is 400', () => {
    expect(new ValidationError().status).toBe(400);
  });

  test('UnauthorizedError status is 401', () => {
    expect(new UnauthorizedError().status).toBe(401);
  });

  test('ForbiddenError status is 403', () => {
    expect(new ForbiddenError().status).toBe(403);
  });

  test('All AppErrors are instanceof AppError', () => {
    expect(new NotFoundError()    instanceof AppError).toBe(true);
    expect(new ConflictError()    instanceof AppError).toBe(true);
    expect(new ValidationError()  instanceof AppError).toBe(true);
    expect(new UnauthorizedError() instanceof AppError).toBe(true);
    expect(new ForbiddenError()   instanceof AppError).toBe(true);
  });

  test('All AppErrors are instanceof Error', () => {
    expect(new NotFoundError() instanceof Error).toBe(true);
  });
});

// ─── routeHandler ─────────────────────────────────────────────────────────────
describe('routeHandler', () => {
  test('calls next with error when async fn throws', async () => {
    const err  = new NotFoundError('test');
    const fn   = routeHandler(async () => { throw err; });
    const next = jest.fn();
    await fn({}, {}, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test('does not call next when fn succeeds', async () => {
    const res  = { json: jest.fn() };
    const fn   = routeHandler(async (_req, r) => { r.json({ ok: true }); });
    const next = jest.fn();
    await fn({}, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('calls next with generic Error', async () => {
    const err  = new Error('boom');
    const fn   = routeHandler(async () => { throw err; });
    const next = jest.fn();
    await fn({}, {}, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─── errorMiddleware ──────────────────────────────────────────────────────────
describe('errorMiddleware', () => {
  function makeRes() {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    return res;
  }

  test('responds with AppError status and message', () => {
    const res = makeRes();
    errorMiddleware(new NotFoundError('Cashflow tidak ditemukan.'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Cashflow tidak ditemukan.' });
  });

  test('responds 500 for generic Error', () => {
    const res = makeRes();
    errorMiddleware(new Error('db crash'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'db crash' });
  });

  test('responds 500 with fallback message if no message', () => {
    const res = makeRes();
    const err = new AppError(500, '');
    errorMiddleware(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
