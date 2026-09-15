const leadsView = (() => {
  let allLeads = [];
  let pendingImportRows = [];

  const STATUS_BADGE = {
    new: 'badge-info',
    contacted: 'badge-warning',
    responded: 'badge-success',
    converted: 'badge-success',
    unsubscribed: 'badge-danger',
  };

  function applyFilters(leads) {
    const query = document.getElementById('leadSearch').value.trim().toLowerCase();
    const status = document.getElementById('leadStatusFilter').value;
    return leads.filter((lead) => {
      if (status && lead.status !== status) return false;
      if (!query) return true;
      const haystack = `${lead.name} ${lead.email} ${lead.company} ${(lead.tags || []).join(' ')}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  function render() {
    const wrap = document.getElementById('leadsTableWrap');
    const rows = applyFilters(allLeads);

    if (!allLeads.length) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="icon">📇</div>
          <h3>No leads yet</h3>
          <p>Add a lead manually or import a CSV list from your client to get started.</p>
          <button class="btn btn-primary" onclick="document.getElementById('openAddLeadModal').click()">Add your first lead</button>
        </div>`;
      return;
    }

    if (!rows.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><h3>No matches</h3><p>Try a different search or filter.</p></div>`;
      return;
    }

    wrap.innerHTML = `
      <table>
        <thead><tr>
          <th>Name</th><th>Contact</th><th>Company</th><th>Tags</th><th>Consent</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.map(rowHtml).join('')}
        </tbody>
      </table>`;
  }

  function rowHtml(lead) {
    const badge = STATUS_BADGE[lead.status] || 'badge-muted';
    return `
      <tr>
        <td class="cell-main">${escapeHtml(lead.name)}</td>
        <td>
          <div>${escapeHtml(lead.email) || '<span class="cell-sub">no email</span>'}</div>
          <div class="cell-sub">${escapeHtml(lead.phone) || 'no phone'}</div>
        </td>
        <td>${escapeHtml(lead.company) || '<span class="cell-sub">—</span>'}</td>
        <td>${(lead.tags || []).map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('') || '<span class="cell-sub">—</span>'}</td>
        <td>${lead.consentGiven ? '<span class="badge badge-success">Opted in</span>' : '<span class="badge badge-muted">No consent</span>'}</td>
        <td><span class="badge ${badge}">${lead.status}</span></td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn btn-icon btn-ghost" title="Edit" onclick="leadsView.edit('${lead.id}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
          </button>
          <button class="btn btn-icon btn-ghost" title="Delete" onclick="leadsView.remove('${lead.id}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </td>
      </tr>`;
  }

  async function refresh() {
    const data = await api.get('/leads');
    allLeads = data.leads;
    render();
    if (window.dashboardView) dashboardView.refresh();
  }

  function resetForm() {
    document.getElementById('leadId').value = '';
    document.getElementById('leadModalTitle').textContent = 'Add lead';
    ['leadName', 'leadCompany', 'leadEmail', 'leadPhone', 'leadTags', 'leadNotes'].forEach((id) => {
      document.getElementById(id).value = '';
    });
    document.getElementById('leadConsent').checked = false;
  }

  function edit(id) {
    const lead = allLeads.find((l) => l.id === id);
    if (!lead) return;
    document.getElementById('leadId').value = lead.id;
    document.getElementById('leadModalTitle').textContent = 'Edit lead';
    document.getElementById('leadName').value = lead.name || '';
    document.getElementById('leadCompany').value = lead.company || '';
    document.getElementById('leadEmail').value = lead.email || '';
    document.getElementById('leadPhone').value = lead.phone || '';
    document.getElementById('leadTags').value = (lead.tags || []).join(', ');
    document.getElementById('leadNotes').value = lead.notes || '';
    document.getElementById('leadConsent').checked = Boolean(lead.consentGiven);
    openModal('leadModalBackdrop');
  }

  async function remove(id) {
    if (!confirm('Delete this lead?')) return;
    try {
      await api.delete(`/leads/${id}`);
      showToast('Lead deleted', 'success');
      refresh();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('leadId').value;
    const payload = {
      name: document.getElementById('leadName').value,
      company: document.getElementById('leadCompany').value,
      email: document.getElementById('leadEmail').value,
      phone: document.getElementById('leadPhone').value,
      tags: document.getElementById('leadTags').value,
      notes: document.getElementById('leadNotes').value,
      consentGiven: document.getElementById('leadConsent').checked,
    };
    try {
      if (id) await api.patch(`/leads/${id}`, payload);
      else await api.post('/leads', payload);
      showToast(id ? 'Lead updated' : 'Lead added', 'success');
      closeModal('leadModalBackdrop');
      refresh();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderCsvPreview() {
    const preview = document.getElementById('csvPreview');
    if (!pendingImportRows.length) { preview.innerHTML = ''; return; }
    const withConsent = pendingImportRows.filter((r) => r.consentGiven).length;
    preview.innerHTML = `
      <p class="helper-text"><strong>${pendingImportRows.length}</strong> lead(s) ready to import
      (<strong>${withConsent}</strong> marked as consented).</p>`;
  }

  function loadCsvText(text) {
    pendingImportRows = csvToLeadRows(text);
    renderCsvPreview();
  }

  function bindImportInputs() {
    document.getElementById('csvFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      document.getElementById('csvPasteInput').value = text;
      loadCsvText(text);
    });

    document.getElementById('csvPasteInput').addEventListener('input', (e) => loadCsvText(e.target.value));

    document.getElementById('confirmImportBtn').addEventListener('click', async () => {
      if (!pendingImportRows.length) { showToast('Nothing to import yet', 'error'); return; }
      try {
        const result = await api.post('/leads/import', { leads: pendingImportRows });
        showToast(`Imported ${result.imported} lead(s)${result.rejected.length ? `, ${result.rejected.length} skipped` : ''}`, 'success');
        closeModal('importModalBackdrop');
        document.getElementById('csvFileInput').value = '';
        document.getElementById('csvPasteInput').value = '';
        document.getElementById('csvPreview').innerHTML = '';
        pendingImportRows = [];
        refresh();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  function bind() {
    document.getElementById('openAddLeadModal').addEventListener('click', () => { resetForm(); openModal('leadModalBackdrop'); });
    document.getElementById('openImportModal').addEventListener('click', () => openModal('importModalBackdrop'));
    document.getElementById('leadForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('leadSearch').addEventListener('input', render);
    document.getElementById('leadStatusFilter').addEventListener('change', render);
    bindImportInputs();
  }

  return { refresh, bind, edit, remove, getAll: () => allLeads };
})();
