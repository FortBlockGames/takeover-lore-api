// routes/index.js
const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { verifyWallet } = require('../services/wallet');
const { scanInventory } = require('../services/inventory');
const { matchEpisode } = require('../services/matching');
const { episodes, analytics } = require('../db');

const router = express.Router();

// ---- HEALTH ----
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
  });
});

// ---- WALLET ----
router.post('/verify-wallet', async (req, res, next) => {
  try {
    const { address, message, signature } = req.body;
    if (!address || !message || !signature) {
      return res.status(400).json({ error: 'Missing address, message, or signature' });
    }
    const result = await verifyWallet(address, message, signature);
    res.json(result);
  } catch (err) { next(err); }
});

// ---- INVENTORY ----
router.get('/inventory/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    const result = await scanInventory(address);
    res.json(result);
  } catch (err) { next(err); }
});

// ---- MATCHING (main endpoint for UE5 + web) ----
router.get('/match/:address/:episodeId', async (req, res, next) => {
  try {
    const { address, episodeId } = req.params;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    const result = await matchEpisode(address, episodeId);
    res.json(result);
  } catch (err) { next(err); }
});

// ---- EPISODES ----
router.get('/episodes', (req, res) => {
  const rows = episodes.getAll.all();
  res.json({ episodes: rows });
});

router.get('/episodes/:id', (req, res) => {
  const row = episodes.getById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Episode not found' });

  // Return episode info without raw manifest (use /match for that)
  const { manifest, ...info } = row;
  res.json(info);
});

router.get('/manifest/:episodeId', (req, res) => {
  const row = episodes.getById.get(req.params.episodeId);
  if (!row) return res.status(404).json({ error: 'Episode not found' });

  try {
    res.json(JSON.parse(row.manifest));
  } catch (e) {
    res.status(500).json({ error: 'Invalid manifest data' });
  }
});

// ---- ANALYTICS ----
router.post('/analytics/event', optionalAuth, (req, res) => {
  try {
    const { event_type, episode_id, slot_id, nft_token_id, metadata } = req.body;
    if (!event_type) return res.status(400).json({ error: 'Missing event_type' });

    analytics.track.run(
      event_type,
      req.walletAddress || null,
      episode_id || null,
      slot_id || null,
      nft_token_id || null,
      metadata ? JSON.stringify(metadata) : null
    );
    res.json({ tracked: true });
  } catch (err) {
    // Analytics failures should not return errors to clients
    res.json({ tracked: false });
  }
});

router.get('/analytics/episode/:episodeId', requireAuth, (req, res) => {
  const views = analytics.getEpisodeViews.get(req.params.episodeId);
  const impressions = analytics.getSlotImpressions.all(req.params.episodeId);
  res.json({ episode_id: req.params.episodeId, ...views, slot_impressions: impressions });
});

module.exports = router;
