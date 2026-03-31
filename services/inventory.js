const { ethers } = require('ethers');
const config = require('../config');
const { inventoryCache } = require('../db');
const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const ASSET_TYPE_NAMES = ['weapon_skin','armor_set','helmet','shoulder_plate','faction_banner','faction_patch','chest_core','tracer_color','vehicle_livery','weapon_charm'];
const RARITY_NAMES = ['common','uncommon','rare','epic','legendary'];
const CONTRACT_ADDRESS = config.contracts.weapons;
const TOKEN_ABI = ['function tokenAssetType(uint256) view returns (uint8)','function tokenRarity(uint256) view returns (uint8)','function tokenURI(uint256) view returns (string)','function balanceOf(address) view returns (uint256)','function tokenOfOwnerByIndex(address, uint256) view returns (uint256)'];
const provider = new ethers.JsonRpcProvider(config.avax.rpcUrl);
function resolveIPFS(uri) { if (!uri) return null; if (uri.startsWith('ipfs://')) return 'https://ipfs.io/ipfs/' + uri.slice(7); return uri; }
async function scanInventory(address) {
  var addr = address.toLowerCase();
  var cached = inventoryCache.get(addr);
  if (cached) return Object.assign({}, cached, { cached: true });
  var nfts = [];
  try {
    var contract = new ethers.Contract(CONTRACT_ADDRESS, TOKEN_ABI, provider);
    var balance = await contract.balanceOf(addr);
    var count = Number(balance);
    if (count === 0) { var r = { address: addr, total: 0, nfts: [], cached: false, scanned_at: new Date().toISOString() }; inventoryCache.set(addr, r); return r; }
    for (var i = 0; i < count; i++) {
      try {
        var tokenId = await contract.tokenOfOwnerByIndex(addr, i);
        var assetTypeNum = Number(await contract.tokenAssetType(tokenId));
        var rarityNum = Number(await contract.tokenRarity(tokenId));
        var assetType = ASSET_TYPE_NAMES[assetTypeNum] || 'unknown';
        var rarity = RARITY_NAMES[rarityNum] || 'common';
        var tokenUri = null;
        try { tokenUri = await contract.tokenURI(tokenId); } catch (e) {}
        nfts.push({ contract_address: CONTRACT_ADDRESS.toLowerCase(), contract_name: 'TAKEOVER', token_id: tokenId.toString(), name: 'TAKEOVER ' + assetType.replace(/_/g, ' ') + ' #' + tokenId.toString(), asset_type: assetType, rarity: rarity, compatible_slots: [assetType], texture_url: resolveIPFS(tokenUri), model_url: null, image: null, attributes: [{ trait_type: 'Asset Type', value: assetType }, { trait_type: 'Rarity', value: rarity }] });
      } catch (e) { console.error('[inventory] Token error:', e.message); }
    }
  } catch (err) { console.error('[inventory] Error:', err.message); return { address: addr, total: 0, nfts: [], errors: [{ error: err.message }], cached: false }; }
  nfts.sort(function(a, b) { return (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0); });
  var result = { address: addr, total: nfts.length, nfts: nfts, cached: false, scanned_at: new Date().toISOString() };
  inventoryCache.set(addr, result);
  return result;
}
module.exports = { scanInventory, RARITY_ORDER };
```

Save and close. Then push to GitHub:
```
cd C:\Projects\takeover\takeover-lore\packages\api
git add .
git commit -m "Fix inventory: read asset type and rarity from contract"
git push
```

Render will auto-redeploy. Wait about a minute, then test the inventory URL in your browser again:
```
https://takeover-lore-api.onrender.com/api/v1/inventory/0xFd3396b83035bc152478c250998874Fb6bD494c1