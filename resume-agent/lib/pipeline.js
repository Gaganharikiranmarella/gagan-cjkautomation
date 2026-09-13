// Known skill vocabulary the screener looks for inside resume text.
// Job postings can reference any of these (or arbitrary words) as requirements.
const SKILL_VOCAB = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php',
  'react', 'vue', 'angular', 'node.js', 'node', 'express', 'next.js', 'django', 'flask',
  'spring', 'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'graphql', 'rest api',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ci/cd', 'git',
  'machine learning', 'data science', 'pandas', 'numpy', 'tensorflow', 'pytorch',
  'html', 'css', 'sass', 'figma', 'agile', 'scrum', 'project management',
  'communication', 'leadership', 'sales', 'marketing', 'seo', 'excel',
];

// Stage 2 — Screen Resume (AI)
// Heuristic stand-in for an LLM resume parser: pulls structured fields out of raw resume text.
function screenResume({ name, email, phone, resumeText }) {
  const text = resumeText || '';
  const lower = text.toLowerCase();

  const foundEmail = email || (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] || '';
  const foundPhone = phone || (text.match(/\+?\d[\d\s().-]{8,}\d/) || [])[0] || '';

  const skills = SKILL_VOCAB.filter(skill => lower.includes(skill));

  const yearsMatch = lower.match(/(\d+)\+?\s*(?:years|yrs)\b/);
  const experienceYears = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;

  const educationLevel =
    /\b(phd|doctorate)\b/.test(lower) ? 'PhD' :
    /\b(mba|m\.?tech|m\.?s\.?|master)/.test(lower) ? 'Master' :
    /\b(b\.?tech|b\.?s\.?|bachelor)/.test(lower) ? 'Bachelor' :
    /\b(diploma|associate)\b/.test(lower) ? 'Diploma' : 'Unspecified';

  return {
    name: name || '',
    email: foundEmail,
    phone: foundPhone,
    skills,
    experienceYears,
    educationLevel,
    resumeText: text,
    wordCount: text.trim().split(/\s+/).filter(Boolean).length,
  };
}

// Stage 3 — Validate Candidate (rules)
// Checks the screened profile is complete and well-formed before it's allowed into matching.
function validateCandidate(profile) {
  const issues = [];

  if (!profile.name || !profile.name.trim()) issues.push('Missing candidate name');
  if (!profile.email) {
    issues.push('Missing email address');
  } else if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(profile.email)) {
    issues.push('Email address looks malformed');
  }
  if (!profile.phone) issues.push('Missing phone number');
  if (profile.wordCount < 40) issues.push('Resume text looks too short to be a real CV');
  if (profile.skills.length === 0) issues.push('No recognizable skills found on resume');

  return { valid: issues.length === 0, issues };
}

// Stage 4 — Match Candidate to Job (AI)
// Heuristic stand-in for an LLM/embedding match: scores the candidate against job requirements.
function matchToJob(profile, job) {
  const mustHave = (job.mustHaveSkills || []).map(s => s.toLowerCase());
  const niceToHave = (job.niceToHaveSkills || []).map(s => s.toLowerCase());
  const candidateSkills = profile.skills.map(s => s.toLowerCase());

  const matchedMustHave = mustHave.filter(s => candidateSkills.includes(s));
  const missingMustHave = mustHave.filter(s => !candidateSkills.includes(s));
  const matchedNiceToHave = niceToHave.filter(s => candidateSkills.includes(s));

  let score = 30;
  score += mustHave.length ? (matchedMustHave.length / mustHave.length) * 45 : 20;
  score += niceToHave.length ? (matchedNiceToHave.length / niceToHave.length) * 15 : 0;
  if (profile.experienceYears >= (job.minExperienceYears || 0)) {
    score += 10;
  } else if (job.minExperienceYears) {
    score -= 10 * Math.min(1, (job.minExperienceYears - profile.experienceYears) / job.minExperienceYears);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const status =
    score >= 70 && missingMustHave.length === 0 ? 'shortlisted' :
    score >= 45 ? 'consider' : 'rejected';

  const nextAction =
    status === 'shortlisted' ? 'Schedule interview' :
    status === 'consider' ? 'Manual recruiter review' :
    'Send rejection notice';

  return {
    score,
    status,
    matchedMustHave,
    missingMustHave,
    matchedNiceToHave,
    nextAction,
  };
}

// Path A, step 1 — Draft Interview Invite (AI)
function draftInterviewInvite({ name, jobTitle }) {
  const firstName = (name || '').split(' ')[0] || 'there';
  const subject = `Interview invitation — ${jobTitle}`;
  const body =
`Hi ${firstName},

Thanks for applying for the ${jobTitle} role! Your background looks like a strong match and we'd like to move forward with an interview.

Could you share a few times that work for you over the next week?

Best,
Recruiting Team`;
  return { subject, body };
}

module.exports = { screenResume, validateCandidate, matchToJob, draftInterviewInvite };
