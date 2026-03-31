// middleware/errors.js

function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  // Log full error in development, sanitized in production
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${status}] ${req.method} ${req.originalUrl}:`, err);
  } else {
    console.error(`[${status}] ${req.method} ${req.originalUrl}: ${message}`);
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
