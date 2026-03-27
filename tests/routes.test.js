'use strict';
/**
 * tests/routes.test.js
 * Integration tests untuk route handlers menggunakan supertest.
 *
 * Database di-mock — tidak perlu koneksi PostgreSQL nyata.
 * Session di-mock dengan userId = 'test-user-uuid'.
 */

const express    = require('express');
const supertest  = require('supertest');
const { errorMiddleware } = require('../errors');

// ─── MOCK DATABASE ────────────────────────────────────────────────────────────
// Override require('../database') sebelum routes di-load
const mockDb = {
  getCashflows:      jest.fn(),
  addCashflow:       jest.fn(),
  updateCashflow:    jest.fn(),
  deleteCashflow:    jest.fn(),
  getAssets:         jest.fn(),
  addAsset:          jest.fn(),
  updateAsset:       jest.fn(),
  deleteAsset:       jest.fn(),
  getDebts:          jest.fn(),
  addDebt:           jest.fn(),
  updateDebt:        jest.fn(),
  deleteDebt:        jest.fn(),
  getGoals:          jest.fn(),
  addGoal:           jest.fn(),
  updateGoal:        jest.fn(),
  deleteGoal:        jest.fn(),
  getTransactions:   jest.fn(),
  addTransaction:    jest.fn(),
  updateTransaction: jest.fn(),
  deleteTransaction: jest.fn(),
  getSettings:       jest.fn(),
  updateSettings:    jest.fn(),
  getState:          jest.fn(),
  setPaidDebts:      jest.fn(),
  resetToDefault:    jest.fn(),
};

jest.mock('../database', () => mockDb);

const dataRoutes = require('../routes/data.routes');

// ─── MOCK APP ─────────────────────────────────────────────────────────────────
function buildApp() {
  const app = express();
  app.use(express.json());
  // Inject fake userId (bypasses auth middleware)
  app.use((req, _res, next) => { req.userId = 'test-user-uuid'; next(); });
  app.use('/api', dataRoutes);
  app.use(errorMiddleware);
  return app;
}

let app;
let request;

beforeAll(() => { app = buildApp(); request = supertest(app); });
beforeEach(() => jest.clearAllMocks());

// ─── STATE ────────────────────────────────────────────────────────────────────
describe('GET /api/state', () => {
  test('returns state from db', async () => {
    const fakeState = { cashflows: [], assets: [], debts: [] };
    mockDb.getState.mockResolvedValue(fakeState);
    const res = await request.get('/api/state');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(fakeState);
    expect(mockDb.getState).toHaveBeenCalledWith('test-user-uuid');
  });

  test('returns 500 on db error', async () => {
    mockDb.getState.mockRejectedValue(new Error('db down'));
    const res = await request.get('/api/state');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('db down');
  });
});

// ─── CASHFLOWS ────────────────────────────────────────────────────────────────
describe('GET /api/cashflows', () => {
  test('returns cashflows array', async () => {
    const cfs = [{ id: 'cf1', month: '2025-03', income: 10_000_000, expenses: {} }];
    mockDb.getCashflows.mockResolvedValue(cfs);
    const res = await request.get('/api/cashflows');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(cfs);
  });
});

