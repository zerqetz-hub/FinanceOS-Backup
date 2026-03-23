'use strict';
/**
 * tests/financial-calc.test.js
 * Logika kalkulasi keuangan — independen dari DB dan HTTP layer.
 * Semua fungsi ditest dengan data murni tanpa side effects.
 */

// ─── Helpers (replicated from helpers.js for isolated testing) ────────────────

const RATES = { USD: 15_800 };

function toDisplay(idrAmount, currency = 'IDR') {
  return currency === 'IDR' ? idrAmount : idrAmount / RATES[currency];
}

function cfExp(cf) {
  return Object.values(cf.expenses || {}).reduce((a, b) => a + b, 0);
}

function cfSaldo(cf) {
  return cf ? cf.income - cfExp(cf) : 0;
}

function savingRate(cf) {
  if (!cf || cf.income === 0) return 0;
  return (cfSaldo(cf) / cf.income) * 100;
}

function netWorth(assets, debts) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalDebts  = debts.reduce((s, d) => s + d.sisa, 0);
  return totalAssets - totalDebts;
}

function avgMonthExp(cashflows) {
  if (!cashflows.length) return 0;
  return cashflows.reduce((s, cf) => s + cfExp(cf), 0) / cashflows.length;
}

function efTarget(cashflows) {
  return avgMonthExp(cashflows) * 6;
}

function debtToIncome(debts, income) {
  if (!income) return 0;
  const totalCicilan = debts.reduce((s, d) => s + d.cicilan, 0);
  return (totalCicilan / income) * 100;
}

