const path = require('path');
const express = require('express');
const env = require('./src/config/env');
const apiRoutes = require('./src/routes');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');
const { logger } = require('./src/utils/logger');

const app = express();
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

app.use(express.json());
app.use(express.static(FRONTEND_DIR));

app.use('/api', apiRoutes);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.use('/api', notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  app.listen(env.port, () => {
    logger.info(`Lead Gen Agent running at http://localhost:${env.port}`);
  });
}

module.exports = app;
