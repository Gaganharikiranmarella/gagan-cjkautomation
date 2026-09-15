require('dotenv').config();
const express = require('express');
const path = require('path');
const { screenResume, validateCandidate, matchToRole, draftInterviewInvite } = require('./lib/pipeline');
const { listRoles, getRole } = require('./lib/jobRoles');
const { sendInterviewNotice, isConfigured, SENDER } = require('./lib/mailer');
const {
  saveCandidate, listCandidates, getCandidate,
  postInvite, listInvites,
} = require('./lib/store');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Stage 1 — Role catalog (fixed baseline requirements, not user-created)
app.get('/api/roles', (req, res) => {
  res.json(listRoles());
});

app.get('/api/mailer-status', (req, res) => {
  res.json({ configured: isConfigured(), sender: SENDER });
});

// Stage 2 — New Candidate Application (trigger) -> runs the whole pipeline synchronously
const EMAIL_SCORE_THRESHOLD = 67;

app.post('/api/candidates', async (req, res) => {
  const { name, email, phone, resumeText, roleId } = req.body || {};
  if (!resumeText || !roleId) {
    return res.status(400).json({ error: 'resumeText and roleId are required' });
  }
  const role = getRole(roleId);
  if (!role) {
    return res.status(404).json({ error: `No role found with id ${roleId}` });
  }

  // Stage 2 — Screen
  const profile = screenResume({ name, email, phone, resumeText });

  // Stage 3 — Validate
  const validation = validateCandidate(profile);

  let match = null;
  let invite = null;

  if (validation.valid) {
    // Stage 4 — Analyze against the role's baseline requirements
    match = matchToRole(profile, role);
  }

  // Stage 5 — Notify the candidate by real email once their score clears the bar
  let emailResult = null;
  if (match && match.score > EMAIL_SCORE_THRESHOLD) {
    emailResult = await sendInterviewNotice({ to: profile.email, candidateName: profile.name, roleTitle: role.title });
  }

  const candidate = saveCandidate({
    roleId: role.id,
    roleTitle: role.title,
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
    mustHaveCoverage: match ? match.mustHaveCoverage : null,
    niceToHaveCoverage: match ? match.niceToHaveCoverage : null,
    experienceFit: match ? match.experienceFit : null,
    matchedMustHave: match ? match.matchedMustHave : [],
    missingMustHave: match ? match.missingMustHave : [],
    matchedNiceToHave: match ? match.matchedNiceToHave : [],
    missingNiceToHave: match ? match.missingNiceToHave : [],
    analysis: match ? match.analysis : 'Application could not be analyzed until the issues above are resolved.',
    nextAction: match ? match.nextAction : 'Request a complete application',
    emailSent: emailResult ? emailResult.sent : false,
    emailNote: emailResult ? (emailResult.reason || null) : null,
  });

  if (match && match.status === 'shortlisted') {
    // Path A — draft interview invite for shortlisted candidates
    const draft = draftInterviewInvite({ name: candidate.name, roleTitle: role.title });
    invite = postInvite(candidate, { draft });
  }

  res.status(201).json({ candidate, invite });
});

app.get('/api/candidates', (req, res) => {
  res.json(listCandidates(req.query.roleId));
});

app.get('/api/candidates/:id', (req, res) => {
  const candidate = getCandidate(req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  res.json(candidate);
});

app.get('/api/shortlist', (req, res) => {
  res.json(listCandidates(req.query.roleId).filter(c => c.status === 'shortlisted'));
});

app.get('/api/invites', (req, res) => {
  res.json(listInvites(req.query.roleId));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Resumalyze (Recruitment AI Agent) running on http://localhost:${PORT}`));
