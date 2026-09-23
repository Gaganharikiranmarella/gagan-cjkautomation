const { getSql } = require('../config/db');

const SELECT_FIELDS = `
  id, company_name AS "companyName", email, password_hash AS "passwordHash",
  industry, website, about,
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

async function findByEmail(email) {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT ${SELECT_FIELDS} FROM companies WHERE email = $1`,
    [(email || '').toLowerCase().trim()]
  );
  return rows[0] || null;
}

async function findById(id) {
  const sql = getSql();
  const rows = await sql.query(`SELECT ${SELECT_FIELDS} FROM companies WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function create({ companyName, email, passwordHash, industry, website }) {
  const sql = getSql();
  const rows = await sql.query(
    `INSERT INTO companies (company_name, email, password_hash, industry, website)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SELECT_FIELDS}`,
    [companyName, (email || '').toLowerCase().trim(), passwordHash, industry || '', website || '']
  );
  return rows[0];
}

module.exports = { findByEmail, findById, create };
