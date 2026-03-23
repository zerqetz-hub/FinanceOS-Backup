'use strict';
/**
 * tests/validators.test.js
 * Unit tests untuk semua validator di validators.js
 */

const {
  validateCashflow,
  validateAsset,
  validateDebt,
  validateGoal,
  validateTransaction,
  validateSettings,
} = require('../validators');

// ─── Helper ───────────────────────────────────────────────────────────────────
const ok  = r => expect(r.valid).toBe(true);
const bad = (r, substr) => {
  expect(r.valid).toBe(false);
  if (substr) expect(r.message).toContain(substr);
};

// ─── validateCashflow ─────────────────────────────────────────────────────────
describe('validateCashflow', () => {
  test('empty body passes (partial update)', () => ok(validateCashflow({})));

  test('valid month format', () => ok(validateCashflow({ month: '2025-03' })));
  test('invalid month — wrong format', () => bad(validateCashflow({ month: '2025-3' }), 'month'));
  test('invalid month — month 13', () => bad(validateCashflow({ month: '2025-13' }), 'month'));

  test('valid income 0', () => ok(validateCashflow({ income: 0 })));
  test('valid income positive', () => ok(validateCashflow({ income: 5_000_000 })));
  test('invalid income negative', () => bad(validateCashflow({ income: -1 }), 'income'));
  test('invalid income non-finite', () => bad(validateCashflow({ income: Infinity }), 'income'));
  test('income over limit', () => bad(validateCashflow({ income: 2e13 }), 'maksimum'));

  test('valid expenses object', () => ok(validateCashflow({ expenses: { Makanan: 500000, Transport: 200000 } })));
  test('invalid expenses — not object', () => bad(validateCashflow({ expenses: [1,2,3] }), 'expenses'));
  test('invalid expenses — negative value', () => bad(validateCashflow({ expenses: { Makanan: -500 } }), 'Makanan'));
  test('invalid expenses — category name too long', () => {
    bad(validateCashflow({ expenses: { ['X'.repeat(51)]: 0 } }), 'kategori');
  });

  test('invalid incomeBreakdown — must be object', () => bad(validateCashflow({ incomeBreakdown: 'string' }), 'incomeBreakdown'));
  test('valid incomeBreakdown', () => ok(validateCashflow({ incomeBreakdown: { Gaji: 10_000_000 } })));
});

// ─── validateAsset ────────────────────────────────────────────────────────────
describe('validateAsset', () => {
  test('empty body passes', () => ok(validateAsset({})));

  test('valid name', () => ok(validateAsset({ name: 'BBCA' })));
  test('invalid name — empty string', () => bad(validateAsset({ name: '' }), 'name'));
  test('invalid name — too long', () => bad(validateAsset({ name: 'X'.repeat(201) }), 'name'));

  test('valid type Stock', () => ok(validateAsset({ type: 'Stock' })));
  test('valid type Cash', () => ok(validateAsset({ type: 'Cash' })));
  test('valid type Other', () => ok(validateAsset({ type: 'Other' })));
  test('invalid type', () => bad(validateAsset({ type: 'Crypto123' }), 'type'));

  test('valid value 0', () => ok(validateAsset({ value: 0 })));
  test('invalid value negative', () => bad(validateAsset({ value: -1 }), 'value'));
  test('invalid cost NaN', () => bad(validateAsset({ cost: NaN }), 'cost'));

  test('valid priceHistory array', () => ok(validateAsset({ priceHistory: [{ date: '2025-01', price: 100 }] })));
  test('invalid priceHistory not array', () => bad(validateAsset({ priceHistory: 'abc' }), 'priceHistory'));
});

