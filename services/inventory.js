// services/inventory.js
const config = require('../config');
const { inventoryCache } = require('../db');

const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

const CONTRACT_META = {
  [config.contracts.weapons]:   { name: 'TAKEOVER Weapons',   types: ['weapon_skin'] },
  [config.contracts.armor]:     { name: 'TAKEOVER Armor',     types: ['armor_set', 'helmet', 'gloves', 'backpack', 'shoulder_plate'] },
  [config.contracts.faction]:   { name: 'TAKEOVER Faction',   types: ['faction_banner', 'faction_patch', 'dogtag'] },
  [config.contracts.effects]:   { name: 'TAKEOVER Effects',   types: ['emote_effect', 'tracer_color', 'kill_marker', 'chest_core', 'muzzle_flash'] },
  [config.contracts.vehicles]:  { name: 'TAKEOVER Vehicles',  types: ['vehicle_livery'] },
  [config.contracts.cosmetics]: { name: 'TAKEOVER Cosmetics', types: ['weapon_charm'] },
};

const ALL_CONTRACT_ADDRESSES = Object.keys(CONTRACT_META).map(a => a.toLowerCase());

function resolveIPFS(uri) {
  if (!uri) return null;
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  if (uri.startsWith('ar://')) return `https://arweave.net/${uri.slice(5)}`;
  return uri;
}

async function scanInventory(address) {
  const addr = address.toLowerCase();

  // Check cache first
  const cached = inventoryCache.get(addr);
  if (cached) return { ...cached, cached: true };

  // Query Glacier API for all ERC-721 tokens
  const url = `${config.avax.glacierUrl}/v1/chains/${config.avax.chainId}/addresses/${addr}/balances:listErc721`;

  let glacierData;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Glacier API returned ${res.status}`);
    glacierData = await res.json();
  } catch (err) {
    // If Glacier fails, return empty inventory (don't crash)
    console.error(`[inventory] Glacier API error for ${addr}:`, err.message);
    return {
      address: addr,
      total: 0,
      nfts: [],
      contracts_scanned: [],
      errors: [{ error: err.message }],
      cached: false,
    };
  }

  // Filter to TAKEOVER contracts only
  const tokens = (glacierData.erc721TokenBalances || []).filter(t =>
    ALL_CONTRACT_ADDRESSES.includes(t.address?.toLowerCase())
  );

  const nfts = [];
  const contractsScanned = {};

  for (const token of tokens) {
    const contractAddr = token.address.toLowerCase();
    const meta = CONTRACT_META[contractAddr] || CONTRACT_META[token.address];
    if (!meta) continue;

    // Track contracts scanned
    if (!contractsScanned[contractAddr]) {
      contractsScanned[contractAddr] = { name: meta.name, address: contractAddr, found: 0 };
    }
    contractsScanned[contractAddr].found++;

    // Parse metadata
    const md = token.metadata || {};
    const nft = {
      contract_address: contractAddr,
      contract_name: meta.name,
      token_id: token.tokenId || token.token_id,
      name: md.name || `${meta.name} #${token.tokenId}`,
      asset_type: md.asset_type || meta.types[0] || 'unknown',
      rarity: md.rarity || 'common',
      compatible_slots: md.compatible_slots || meta.types,
      texture_url: resolveIPFS(md.overlay_uri || md.texture_uri || md.image),
      model_url: resolveIPFS(md.model_uri),
      image: resolveIPFS(md.image),
      attributes: md.attributes || [],
    };

    nfts.push(nft);
  }

  // Sort by rarity (highest first)
  nfts.sort((a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0));

  const result = {
    address: addr,
    total: nfts.length,
    nfts,
    contracts_scanned: Object.values(contractsScanned),
    cached: false,
    scanned_at: new Date().toISOString(),
  };

  // Cache the result
  inventoryCache.set(addr, result);

  return result;
}

module.exports = { scanInventory, RARITY_ORDER };
