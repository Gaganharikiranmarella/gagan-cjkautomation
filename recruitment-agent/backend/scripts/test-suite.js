// Resumalyze v2.0 - API test suite
//
// Runs against a live server (local dev or a deployed Vercel URL) using
// plain fetch - no test framework, nothing to install, matches the rest
// of this project's "no build step" approach.
//
// Usage:
//   node backend/scripts/test-suite.js
//   BASE_URL=https://your-deploy.vercel.app node backend/scripts/test-suite.js
//
// Three suites:
//   1. Login       - register + login for both an applicant and a company
//   2. 80%+ score  - a resume that matches 4/5 required skills (80%) and gets auto-shortlisted
//   3. 40% score   - a resume that matches 2/5 required skills (40%) and is NOT shortlisted
//
// Exits 0 if every test passed, 1 otherwise (safe to wire into CI later).

const assert = require('node:assert/strict');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3020';
const stamp = Date.now();

const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push({ name, pass: false, error: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

async function api(path, { method = 'GET', token, body, isFormData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function resumeFile(filename, text) {
  const fd = new FormData();
  fd.append('resume', new Blob([text], { type: 'text/plain' }), filename);
  return fd;
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const companyCreds = {
  role: 'company',
  companyName: 'Test Suite Co',
  email: `test-company-${stamp}@resumalyze-suite.test`,
  password: 'password123',
  industry: 'Software',
};

const applicantCreds = {
  role: 'applicant',
  name: 'Test Suite Applicant',
  email: `test-applicant-${stamp}@resumalyze-suite.test`,
  password: 'password123',
};

let companyToken;
let applicantToken;

// ---------------------------------------------------------------------------
// 1. Login suite (applicant + company)
// ---------------------------------------------------------------------------
async function loginSuite() {
  console.log('\n== 1. Login suite ==');

  await test('company: register creates an account and returns a token', async () => {
    const { status, data } = await api('/api/auth/register', { method: 'POST', body: companyCreds });
    assert.equal(status, 201);
    assert.ok(data.token);
    assert.equal(data.user.role, 'company');
  });

  await test('company: login with correct credentials succeeds', async () => {
    const { status, data } = await api('/api/auth/login', {
      method: 'POST',
      body: { role: 'company', email: companyCreds.email, password: companyCreds.password },
    });
    assert.equal(status, 200);
    assert.ok(data.token);
    companyToken = data.token;
  });

  await test('company: login with wrong password is rejected', async () => {
    const { status } = await api('/api/auth/login', {
      method: 'POST',
      body: { role: 'company', email: companyCreds.email, password: 'wrong-password' },
    });
    assert.equal(status, 400);
  });

  await test('company: GET /api/auth/me returns the logged-in profile', async () => {
    const { status, data } = await api('/api/auth/me', { token: companyToken });
    assert.equal(status, 200);
    assert.equal(data.user.companyName, companyCreds.companyName);
  });

  await test('applicant: register creates an account and returns a token', async () => {
    const { status, data } = await api('/api/auth/register', { method: 'POST', body: applicantCreds });
    assert.equal(status, 201);
    assert.ok(data.token);
    assert.equal(data.user.role, 'applicant');
  });

  await test('applicant: login with correct credentials succeeds', async () => {
    const { status, data } = await api('/api/auth/login', {
      method: 'POST',
      body: { role: 'applicant', email: applicantCreds.email, password: applicantCreds.password },
    });
    assert.equal(status, 200);
    assert.ok(data.token);
    applicantToken = data.token;
  });

  await test('applicant: login with wrong password is rejected', async () => {
    const { status } = await api('/api/auth/login', {
      method: 'POST',
      body: { role: 'applicant', email: applicantCreds.email, password: 'wrong-password' },
    });
    assert.equal(status, 400);
  });

  await test('applicant: GET /api/auth/me returns the logged-in profile', async () => {
    const { status, data } = await api('/api/auth/me', { token: applicantToken });
    assert.equal(status, 200);
    assert.equal(data.user.name, applicantCreds.name);
  });

  await test('cross-role login is rejected (applicant creds under role: company)', async () => {
    const { status } = await api('/api/auth/login', {
      method: 'POST',
      body: { role: 'company', email: applicantCreds.email, password: applicantCreds.password },
    });
    assert.equal(status, 400);
  });
}

// ---------------------------------------------------------------------------
// 2. 80%+ ATS score suite
//    Job asks for 5 skills (weight 3 each = 15 total, no other keywords).
//    Resume matches 4/5 -> 12/15 = 80% -> auto-shortlisted.
// ---------------------------------------------------------------------------
async function highScoreSuite() {
  console.log('\n== 2. 80%+ ATS score suite ==');
  let jobId;

  await test('company can post the high-match job fixture', async () => {
    const { status, data } = await api('/api/jobs', {
      method: 'POST',
      token: companyToken,
      body: {
        title: 'Full-Stack Engineer (High Match Fixture)',
        description: 'We need a dependable teammate for this position.',
        location: 'Remote',
        jobType: 'full-time',
        minExperience: 0,
        skillsRequired: 'React, Node.js, MongoDB, Express, Git',
        minimumRequirements: '',
        openings: 1,
      },
    });
    assert.equal(status, 201);
    jobId = data.job.id;
  });

  await test('resume matching 4/5 skills scores >= 80% and is shortlisted', async () => {
    const resumeText = [
      'Jane Doe - Full-Stack Developer',
      'Built production apps with React on the frontend and Node.js on the backend.',
      'Used MongoDB as the primary datastore and Git for version control.',
    ].join('\n');

    const { status, data } = await api(`/api/applications/${jobId}`, {
      method: 'POST',
      token: applicantToken,
      isFormData: true,
      body: resumeFile('high-match.txt', resumeText),
    });

    assert.equal(status, 201);
    const { score, status: verdict, matchedKeywords, missingKeywords } = data.application;
    console.log(`    score: ${score}%  status: ${verdict}  matched: [${matchedKeywords.join(', ')}]  missing: [${missingKeywords.join(', ')}]`);

    assert.ok(score >= 80, `expected score >= 80, got ${score}`);
    assert.equal(verdict, 'shortlisted');
    assert.deepEqual(matchedKeywords.slice().sort(), ['git', 'mongodb', 'node.js', 'react']);
    assert.deepEqual(missingKeywords, ['express']);
  });

  await test('applying to the same job twice is rejected', async () => {
    const { status, data } = await api(`/api/applications/${jobId}`, {
      method: 'POST',
      token: applicantToken,
      isFormData: true,
      body: resumeFile('again.txt', 'Second attempt.'),
    });
    assert.equal(status, 400);
    assert.match(data.error, /already applied/i);
  });

  await test('the company sees the shortlisted applicant, sorted to the top', async () => {
    const { status, data } = await api(`/api/applications/job/${jobId}`, { token: companyToken });
    assert.equal(status, 200);
    assert.equal(data.applications.length, 1);
    assert.equal(data.applications[0].status, 'shortlisted');
  });
}

// ---------------------------------------------------------------------------
// 3. ~40% ATS score suite
//    Job asks for 5 different skills (weight 15 total).
//    Resume matches 2/5 -> 6/15 = 40% -> NOT shortlisted (below the 65% bar).
// ---------------------------------------------------------------------------
async function lowScoreSuite() {
  console.log('\n== 3. ~40% ATS score suite ==');
  let jobId;

  await test('company can post the low-match job fixture', async () => {
    const { status, data } = await api('/api/jobs', {
      method: 'POST',
      token: companyToken,
      body: {
        title: 'Backend Engineer (Low Match Fixture)',
        description: 'We need a dependable teammate for this position.',
        location: 'Remote',
        jobType: 'full-time',
        minExperience: 0,
        skillsRequired: 'Python, Django, PostgreSQL, Docker, AWS',
        minimumRequirements: '',
        openings: 1,
      },
    });
    assert.equal(status, 201);
    jobId = data.job.id;
  });

  await test('resume matching 2/5 skills scores 40% and is NOT shortlisted', async () => {
    const resumeText = [
      'Jane Doe - Backend Developer',
      'Comfortable writing scripts in Python and shipping services inside Docker containers.',
      'New to cloud infrastructure and ORMs.',
    ].join('\n');

    const { status, data } = await api(`/api/applications/${jobId}`, {
      method: 'POST',
      token: applicantToken,
      isFormData: true,
      body: resumeFile('low-match.txt', resumeText),
    });

    assert.equal(status, 201);
    const { score, status: verdict, matchedKeywords, missingKeywords } = data.application;
    console.log(`    score: ${score}%  status: ${verdict}  matched: [${matchedKeywords.join(', ')}]  missing: [${missingKeywords.join(', ')}]`);

    assert.equal(score, 40, `expected score === 40, got ${score}`);
    assert.equal(verdict, 'not-shortlisted');
    assert.deepEqual(matchedKeywords.slice().sort(), ['docker', 'python']);
    assert.deepEqual(missingKeywords.slice().sort(), ['aws', 'django', 'postgresql']);
  });

  await test("the applicant's own list shows this application as not shortlisted", async () => {
    const { status, data } = await api('/api/applications/mine', { token: applicantToken });
    assert.equal(status, 200);
    const app = data.applications.find((a) => a.job && a.job.id === jobId);
    assert.ok(app, 'application not found in /api/applications/mine');
    assert.equal(app.status, 'not-shortlisted');
  });
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Resumalyze v2.0 test suite -> ${BASE_URL}`);

  await loginSuite();
  await highScoreSuite();
  await lowScoreSuite();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} tests passed`);

  if (failed.length) {
    console.log('\nFailed:');
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.error}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
