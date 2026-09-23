const { getSql } = require('../config/db');

const SELECT_FIELDS = `
  id, name, email, password_hash AS "passwordHash", phone, headline,
  experience_years AS "experienceYears", skills,
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

async function findByEmail(email) {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT ${SELECT_FIELDS} FROM applicants WHERE email = $1`,
    [(email || '').toLowerCase().trim()]
  );
  return rows[0] || null;
}

async function findById(id) {
  const sql = getSql();
  const rows = await sql.query(`SELECT ${SELECT_FIELDS} FROM applicants WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function create({ name, email, passwordHash, phone, headline }) {
  const sql = getSql();
  const rows = await sql.query(
    `INSERT INTO applicants (name, email, password_hash, phone, headline)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SELECT_FIELDS}`,
    [name, (email || '').toLowerCase().trim(), passwordHash, phone || '', headline || '']
  );
  return rows[0];
}

module.exports = { findByEmail, findById, create };
