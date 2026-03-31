// middleware/auth.js
const { validateSession } = require('../services/wallet');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  const session = validateSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.walletAddress = session.address;
  next();
}

// Optional auth — sets req.walletAddress if token present, but doesn't reject
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const session = validateSession(authHeader.slice(7));
    if (session) req.walletAddress = session.address;
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
