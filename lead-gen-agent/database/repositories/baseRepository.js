const { readState, writeState } = require('../db');
const { generateId } = require('../utils/id');

// Generic CRUD over one collection in the JSON store. Domain repositories
// compose this instead of re-implementing list/find/create/update/remove.
class BaseRepository {
  constructor(collectionName, idPrefix) {
    this.collectionName = collectionName;
    this.idPrefix = idPrefix;
  }

  list() {
    const state = readState();
    return state[this.collectionName] || [];
  }

  findById(id) {
    return this.list().find((record) => record.id === id) || null;
  }

  create(fields) {
    const state = readState();
    const record = {
      id: generateId(this.idPrefix),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...fields,
    };
    state[this.collectionName] = [...(state[this.collectionName] || []), record];
    writeState(state);
    return record;
  }

  update(id, patch) {
    const state = readState();
    const collection = state[this.collectionName] || [];
    let updated = null;
    state[this.collectionName] = collection.map((record) => {
      if (record.id !== id) return record;
      updated = { ...record, ...patch, id: record.id, updatedAt: new Date().toISOString() };
      return updated;
    });
    if (updated) writeState(state);
    return updated;
  }

  remove(id) {
    const state = readState();
    const collection = state[this.collectionName] || [];
    const next = collection.filter((record) => record.id !== id);
    const removed = next.length !== collection.length;
    if (removed) {
      state[this.collectionName] = next;
      writeState(state);
    }
    return removed;
  }
}

module.exports = { BaseRepository };
