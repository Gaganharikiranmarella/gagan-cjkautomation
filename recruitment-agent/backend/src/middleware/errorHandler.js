const { logger } = require('../utils/logger');

function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status >= 500) {
    logger.error(err.stack || err.message);
  }
  res.status(status).json({ error: err.publicMessage || err.message || 'Something went wrong' });
}

module.exports = { notFoundHandler, errorHandler };
