(function () {
  const user = session.requireRole('company');
  if (!user) return;
  document.getElementById('userName').textContent = user.companyName;
  document.getElementById('logoutBtn').addEventListener('click', session.logout);

  const jobsList = document.getElementById('jobsList');
  const jobsEmptyState = document.getElementById('jobsEmptyState');
  let myJobs = [];
  let editingJobId = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function formatPay(job) {
    if (!job.payMin && !job.payMax) return 'Not disclosed';
    const cur = job.payCurrency || '';
    if (job.payMin && job.payMax) return `${cur} ${job.payMin.toLocaleString()} - ${job.payMax.toLocaleString()}`;
    return `${cur} ${(job.payMin || job.payMax).toLocaleString()}+`;
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
    document.getElementById('statJobs').textContent = myJobs.length;
    document.getElementById('statApplicants').textContent = myJobs.reduce((s, j) => s + (j.applicantCount || 0), 0);
    document.getElementById('statShortlisted').textContent = myJobs.reduce((s, j) => s + (j.shortlistedCount || 0), 0);
  }

  // ---------- Job list ----------
  async function loadJobs() {
    const { jobs } = await api.get('/jobs/mine');
    myJobs = jobs;
    renderStats();

    jobsList.innerHTML = '';
    jobsEmptyState.classList.toggle('hidden', jobs.length > 0);

    jobs.forEach((job) => {
      const row = document.createElement('div');
      row.className = 'glass list-row fade-in';
      row.innerHTML = `
        <div class="list-row-main">
          <h4>${escapeHtml(job.title)} <span class="badge badge-${job.status}">${job.status}</span></h4>
          <div class="sub">${escapeHtml(job.location)} · ${job.jobType} · ${formatPay(job)}</div>
          <div class="chip-row" style="margin-top:8px;">
            <span class="chip">${job.applicantCount || 0} applicants</span>
            <span class="chip">${job.shortlistedCount || 0} shortlisted</span>
          </div>
        </div>
        <div class="list-row-actions">
          <button class="btn btn-ghost btn-sm" data-action="applicants">Applicants</button>
          <button class="btn btn-ghost btn-sm" data-action="edit">Edit</button>
          <button class="btn btn-ghost btn-sm" data-action="toggle">${job.status === 'open' ? 'Close' : 'Reopen'}</button>
          <button class="btn btn-danger btn-sm" data-action="delete">Delete</button>
        </div>
      `;
      row.querySelector('[data-action="applicants"]').addEventListener('click', () => openApplicantsModal(job));
      row.querySelector('[data-action="edit"]').addEventListener('click', () => openJobForm(job));
      row.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleJobStatus(job));
      row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteJob(job));
      jobsList.appendChild(row);
    });
  }

  async function toggleJobStatus(job) {
    try {
      const nextStatus = job.status === 'open' ? 'closed' : 'open';
      await api.put(`/jobs/${job.id}`, { ...jobToFormPayload(job), status: nextStatus });
      showToast(`Job ${nextStatus === 'open' ? 'reopened' : 'closed'}`, 'success');
      loadJobs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteJob(job) {
    if (!confirm(`Delete "${job.title}"? This also removes its applications.`)) return;
    try {
      await api.del(`/jobs/${job.id}`);
      showToast('Job deleted', 'success');
      loadJobs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function jobToFormPayload(job) {
    return {
      title: job.title,
      description: job.description,
      location: job.location,
      jobType: job.jobType,
      minExperience: job.minExperience,
      skillsRequired: job.skillsRequired,
      minimumRequirements: job.minimumRequirements,
      payMin: job.payMin,
      payMax: job.payMax,
      payCurrency: job.payCurrency,
      openings: job.openings,
      deadline: job.deadline,
    };
  }

  // ---------- Job form (create / edit) ----------
  const jobFormOverlay = document.getElementById('jobFormOverlay');
  const jobForm = document.getElementById('jobForm');
  const jobFormTitle = document.getElementById('jobFormTitle');
  const jobFormSubmit = document.getElementById('jobFormSubmit');

  document.getElementById('newJobBtn').addEventListener('click', () => openJobForm(null));
  document.getElementById('jobFormClose').addEventListener('click', closeJobForm);
  jobFormOverlay.addEventListener('click', (e) => {
    if (e.target === jobFormOverlay) closeJobForm();
  });

  function openJobForm(job) {
    editingJobId = job ? job.id : null;
    jobFormTitle.textContent = job ? 'Edit Job Posting' : 'Post a New Job';
    jobFormSubmit.textContent = job ? 'Save Changes' : 'Publish Job';
    jobForm.reset();
    if (job) {
      jobForm.title.value = job.title;
      jobForm.description.value = job.description;
      jobForm.location.value = job.location;
      jobForm.jobType.value = job.jobType;
      jobForm.minExperience.value = job.minExperience || 0;
      jobForm.openings.value = job.openings || 1;
      jobForm.skillsRequired.value = (job.skillsRequired || []).join(', ');
      jobForm.minimumRequirements.value = (job.minimumRequirements || []).join('\n');
      jobForm.payMin.value = job.payMin ?? '';
      jobForm.payMax.value = job.payMax ?? '';
      jobForm.payCurrency.value = job.payCurrency || 'INR';
      jobForm.deadline.value = job.deadline ? job.deadline.slice(0, 10) : '';
    }
    jobFormOverlay.classList.remove('hidden');
  }

  function closeJobForm() {
    jobFormOverlay.classList.add('hidden');
  }

  jobForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(jobForm);
    const payload = Object.fromEntries(fd.entries());

    jobFormSubmit.disabled = true;
    try {
      if (editingJobId) {
        await api.put(`/jobs/${editingJobId}`, payload);
        showToast('Job updated', 'success');
      } else {
        await api.post('/jobs', payload);
        showToast('Job published', 'success');
      }
      closeJobForm();
      loadJobs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      jobFormSubmit.disabled = false;
    }
  });

  // ---------- Applicants modal ----------
  const applicantsOverlay = document.getElementById('applicantsOverlay');
  const applicantsContent = document.getElementById('applicantsContent');
  document.getElementById('applicantsClose').addEventListener('click', () => applicantsOverlay.classList.add('hidden'));
  applicantsOverlay.addEventListener('click', (e) => {
    if (e.target === applicantsOverlay) applicantsOverlay.classList.add('hidden');
  });

  async function openApplicantsModal(job) {
    applicantsOverlay.classList.remove('hidden');
    applicantsContent.innerHTML = '<div class="spinner" style="margin: 40px auto;"></div>';
    try {
      const { applications } = await api.get(`/applications/job/${job.id}`);
      renderApplicants(job, applications);
    } catch (err) {
      applicantsContent.innerHTML = `<p class="text-faint">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderApplicants(job, applications) {
    if (!applications.length) {
      applicantsContent.innerHTML = `
        <h2>${escapeHtml(job.title)}</h2>
        <div class="empty-state"><div class="icon">📭</div><p>No applicants yet.</p></div>
      `;
      return;
    }

    applicantsContent.innerHTML = `
      <h2>${escapeHtml(job.title)}</h2>
      <p class="text-faint" style="margin-top:-8px;">${applications.length} applicant${applications.length === 1 ? '' : 's'}, sorted by match score</p>
      <div class="list" style="margin-top:16px;">
        ${applications.map((a, i) => applicantRowHtml(a, i)).join('')}
      </div>
    `;

    applications.forEach((a, i) => {
      const toggle = document.getElementById(`resumeToggle-${i}`);
      if (toggle) {
        toggle.addEventListener('click', () => {
          const box = document.getElementById(`resumeBox-${i}`);
          box.classList.toggle('hidden');
          toggle.textContent = box.classList.contains('hidden') ? 'View resume text' : 'Hide resume text';
        });
      }
    });
  }

  const FIT_LABEL = { strong: 'AI: Strong fit', moderate: 'AI: Moderate fit', weak: 'AI: Weak fit' };
  const FIT_CLASS = { strong: 'badge-shortlisted', moderate: 'badge-open', weak: 'badge-not-shortlisted' };

  // Optional Claude-generated layer, only rendered when the backend has an
  // ANTHROPIC_API_KEY configured and the call succeeded for this application.
  function aiInsightsHtml(insights) {
    if (!insights || !insights.summary) return '';
    return `
      <div style="margin-top:14px; padding-top:14px; border-top:1px solid var(--glass-border);">
        <p class="text-faint" style="margin:0 0 6px; font-size:0.78rem;">✦ AI summary ${insights.fitRating ? `<span class="badge ${FIT_CLASS[insights.fitRating]}" style="margin-left:6px;">${FIT_LABEL[insights.fitRating]}</span>` : ''}</p>
        <p style="margin-bottom:10px;">${escapeHtml(insights.summary)}</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
          ${insights.strengths?.length ? `<div><p class="text-faint" style="margin:0 0 6px; font-size:0.76rem;">Strengths</p><ul style="margin:0;">${insights.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>` : ''}
          ${insights.gaps?.length ? `<div><p class="text-faint" style="margin:0 0 6px; font-size:0.76rem;">Gaps</p><ul style="margin:0;">${insights.gaps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>` : ''}
        </div>
      </div>
    `;
  }

  function applicantRowHtml(a, i) {
    const applicant = a.applicant || {};
    return `
      <div class="glass card fade-in">
        <div style="display:flex; gap:16px; align-items:flex-start;">
          ${scoreRingHtml(a.score)}
          <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
              <div>
                <h4 style="margin-bottom:2px;">${escapeHtml(applicant.name || 'Applicant')}</h4>
                <div class="sub">${escapeHtml(applicant.email || '')}${applicant.phone ? ' · ' + escapeHtml(applicant.phone) : ''}</div>
              </div>
              <span class="badge badge-${a.status === 'shortlisted' ? 'shortlisted' : 'not-shortlisted'}">${a.status === 'shortlisted' ? 'Shortlisted' : 'Not shortlisted'}</span>
            </div>
            <p class="text-faint" style="margin:8px 0 6px; font-size:0.78rem;">Matched keywords</p>
            <div class="chip-row">${a.matchedKeywords.map((k) => `<span class="chip">${escapeHtml(k)}</span>`).join('') || '<span class="text-faint">None</span>'}</div>
            <p class="text-faint" style="margin:10px 0 6px; font-size:0.78rem;">Missing keywords</p>
            <div class="chip-row">${a.missingKeywords.map((k) => `<span class="chip chip-missing">${escapeHtml(k)}</span>`).join('') || '<span class="text-faint">None</span>'}</div>
            ${aiInsightsHtml(a.aiInsights)}
            <button class="btn btn-ghost btn-sm" id="resumeToggle-${i}" style="margin-top:12px;">View resume text</button>
            <div class="resume-text-box hidden" id="resumeBox-${i}" style="margin-top:10px;">${escapeHtml(a.resumeText)}</div>
          </div>
        </div>
      </div>
    `;
  }

  // ---------- Init ----------
  (async function init() {
    try {
      await loadJobs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  })();
})();
