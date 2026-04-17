'use strict';
// routes/checkpoint.routes.js — single & multi checkpoint management

const router = require('express').Router();
const db     = require('../database');
const { routeHandler } = require('../errors');

// ─── SINGLE CHECKPOINT ────────────────────────────────────────────────────────
router.post('/save',    routeHandler(async (req, res) => { const cp = await db.saveCheckpoint(req.userId); res.json({ ok: true, savedAt: cp.savedAt }); }));
router.get ('/info',    routeHandler(async (req, res) => { res.json(await db.checkpointInfo(req.userId)); }));
router.post('/restore', routeHandler(async (req, res) => { await db.restoreCheckpoint(req.userId); res.json({ ok: true }); }));

// ─── MULTI CHECKPOINT ─────────────────────────────────────────────────────────
router.get   ('/',    routeHandler(async (req, res) => { res.json(await db.listCheckpoints(req.userId)); }));
router.post  ('/',    routeHandler(async (req, res) => {
  const label = (req.body.label || '').trim().slice(0, 60) || null;
  const cp = await db.createCheckpoint(req.userId, label);
  res.json({ ok: true, checkpoint: cp });
}));
router.post  ('/:id/restore', routeHandler(async (req, res) => { await db.restoreNamedCheckpoint(req.userId, req.params.id); res.json({ ok: true }); }));
router.delete('/:id',         routeHandler(async (req, res) => { await db.deleteCheckpoint(req.userId, req.params.id); res.json({ ok: true }); }));

module.exports = router;
