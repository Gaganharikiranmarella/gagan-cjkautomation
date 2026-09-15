const campaignsView = (() => {
  let allCampaigns = [];
  const pollers = new Map();

  const CHANNEL_LABEL = { email: 'Email', whatsapp: 'WhatsApp', sms: 'SMS' };
  const STATUS_BADGE = {
    draft: 'badge-muted',
    sending: 'badge-warning',
    completed: 'badge-success',
    failed: 'badge-danger',
  };

  const TOKENS = ['name', 'firstName', 'company', 'email', 'phone'];

  function renderTokenRow() {
    document.getElementById('tokenRow').innerHTML = TOKENS.map((t) => (
      `<button type="button" class="token-chip" data-token="${t}">{{${t}}}</button>`
    )).join('');
  }

  function cardHtml(campaign) {
    const stats = campaign.stats || { total: 0, sent: 0, failed: 0, skipped: 0 };
    const progressPct = stats.total ? Math.round(((stats.sent + stats.failed) / stats.total) * 100) : 0;
    const canSend = campaign.status === 'draft' || campaign.status === 'failed';

    return `
      <div class="card campaign-card" data-campaign-id="${campaign.id}">
        <div class="top-row">
          <div class="title-block">
            <div class="glyph glyph-${campaign.channel}" style="width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px;">${channelEmoji(campaign.channel)}</div>
            <div>
              <h3>${escapeHtml(campaign.name)}</h3>
              <div class="meta">${CHANNEL_LABEL[campaign.channel]} · created ${new Date(campaign.createdAt).toLocaleString()}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="badge ${STATUS_BADGE[campaign.status] || 'badge-muted'}">${campaign.status}</span>
            ${canSend ? `<button class="btn btn-primary btn-sm" onclick="campaignsView.send('${campaign.id}')">Send now</button>` : ''}
            <button class="btn btn-ghost btn-icon" title="Delete" onclick="campaignsView.remove('${campaign.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${progressPct}%"></div></div>
        <div class="stat-inline">
          <span>Total: <b>${stats.total}</b></span>
          <span>Sent: <b>${stats.sent}</b></span>
          <span>Failed: <b>${stats.failed}</b></span>
        </div>
      </div>`;
  }

  function channelEmoji(channel) {
    if (channel === 'email') return '✉️';
    if (channel === 'whatsapp') return '💬';
    return '📱';
  }

  function render() {
    const list = document.getElementById('campaignList');
    if (!allCampaigns.length) {
      list.innerHTML = `
        <div class="card empty-state">
          <div class="icon">🚀</div>
          <h3>No campaigns yet</h3>
          <p>Create a campaign to start reaching out to your consented leads.</p>
          <button class="btn btn-primary" onclick="document.getElementById('openNewCampaignModal').click()">Create your first campaign</button>
        </div>`;
      return;
    }
    list.innerHTML = allCampaigns.map(cardHtml).join('');
  }

  async function refresh() {
    const data = await api.get('/campaigns');
    allCampaigns = data.campaigns;
    render();
    allCampaigns.forEach((c) => { if (c.status === 'sending') startPolling(c.id); });
    if (window.dashboardView) dashboardView.refresh();
  }

  function startPolling(id) {
    if (pollers.has(id)) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.get(`/campaigns/${id}/status`);
        const idx = allCampaigns.findIndex((c) => c.id === id);
        if (idx !== -1) allCampaigns[idx] = { ...allCampaigns[idx], status: data.status, stats: data.stats };
        render();
        if (data.status !== 'sending') {
          clearInterval(interval);
          pollers.delete(id);
          if (data.status === 'completed') showToast(`Campaign finished: ${data.stats.sent} sent, ${data.stats.failed} failed`, 'success');
          if (window.dashboardView) dashboardView.refresh();
        }
      } catch {
        clearInterval(interval);
        pollers.delete(id);
      }
    }, 1500);
    pollers.set(id, interval);
  }

  async function send(id) {
    try {
      await api.post(`/campaigns/${id}/send`);
      showToast('Campaign started', 'success');
      await refresh();
      startPolling(id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function remove(id) {
    if (!confirm('Delete this campaign?')) return;
    try {
      await api.delete(`/campaigns/${id}`);
      showToast('Campaign deleted', 'success');
      refresh();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function updateRecipientPreview() {
    const channel = document.getElementById('campaignChannel').value;
    const el = document.getElementById('recipientPreview');
    el.textContent = 'Checking eligible recipients…';
    try {
      const data = await api.get(`/campaigns/recipients/preview?channel=${channel}`);
      el.innerHTML = data.count
        ? `This will reach <strong>${data.count}</strong> consented lead(s) with a valid ${channel === 'email' ? 'email address' : 'phone number'}.`
        : `No eligible leads for ${channel} yet — add consent + contact info to some leads first.`;
    } catch {
      el.textContent = '';
    }
  }

  function toggleSubjectField() {
    const channel = document.getElementById('campaignChannel').value;
    document.getElementById('campaignSubjectField').style.display = channel === 'email' ? 'flex' : 'none';
  }

  function resetForm() {
    document.getElementById('campaignName').value = '';
    document.getElementById('campaignChannel').value = 'email';
    document.getElementById('campaignSubject').value = '';
    document.getElementById('campaignMessage').value = '';
    toggleSubjectField();
    updateRecipientPreview();
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('campaignName').value,
      channel: document.getElementById('campaignChannel').value,
      subject: document.getElementById('campaignSubject').value,
      messageTemplate: document.getElementById('campaignMessage').value,
    };
    try {
      await api.post('/campaigns', payload);
      showToast('Campaign created', 'success');
      closeModal('campaignModalBackdrop');
      refresh();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function bind() {
    renderTokenRow();
    document.getElementById('openNewCampaignModal').addEventListener('click', () => { resetForm(); openModal('campaignModalBackdrop'); });
    document.getElementById('campaignForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('campaignChannel').addEventListener('change', () => { toggleSubjectField(); updateRecipientPreview(); });
    document.getElementById('tokenRow').addEventListener('click', (e) => {
      const chip = e.target.closest('.token-chip');
      if (!chip) return;
      const textarea = document.getElementById('campaignMessage');
      const token = `{{${chip.dataset.token}}}`;
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      textarea.value = textarea.value.slice(0, start) + token + textarea.value.slice(end);
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + token.length;
    });
  }

  return { refresh, bind, send, remove };
})();
