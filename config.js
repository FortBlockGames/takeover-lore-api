// config.js
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3001'),
  env: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',

  avax: {
    rpcUrl: process.env.AVAX_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    chainId: parseInt(process.env.AVAX_CHAIN_ID || '43114'),
    glacierUrl: process.env.GLACIER_API_URL || 'https://glacier-api.avax.network',
  },

  contracts: {
    weapons:   process.env.CONTRACT_WEAPONS   || '0x0000000000000000000000000000000000000001',
    armor:     process.env.CONTRACT_ARMOR     || '0x0000000000000000000000000000000000000002',
    faction:   process.env.CONTRACT_FACTION   || '0x0000000000000000000000000000000000000003',
    effects:   process.env.CONTRACT_EFFECTS   || '0x0000000000000000000000000000000000000004',
    vehicles:  process.env.CONTRACT_VEHICLES  || '0x0000000000000000000000000000000000000005',
    cosmetics: process.env.CONTRACT_COSMETICS || '0x0000000000000000000000000000000000000006',
  },

  cdn: {
    baseUrl: process.env.CDN_BASE_URL || 'https://cdn.playtakeover.com',
  },

  redis: {
    url: process.env.REDIS_URL || null,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3000')
      .split(',').map(s => s.trim()),
  },
};