describe('POST /api/cashflows', () => {
  test('creates cashflow with valid body', async () => {
    mockDb.addCashflow.mockResolvedValue();
    const res = await request.post('/api/cashflows').send({
      id: 'cf-new', month: '2025-04', income: 8_000_000,
      expenses: { Makanan: 1_000_000 },
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockDb.addCashflow).toHaveBeenCalledWith('test-user-uuid', expect.objectContaining({ month: '2025-04' }));
  });

  test('400 for invalid month format', async () => {
    const res = await request.post('/api/cashflows').send({ month: '2025/04', income: 1000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('month');
  });

  test('400 for negative income', async () => {
    const res = await request.post('/api/cashflows').send({ month: '2025-04', income: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('income');
  });
});

describe('PUT /api/cashflows/:id', () => {
  test('updates cashflow', async () => {
    mockDb.updateCashflow.mockResolvedValue();
    const res = await request.put('/api/cashflows/cf1').send({ income: 12_000_000 });
    expect(res.status).toBe(200);
    expect(mockDb.updateCashflow).toHaveBeenCalledWith('test-user-uuid', 'cf1', expect.any(Object));
  });

  test('404 when cashflow not found', async () => {
    const { NotFoundError } = require('../errors');
    mockDb.updateCashflow.mockRejectedValue(new NotFoundError('Cashflow tidak ditemukan.'));
    const res = await request.put('/api/cashflows/nonexistent').send({ income: 1000 });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('tidak ditemukan');
  });
});

describe('DELETE /api/cashflows/:id', () => {
  test('deletes cashflow', async () => {
    mockDb.deleteCashflow.mockResolvedValue();
    const res = await request.delete('/api/cashflows/cf1');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('404 when cashflow not found', async () => {
    const { NotFoundError } = require('../errors');
    mockDb.deleteCashflow.mockRejectedValue(new NotFoundError('Cashflow tidak ditemukan.'));
    const res = await request.delete('/api/cashflows/nonexistent');
    expect(res.status).toBe(404);
  });
});

// ─── ASSETS ───────────────────────────────────────────────────────────────────
describe('POST /api/assets', () => {
  test('creates asset with valid body', async () => {
    mockDb.addAsset.mockResolvedValue();
    const res = await request.post('/api/assets').send({
      id: 'ast1', name: 'BBCA', type: 'Stock', value: 5_000_000, cost: 4_000_000,
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('400 for invalid asset type', async () => {
    const res = await request.post('/api/assets').send({ name: 'X', type: 'Bonds' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('type');
  });

  test('400 for negative value', async () => {
    const res = await request.post('/api/assets').send({ name: 'X', type: 'Gold', value: -100 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/assets/:id', () => {
  test('404 when not found', async () => {
    const { NotFoundError } = require('../errors');
    mockDb.deleteAsset.mockRejectedValue(new NotFoundError('Asset tidak ditemukan.'));
    const res = await request.delete('/api/assets/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Asset');
  });
});

// ─── DEBTS ────────────────────────────────────────────────────────────────────
describe('POST /api/debts', () => {
  test('creates debt with valid body', async () => {
    mockDb.addDebt.mockResolvedValue();
    const res = await request.post('/api/debts').send({
      id: 'd1', name: 'KPR BCA', type: 'Long-term',
      total: 500_000_000, sisa: 480_000_000, bunga: 9.5, cicilan: 4_200_000,
    });
    expect(res.status).toBe(200);
  });

  test('400 for bunga > 100', async () => {
    const res = await request.post('/api/debts').send({ name: 'KPR', type: 'Long-term', bunga: 150 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('bunga');
  });

  test('400 for invalid debt type', async () => {
    const res = await request.post('/api/debts').send({ name: 'KPR', type: 'Mortgage' });
    expect(res.status).toBe(400);
  });
});

// ─── GOALS ────────────────────────────────────────────────────────────────────
describe('POST /api/goals', () => {
  test('creates goal with valid body', async () => {
    mockDb.addGoal.mockResolvedValue();
    const res = await request.post('/api/goals').send({
      id: 'g1', name: 'Dana Pensiun', target: 2_000_000_000, current: 50_000_000,
    });
    expect(res.status).toBe(200);
  });

  test('400 for target = 0', async () => {
    const res = await request.post('/api/goals').send({ name: 'Test', target: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('target');
  });

  test('400 for invalid deadline', async () => {
    const res = await request.post('/api/goals').send({ name: 'X', target: 1000, deadline: '12/2026' });
    expect(res.status).toBe(400);
  });
});

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
describe('GET /api/transactions', () => {
  test('returns paginated transactions', async () => {
    const result = { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    mockDb.getTransactions.mockResolvedValue(result);
    const res = await request.get('/api/transactions?page=1&limit=20');
    expect(res.status).toBe(200);
    expect(mockDb.getTransactions).toHaveBeenCalledWith('test-user-uuid', { page: 1, limit: 20 });
  });

  test('clamps limit to max 100', async () => {
    mockDb.getTransactions.mockResolvedValue({ items:[], total:0, page:1, limit:100, totalPages:0 });
    await request.get('/api/transactions?limit=9999');
    expect(mockDb.getTransactions).toHaveBeenCalledWith('test-user-uuid', { page: 1, limit: 100 });
  });
});

describe('POST /api/transactions', () => {
  test('creates transaction', async () => {
    mockDb.addTransaction.mockResolvedValue();
    const res = await request.post('/api/transactions').send({
      id: 't1', name: 'Makan siang', amount: -25000, date: '2025-03-15',
    });
    expect(res.status).toBe(200);
  });

  test('display-format date passes (date is a display string)', async () => {
    mockDb.addTransaction.mockResolvedValue();
    const res = await request.post('/api/transactions').send({ name: 'X', amount: 1000, date: '15 Mar 2025' });
    expect(res.status).toBe(200);
  });

  test('400 for invalid dateAdded format', async () => {
    const res = await request.post('/api/transactions').send({ name: 'X', amount: 1000, dateAdded: '15/03/2025' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('dateAdded');
  });
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
describe('PUT /api/settings', () => {
  test('updates settings with valid currency', async () => {
    mockDb.updateSettings.mockResolvedValue();
    const res = await request.put('/api/settings').send({ currency: 'USD' });
    expect(res.status).toBe(200);
  });

  test('400 for unsupported currency (EUR removed in v5.5)', async () => {
    const res = await request.put('/api/settings').send({ currency: 'EUR' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('currency');
  });
});

// ─── PAID DEBTS ───────────────────────────────────────────────────────────────
describe('PUT /api/paidDebts', () => {
  test('400 if body is not array', async () => {
    const res = await request.put('/api/paidDebts').send({ notAnArray: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('array');
  });

  test('accepts empty array', async () => {
    mockDb.setPaidDebts.mockResolvedValue();
    const res = await request.put('/api/paidDebts').send([]);
    expect(res.status).toBe(200);
  });
});

// ─── RESET ────────────────────────────────────────────────────────────────────
describe('POST /api/reset', () => {
  test('calls resetToDefault', async () => {
    mockDb.resetToDefault.mockResolvedValue();
    const res = await request.post('/api/reset').send({});
    expect(res.status).toBe(200);
    expect(mockDb.resetToDefault).toHaveBeenCalledWith('test-user-uuid');
  });

  test('500 on db error', async () => {
    mockDb.resetToDefault.mockRejectedValue(new Error('constraint'));
    const res = await request.post('/api/reset').send({});
    expect(res.status).toBe(500);
  });
});
