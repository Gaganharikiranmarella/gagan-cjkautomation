const { neon } = require('@neondatabase/serverless');
const env = require('./env');

// neon() gives us a fetch/https-based query function - no connection to
// open or keep alive, which is exactly what a stateless serverless
// function wants. We just memoize the function itself (cheap) across warm
// invocations of the same process.
let cachedSql = global._resumalyzeSql;

function getSql() {
  if (!env.databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string.'
    );
  }
  if (!cachedSql) {
    cachedSql = neon(env.databaseUrl);
    global._resumalyzeSql = cachedSql;
  }
  return cachedSql;
}

module.exports = { getSql };
