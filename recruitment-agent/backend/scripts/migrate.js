// One-off setup script: creates the tables in schema.sql against
// DATABASE_URL. Run with `npm run migrate` after setting DATABASE_URL in
// .env (or export it in your shell). Safe to re-run - every statement is
// CREATE ... IF NOT EXISTS.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string.');
    process.exit(1);
  }

  const schema = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.sql'), 'utf-8');

  const client = new Client(databaseUrl);
  await client.connect();
  try {
    await client.query(schema);
    console.log('Schema applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
