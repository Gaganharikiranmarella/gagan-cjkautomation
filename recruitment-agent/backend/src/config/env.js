const path = require('path');

// Resolve .env relative to this file, not process.cwd() - the app can be
// launched from a parent directory (e.g. a monorepo task runner), and a
// cwd-relative lookup would silently miss the file in that case.
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const env = {
  port: process.env.PORT || 3020,
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  isProduction: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
};

module.exports = env;
