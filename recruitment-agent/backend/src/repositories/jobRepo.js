const { getSql } = require('../config/db');

const JOB_FIELDS = `
  j.id, j.company_id AS "companyId", j.title, j.description, j.location,
  j.job_type AS "jobType", j.min_experience AS "minExperience",
  j.skills_required AS "skillsRequired", j.minimum_requirements AS "minimumRequirements",
  j.pay_min AS "payMin", j.pay_max AS "payMax", j.pay_currency AS "payCurrency",
  j.openings, j.deadline, j.status,
  j.applicant_count AS "applicantCount", j.shortlisted_count AS "shortlistedCount",
  j.created_at AS "createdAt", j.updated_at AS "updatedAt"
`;

// All open jobs, newest first, with the posting company attached. Search /
// job type / location filters are applied in JS rather than composed into
// dynamic SQL - simpler to read and plenty fast for a job board this size.
async function listOpen({ search, jobType, location } = {}) {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT ${JOB_FIELDS},
       jsonb_build_object('id', c.id, 'companyName', c.company_name, 'industry', c.industry) AS company
     FROM jobs j
     JOIN companies c ON c.id = j.company_id
     WHERE j.status = 'open'
     ORDER BY j.created_at DESC`
  );

  let jobs = rows;
  if (jobType) jobs = jobs.filter((j) => j.jobType === jobType);
  if (location) {
    const needle = location.toLowerCase();
    jobs = jobs.filter((j) => (j.location || '').toLowerCase().includes(needle));
  }
  if (search) {
    const needle = search.toLowerCase();
    jobs = jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(needle) ||
        (j.skillsRequired || []).some((s) => s.toLowerCase().includes(needle))
    );
  }
  return jobs;
}

async function getById(id) {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT ${JOB_FIELDS},
       jsonb_build_object('id', c.id, 'companyName', c.company_name, 'industry', c.industry, 'website', c.website, 'about', c.about) AS company
     FROM jobs j
     JOIN companies c ON c.id = j.company_id
     WHERE j.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function listByCompany(companyId) {
  const sql = getSql();
  return sql.query(`SELECT ${JOB_FIELDS} FROM jobs j WHERE j.company_id = $1 ORDER BY j.created_at DESC`, [
    companyId,
  ]);
}

async function create(companyId, data) {
  const sql = getSql();
  const rows = await sql.query(
    `INSERT INTO jobs AS j (
       company_id, title, description, location, job_type, min_experience,
       skills_required, minimum_requirements, pay_min, pay_max, pay_currency,
       openings, deadline
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING ${JOB_FIELDS}`,
    [
      companyId,
      data.title,
      data.description,
      data.location,
      data.jobType,
      data.minExperience,
      JSON.stringify(data.skillsRequired || []),
      JSON.stringify(data.minimumRequirements || []),
      data.payMin,
      data.payMax,
      data.payCurrency,
      data.openings,
      data.deadline,
    ]
  );
  return rows[0];
}

async function update(id, data) {
  const sql = getSql();
  const rows = await sql.query(
    `UPDATE jobs AS j SET
       title = $2, description = $3, location = $4, job_type = $5, min_experience = $6,
       skills_required = $7, minimum_requirements = $8, pay_min = $9, pay_max = $10,
       pay_currency = $11, openings = $12, deadline = $13, status = $14, updated_at = now()
     WHERE j.id = $1
     RETURNING ${JOB_FIELDS}`,
    [
      id,
      data.title,
      data.description,
      data.location,
      data.jobType,
      data.minExperience,
      JSON.stringify(data.skillsRequired || []),
      JSON.stringify(data.minimumRequirements || []),
      data.payMin,
      data.payMax,
      data.payCurrency,
      data.openings,
      data.deadline,
      data.status,
    ]
  );
  return rows[0] || null;
}

async function remove(id) {
  const sql = getSql();
  await sql.query('DELETE FROM jobs WHERE id = $1', [id]);
}

async function incrementCounts(id, { applicantDelta = 0, shortlistedDelta = 0 }) {
  const sql = getSql();
  await sql.query(
    'UPDATE jobs SET applicant_count = applicant_count + $2, shortlisted_count = shortlisted_count + $3 WHERE id = $1',
    [id, applicantDelta, shortlistedDelta]
  );
}

module.exports = { listOpen, getById, listByCompany, create, update, remove, incrementCounts };
