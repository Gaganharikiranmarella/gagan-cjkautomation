const jobForm = document.getElementById('job-form');
const jobPillsEl = document.getElementById('job-pills');
const jobHint = document.getElementById('job-hint');
const candidateForm = document.getElementById('candidate-form');
const submitBtn = candidateForm.querySelector('button[type="submit"]');
const pipelineBody = document.querySelector('#pipeline-table tbody');
const pipelineEmpty = document.getElementById('pipeline-empty');
const shortlistFeed = document.getElementById('shortlist-feed');
const shortlistEmpty = document.getElementById('shortlist-empty');
const themeToggle = document.getElementById('theme-toggle');
const dropzone = document.getElementById('dropzone');
const resumeTextarea = document.getElementById('resume-text');
const statusTabs = document.getElementById('status-tabs');
const searchInput = document.getElementById('candidate-search');
const sortScoreHeader = document.getElementById('sort-score');
const overlay = document.getElementById('detail-overlay');
const detailBody = document.getElementById('detail-body');
const detailClose = document.getElementById('detail-close');
const toastContainer = document.getElementById('toast-container');

let jobs = [];
let activeJobId = null;
let candidates = [];
let invitesByCandidateId = {};
let filterStatus = '';
let searchTerm = '';
let sortDir = 'desc';

// ---------- Theme ----------
(function initTheme() {
  const saved = localStorage.getItem('resumalyze-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  themeToggle.textContent = currentTheme() === 'dark' ? '☀️' : '🌙';
})();

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

themeToggle.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('resumalyze-theme', next);
  themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
});

