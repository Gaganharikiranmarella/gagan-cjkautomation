const { getSql } = require('../config/db');

const APPLICATION_FIELDS = `
  a.id, a.job_id AS "jobId", a.applicant_id AS "applicantId",
  a.resume_file_name AS "resumeFileName", a.resume_text AS "resumeText",
  a.score, a.matched_keywords AS "matchedKeywords", a.missing_keywords AS "missingKeywords",
  a.status, a.ai_insights AS "aiInsights", a.created_at AS "createdAt"
`;

async function findByJobAndApplicant(jobId, applicantId) {
  const sql = getSql();
  const rows = await sql.query('SELECT id FROM applications WHERE job_id = $1 AND applicant_id = $2', [
    jobId,
    applicantId,
  ]);
  return rows[0] || null;
}

async function create(data) {
  const sql = getSql();
  const rows = await sql.query(
    `INSERT INTO applications (
       job_id, applicant_id, resume_file_name, resume_text, score,
       matched_keywords, missing_keywords, status, ai_insights
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${APPLICATION_FIELDS}`,
    [
      data.jobId,
      data.applicantId,
      data.resumeFileName,
      data.resumeText,
      data.score,
      JSON.stringify(data.matchedKeywords || []),
      JSON.stringify(data.missingKeywords || []),
      data.status,
      data.aiInsights ? JSON.stringify(data.aiInsights) : null,
    ]
  );
  return rows[0];
}

// Applicant's own applications, with the job and its posting company nested.
async function listByApplicant(applicantId) {
  const sql = getSql();
  return sql.query(
    `SELECT ${APPLICATION_FIELDS},
       jsonb_build_object(
         'id', j.id, 'title', j.title, 'status', j.status,
         'company', jsonb_build_object('id', c.id, 'companyName', c.company_name, 'industry', c.industry)
       ) AS job
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     JOIN companies c ON c.id = j.company_id
     WHERE a.applicant_id = $1
     ORDER BY a.created_at DESC`,
    [applicantId]
  );
}

// Everyone who applied to one job, best score first, with applicant details nested.
async function listByJob(jobId) {
  const sql = getSql();
  return sql.query(
    `SELECT ${APPLICATION_FIELDS},
       jsonb_build_object(
         'id', ap.id, 'name', ap.name, 'email', ap.email, 'phone', ap.phone,
         'headline', ap.headline, 'experienceYears', ap.experience_years, 'skills', ap.skills
       ) AS applicant
     FROM applications a
     JOIN applicants ap ON ap.id = a.applicant_id
     WHERE a.job_id = $1
     ORDER BY a.score DESC, a.created_at DESC`,
    [jobId]
  );
}

module.exports = { findByJobAndApplicant, create, listByApplicant, listByJob };
