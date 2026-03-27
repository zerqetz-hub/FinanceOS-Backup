'use strict';

/**
 * validators.js — Input validation untuk KepingUang.
 *
 * v5.5: validatePassword DIHAPUS dari sini — satu-satunya sumber kebenaran
 * ada di auth.js (validatePasswordRules). Import dari sana jika perlu.
 * Ini menghindari drift di mana perubahan aturan hanya diterapkan di satu file.
 */

const ok  = { valid: true };
const err = msg => ({ valid: false, message: msg });

const isStr   = v => typeof v === 'string' && v.trim().length > 0;
const isNum   = v => typeof v === 'number' && Number.isFinite(v);
const isObj   = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isArr   = v => Array.isArray(v);
const isYM    = v => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const isEmail = v => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const MAX_AMOUNT = 1e13;
const MAX_STR    = 200;

const ASSET_TYPES = new Set(['Stock','Crypto','Property','Gold','MutualFund','Cash','Bond','Other']);
const DEBT_TYPES  = new Set(['Long-term','Short-term','Installment','Credit','Other']);

function validateCashflow(body) {
  if (body.month !== undefined && !isYM(body.month))
    return err('month harus format YYYY-MM (contoh: 2025-03)');
  if (body.income !== undefined) {
    if (!isNum(body.income) || body.income < 0) return err('income harus angka ≥ 0');
    if (body.income > MAX_AMOUNT)               return err('income melebihi batas maksimum');
  }
  if (body.expenses !== undefined) {
    if (!isObj(body.expenses)) return err('expenses harus berupa object');
    for (const [cat, val] of Object.entries(body.expenses)) {
      if (typeof cat !== 'string' || cat.length > 50) return err('nama kategori expenses tidak valid');
      if (!isNum(val) || val < 0)  return err(`expenses["${cat}"] harus angka ≥ 0`);
      if (val > MAX_AMOUNT)        return err(`expenses["${cat}"] melebihi batas maksimum`);
    }
  }
  if (body.incomeBreakdown !== undefined) {
    if (!isObj(body.incomeBreakdown)) return err('incomeBreakdown harus berupa object');
    for (const [src, val] of Object.entries(body.incomeBreakdown)) {
      if (typeof src !== 'string' || src.length > 50) return err('nama sumber incomeBreakdown tidak valid');
      if (!isNum(val) || val < 0)  return err(`incomeBreakdown["${src}"] harus angka ≥ 0`);
      if (val > MAX_AMOUNT)        return err(`incomeBreakdown["${src}"] melebihi batas maksimum`);
    }
  }
  return ok;
}

function validateAsset(body) {
  if (body.name !== undefined) {
    if (!isStr(body.name))          return err('name wajib diisi');
    if (body.name.length > MAX_STR) return err(`name maksimal ${MAX_STR} karakter`);
  }
  if (body.type !== undefined && !ASSET_TYPES.has(body.type))
    return err(`type tidak valid. Pilihan: ${[...ASSET_TYPES].join(', ')}`);
  for (const field of ['value','cost']) {
    if (body[field] !== undefined) {
      if (!isNum(body[field]) || body[field] < 0) return err(`${field} harus angka ≥ 0`);
      if (body[field] > MAX_AMOUNT)               return err(`${field} melebihi batas maksimum`);
    }
  }
  if (body.priceHistory !== undefined && !isArr(body.priceHistory))
    return err('priceHistory harus array');
  return ok;
}

function validateDebt(body) {
  if (body.name !== undefined) {
    if (!isStr(body.name))          return err('name wajib diisi');
    if (body.name.length > MAX_STR) return err(`name maksimal ${MAX_STR} karakter`);
  }
  if (body.type !== undefined && !DEBT_TYPES.has(body.type))
    return err(`type tidak valid. Pilihan: ${[...DEBT_TYPES].join(', ')}`);
  for (const [field, min] of [['total',0],['sisa',0],['bunga',0],['cicilan',0]]) {
    if (body[field] !== undefined) {
      if (!isNum(body[field]) || body[field] < min) return err(`${field} harus angka ≥ ${min}`);
      if (body[field] > MAX_AMOUNT)                 return err(`${field} melebihi batas maksimum`);
    }
  }
  if (body.bunga !== undefined && body.bunga > 100)
    return err('bunga tidak boleh lebih dari 100%');
  if (body.balanceHistory !== undefined && !isArr(body.balanceHistory))
    return err('balanceHistory harus array');
  return ok;
}

