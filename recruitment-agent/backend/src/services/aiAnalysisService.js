const Anthropic = require('@anthropic-ai/sdk');
const env = require('../config/env');
const { logger } = require('../utils/logger');

const MODEL = 'claude-haiku-4-5-20251001';

let client = null;
function getClient() {
  if (!env.anthropicApiKey) return null;
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max)}\n...(truncated)` : text;
}

function buildPrompt({ job, resumeText, atsScore, matchedKeywords, missingKeywords }) {
  return `You are a hiring assistant helping screen a job application. You are given the job
posting, the candidate's resume text, and an already-computed ATS keyword match score
(this score is final and NOT yours to change). Your job is to add qualitative judgement
on top of it.

JOB TITLE: ${job.title}
JOB DESCRIPTION: ${truncate(job.description, 1500)}
MINIMUM REQUIREMENTS: ${(job.minimumRequirements || []).join('; ') || 'none listed'}
REQUIRED SKILLS: ${(job.skillsRequired || []).join(', ') || 'none listed'}
MINIMUM EXPERIENCE: ${job.minExperience || 0} years

ATS KEYWORD SCORE (already computed, informational only): ${atsScore}%
MATCHED KEYWORDS: ${matchedKeywords.join(', ') || 'none'}
MISSING KEYWORDS: ${missingKeywords.join(', ') || 'none'}

RESUME TEXT:
${truncate(resumeText, 6000)}

Respond with ONLY a single JSON object (no markdown fences, no prose before or after) with
exactly these keys:
{
  "summary": "2 sentences summarizing who this candidate is and their relevant background",
  "strengths": ["up to 4 short bullet points on genuine strengths for THIS role"],
  "gaps": ["up to 3 short bullet points on real gaps or concerns for THIS role, or an empty array if none"],
  "improvementTips": ["up to 3 short, actionable tips the candidate could use to strengthen their resume for roles like this"],
  "fitRating": "strong" | "moderate" | "weak"
}
Base every field strictly on the resume text given - do not invent experience or credentials
that aren't there. Keep bullet points under 15 words each.`;
}

function parseResponse(rawText) {
  // Claude may still wrap in a fence occasionally; strip if present.
  const cleaned = rawText.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  const asStringArray = (val, max) =>
    Array.isArray(val) ? val.filter((s) => typeof s === 'string').slice(0, max) : [];

  const fitRating = ['strong', 'moderate', 'weak'].includes(parsed.fitRating) ? parsed.fitRating : 'moderate';

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : '',
    strengths: asStringArray(parsed.strengths, 4),
    gaps: asStringArray(parsed.gaps, 3),
    improvementTips: asStringArray(parsed.improvementTips, 3),
    fitRating,
  };
}

// Optional qualitative layer on top of the deterministic ATS score. Never
// throws - any failure (no API key, network error, bad JSON) just means no
// AI insights are attached, and the ATS score/shortlist decision is
// unaffected either way.
async function generateAiInsights(context) {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: buildPrompt(context) }],
    });
    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock) return null;
    return parseResponse(textBlock.text);
  } catch (err) {
    logger.warn('AI resume analysis skipped:', err.message);
    return null;
  }
}

module.exports = { generateAiInsights, isAiEnabled: () => !!env.anthropicApiKey };
