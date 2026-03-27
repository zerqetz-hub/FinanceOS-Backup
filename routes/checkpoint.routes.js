'use strict';
// routes/checkpoint.routes.js — single & multi checkpoint management

const router = require('express').Router();
const db     = require('../database');

const e500 = (res, e) => res.status(e.status || 500).json({ error: e.message });

// ─── SINGLE CHECKPOINT ────────────────────────────────────────────────────────
router.post('/save',    async (req, res) => { try { const cp = await db.saveCheckpoint(req.userId); res.json({ ok: true, savedAt: cp.savedAt }); } catch (e) { e500(res, e); } });
router.get ('/info',    async (req, res) => { try { res.json(await db.checkpointInfo(req.userId)); } catch (e) { e500(res, e); } });
router.post('/restore', async (req, res) => { try { await db.restoreCheckpoint(req.userId); res.json({ ok: true }); } catch (e) { res.status(404).json({ error: e.message }); } });

// ─── MULTI CHECKPOINT ─────────────────────────────────────────────────────────
router.get   ('/',         async (req, res) => { try { res.json(await db.listCheckpoints(req.userId)); } catch (e) { e500(res, e); } });
router.post  ('/',         async (req, res) => {
  const label = (req.body.label || '').trim().slice(0, 60) || null;
  try { const cp = await db.createCheckpoint(req.userId, label); res.json({ ok: true, checkpoint: cp }); } catch (e) { e500(res, e); }
});
router.post  ('/:id/restore', async (req, res) => { try { await db.restoreNamedCheckpoint(req.userId, req.params.id); res.json({ ok: true }); } catch (e) { res.status(404).json({ error: e.message }); } });
router.delete('/:id',         async (req, res) => { try { await db.deleteCheckpoint(req.userId, req.params.id); res.json({ ok: true }); } catch (e) { e500(res, e); } });

module.exports = router;
