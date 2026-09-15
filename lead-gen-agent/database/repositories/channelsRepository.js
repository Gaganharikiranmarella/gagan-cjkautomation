const { BaseRepository } = require('./baseRepository');

// Persists connection state for channels whose "connect" step is stateful in
// the UI (e.g. WhatsApp's QR-link flow). One record per channel name.
class ChannelsRepository extends BaseRepository {
  constructor() {
    super('channels', 'chan');
  }

  findByName(name) {
    return this.list().find((c) => c.name === name) || null;
  }

  upsert(name, patch) {
    const existing = this.findByName(name);
    if (existing) return this.update(existing.id, patch);
    return this.create({ name, status: 'disconnected', ...patch });
  }
}

module.exports = new ChannelsRepository();