// ---------- Tag inputs (job skills) ----------
const tagState = { mustHaveSkills: [], niceToHaveSkills: [] };
document.querySelectorAll('.tag-input').forEach(wrapper => {
  const field = wrapper.dataset.field;
  const tagsEl = wrapper.querySelector('.tags');
  const input = wrapper.querySelector('input');

  function renderTags() {
    tagsEl.innerHTML = '';
    tagState[field].forEach((tag, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `${escapeHtml(tag)} <button type="button" aria-label="Remove">✕</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        tagState[field].splice(i, 1);
        renderTags();
      });
      tagsEl.appendChild(chip);
    });
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = input.value.trim().toLowerCase();
      if (val && !tagState[field].includes(val)) {
        tagState[field].push(val);
        renderTags();
      }
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && tagState[field].length) {
      tagState[field].pop();
      renderTags();
    }
  });
});

// ---------- Job creation ----------
jobForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = Object.fromEntries(new FormData(jobForm).entries());
  const payload = {
    title: raw.title,
    description: raw.description,
    minExperienceYears: raw.minExperienceYears ? Number(raw.minExperienceYears) : 0,
    mustHaveSkills: tagState.mustHaveSkills,
    niceToHaveSkills: tagState.niceToHaveSkills,
  };
  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to create job');
    jobForm.reset();
    tagState.mustHaveSkills = [];
    tagState.niceToHaveSkills = [];
    document.querySelectorAll('.tag-input .tags').forEach(t => t.innerHTML = '');
    const job = await res.json();
    toast(`Job "${job.title}" created`, 'success');
    await refreshJobs(job.id);
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ---------- Dropzone (drag a .txt resume in) ----------
['dragenter', 'dragover'].forEach(evt =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); })
);
['dragleave', 'drop'].forEach(evt =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); })
);
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (!/\.txt$/i.test(file.name)) {
    toast('Only .txt resume files can be auto-filled — paste other formats as text', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => { resumeTextarea.value = reader.result; toast(`Loaded ${file.name}`, 'success'); };
  reader.readAsText(file);
});

// ---------- Candidate submission ----------
candidateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeJobId) {
    toast('Create or select a job first', 'error');
    return;
  }
  const data = Object.fromEntries(new FormData(candidateForm).entries());
  data.jobId = activeJobId;
  setSubmitting(true);
  try {
    const res = await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to submit application');
    const { candidate } = await res.json();
    candidateForm.reset();
    toast(`${candidate.name || 'Candidate'} scored ${candidate.score ?? '—'} · ${candidate.status}`,
      candidate.status === 'shortlisted' ? 'success' : candidate.status === 'invalid' ? 'error' : 'default');
    await refreshCandidates();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setSubmitting(false);
  }
});

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  submitBtn.querySelector('.btn-label').textContent = isSubmitting ? 'Screening…' : 'Submit Application';
  submitBtn.querySelector('.spinner').hidden = !isSubmitting;
}

// ---------- Jobs ----------
async function refreshJobs(selectId) {
  jobs = await fetch('/api/jobs').then(r => r.json());
  jobHint.style.display = jobs.length ? 'none' : 'block';
  if (selectId) activeJobId = String(selectId);
  else if (!activeJobId && jobs.length) activeJobId = String(jobs[0].id);
  else if (jobs.length && !jobs.some(j => String(j.id) === activeJobId)) activeJobId = String(jobs[0].id);

  jobPillsEl.innerHTML = jobs.map(j => `
    <button type="button" class="job-pill ${String(j.id) === activeJobId ? 'active' : ''}" data-id="${j.id}">
      ${escapeHtml(j.title)} · min ${j.minExperienceYears}y
    </button>
  `).join('');
  jobPillsEl.querySelectorAll('.job-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      activeJobId = btn.dataset.id;
      jobPillsEl.querySelectorAll('.job-pill').forEach(b => b.classList.toggle('active', b === btn));
      refreshCandidates();
    });
  });

  await refreshCandidates();
}

// ---------- Candidates / pipeline ----------
async function refreshCandidates() {
  if (!activeJobId) {
    candidates = [];
    invitesByCandidateId = {};
    renderStats();
    renderPipeline();
    renderShortlist([]);
    return;
  }
  const [allCandidates, invites] = await Promise.all([
    fetch(`/api/candidates?jobId=${activeJobId}`).then(r => r.json()),
    fetch(`/api/invites?jobId=${activeJobId}`).then(r => r.json()),
  ]);
  candidates = allCandidates;
  invitesByCandidateId = Object.fromEntries(invites.map(i => [i.candidateId, i]));
  renderStats();
  renderPipeline();
  renderShortlist(candidates.filter(c => c.status === 'shortlisted'));
}

function renderStats() {
  const counts = { shortlisted: 0, consider: 0, rejected: 0, invalid: 0 };
  candidates.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });
  document.getElementById('stat-total').textContent = candidates.length;
  document.getElementById('stat-shortlisted').textContent = counts.shortlisted;
  document.getElementById('stat-consider').textContent = counts.consider;
  document.getElementById('stat-rejected').textContent = counts.rejected;
  document.getElementById('stat-invalid').textContent = counts.invalid;
  document.querySelectorAll('.stat-card').forEach(card => {
    card.classList.toggle('active', card.dataset.status === filterStatus);
  });
}

document.querySelectorAll('.stat-card').forEach(card => {
  card.addEventListener('click', () => {
    filterStatus = card.dataset.status;
    syncTabs();
    renderStats();
    renderPipeline();
  });
});

statusTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  filterStatus = btn.dataset.filter;
  syncTabs();
  renderStats();
  renderPipeline();
});

function syncTabs() {
  statusTabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.filter === filterStatus));
}

searchInput.addEventListener('input', () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  renderPipeline();
});

sortScoreHeader.addEventListener('click', () => {
  sortDir = sortDir === 'desc' ? 'asc' : 'desc';
  sortScoreHeader.querySelector('.sort-arrow').textContent = sortDir === 'desc' ? '↓' : '↑';
  renderPipeline();
});

function visibleCandidates() {
  let list = candidates;
  if (filterStatus) list = list.filter(c => c.status === filterStatus);
  if (searchTerm) list = list.filter(c => (c.name || '').toLowerCase().includes(searchTerm));
  list = [...list].sort((a, b) => {
    const sa = a.score ?? -1, sb = b.score ?? -1;
    return sortDir === 'desc' ? sb - sa : sa - sb;
  });
  return list;
}

function renderPipeline() {
  const list = visibleCandidates();
  pipelineBody.innerHTML = '';
  pipelineEmpty.style.display = list.length ? 'none' : 'block';
  pipelineEmpty.textContent = candidates.length ? 'No candidates match this filter.' : 'No candidates yet.';
  for (const c of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(c.name || '(unknown)')}</strong><br><span style="color:var(--muted)">${escapeHtml(c.email || '')}</span></td>
      <td>${c.score ?? '—'}</td>
      <td class="status-${c.status}">${c.status}${c.issues && c.issues.length ? `<br><span style="font-weight:400;color:var(--muted)">${escapeHtml(c.issues.join('; '))}</span>` : ''}</td>
      <td>${renderSkills(c.matchedMustHave)}${renderSkills(c.matchedNiceToHave)}</td>
      <td>${renderSkills(c.missingMustHave)}</td>
      <td>${escapeHtml(c.nextAction)}</td>
    `;
    tr.addEventListener('click', () => openDetail(c));
    pipelineBody.appendChild(tr);
  }
}

function renderSkills(skills) {
  return (skills || []).map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('');
}

function renderShortlist(items) {
  shortlistFeed.innerHTML = '';
  shortlistEmpty.style.display = items.length ? 'none' : 'block';
  for (const c of items) {
    const div = document.createElement('div');
    div.className = 'feed-item';
    div.innerHTML = `
      <div class="fi-top"><span>${escapeHtml(c.name)} · ${escapeHtml(c.jobTitle)}</span><span>Score ${c.score}</span></div>
      <div class="fi-summary">${escapeHtml(c.nextAction)}</div>
    `;
    div.addEventListener('click', () => openDetail(c));
    shortlistFeed.appendChild(div);
  }
}

// ---------- Detail overlay ----------
function openDetail(c) {
  const invite = invitesByCandidateId[c.id];
  detailBody.innerHTML = `
    <h3>${escapeHtml(c.name || '(unknown)')}</h3>
    <div class="detail-meta">${escapeHtml(c.email || 'no email')} · ${escapeHtml(c.phone || 'no phone')} · applied for ${escapeHtml(c.jobTitle)}</div>
    <div class="detail-section">
      <h4>Match</h4>
      <p><span class="status-${c.status}">${c.status}</span> · score ${c.score ?? '—'} · ${c.experienceYears ?? 0} yrs experience · ${escapeHtml(c.educationLevel || 'Unspecified')}</p>
      ${c.matchedMustHave && c.matchedMustHave.length ? `<p>Matched must-have: ${renderSkills(c.matchedMustHave)}</p>` : ''}
      ${c.matchedNiceToHave && c.matchedNiceToHave.length ? `<p>Matched nice-to-have: ${renderSkills(c.matchedNiceToHave)}</p>` : ''}
      ${c.missingMustHave && c.missingMustHave.length ? `<p>Missing: ${renderSkills(c.missingMustHave)}</p>` : ''}
      ${c.issues && c.issues.length ? `<p>Issues: ${escapeHtml(c.issues.join('; '))}</p>` : ''}
    </div>
    ${invite ? `
      <div class="detail-section">
        <h4>Interview invite draft</h4>
        <div class="email-draft"><strong>${escapeHtml(invite.draft.subject)}</strong>\n\n${escapeHtml(invite.draft.body)}</div>
      </div>` : ''}
    ${c.resumeText ? `
      <div class="detail-section">
        <h4>Resume text</h4>
        <pre class="resume-text">${escapeHtml(c.resumeText)}</pre>
      </div>` : ''}
  `;
  overlay.hidden = false;
}

detailClose.addEventListener('click', () => { overlay.hidden = true; });
overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') overlay.hidden = true; });

// ---------- Toasts ----------
function toast(message, kind = 'default') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

refreshJobs();
