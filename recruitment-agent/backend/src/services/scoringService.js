const { SYNONYMS, canonicalize } = require('./skillsTaxonomy');

const SHORTLIST_THRESHOLD = 65;

// All known phrases (canonical + synonyms), longest first so multi-word
// phrases like "machine learning" are matched before the single word "learning".
const ALL_TAXONOMY_PHRASES = Object.entries(SYNONYMS)
  .flatMap(([canonical, synonyms]) => [canonical, ...synonyms])
  .sort((a, b) => b.length - a.length);

function normalize(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textContainsPhrase(normalizedText, phrase) {
  const escaped = escapeRegExp(phrase.toLowerCase());
  // \b word boundaries don't work well around symbols like "c++" or "c#",
  // so fall back to a plain substring test for phrases with no letters/digits
  // at their edges being relied on.
  const boundary = /^[a-z0-9]/i.test(phrase) && /[a-z0-9]$/i.test(phrase);
  const pattern = boundary ? `(^|[^a-z0-9])${escaped}([^a-z0-9]|$)` : escaped;
  return new RegExp(pattern, 'i').test(normalizedText);
}

// Scans free text (job description / requirement bullets) for any known
// taxonomy term, returning canonical forms actually mentioned.
function findTaxonomyMatches(text) {
  const normalized = normalize(text);
  const found = new Set();
  for (const phrase of ALL_TAXONOMY_PHRASES) {
    if (textContainsPhrase(normalized, phrase)) {
      found.add(canonicalize(phrase));
    }
  }
  return found;
}

// Builds the weighted keyword set a resume is scored against.
// Explicit company-listed skills carry the most weight; terms mined from
// requirement bullets and the description carry progressively less.
function buildKeywordWeights(job) {
  const weights = new Map(); // canonical/literal term -> weight

  const upsert = (term, weight) => {
    const key = canonicalize(term);
    if (!key) return;
    weights.set(key, Math.max(weights.get(key) || 0, weight));
  };

  for (const skill of job.skillsRequired || []) {
    if (skill && skill.trim()) upsert(skill.trim(), 3);
  }

  for (const requirement of job.minimumRequirements || []) {
    for (const term of findTaxonomyMatches(requirement)) upsert(term, 2);
  }

  for (const term of findTaxonomyMatches(job.description || '')) upsert(term, 1);

  return weights;
}

function extractExperienceYears(resumeText) {
  const matches = [...normalize(resumeText).matchAll(/(\d{1,2})\+?\s*(?:years|yrs)\b/gi)];
  if (!matches.length) return 0;
  return Math.max(...matches.map((m) => parseInt(m[1], 10)));
}

// Core ATS scoring: how much of the job's weighted keyword set shows up in
// the resume text. Returns a 0-100 score plus a transparent breakdown.
function scoreResume({ job, resumeText }) {
  const normalizedResume = normalize(resumeText);
  const weights = buildKeywordWeights(job);

  const matchedKeywords = [];
  const missingKeywords = [];
  let matchedWeight = 0;
  let totalWeight = 0;

  for (const [term, weight] of weights.entries()) {
    totalWeight += weight;
    const synonyms = SYNONYMS[term] ? [term, ...SYNONYMS[term]] : [term];
    const isMatch = synonyms.some((variant) => textContainsPhrase(normalizedResume, variant));
    if (isMatch) {
      matchedWeight += weight;
      matchedKeywords.push(term);
    } else {
      missingKeywords.push(term);
    }
  }

  const keywordScore = totalWeight > 0 ? (matchedWeight / totalWeight) * 100 : 0;

  const detectedExperienceYears = extractExperienceYears(resumeText);
  const experienceBonus =
    job.minExperience > 0 && detectedExperienceYears >= job.minExperience ? 5 : 0;

  const score = Math.max(0, Math.min(100, Math.round(keywordScore + experienceBonus)));
  const status = score >= SHORTLIST_THRESHOLD ? 'shortlisted' : 'not-shortlisted';

  return {
    score,
    status,
    matchedKeywords,
    missingKeywords,
    breakdown: {
      keywordScore: Math.round(keywordScore),
      experienceBonus,
      detectedExperienceYears,
      requiredExperienceYears: job.minExperience || 0,
      totalKeywords: weights.size,
      matchedKeywordCount: matchedKeywords.length,
    },
  };
}

module.exports = { scoreResume, buildKeywordWeights, findTaxonomyMatches, SHORTLIST_THRESHOLD };
