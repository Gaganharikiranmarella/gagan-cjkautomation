const { logger } = require('../utils/logger');

function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) logger.error(err.stack || err.message);
  res.status(statusCode).json({ error: err.message || 'Internal server error' });
}

module.exports = { notFoundHandler, errorHandler };