// ─── validateDebt ─────────────────────────────────────────────────────────────
describe('validateDebt', () => {
  test('empty body passes', () => ok(validateDebt({})));

  test('valid Long-term type', () => ok(validateDebt({ type: 'Long-term' })));
  test('valid Credit type', () => ok(validateDebt({ type: 'Credit' })));
  test('valid Other type', () => ok(validateDebt({ type: 'Other' })));
  test('invalid type', () => bad(validateDebt({ type: 'Mortgage' }), 'type'));

  test('bunga 0 valid', () => ok(validateDebt({ bunga: 0 })));
  test('bunga 100 valid (edge)', () => ok(validateDebt({ bunga: 100 })));
  test('bunga 101 invalid', () => bad(validateDebt({ bunga: 101 }), 'bunga'));
  test('bunga negative invalid', () => bad(validateDebt({ bunga: -1 }), 'bunga'));

  test('sisa 0 valid', () => ok(validateDebt({ sisa: 0 })));
  test('total over limit', () => bad(validateDebt({ total: 2e13 }), 'maksimum'));

  test('valid balanceHistory', () => ok(validateDebt({ balanceHistory: [] })));
  test('invalid balanceHistory', () => bad(validateDebt({ balanceHistory: 'yes' }), 'balanceHistory'));
});

// ─── validateGoal ─────────────────────────────────────────────────────────────
describe('validateGoal', () => {
  test('empty body passes', () => ok(validateGoal({})));

  test('valid target', () => ok(validateGoal({ target: 1_000_000 })));
  test('target 0 invalid (must be > 0)', () => bad(validateGoal({ target: 0 }), 'target'));
  test('target negative invalid', () => bad(validateGoal({ target: -100 }), 'target'));

  test('current 0 valid', () => ok(validateGoal({ current: 0 })));
  test('current negative invalid', () => bad(validateGoal({ current: -1 }), 'current'));

  test('valid deadline YYYY-MM', () => ok(validateGoal({ deadline: '2026-12' })));
  test('empty deadline valid (optional)', () => ok(validateGoal({ deadline: '' })));
  test('invalid deadline format', () => bad(validateGoal({ deadline: '2026/12' }), 'deadline'));

  test('valid hex color', () => ok(validateGoal({ color: '#1a6b4a' })));
  test('invalid color — no hash', () => bad(validateGoal({ color: '1a6b4a' }), 'color'));
  test('invalid color — wrong length', () => bad(validateGoal({ color: '#1a6b' }), 'color'));
});

// ─── validateTransaction ──────────────────────────────────────────────────────
describe('validateTransaction', () => {
  test('empty body passes', () => ok(validateTransaction({})));

  test('valid positive amount', () => ok(validateTransaction({ amount: 50_000 })));
  test('valid negative amount (expense)', () => ok(validateTransaction({ amount: -50_000 })));
  test('invalid amount non-number', () => bad(validateTransaction({ amount: 'lima' }), 'amount'));

  test('valid date YYYY-MM-DD', () => ok(validateTransaction({ date: '2025-03-15' })));
  test('empty date valid (optional)', () => ok(validateTransaction({ date: '' })));
  test('invalid date format', () => bad(validateTransaction({ date: '15-03-2025' }), 'date'));
  test('invalid date — month 13', () => bad(validateTransaction({ date: '2025-13-01' }), 'date'));

  test('catName too long', () => bad(validateTransaction({ catName: 'X'.repeat(51) }), 'catName'));
  test('catName 50 chars valid', () => ok(validateTransaction({ catName: 'X'.repeat(50) })));
});

// ─── validateSettings ─────────────────────────────────────────────────────────
describe('validateSettings', () => {
  test('empty body passes', () => ok(validateSettings({})));

  test('IDR valid', () => ok(validateSettings({ currency: 'IDR' })));
  test('USD valid', () => ok(validateSettings({ currency: 'USD' })));
  test('EUR invalid (v5.5 only IDR/USD)', () => bad(validateSettings({ currency: 'EUR' }), 'currency'));
  test('currency not string', () => bad(validateSettings({ currency: 123 }), 'currency'));

  test('valid categories', () => ok(validateSettings({ categories: { income: ['Gaji'], expense: ['Makanan'] } })));
  test('categories income not array', () => bad(validateSettings({ categories: { income: 'Gaji' } }), 'income'));
  test('category name too long', () => bad(validateSettings({ categories: { income: ['X'.repeat(51)] } }), 'valid'));

  test('valid budgets', () => ok(validateSettings({ budgets: { Makanan: 3_500_000 } })));
  test('budget negative', () => bad(validateSettings({ budgets: { Makanan: -100 } }), 'angka'));
  test('budget key too long', () => bad(validateSettings({ budgets: { ['X'.repeat(51)]: 0 } }), 'kategori'));
});
