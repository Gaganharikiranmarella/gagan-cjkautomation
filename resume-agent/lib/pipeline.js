// Known skill vocabulary the screener looks for inside resume text.
// Covers the requirements of every role in lib/jobRoles.js plus common adjacent terms.
const SKILL_VOCAB = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'c', 'go', 'rust', 'ruby', 'php',
  'react', 'vue', 'angular', 'node.js', 'node', 'express', 'next.js', 'django', 'flask',
  'spring', 'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'graphql', 'rest api', 'microservices',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ansible', 'ci/cd', 'git', 'linux',
  'machine learning', 'data science', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'scikit-learn', 'keras',
  'nlp', 'llm', 'prompt engineering', 'computer vision',
  'html', 'css', 'sass', 'figma', 'agile', 'scrum', 'project management', 'roadmap', 'stakeholder management',
  'communication', 'leadership', 'sales', 'marketing', 'seo', 'excel',
  'kotlin', 'android', 'swift', 'ios', 'flutter', 'react native', 'firebase',
  'monitoring', 'incident response', 'prometheus', 'grafana',
  'etl', 'spark', 'airflow', 'hadoop', 'kafka', 'tableau', 'power bi', 'data visualization',
  'selenium', 'cypress', 'jest', 'junit', 'manual testing', 'automation testing', 'jira',
  'cybersecurity', 'networking', 'tcp/ip', 'dns', 'firewall', 'penetration testing', 'siem', 'iam',
  'database administration', 'oracle',
  'ui design', 'ux design', 'wireframing', 'user research', 'prototyping', 'sketch', 'adobe xd',
  'solidity', 'blockchain', 'ethereum', 'web3', 'smart contracts',
  'unity', 'unreal engine', 'game design',
];

// Stage 2 — Screen Resume (AI)
// Heuristic stand-in for an LLM resume parser: pulls structured fields out of raw resume text.
function screenResume({ name, email, phone, resumeText }) {
  const text = resumeText || '';
  const lower = text.toLowerCase();

  const foundEmail = email || (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] || '';
  const foundPhone = phone || (text.match(/\+?\d[\d\s().-]{8,}\d/) || [])[0] || '';

  const skills = SKILL_VOCAB.filter(skill => lower.includes(skill));

  const yearsMatch = lower.match(/(\d+)\+?\s*(?:years?|yrs?)\b/);
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
// Checks the screened profile is complete and well-formed before it's allowed into role matching.
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

// Stage 4 — Analyze Candidate Against Role Baseline (AI)
// Unlike a flat lead score, this scores must-have/nice-to-have coverage and experience fit
// separately, then blends them into an overall score with a short plain-English analysis.
function matchToRole(profile, role) {
  const mustHave = (role.mustHaveSkills || []).map(s => s.toLowerCase());
  const niceToHave = (role.niceToHaveSkills || []).map(s => s.toLowerCase());
  const candidateSkills = profile.skills.map(s => s.toLowerCase());

  const matchedMustHave = mustHave.filter(s => candidateSkills.includes(s));
  const missingMustHave = mustHave.filter(s => !candidateSkills.includes(s));
  const matchedNiceToHave = niceToHave.filter(s => candidateSkills.includes(s));
  const missingNiceToHave = niceToHave.filter(s => !candidateSkills.includes(s));

  const mustHaveCoverage = mustHave.length ? Math.round((matchedMustHave.length / mustHave.length) * 100) : 100;
  const niceToHaveCoverage = niceToHave.length ? Math.round((matchedNiceToHave.length / niceToHave.length) * 100) : 0;
  const experienceFit = profile.experienceYears >= (role.minExperienceYears || 0) ? 'meets' : 'below';

  let score = Math.round(mustHaveCoverage * 0.6 + niceToHaveCoverage * 0.25 + (experienceFit === 'meets' ? 15 : 0));
  score = Math.max(0, Math.min(100, score));

  const status =
    mustHaveCoverage === 100 && experienceFit === 'meets' && score >= 70 ? 'shortlisted' :
    score >= 45 ? 'consider' : 'rejected';

  const nextAction =
    status === 'shortlisted' ? 'Schedule interview' :
    status === 'consider' ? 'Manual recruiter review' :
    'Send rejection notice';

  const analysis = [
    `Covers ${matchedMustHave.length}/${mustHave.length} must-have skill${mustHave.length === 1 ? '' : 's'} for ${role.title}${matchedMustHave.length ? ` (${matchedMustHave.join(', ')})` : ''}.`,
    missingMustHave.length ? `Missing: ${missingMustHave.join(', ')}.` : null,
    matchedNiceToHave.length ? `Bonus skills: ${matchedNiceToHave.join(', ')}.` : null,
    experienceFit === 'meets'
      ? `Experience (${profile.experienceYears}y) meets the ${role.minExperienceYears}y minimum.`
      : `Experience (${profile.experienceYears}y) is below the ${role.minExperienceYears}y minimum.`,
  ].filter(Boolean).join(' ');

  return {
    score,
    status,
    mustHaveCoverage,
    niceToHaveCoverage,
    experienceFit,
    matchedMustHave,
    missingMustHave,
    matchedNiceToHave,
    missingNiceToHave,
    nextAction,
    analysis,
  };
}

// Path A, step 1 — Draft Interview Invite (AI)
function draftInterviewInvite({ name, roleTitle }) {
  const firstName = (name || '').split(' ')[0] || 'there';
  const subject = `Interview invitation — ${roleTitle}`;
  const body =
`Hi ${firstName},

Thanks for applying for the ${roleTitle} role! Your background looks like a strong match and we'd like to move forward with an interview.

Could you share a few times that work for you over the next week?

Best,
Recruiting Team`;
  return { subject, body };
}

module.exports = { SKILL_VOCAB, screenResume, validateCandidate, matchToRole, draftInterviewInvite };
