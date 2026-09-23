const bcrypt = require('bcryptjs');
const applicantRepo = require('../repositories/applicantRepo');
const companyRepo = require('../repositories/companyRepo');
const { signToken } = require('../utils/jwt');
const asyncHandler = require('../utils/asyncHandler');

const REPO_BY_ROLE = { applicant: applicantRepo, company: companyRepo };

function toPublicUser(row, role) {
  const { passwordHash, ...rest } = row;
  return { ...rest, role };
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

const register = asyncHandler(async (req, res) => {
  const { role, email, password } = req.body;
  const repo = REPO_BY_ROLE[role];
  if (!repo) throw badRequest('role must be "applicant" or "company"');
  if (!email || !password || password.length < 6) {
    throw badRequest('Email and a password of at least 6 characters are required');
  }

  const existing = await repo.findByEmail(email);
  if (existing) throw badRequest('An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 10);

  let row;
  if (role === 'applicant') {
    const { name, phone, headline } = req.body;
    if (!name) throw badRequest('name is required');
    row = await applicantRepo.create({ name, email, passwordHash, phone, headline });
  } else {
    const { companyName, industry, website } = req.body;
    if (!companyName) throw badRequest('companyName is required');
    row = await companyRepo.create({ companyName, email, passwordHash, industry, website });
  }

  const user = toPublicUser(row, role);
  const token = signToken({ id: row.id, role, name: role === 'applicant' ? row.name : row.companyName });
  res.status(201).json({ token, user });
});

const login = asyncHandler(async (req, res) => {
  const { role, email, password } = req.body;
  const repo = REPO_BY_ROLE[role];
  if (!repo) throw badRequest('role must be "applicant" or "company"');

  const row = await repo.findByEmail(email);
  if (!row) throw badRequest('Invalid email or password');

  const valid = await bcrypt.compare(password || '', row.passwordHash);
  if (!valid) throw badRequest('Invalid email or password');

  const user = toPublicUser(row, role);
  const token = signToken({ id: row.id, role, name: role === 'applicant' ? row.name : row.companyName });
  res.json({ token, user });
});

const me = asyncHandler(async (req, res) => {
  const repo = REPO_BY_ROLE[req.user.role];
  const row = await repo.findById(req.user.id);
  if (!row) return res.status(404).json({ error: 'Account no longer exists' });
  res.json({ user: toPublicUser(row, req.user.role) });
});

module.exports = { register, login, me };
