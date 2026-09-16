// Tiny embedded JSON-file database engine.
//
// This plays the role a real database driver would play: every repository
// goes through readState()/writeState() here instead of touching the file
// directly. That means the storage engine can be swapped later (SQLite,
// Postgres, etc.) by rewriting just this module and keeping the repository
// API the same.
const fs = require('fs');
const path = require('path');
const { DEFAULT_STATE } = require('./schema');

// On Vercel the deployment bundle is read-only except for /tmp, and /tmp is
// wiped between cold starts / separate instances, so data won't persist
// reliably in production there — fine for a demo, not for real usage.
const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'lead-gen-agent-data')
  : path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
  }
}

function readState() {
  ensureStore();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

// Write-to-temp-then-rename keeps a crash mid-write from corrupting the file.
function writeState(state) {
  ensureStore();
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2));
  fs.renameSync(tmpFile, DATA_FILE);
}

module.exports = { readState, writeState };