function validateGoal(body) {
  if (body.name !== undefined) {
    if (!isStr(body.name))          return err('name wajib diisi');
    if (body.name.length > MAX_STR) return err(`name maksimal ${MAX_STR} karakter`);
  }
  if (body.target !== undefined) {
    if (!isNum(body.target) || body.target <= 0) return err('target harus angka > 0');
    if (body.target > MAX_AMOUNT)                return err('target melebihi batas maksimum');
  }
  if (body.current !== undefined) {
    if (!isNum(body.current) || body.current < 0) return err('current harus angka ≥ 0');
    if (body.current > MAX_AMOUNT)                return err('current melebihi batas maksimum');
  }
  if (body.deadline !== undefined && body.deadline !== '' && !isYM(body.deadline))
    return err('deadline harus format YYYY-MM (contoh: 2026-12)');
  if (body.color !== undefined && typeof body.color === 'string') {
    if (!/^#[0-9a-fA-F]{6}$/.test(body.color))
      return err('color harus format hex 6 digit (contoh: #1a6b4a)');
  }
  return ok;
}

function validateTransaction(body) {
  if (body.name !== undefined) {
    if (!isStr(body.name))          return err('name wajib diisi');
    if (body.name.length > MAX_STR) return err(`name maksimal ${MAX_STR} karakter`);
  }
  if (body.amount !== undefined) {
    if (!isNum(body.amount))                return err('amount harus angka');
    if (Math.abs(body.amount) > MAX_AMOUNT) return err('amount melebihi batas maksimum');
  }
  if (body.dateAdded !== undefined && body.dateAdded !== '') {
    if (typeof body.dateAdded !== 'string' ||
        !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(body.dateAdded))
      return err('dateAdded harus format YYYY-MM-DD (contoh: 2025-03-15)');
  }
  if (body.catName !== undefined && typeof body.catName === 'string' && body.catName.length > 50)
    return err('catName terlalu panjang');
  return ok;
}

function validateSettings(body) {
  const VALID_CURRENCIES = ['IDR', 'USD'];   // v5.5: hanya IDR dan USD
  if (body.currency !== undefined) {
    if (!isStr(body.currency)) return err('currency harus string');
    if (!VALID_CURRENCIES.includes(body.currency.toUpperCase()))
      return err(`currency tidak didukung. Pilihan: ${VALID_CURRENCIES.join(', ')}`);
  }
  if (body.categories !== undefined) {
    if (!isObj(body.categories)) return err('categories harus object');
    for (const type of ['income','expense']) {
      if (body.categories[type] !== undefined) {
        if (!isArr(body.categories[type])) return err(`categories.${type} harus array`);
        for (const cat of body.categories[type]) {
          if (typeof cat !== 'string' || cat.length > 50)
            return err(`Nama kategori tidak valid di categories.${type}`);
        }
      }
    }
  }
  if (body.budgets !== undefined) {
    if (!isObj(body.budgets)) return err('budgets harus object');
    for (const [k, v] of Object.entries(body.budgets)) {
      if (typeof k !== 'string' || k.length > 50) return err('nama kategori budget tidak valid');
      if (!isNum(v) || v < 0)    return err(`budgets["${k}"] harus angka ≥ 0`);
      if (v > MAX_AMOUNT)        return err(`budgets["${k}"] melebihi batas maksimum`);
    }
  }
  return ok;
}

/**
 * Validasi body POST /api/auth/register.
 * Password rules diambil dari auth.js untuk menghindari duplikasi.
 */
function validateRegister(body) {
  if (!isEmail(body.email))     return err('Email tidak valid.');
  if (body.email.length > 254)  return err('Email terlalu panjang.');

  // Delegasi ke auth.js agar ada single source of truth
  const { validatePasswordRules } = require('./auth');
  const pwErr = validatePasswordRules(body.password);
  if (pwErr) return err(pwErr);

  if (body.username !== undefined && typeof body.username === 'string') {
    if (body.username.trim().length > 40) return err('Username maksimal 40 karakter.');
  }
  return ok;
}

/** Express middleware factory — validates req.body dengan fn, returns 400 jika invalid. */
function validate(fn) {
  return (req, res, next) => {
    const result = fn(req.body);
    if (!result.valid) return res.status(400).json({ error: result.message });
    next();
  };
}

module.exports = {
  validateCashflow,
  validateAsset,
  validateDebt,
  validateGoal,
  validateTransaction,
  validateSettings,
  validateRegister,
  validate,
};
