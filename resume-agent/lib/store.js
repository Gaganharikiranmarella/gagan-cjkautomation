// In-memory stand-in for Stage 5's ATS/calendar. Roles are a fixed catalog (lib/jobRoles.js),
// not user-created, so only candidates and interview invites are stored here.
// Labelled PLACEHOLDER, same as in the source workflow — swap for real API calls when ready.
let nextCandidateId = 1;
const candidates = [];  // PLACEHOLDER -> ATS: Candidate Pipeline
const invites = [];     // PLACEHOLDER -> Calendar: Interview Invites

function saveCandidate(candidate) {
  const record = { id: nextCandidateId++, ...candidate, createdAt: new Date().toISOString() };
  candidates.unshift(record);
  return record;
}

function listCandidates(roleId) {
  return roleId ? candidates.filter(c => c.roleId === roleId) : candidates;
}

function getCandidate(id) {
  return candidates.find(c => c.id === Number(id));
}

function postInvite(candidate, extra = {}) {
  const invite = {
    id: invites.length + 1,
    candidateId: candidate.id,
    roleId: candidate.roleId,
    name: candidate.name,
    email: candidate.email,
    createdAt: new Date().toISOString(),
    ...extra,
  };
  invites.unshift(invite);
  return invite;
}

function listInvites(roleId) {
  return roleId ? invites.filter(i => i.roleId === roleId) : invites;
}

module.exports = {
  saveCandidate, listCandidates, getCandidate,
  postInvite, listInvites,
};
