const jobRepo = require('../repositories/jobRepo');
const asyncHandler = require('../utils/asyncHandler');

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function notFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

function parseListField(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function jobPayloadFromBody(body) {
  return {
    title: body.title?.trim(),
    description: body.description?.trim(),
    location: body.location?.trim() || 'Remote',
    jobType: body.jobType || 'full-time',
    minExperience: Number(body.minExperience) || 0,
    skillsRequired: parseListField(body.skillsRequired),
    minimumRequirements: parseListField(body.minimumRequirements),
    payMin: body.payMin !== undefined && body.payMin !== '' ? Number(body.payMin) : null,
    payMax: body.payMax !== undefined && body.payMax !== '' ? Number(body.payMax) : null,
    payCurrency: body.payCurrency || 'INR',
    openings: Number(body.openings) || 1,
    deadline: body.deadline ? new Date(body.deadline) : null,
  };
}

// Public/applicant-facing: only open roles, newest first.
const listOpenJobs = asyncHandler(async (req, res) => {
  const { search, jobType, location } = req.query;
  const jobs = await jobRepo.listOpen({ search, jobType, location });
  res.json({ jobs });
});

const getJob = asyncHandler(async (req, res) => {
  const job = await jobRepo.getById(req.params.id);
  if (!job) throw notFound('Job not found');
  res.json({ job });
});

// Company dashboard: all of the caller's own postings, any status.
const listMyJobs = asyncHandler(async (req, res) => {
  const jobs = await jobRepo.listByCompany(req.user.id);
  res.json({ jobs });
});

const createJob = asyncHandler(async (req, res) => {
  const payload = jobPayloadFromBody(req.body);
  if (!payload.title || !payload.description) throw badRequest('title and description are required');
  const job = await jobRepo.create(req.user.id, payload);
  res.status(201).json({ job });
});

async function loadOwnedJob(jobId, companyId) {
  const job = await jobRepo.getById(jobId);
  if (!job) throw notFound('Job not found');
  if (String(job.companyId) !== String(companyId)) {
    const err = new Error('You do not own this job posting');
    err.status = 403;
    throw err;
  }
  return job;
}

const updateJob = asyncHandler(async (req, res) => {
  const existing = await loadOwnedJob(req.params.id, req.user.id);
  const payload = jobPayloadFromBody(req.body);
  const status = req.body.status && ['open', 'closed'].includes(req.body.status) ? req.body.status : existing.status;
  const job = await jobRepo.update(req.params.id, { ...payload, status });
  res.json({ job });
});

const deleteJob = asyncHandler(async (req, res) => {
  await loadOwnedJob(req.params.id, req.user.id);
  // applications.job_id has ON DELETE CASCADE, so this cleans those up too.
  await jobRepo.remove(req.params.id);
  res.json({ success: true });
});

module.exports = { listOpenJobs, getJob, listMyJobs, createJob, updateJob, deleteJob };