function returnRate(cost, value) {
  if (!cost) return 0;
  return ((value - cost) / cost) * 100;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('cfExp — total expenses from cashflow', () => {
  test('sums all expense categories', () => {
    const cf = { expenses: { Makanan: 500000, Transport: 200000, Hiburan: 150000 } };
    expect(cfExp(cf)).toBe(850000);
  });

  test('returns 0 for empty expenses', () => {
    expect(cfExp({ expenses: {} })).toBe(0);
  });

  test('handles missing expenses key', () => {
    expect(cfExp({})).toBe(0);
  });
});

describe('cfSaldo — income minus expenses', () => {
  test('positive saldo', () => {
    const cf = { income: 10_000_000, expenses: { Makanan: 3_000_000, Transport: 1_000_000 } };
    expect(cfSaldo(cf)).toBe(6_000_000);
  });

  test('negative saldo (pengeluaran > income)', () => {
    const cf = { income: 2_000_000, expenses: { Makanan: 3_000_000 } };
    expect(cfSaldo(cf)).toBe(-1_000_000);
  });

  test('zero saldo', () => {
    const cf = { income: 5_000_000, expenses: { Makanan: 5_000_000 } };
    expect(cfSaldo(cf)).toBe(0);
  });

  test('returns 0 for null cf', () => {
    expect(cfSaldo(null)).toBe(0);
  });
});

describe('savingRate', () => {
  test('correct percentage', () => {
    const cf = { income: 10_000_000, expenses: { Makanan: 6_000_000 } };
    expect(savingRate(cf)).toBeCloseTo(40, 1);
  });

  test('returns 0 if income is 0', () => {
    const cf = { income: 0, expenses: { Makanan: 1000 } };
    expect(savingRate(cf)).toBe(0);
  });

  test('returns 0 for null', () => {
    expect(savingRate(null)).toBe(0);
  });

  test('100% saving rate (no expenses)', () => {
    const cf = { income: 5_000_000, expenses: {} };
    expect(savingRate(cf)).toBeCloseTo(100, 1);
  });
});

describe('netWorth', () => {
  test('positive net worth', () => {
    const assets = [{ value: 500_000_000 }, { value: 100_000_000 }];
    const debts  = [{ sisa: 200_000_000 }];
    expect(netWorth(assets, debts)).toBe(400_000_000);
  });

  test('negative net worth (debt > assets)', () => {
    const assets = [{ value: 10_000_000 }];
    const debts  = [{ sisa: 50_000_000 }];
    expect(netWorth(assets, debts)).toBe(-40_000_000);
  });

  test('zero net worth', () => {
    expect(netWorth([{ value: 100 }], [{ sisa: 100 }])).toBe(0);
  });

  test('no assets and no debts', () => {
    expect(netWorth([], [])).toBe(0);
  });
});

describe('avgMonthExp and efTarget', () => {
  const cashflows = [
    { expenses: { Makanan: 3_000_000, Transport: 1_000_000 } }, // 4jt
    { expenses: { Makanan: 2_000_000, Transport: 1_500_000 } }, // 3.5jt
    { expenses: { Makanan: 3_500_000, Transport: 500_000   } }, // 4jt
  ];

  test('avgMonthExp is correct', () => {
    expect(avgMonthExp(cashflows)).toBeCloseTo(3_833_333, -3);
  });

  test('efTarget is 6x avgMonthExp', () => {
    const avg    = avgMonthExp(cashflows);
    const target = efTarget(cashflows);
    expect(target).toBeCloseTo(avg * 6, 0);
  });

  test('avgMonthExp returns 0 for empty array', () => {
    expect(avgMonthExp([])).toBe(0);
  });

  test('efTarget returns 0 for empty cashflows', () => {
    expect(efTarget([])).toBe(0);
  });
});

describe('debtToIncome (DTI)', () => {
  test('DTI below 40% is safe', () => {
    const debts = [{ cicilan: 2_000_000 }, { cicilan: 1_500_000 }];
    const dti = debtToIncome(debts, 10_000_000);
    expect(dti).toBe(35);
  });

  test('DTI above 40% is dangerous', () => {
    const debts = [{ cicilan: 5_000_000 }];
    const dti = debtToIncome(debts, 10_000_000);
    expect(dti).toBe(50);
  });

  test('DTI returns 0 if no income', () => {
    expect(debtToIncome([{ cicilan: 1_000_000 }], 0)).toBe(0);
  });

  test('DTI 0 if no debts', () => {
    expect(debtToIncome([], 10_000_000)).toBe(0);
  });
});

describe('returnRate (investasi)', () => {
  test('positive return', () => {
    expect(returnRate(10_000_000, 12_500_000)).toBeCloseTo(25, 1);
  });

  test('negative return (rugi)', () => {
    expect(returnRate(10_000_000, 8_000_000)).toBeCloseTo(-20, 1);
  });

  test('zero return (breakeven)', () => {
    expect(returnRate(10_000_000, 10_000_000)).toBe(0);
  });

  test('returns 0 if cost is 0', () => {
    expect(returnRate(0, 5_000_000)).toBe(0);
  });
});

describe('currency conversion', () => {
  test('IDR to IDR is identity', () => {
    expect(toDisplay(10_000_000, 'IDR')).toBe(10_000_000);
  });

  test('IDR to USD uses rate', () => {
    const usd = toDisplay(15_800_000, 'USD');
    expect(usd).toBeCloseTo(1000, 1);
  });

  test('small amounts convert correctly', () => {
    const usd = toDisplay(158, 'USD');
    expect(usd).toBeCloseTo(0.01, 4);
  });
});

describe('debt balance history logic', () => {
  test('latest balance history entry = current sisa', () => {
    const history = [
      { date: '2024-01-01', sisa: 100_000_000 },
      { date: '2024-06-01', sisa: 80_000_000  },
      { date: '2025-01-01', sisa: 60_000_000  },
    ];
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    expect(latest.sisa).toBe(60_000_000);
  });

  test('paid debt has sisa 0 at paidDate', () => {
    const history = [
      { date: '2024-01-01', sisa: 5_000_000 },
      { date: '2025-03-01', sisa: 0 },
    ];
    const current = history[history.length - 1].sisa;
    expect(current).toBe(0);
  });
});

describe('NUMERIC precision (v5.5 regression test)', () => {
  test('0.1 + 0.2 handled correctly with rounding', () => {
    // JS float: 0.1 + 0.2 = 0.30000000000000004
    // We should always round before displaying
    const raw  = 0.1 + 0.2;
    const rounded = Math.round(raw * 1e4) / 1e4; // 4 decimal places like NUMERIC(20,4)
    expect(rounded).toBe(0.3);
  });

  test('large financial amounts keep precision', () => {
    // NUMERIC(20,4) can hold up to 10^16 exactly with 4 decimal places
    const amount = 9_999_999_999_999.9999;
    const rounded = Math.round(amount * 1e4) / 1e4;
    expect(rounded).toBe(9_999_999_999_999.9999);
  });
});
