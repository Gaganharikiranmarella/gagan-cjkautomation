require('dotenv').config();

const env = {
  port: process.env.PORT || 3020,
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  isProduction: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
};

module.exports = env;
