const { leadsRepository } = require('../../../database');
const { HttpError } = require('../utils/httpError');

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
}

function sanitizeLeadInput(body) {
  const name = String(body.name || '').trim();
  if (!name) throw new HttpError(400, 'Lead name is required');

  return {
    name,
    email: String(body.email || '').trim(),
    phone: String(body.phone || '').trim(),
    company: String(body.company || '').trim(),
    source: String(body.source || 'manual').trim(),
    tags: normalizeTags(body.tags),
    consentGiven: Boolean(body.consentGiven),
    notes: String(body.notes || '').trim(),
  };
}

function list(req, res) {
  res.json({ leads: leadsRepository.list(), stats: leadsRepository.stats() });
}

function create(req, res) {
  const lead = leadsRepository.create(sanitizeLeadInput(req.body));
  res.status(201).json({ lead });
}

// Bulk create used by the CSV import flow (CSV is parsed client-side into
// an array of row objects, then posted here as a batch).
function importBatch(req, res) {
  const rows = Array.isArray(req.body.leads) ? req.body.leads : [];
  if (!rows.length) throw new HttpError(400, 'No leads to import');

  const imported = [];
  const rejected = [];
  rows.forEach((row, index) => {
    try {
      imported.push(leadsRepository.create({ ...sanitizeLeadInput(row), source: row.source || 'csv' }));
    } catch (err) {
      rejected.push({ row: index + 1, reason: err.message });
    }
  });

  res.status(201).json({ imported: imported.length, rejected });
}

function update(req, res) {
  const existing = leadsRepository.findById(req.params.id);
  if (!existing) throw new HttpError(404, 'Lead not found');

  const patch = sanitizeLeadInput({ ...existing, ...req.body });
  if (req.body.status) patch.status = req.body.status;
  const lead = leadsRepository.update(req.params.id, patch);
  res.json({ lead });
}

function remove(req, res) {
  const removed = leadsRepository.remove(req.params.id);
  if (!removed) throw new HttpError(404, 'Lead not found');
  res.status(204).end();
}

module.exports = { list, create, importBatch, update, remove };
