const express = require('express');
const path = require('path');
const { screenResume, validateCandidate, matchToJob, draftInterviewInvite } = require('./lib/pipeline');
const {
  saveJob, listJobs, getJob,
  saveCandidate, listCandidates, getCandidate,
  postInvite, listInvites,
} = require('./lib/store');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Stage 1 — New Job Requisition (trigger)
app.post('/api/jobs', (req, res) => {
  const { title, description, mustHaveSkills, niceToHaveSkills, minExperienceYears } = req.body || {};
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }
  const job = saveJob({
    title,
    description: description || '',
    mustHaveSkills: mustHaveSkills || [],
    niceToHaveSkills: niceToHaveSkills || [],
    minExperienceYears: minExperienceYears || 0,
  });
  res.status(201).json(job);
});

app.get('/api/jobs', (req, res) => {
  res.json(listJobs());
});

// Stage 2 — New Candidate Application (trigger) -> runs the whole pipeline synchronously
app.post('/api/candidates', (req, res) => {
  const { name, email, phone, resumeText, jobId } = req.body || {};
  if (!resumeText || !jobId) {
    return res.status(400).json({ error: 'resumeText and jobId are required' });
  }
  const job = getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: `No job found with id ${jobId}` });
  }

  // Stage 2 — Screen
  const profile = screenResume({ name, email, phone, resumeText });

  // Stage 3 — Validate
  const validation = validateCandidate(profile);

  let match = null;
  let invite = null;

  if (validation.valid) {
    // Stage 4 — Match against job requirements
    match = matchToJob(profile, job);
  }

  const candidate = saveCandidate({
    jobId: job.id,
    jobTitle: job.title,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    resumeText: profile.resumeText,
    skills: profile.skills,
    experienceYears: profile.experienceYears,
    educationLevel: profile.educationLevel,
    valid: validation.valid,
    issues: validation.issues,
    score: match ? match.score : null,
    status: match ? match.status : 'invalid',
    matchedMustHave: match ? match.matchedMustHave : [],
    missingMustHave: match ? match.missingMustHave : [],
    matchedNiceToHave: match ? match.matchedNiceToHave : [],
    nextAction: match ? match.nextAction : 'Request a complete application',
  });

  if (match && match.status === 'shortlisted') {
    // Path A — draft interview invite for shortlisted candidates
    const draft = draftInterviewInvite({ name: candidate.name, jobTitle: job.title });
    invite = postInvite(candidate, { draft });
  }

  res.status(201).json({ candidate, invite });
});

app.get('/api/candidates', (req, res) => {
  res.json(listCandidates(req.query.jobId));
});

app.get('/api/candidates/:id', (req, res) => {
  const candidate = getCandidate(req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  res.json(candidate);
});

app.get('/api/shortlist', (req, res) => {
  res.json(listCandidates(req.query.jobId).filter(c => c.status === 'shortlisted'));
});

app.get('/api/invites', (req, res) => {
  res.json(listInvites(req.query.jobId));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Resumalyze (Recruitment AI Agent) running on http://localhost:${PORT}`));
