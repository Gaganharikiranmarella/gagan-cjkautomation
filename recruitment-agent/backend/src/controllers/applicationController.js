const jobRepo = require('../repositories/jobRepo');
const applicationRepo = require('../repositories/applicationRepo');
const asyncHandler = require('../utils/asyncHandler');
const { extractResumeText } = require('../services/resumeParser');
const { scoreResume } = require('../services/scoringService');
const { generateAiInsights } = require('../services/aiAnalysisService');

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

// Applicant uploads a resume for one job; we score it immediately (ATS
// keyword match) and store the verdict - no separate review step, matching
// how Internshala-style auto-shortlisting works.
const applyToJob = asyncHandler(async (req, res) => {
  const job = await jobRepo.getById(req.params.jobId);
  if (!job) throw notFound('Job not found');
  if (job.status !== 'open') throw badRequest('This job is no longer accepting applications');
  if (!req.file) throw badRequest('Attach a resume (PDF, DOCX or TXT)');

  const existing = await applicationRepo.findByJobAndApplicant(job.id, req.user.id);
  if (existing) throw badRequest('You already applied to this job');

  let resumeText;
  try {
    resumeText = await extractResumeText(req.file);
  } catch (err) {
    throw badRequest(`Could not read resume: ${err.message}`);
  }
  if (!resumeText || resumeText.trim().length < 20) {
    throw badRequest('Could not extract enough text from that resume - try a different file');
  }

  const result = scoreResume({ job, resumeText });

  // Optional AI layer - purely additive, never changes the score/status above.
  const aiInsights = await generateAiInsights({
    job,
    resumeText,
    atsScore: result.score,
    matchedKeywords: result.matchedKeywords,
    missingKeywords: result.missingKeywords,
  });

  const application = await applicationRepo.create({
    jobId: job.id,
    applicantId: req.user.id,
    resumeFileName: req.file.originalname,
    resumeText,
    score: result.score,
    matchedKeywords: result.matchedKeywords,
    missingKeywords: result.missingKeywords,
    status: result.status,
    aiInsights,
  });

  await jobRepo.incrementCounts(job.id, {
    applicantDelta: 1,
    shortlistedDelta: result.status === 'shortlisted' ? 1 : 0,
  });

  res.status(201).json({
    application: {
      id: application.id,
      score: application.score,
      status: application.status,
      matchedKeywords: application.matchedKeywords,
      missingKeywords: application.missingKeywords,
      breakdown: result.breakdown,
      aiInsights: application.aiInsights,
    },
  });
});

const listMyApplications = asyncHandler(async (req, res) => {
  const applications = await applicationRepo.listByApplicant(req.user.id);
  res.json({ applications });
});

// Company view of everyone who applied to one of their jobs, best score first.
const listApplicantsForJob = asyncHandler(async (req, res) => {
  const job = await jobRepo.getById(req.params.jobId);
  if (!job) throw notFound('Job not found');
  if (String(job.companyId) !== String(req.user.id)) {
    const err = new Error('You do not own this job posting');
    err.status = 403;
    throw err;
  }

  const applications = await applicationRepo.listByJob(job.id);
  res.json({ job, applications });
});

module.exports = { applyToJob, listMyApplications, listApplicantsForJob };
