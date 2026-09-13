// In-memory stand-ins for Stage 1 (job requisitions) and Stage 5's ATS/calendar.
// Labelled PLACEHOLDER, same as in the source workflow — swap for real API calls when ready.
let nextJobId = 1;
let nextCandidateId = 1;
const jobs = [];        // PLACEHOLDER -> ATS: Job Requisitions
const candidates = [];  // PLACEHOLDER -> ATS: Candidate Pipeline
const invites = [];     // PLACEHOLDER -> Calendar: Interview Invites

function saveJob(job) {
  const record = { id: nextJobId++, ...job, createdAt: new Date().toISOString() };
  jobs.unshift(record);
  return record;
}

function listJobs() {
  return jobs;
}

function getJob(id) {
  return jobs.find(j => j.id === Number(id));
}

function saveCandidate(candidate) {
  const record = { id: nextCandidateId++, ...candidate, createdAt: new Date().toISOString() };
  candidates.unshift(record);
  return record;
}

function listCandidates(jobId) {
  return jobId ? candidates.filter(c => c.jobId === Number(jobId)) : candidates;
}

function getCandidate(id) {
  return candidates.find(c => c.id === Number(id));
}

function postInvite(candidate, extra = {}) {
  const invite = {
    id: invites.length + 1,
    candidateId: candidate.id,
    jobId: candidate.jobId,
    name: candidate.name,
    email: candidate.email,
    createdAt: new Date().toISOString(),
    ...extra,
  };
  invites.unshift(invite);
  return invite;
}

function listInvites(jobId) {
  return jobId ? invites.filter(i => i.jobId === Number(jobId)) : invites;
}

module.exports = {
  saveJob, listJobs, getJob,
  saveCandidate, listCandidates, getCandidate,
  postInvite, listInvites,
};
