// services/matching.js
const config = require('../config');
const { episodes, analytics } = require('../db');
const { scanInventory, RARITY_ORDER } = require('./inventory');

// Mintable NFTs for unmatched slots — in production, read from a DB table
const MINTABLE_REGISTRY = {
  faction_banner: { name: 'Iron Vanguard Banner', price: '2.5 AVAX', supply: '47/500', mint_url: `${config.cdn.baseUrl}/mint/banner` },
  faction_patch:  { name: 'Wolves of War Poster', price: '0.8 AVAX', supply: '182/1000', mint_url: `${config.cdn.baseUrl}/mint/poster` },
  faction_poster: { name: 'Wolves of War Poster', price: '0.8 AVAX', supply: '182/1000', mint_url: `${config.cdn.baseUrl}/mint/poster` },
  end_card_logo:  { name: 'PUF Loyalist Emblem', price: '1.2 AVAX', supply: '93/500', mint_url: `${config.cdn.baseUrl}/mint/emblem` },
};

async function matchEpisode(address, episodeId) {
  // 1. Get episode manifest
  const epRow = episodes.getById.get(episodeId);
  if (!epRow) {
    throw Object.assign(new Error('Episode not found'), { status: 404 });
  }

  let manifest;
  try {
    manifest = JSON.parse(epRow.manifest);
  } catch (e) {
    throw Object.assign(new Error('Invalid manifest data'), { status: 500 });
  }

  // 2. Get NFT inventory
  const inventory = await scanInventory(address);

  // Build lookup: nft_category -> sorted NFT array
  const nftByType = {};
  for (const nft of inventory.nfts) {
    const types = nft.compatible_slots || [nft.asset_type];
    for (const type of types) {
      if (!nftByType[type]) nftByType[type] = [];
      nftByType[type].push(nft);
    }
  }

  // 3. Match each slot
  const slotTypes = manifest.slot_types || {};
  const resolution = manifest.global_settings?.preference_resolution || 'highest_rarity';
  const slots = (manifest.slots || []).map(slot => {
    const typeDef = slotTypes[slot.slot_type];
    const nftCategory = typeDef?.nft_category || slot.slot_type;

    // Find candidates
    const candidates = (nftByType[nftCategory] || nftByType[slot.slot_type] || [])
      .sort((a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0));

    const matched = candidates.length > 0;
    const chosen = matched ? candidates[0] : null;

    const result = {
      slot_id: slot.slot_id,
      slot_type: slot.slot_type,
      time_in: slot.time_in,
      time_out: slot.time_out,
      priority: slot.priority || 'standard',
      render_mode: slot.render_mode || 'client_overlay',
      scene_label: slot.scene_label || '',
      matched,
      nft: chosen ? {
        token_id: chosen.token_id,
        name: chosen.name,
        rarity: chosen.rarity,
      } : null,
      texture_url: chosen?.texture_url || null,
      fallback_texture_url: typeDef?.fallback_asset_uri || null,
      position: slot.position || null,
      animation: slot.animation || null,
      lighting: slot.lighting_context || null,
    };

    // Add mintable info for unmatched slots
    if (!matched) {
      result.mintable = MINTABLE_REGISTRY[nftCategory] || MINTABLE_REGISTRY[slot.slot_type] || null;
    }

    return result;
  });

  // 4. Collect preload URLs
  const preloadUrls = slots.filter(s => s.texture_url).map(s => s.texture_url);
  const matchedCount = slots.filter(s => s.matched).length;

  // 5. Track analytics
  try {
    analytics.track.run('episode_match', address.toLowerCase(), episodeId, null, null,
      JSON.stringify({ matched: matchedCount, total: slots.length }));
  } catch (e) { /* analytics failure shouldn't break the response */ }

  return {
    episode_id: episodeId,
    episode_title: epRow.title,
    video_url: epRow.video_url || `${config.cdn.baseUrl}/lore/s${String(epRow.season).padStart(2,'0')}e${String(epRow.episode_number).padStart(2,'0')}/base-render.mp4`,
    address: address.toLowerCase(),
    total_slots: slots.length,
    matched_slots: matchedCount,
    personalization_rate: slots.length > 0 ? Math.round((matchedCount / slots.length) * 100) : 0,
    slots,
    preload_urls: preloadUrls,
  };
}

module.exports = { matchEpisode };
