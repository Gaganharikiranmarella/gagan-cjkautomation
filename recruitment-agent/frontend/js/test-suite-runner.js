// In-browser port of backend/scripts/test-suite.js - same fixtures, same
// assertions, so the exact same 80%/40% scoring claims can be demoed live
// against this deployment without opening a terminal. Everything here runs
// as fetch() calls from the visitor's own browser against this origin.
(function () {
  const logPanel = document.getElementById('logPanel');
  const runBtn = document.getElementById('runBtn');
  const targetChip = document.getElementById('targetChip');
  const statPassed = document.getElementById('statPassed');
  const statFailed = document.getElementById('statFailed');
  const statDuration = document.getElementById('statDuration');

  targetChip.textContent = `target: ${window.location.origin}`;

  let passCount = 0;
  let failCount = 0;

  function section(title) {
    const el = document.createElement('div');
    el.className = 'log-section';
    el.textContent = title;
    logPanel.appendChild(el);
  }

  function logLine(pass, name) {
    const row = document.createElement('div');
    row.className = `log-line ${pass ? 'log-pass' : 'log-fail'}`;
    row.innerHTML = `<span class="icon">${pass ? '✓' : '✗'}</span><span class="name">${escapeHtml(name)}</span>`;
    logPanel.appendChild(row);
    logPanel.scrollTop = logPanel.scrollHeight;
  }

  function logError(message) {
    const row = document.createElement('div');
    row.className = 'log-error';
    row.textContent = message;
    logPanel.appendChild(row);
  }

  function logDetail(text) {
    const row = document.createElement('div');
    row.className = 'log-detail';
    row.textContent = text;
    logPanel.appendChild(row);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  // ---------- tiny assertion helpers ----------
  function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(msg || `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }
  function assertOk(value, msg) {
    if (!value) throw new Error(msg || 'expected a truthy value');
  }
  function assertSortedEqual(actual, expected, msg) {
    const a = [...actual].sort();
    const b = [...expected].sort();
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error(msg || `expected [${b.join(', ')}], got [${a.join(', ')}]`);
    }
  }
  function assertMatch(str, regex, msg) {
    if (!regex.test(str || '')) throw new Error(msg || `expected "${str}" to match ${regex}`);
  }

  async function test(name, fn) {
    try {
      await fn();
      passCount += 1;
      logLine(true, name);
    } catch (err) {
      failCount += 1;
      logLine(false, name);
      logError(err.message);
    }
    statPassed.textContent = passCount;
    statFailed.textContent = failCount;
  }

  async function api(path, { method = 'GET', token, body, isFormData } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body && !isFormData) headers['Content-Type'] = 'application/json';

    const res = await fetch(path, {
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

  // ---------------------------------------------------------------------
  // Fixtures (identical to backend/scripts/test-suite.js)
  // ---------------------------------------------------------------------
  function freshCreds() {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      company: {
        role: 'company',
        companyName: 'Test Suite Co',
        email: `test-company-${stamp}@resumalyze-suite.test`,
        password: 'password123',
        industry: 'Software',
      },
      applicant: {
        role: 'applicant',
        name: 'Test Suite Applicant',
        email: `test-applicant-${stamp}@resumalyze-suite.test`,
        password: 'password123',
      },
    };
  }

  async function runSuite() {
    logPanel.innerHTML = '';
    passCount = 0;
    failCount = 0;
    statPassed.textContent = '0';
    statFailed.textContent = '0';
    statDuration.textContent = '—';
    const startedAt = performance.now();

    const { company: companyCreds, applicant: applicantCreds } = freshCreds();
    let companyToken, applicantToken;

    // ---------- 1. Login suite ----------
    section('1. Login suite');

    await test('company: register creates an account and returns a token', async () => {
      const { status, data } = await api('/api/auth/register', { method: 'POST', body: companyCreds });
      assertEqual(status, 201);
      assertOk(data.token);
      assertEqual(data.user.role, 'company');
    });

    await test('company: login with correct credentials succeeds', async () => {
      const { status, data } = await api('/api/auth/login', {
        method: 'POST',
        body: { role: 'company', email: companyCreds.email, password: companyCreds.password },
      });
      assertEqual(status, 200);
      assertOk(data.token);
      companyToken = data.token;
    });

    await test('company: login with wrong password is rejected', async () => {
      const { status } = await api('/api/auth/login', {
        method: 'POST',
        body: { role: 'company', email: companyCreds.email, password: 'wrong-password' },
      });
      assertEqual(status, 400);
    });

    await test('company: GET /api/auth/me returns the logged-in profile', async () => {
      const { status, data } = await api('/api/auth/me', { token: companyToken });
      assertEqual(status, 200);
      assertEqual(data.user.companyName, companyCreds.companyName);
    });

    await test('applicant: register creates an account and returns a token', async () => {
      const { status, data } = await api('/api/auth/register', { method: 'POST', body: applicantCreds });
      assertEqual(status, 201);
      assertOk(data.token);
      assertEqual(data.user.role, 'applicant');
    });

    await test('applicant: login with correct credentials succeeds', async () => {
      const { status, data } = await api('/api/auth/login', {
        method: 'POST',
        body: { role: 'applicant', email: applicantCreds.email, password: applicantCreds.password },
      });
      assertEqual(status, 200);
      assertOk(data.token);
      applicantToken = data.token;
    });

    await test('applicant: login with wrong password is rejected', async () => {
      const { status } = await api('/api/auth/login', {
        method: 'POST',
        body: { role: 'applicant', email: applicantCreds.email, password: 'wrong-password' },
      });
      assertEqual(status, 400);
    });

    await test('applicant: GET /api/auth/me returns the logged-in profile', async () => {
      const { status, data } = await api('/api/auth/me', { token: applicantToken });
      assertEqual(status, 200);
      assertEqual(data.user.name, applicantCreds.name);
    });

    await test('cross-role login is rejected (applicant creds under role: company)', async () => {
      const { status } = await api('/api/auth/login', {
        method: 'POST',
        body: { role: 'company', email: applicantCreds.email, password: applicantCreds.password },
      });
      assertEqual(status, 400);
    });

    // ---------- 2. 80%+ score suite ----------
    section('2. 80%+ ATS score suite');
    let highJobId;

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
      assertEqual(status, 201);
      highJobId = data.job.id;
    });

    await test('resume matching 4/5 skills scores >= 80% and is shortlisted', async () => {
      const resumeText = [
        'Jane Doe - Full-Stack Developer',
        'Built production apps with React on the frontend and Node.js on the backend.',
        'Used MongoDB as the primary datastore and Git for version control.',
      ].join('\n');

      const { status, data } = await api(`/api/applications/${highJobId}`, {
        method: 'POST',
        token: applicantToken,
        isFormData: true,
        body: resumeFile('high-match.txt', resumeText),
      });

      assertEqual(status, 201);
      const { score, status: verdict, matchedKeywords, missingKeywords } = data.application;
      logDetail(`score: ${score}%  status: ${verdict}  matched: [${matchedKeywords.join(', ')}]  missing: [${missingKeywords.join(', ')}]`);

      assertOk(score >= 80, `expected score >= 80, got ${score}`);
      assertEqual(verdict, 'shortlisted');
      assertSortedEqual(matchedKeywords, ['git', 'mongodb', 'node.js', 'react']);
      assertSortedEqual(missingKeywords, ['express']);
    });

    await test('applying to the same job twice is rejected', async () => {
      const { status, data } = await api(`/api/applications/${highJobId}`, {
        method: 'POST',
        token: applicantToken,
        isFormData: true,
        body: resumeFile('again.txt', 'Second attempt.'),
      });
      assertEqual(status, 400);
      assertMatch(data.error, /already applied/i);
    });

    await test('the company sees the shortlisted applicant, sorted to the top', async () => {
      const { status, data } = await api(`/api/applications/job/${highJobId}`, { token: companyToken });
      assertEqual(status, 200);
      assertEqual(data.applications.length, 1);
      assertEqual(data.applications[0].status, 'shortlisted');
    });

    // ---------- 3. ~40% score suite ----------
    section('3. ~40% ATS score suite');
    let lowJobId;

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
      assertEqual(status, 201);
      lowJobId = data.job.id;
    });

    await test('resume matching 2/5 skills scores 40% and is NOT shortlisted', async () => {
      const resumeText = [
        'Jane Doe - Backend Developer',
        'Comfortable writing scripts in Python and shipping services inside Docker containers.',
        'New to cloud infrastructure and ORMs.',
      ].join('\n');

      const { status, data } = await api(`/api/applications/${lowJobId}`, {
        method: 'POST',
        token: applicantToken,
        isFormData: true,
        body: resumeFile('low-match.txt', resumeText),
      });

      assertEqual(status, 201);
      const { score, status: verdict, matchedKeywords, missingKeywords } = data.application;
      logDetail(`score: ${score}%  status: ${verdict}  matched: [${matchedKeywords.join(', ')}]  missing: [${missingKeywords.join(', ')}]`);

      assertEqual(score, 40, `expected score === 40, got ${score}`);
      assertEqual(verdict, 'not-shortlisted');
      assertSortedEqual(matchedKeywords, ['docker', 'python']);
      assertSortedEqual(missingKeywords, ['aws', 'django', 'postgresql']);
    });

    await test("the applicant's own list shows this application as not shortlisted", async () => {
      const { status, data } = await api('/api/applications/mine', { token: applicantToken });
      assertEqual(status, 200);
      const app = data.applications.find((a) => a.job && a.job.id === lowJobId);
      assertOk(app, 'application not found in /api/applications/mine');
      assertEqual(app.status, 'not-shortlisted');
    });

    // ---------- summary ----------
    const durationSec = ((performance.now() - startedAt) / 1000).toFixed(1);
    statDuration.textContent = `${durationSec}s`;

    const summary = document.createElement('div');
    summary.className = 'log-summary';
    summary.style.color = failCount === 0 ? 'var(--teal-300)' : '#fda4af';
    summary.textContent = `${passCount}/${passCount + failCount} tests passed in ${durationSec}s`;
    logPanel.appendChild(summary);
    logPanel.scrollTop = logPanel.scrollHeight;
  }

  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="spin">&#9696;</span> Running…';
    try {
      await runSuite();
    } catch (err) {
      logError(`Suite crashed: ${err.message}`);
    } finally {
      runBtn.disabled = false;
      runBtn.innerHTML = '&#9654; Run Test Suite';
    }
  });
})();
