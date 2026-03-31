// db/index.js
// Lightweight data layer using JSON file persistence.
// Swap to PostgreSQL for production — the service layer API stays the same.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

// Load or initialize
let store = { sessions: {}, inventoryCache: {}, episodes: {}, events: [] };
try {
  if (fs.existsSync(DB_PATH)) {
    store = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  }
} catch (e) { /* start fresh */ }

function save() {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2)); } catch (e) { /* non-fatal */ }
}

const now = () => Math.floor(Date.now() / 1000);

// ---- SESSIONS ----
const sessions = {
  create: { run: (token, address, expiresAt) => {
    store.sessions[token] = { token, address, created_at: now(), expires_at: expiresAt, last_used: now() };
    save();
  }},
  get: { get: (token) => {
    const s = store.sessions[token];
    if (!s || s.expires_at < now()) return undefined;
    return s;
  }},
  touch: { run: (token) => {
    if (store.sessions[token]) { store.sessions[token].last_used = now(); save(); }
  }},
  deleteExpired: { run: () => {
    const t = now();
    for (const k of Object.keys(store.sessions)) {
      if (store.sessions[k].expires_at < t) delete store.sessions[k];
    }
    save();
  }},
};

// ---- INVENTORY CACHE ----
const INVENTORY_CACHE_TTL = 300;
const inventoryCache = {
  get: (address) => {
    const entry = store.inventoryCache[address.toLowerCase()];
    if (!entry || (now() - entry.cached_at) > INVENTORY_CACHE_TTL) return null;
    return entry.data;
  },
  set: (address, data) => {
    store.inventoryCache[address.toLowerCase()] = { data, cached_at: now() };
    save();
  },
  invalidate: (address) => {
    delete store.inventoryCache[address.toLowerCase()];
    save();
  },
};

// ---- EPISODES ----
const episodes = {
  getAll: { all: () => Object.values(store.episodes).map(({ manifest, ...rest }) => rest).sort((a,b) => (a.season*100+a.episode_number) - (b.season*100+b.episode_number)) },
  getById: { get: (id) => store.episodes[id] || null },
  upsert: { run: (id, title, season, epNum, duration, videoUrl, thumbUrl, manifest) => {
    store.episodes[id] = { id, title, season, episode_number: epNum, duration_seconds: duration, video_url: videoUrl, thumbnail_url: thumbUrl, manifest, updated_at: now() };
    save();
  }},
};

// ---- ANALYTICS ----
const analytics = {
  track: { run: (eventType, address, episodeId, slotId, nftTokenId, metadata) => {
    store.events.push({ event_type: eventType, address, episode_id: episodeId, slot_id: slotId, nft_token_id: nftTokenId, metadata, created_at: now() });
    if (store.events.length > 10000) store.events = store.events.slice(-5000);
    save();
  }},
  getEpisodeViews: { get: (epId) => {
    const evts = store.events.filter(e => e.event_type === 'episode_view' && e.episode_id === epId);
    return { views: evts.length, unique_viewers: new Set(evts.map(e => e.address).filter(Boolean)).size };
  }},
  getSlotImpressions: { all: (epId) => {
    const evts = store.events.filter(e => e.event_type === 'slot_impression' && e.episode_id === epId);
    const grouped = {};
    for (const e of evts) {
      const k = `${e.slot_id}|${e.nft_token_id}`;
      if (!grouped[k]) grouped[k] = { slot_id: e.slot_id, nft_token_id: e.nft_token_id, impressions: 0 };
      grouped[k].impressions++;
    }
    return Object.values(grouped).sort((a,b) => b.impressions - a.impressions);
  }},
};

// ---- SEED DEFAULT EPISODE ----
if (!store.episodes['ep-puf-first-strike']) {
  let manifest = '{}';
  try {
    const mp = path.join(__dirname, '..', '..', 'takeover-lore', 'packages', 'manifest', 'examples', 'puf-first-strike.json');
    manifest = fs.readFileSync(mp, 'utf-8');
  } catch (e) { /* ok */ }
  episodes.upsert.run('ep-puf-first-strike', 'PUF: First Strike', 1, 1, 88,
    'https://cdn.playtakeover.com/lore/s01/ep01/base-render.mp4',
    'https://cdn.playtakeover.com/lore/s01/ep01/thumb.jpg', manifest);
}

sessions.deleteExpired.run();

module.exports = { sessions, inventoryCache, episodes, analytics };
