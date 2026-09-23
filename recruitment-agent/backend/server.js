const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const env = require('./src/config/env');
const { getSql } = require('./src/config/db');
const apiRoutes = require('./src/routes');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');
const { logger } = require('./src/utils/logger');

const app = express();
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

app.use(cors());
app.use(express.json());
app.use(express.static(FRONTEND_DIR));

// Fail fast with a clear error if DATABASE_URL isn't configured, rather
// than letting the first query throw something more opaque.
app.use('/api', (req, res, next) => {
  try {
    getSql();
    next();
  } catch (err) {
    next(err);
  }
});

app.use('/api', apiRoutes);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.use('/api', notFoundHandler);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) err.status = 400;
  errorHandler(err, req, res, next);
});

if (require.main === module) {
  app.listen(env.port, () => {
    logger.info(`Resumalyze v2.0 running at http://localhost:${env.port}`);
  });
}

module.exports = app;
