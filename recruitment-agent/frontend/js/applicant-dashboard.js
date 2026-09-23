(function () {
  const user = session.requireRole('applicant');
  if (!user) return;
  document.getElementById('userName').textContent = user.name;
  document.getElementById('logoutBtn').addEventListener('click', session.logout);

  const jobGrid = document.getElementById('jobGrid');
  const jobEmptyState = document.getElementById('jobEmptyState');
  const applicationsList = document.getElementById('applicationsList');
  const applicationsEmptyState = document.getElementById('applicationsEmptyState');
  const searchInput = document.getElementById('searchInput');
  const jobTypeFilter = document.getElementById('jobTypeFilter');
  const locationFilter = document.getElementById('locationFilter');

  let myApplications = [];
  let applicationByJobId = new Map();

  // ---------- Tabs ----------
  document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn[data-tab]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('panelBrowse').classList.toggle('hidden', tab !== 'browse');
      document.getElementById('panelApplications').classList.toggle('hidden', tab !== 'applications');
    });
  });

  // ---------- Helpers ----------
  function formatPay(job) {
    if (!job.payMin && !job.payMax) return 'Not disclosed';
    const cur = job.payCurrency || '';
    if (job.payMin && job.payMax) return `${cur} ${job.payMin.toLocaleString()} - ${job.payMax.toLocaleString()}`;
    return `${cur} ${(job.payMin || job.payMax).toLocaleString()}+`;
  }

  function timeAgo(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diffMs / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  function scoreRingColor(score) {
    if (score >= 65) return 'var(--teal-400)';
    if (score >= 40) return '#fbbf24';
    return 'var(--danger)';
  }

  function scoreRingHtml(score, sizeClass = '') {
    return `<div class="score-ring ${sizeClass}" style="--pct:${score}; --ring-color:${scoreRingColor(score)};"><span>${score}%</span></div>`;
  }

  // ---------- Stats ----------
  function renderStats() {
    document.getElementById('statApplied').textContent = myApplications.length;
    const shortlisted = myApplications.filter((a) => a.status === 'shortlisted').length;
    document.getElementById('statShortlisted').textContent = shortlisted;
    if (myApplications.length) {
      const avg = Math.round(myApplications.reduce((sum, a) => sum + a.score, 0) / myApplications.length);
      document.getElementById('statAvgScore').textContent = `${avg}%`;
    } else {
      document.getElementById('statAvgScore').textContent = '—';
    }
  }

  // ---------- Browse jobs ----------
  async function loadJobs() {
    const params = new URLSearchParams();
    if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
    if (jobTypeFilter.value) params.set('jobType', jobTypeFilter.value);
    if (locationFilter.value.trim()) params.set('location', locationFilter.value.trim());

    const { jobs } = await api.get(`/jobs?${params.toString()}`);
    jobGrid.innerHTML = '';
    jobEmptyState.classList.toggle('hidden', jobs.length > 0);

    jobs.forEach((job) => {
      const applied = applicationByJobId.get(job.id);
      const card = document.createElement('div');
      card.className = 'glass job-card fade-in';
      card.innerHTML = `
        <div class="job-card-top">
          <div>
            <h3>${escapeHtml(job.title)}</h3>
            <div class="company-name">${escapeHtml(job.company?.companyName || 'Company')}</div>
          </div>
          ${applied ? `<span class="badge badge-${applied.status === 'shortlisted' ? 'shortlisted' : 'not-shortlisted'}">${applied.status === 'shortlisted' ? 'Shortlisted' : 'Applied'}</span>` : ''}
        </div>
        <div class="job-meta-row">
          <span>📍 ${escapeHtml(job.location)}</span>
          <span>💼 ${job.jobType}</span>
          ${job.minExperience ? `<span>⏱ ${job.minExperience}+ yrs</span>` : ''}
        </div>
        <div class="chip-row">
          ${(job.skillsRequired || []).slice(0, 4).map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join('')}
          ${job.skillsRequired.length > 4 ? `<span class="chip chip-muted">+${job.skillsRequired.length - 4} more</span>` : ''}
        </div>
        <div class="job-card-footer">
          <span class="pay-range">${formatPay(job)}</span>
          <span class="text-faint" style="font-size:0.74rem;">${timeAgo(job.createdAt)}</span>
        </div>
      `;
      card.addEventListener('click', () => openJobModal(job.id));
      jobGrid.appendChild(card);
    });
  }

  // ---------- My applications ----------
  async function loadApplications() {
    const { applications } = await api.get('/applications/mine');
    myApplications = applications;
    applicationByJobId = new Map(applications.filter((a) => a.job).map((a) => [a.job.id, a]));
    renderStats();

    applicationsList.innerHTML = '';
    applicationsEmptyState.classList.toggle('hidden', applications.length > 0);

    applications.forEach((a) => {
      if (!a.job) return;
      const row = document.createElement('div');
      row.className = 'glass list-row fade-in';
      row.innerHTML = `
        ${scoreRingHtml(a.score, 'sm')}
        <div class="list-row-main">
          <h4>${escapeHtml(a.job.title)}</h4>
          <div class="sub">${escapeHtml(a.job.company?.companyName || 'Company')} · Applied ${timeAgo(a.createdAt)}</div>
          <div class="chip-row" style="margin-top:8px;">
            ${a.matchedKeywords.slice(0, 6).map((k) => `<span class="chip">${escapeHtml(k)}</span>`).join('')}
          </div>
        </div>
        <div class="list-row-actions">
          <span class="badge badge-${a.status === 'shortlisted' ? 'shortlisted' : 'not-shortlisted'}">${a.status === 'shortlisted' ? 'Shortlisted' : 'Not shortlisted'}</span>
        </div>
      `;
      row.addEventListener('click', () => openJobModal(a.job.id));
      applicationsList.appendChild(row);
    });
  }

  // ---------- Job detail modal ----------
  const overlay = document.getElementById('jobModalOverlay');
  const content = document.getElementById('jobModalContent');
  document.getElementById('jobModalClose').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  function closeModal() {
    overlay.classList.add('hidden');
  }

  async function openJobModal(jobId) {
    overlay.classList.remove('hidden');
    content.innerHTML = '<div class="spinner" style="margin: 40px auto;"></div>';
    const { job } = await api.get(`/jobs/${jobId}`);
    const applied = applicationByJobId.get(job.id);
    renderJobModal(job, applied);
  }

  function renderJobModal(job, applied) {
    content.innerHTML = `
      <h2>${escapeHtml(job.title)}</h2>
      <p class="text-faint" style="margin-top:-8px;">${escapeHtml(job.company?.companyName || 'Company')} · ${escapeHtml(job.location)}</p>

      <div class="detail-grid" style="margin: 18px 0;">
        <div><span class="k">Job type</span><br/><span class="v">${job.jobType}</span></div>
        <div><span class="k">Min. experience</span><br/><span class="v">${job.minExperience || 0} yrs</span></div>
        <div><span class="k">Pay</span><br/><span class="v">${formatPay(job)}</span></div>
        <div><span class="k">Openings</span><br/><span class="v">${job.openings || 1}</span></div>
      </div>

      <div class="detail-section">
        <h4>Description</h4>
        <p>${escapeHtml(job.description).replace(/\n/g, '<br/>')}</p>
      </div>

      ${job.minimumRequirements?.length ? `
      <div class="detail-section">
        <h4>Minimum Requirements</h4>
        <ul>${job.minimumRequirements.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
      </div>` : ''}

      <div class="detail-section">
        <h4>Skills</h4>
        <div class="chip-row">${(job.skillsRequired || []).map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join('')}</div>
      </div>

      <div id="applySection"></div>
    `;

    const applySection = document.getElementById('applySection');

    if (applied) {
      applySection.innerHTML = `
        <div class="detail-section" style="border-top:1px solid var(--glass-border); padding-top:18px;">
          <h4>Your Result</h4>
          <div style="display:flex; align-items:center; gap:16px; margin-bottom:14px;">
            ${scoreRingHtml(applied.score)}
            <div>
              <span class="badge badge-${applied.status === 'shortlisted' ? 'shortlisted' : 'not-shortlisted'}">${applied.status === 'shortlisted' ? 'Shortlisted' : 'Not shortlisted'}</span>
              <p class="text-faint" style="margin:6px 0 0;">Score needed to be shortlisted: 65%</p>
            </div>
          </div>
          <p class="text-faint" style="margin-bottom:6px;">Matched keywords</p>
          <div class="chip-row" style="margin-bottom:14px;">${applied.matchedKeywords.map((k) => `<span class="chip">${escapeHtml(k)}</span>`).join('') || '<span class="text-faint">None</span>'}</div>
          <p class="text-faint" style="margin-bottom:6px;">Missing keywords</p>
          <div class="chip-row">${applied.missingKeywords.map((k) => `<span class="chip chip-missing">${escapeHtml(k)}</span>`).join('') || '<span class="text-faint">None</span>'}</div>
        </div>
        ${aiInsightsHtml(applied.aiInsights)}
      `;
      return;
    }

    if (job.status !== 'open') {
      applySection.innerHTML = `<div class="detail-section" style="border-top:1px solid var(--glass-border); padding-top:18px;"><p class="text-faint">This role is no longer accepting applications.</p></div>`;
      return;
    }

    applySection.innerHTML = `
      <div class="detail-section" style="border-top:1px solid var(--glass-border); padding-top:18px;">
        <h4>Apply Now</h4>
        <label class="file-drop" id="fileDrop">
          <input type="file" id="resumeInput" accept=".pdf,.docx,.txt" />
          <div class="file-drop-label">📄 Click to choose your resume</div>
          <div class="file-drop-hint">PDF, DOCX or TXT — max 5MB</div>
          <div class="file-drop-name" id="fileDropName"></div>
        </label>
        <button class="btn btn-primary btn-block" id="applyBtn" style="margin-top:14px;" disabled>Submit Application</button>
      </div>
    `;

    const fileInput = document.getElementById('resumeInput');
    const fileDropName = document.getElementById('fileDropName');
    const applyBtn = document.getElementById('applyBtn');

    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) {
        fileDropName.textContent = fileInput.files[0].name;
        applyBtn.disabled = false;
      }
    });

    applyBtn.addEventListener('click', async () => {
      if (!fileInput.files[0]) return;
      applyBtn.disabled = true;
      applyBtn.innerHTML = '<span class="spinner"></span> Analyzing your resume…';
      try {
        const fd = new FormData();
        fd.append('resume', fileInput.files[0]);
        const { application } = await api.post(`/applications/${job.id}`, fd, { isFormData: true });
        showToast(
          application.status === 'shortlisted'
            ? `You scored ${application.score}% — shortlisted! 🎉`
            : `You scored ${application.score}% — not shortlisted this time.`,
          application.status === 'shortlisted' ? 'success' : 'error'
        );
        await loadApplications();
        renderJobModal(job, applicationByJobId.get(job.id));
        loadJobs();
      } catch (err) {
        showToast(err.message, 'error');
        applyBtn.disabled = false;
        applyBtn.textContent = 'Submit Application';
      }
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  const FIT_LABEL = { strong: 'Strong fit', moderate: 'Moderate fit', weak: 'Needs work' };
  const FIT_CLASS = { strong: 'badge-shortlisted', moderate: 'badge-open', weak: 'badge-not-shortlisted' };

  // Renders the optional Claude-generated layer (summary/strengths/tips) on
  // top of the ATS score. Returns '' when AI analysis wasn't run (no API
  // key configured, or the call failed) so the rest of the UI is unaffected.
  function aiInsightsHtml(insights) {
    if (!insights || !insights.summary) return '';
    return `
      <div class="detail-section" style="border-top:1px solid var(--glass-border); padding-top:18px;">
        <h4>✦ AI Insights ${insights.fitRating ? `<span class="badge ${FIT_CLASS[insights.fitRating]}" style="margin-left:8px;">${FIT_LABEL[insights.fitRating]}</span>` : ''}</h4>
        <p>${escapeHtml(insights.summary)}</p>
        ${insights.strengths?.length ? `
        <p class="text-faint" style="margin-bottom:6px;">Your strengths for this role</p>
        <ul style="margin:0 0 14px;">${insights.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : ''}
        ${insights.improvementTips?.length ? `
        <p class="text-faint" style="margin-bottom:6px;">Tips to strengthen your resume</p>
        <ul style="margin:0;">${insights.improvementTips.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : ''}
      </div>
    `;
  }

  // ---------- Filters ----------
  let debounceTimer;
  [searchInput, jobTypeFilter, locationFilter].forEach((el) => {
    el.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadJobs, 300);
    });
  });

  // ---------- Init ----------
  (async function init() {
    try {
      await loadApplications();
      await loadJobs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  })();
})();
