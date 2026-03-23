'use strict';
// routes/data.routes.js — v5.5: routeHandler, tidak ada try/catch manual

const router = require('express').Router();
const db     = require('../database');
const { routeHandler } = require('../errors');
const { validate, validateCashflow, validateAsset, validateDebt,
        validateGoal, validateTransaction, validateSettings } = require('../validators');

router.get('/state', routeHandler(async (req, res) => { res.json(await db.getState(req.userId)); }));

router.get   ('/cashflows',     routeHandler(async (req, res) => { res.json(await db.getCashflows(req.userId)); }));
router.post  ('/cashflows',     validate(validateCashflow), routeHandler(async (req, res) => { await db.addCashflow(req.userId, req.body); res.json({ ok: true }); }));
router.put   ('/cashflows/:id', validate(validateCashflow), routeHandler(async (req, res) => { await db.updateCashflow(req.userId, req.params.id, req.body); res.json({ ok: true }); }));
router.delete('/cashflows/:id', routeHandler(async (req, res) => { await db.deleteCashflow(req.userId, req.params.id); res.json({ ok: true }); }));

router.get   ('/assets',     routeHandler(async (req, res) => { res.json(await db.getAssets(req.userId)); }));
router.post  ('/assets',     validate(validateAsset), routeHandler(async (req, res) => { await db.addAsset(req.userId, req.body); res.json({ ok: true }); }));
router.put   ('/assets/:id', validate(validateAsset), routeHandler(async (req, res) => { await db.updateAsset(req.userId, req.params.id, req.body); res.json({ ok: true }); }));
router.delete('/assets/:id', routeHandler(async (req, res) => { await db.deleteAsset(req.userId, req.params.id); res.json({ ok: true }); }));

router.get   ('/debts',     routeHandler(async (req, res) => { res.json(await db.getDebts(req.userId)); }));
router.post  ('/debts',     validate(validateDebt), routeHandler(async (req, res) => { await db.addDebt(req.userId, req.body); res.json({ ok: true }); }));
router.put   ('/debts/:id', validate(validateDebt), routeHandler(async (req, res) => { await db.updateDebt(req.userId, req.params.id, req.body); res.json({ ok: true }); }));
router.delete('/debts/:id', routeHandler(async (req, res) => { await db.deleteDebt(req.userId, req.params.id); res.json({ ok: true }); }));

router.get   ('/goals',     routeHandler(async (req, res) => { res.json(await db.getGoals(req.userId)); }));
router.post  ('/goals',     validate(validateGoal), routeHandler(async (req, res) => { await db.addGoal(req.userId, req.body); res.json({ ok: true }); }));
router.put   ('/goals/:id', validate(validateGoal), routeHandler(async (req, res) => { await db.updateGoal(req.userId, req.params.id, req.body); res.json({ ok: true }); }));
router.delete('/goals/:id', routeHandler(async (req, res) => { await db.deleteGoal(req.userId, req.params.id); res.json({ ok: true }); }));

router.get('/transactions', routeHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  res.json(await db.getTransactions(req.userId, { page, limit }));
}));
router.post  ('/transactions',     validate(validateTransaction), routeHandler(async (req, res) => { await db.addTransaction(req.userId, req.body); res.json({ ok: true }); }));
router.put   ('/transactions/:id', validate(validateTransaction), routeHandler(async (req, res) => { await db.updateTransaction(req.userId, req.params.id, req.body); res.json({ ok: true }); }));
router.delete('/transactions/:id', routeHandler(async (req, res) => { await db.deleteTransaction(req.userId, req.params.id); res.json({ ok: true }); }));

router.get('/settings', routeHandler(async (req, res) => { res.json(await db.getSettings(req.userId)); }));
router.put ('/settings', validate(validateSettings), routeHandler(async (req, res) => { await db.updateSettings(req.userId, req.body); res.json({ ok: true }); }));

router.put('/paidDebts', routeHandler(async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Body harus array' });
  await db.setPaidDebts(req.userId, req.body);
  res.json({ ok: true });
}));

router.post('/reset', routeHandler(async (req, res) => {
  await db.resetToDefault(req.userId);
  res.json({ ok: true });
}));

module.exports = router;
