// server.js
// TAKEOVER Lore Personalization API
// 
// Start: npm start
// Dev:   npm run dev (auto-reload on changes)
// Init:  npm run db:init (creates SQLite database)

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

// ---- SECURITY ----
app.use(helmet());

// ---- CORS ----
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (UE5 HTTP client, curl, etc.)
    if (!origin) return callback(null, true);
    if (config.cors.origins.includes(origin) || config.env === 'development') {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ---- PARSING ----
app.use(express.json({ limit: '1mb' }));

// ---- COMPRESSION ----
app.use(compression());

// ---- LOGGING ----
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

// ---- RATE LIMITING ----
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Higher limit for the match endpoint (called frequently during playback)
const matchLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 30,
  message: { error: 'Too many match requests' },
});
app.use('/api/v1/match/', matchLimiter);

// ---- ROUTES ----
app.use('/api/v1', routes);

// ---- ROOT ----
app.get('/', (req, res) => {
  res.json({
    name: 'TAKEOVER Lore API',
    version: '1.0.0',
    docs: '/api/v1/health',
    endpoints: {
      health:    'GET  /api/v1/health',
      verify:    'POST /api/v1/verify-wallet',
      inventory: 'GET  /api/v1/inventory/:address',
      match:     'GET  /api/v1/match/:address/:episodeId',
      episodes:  'GET  /api/v1/episodes',
      manifest:  'GET  /api/v1/manifest/:episodeId',
      analytics: 'POST /api/v1/analytics/event',
    },
  });
});

// ---- ERROR HANDLING ----
app.use(notFound);
app.use(errorHandler);

// ---- START ----
app.listen(config.port, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║     TAKEOVER Lore API v1.0.0         ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  console.log(`  Environment: ${config.env}`);
  console.log(`  Port:        ${config.port}`);
  console.log(`  Chain:       Avalanche (${config.avax.chainId})`);
  console.log(`  CDN:         ${config.cdn.baseUrl}`);
  console.log('');
  console.log(`  http://localhost:${config.port}/`);
  console.log('');
});

module.exports = app;
