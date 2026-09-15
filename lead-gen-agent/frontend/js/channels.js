const channelsView = (() => {
  const GLYPH = { email: '✉️', whatsapp: '💬', sms: '📱' };
  const LABEL = { email: 'Email', whatsapp: 'WhatsApp', sms: 'SMS' };
  let qrTimer = null;

  function cardHtml(status) {
    const dot = status.connected ? 'dot-on' : 'dot-off';
    const badge = status.connected ? 'badge-success' : 'badge-muted';
    const badgeText = status.connected ? 'Connected' : 'Not connected';

    let actionBtn = '';
    if (status.channel === 'whatsapp') {
      actionBtn = status.connected
        ? `<button class="btn btn-secondary btn-sm" onclick="channelsView.disconnect('whatsapp')">Disconnect</button>`
        : `<button class="btn btn-primary btn-sm" onclick="channelsView.connect('whatsapp')">Connect</button>`;
    } else if (status.channel === 'email') {
      actionBtn = `<span class="helper-text">Configured via .env</span>`;
    } else {
      actionBtn = `<span class="helper-text">Configured via .env</span>`;
    }

    return `
      <div class="card channel-card">
        <div class="head">
          <div class="glyph glyph-${status.channel}">${GLYPH[status.channel]}</div>
          <div>
            <h3>${LABEL[status.channel]}</h3>
            <div class="status-line"><span class="dot ${dot}"></span>${status.provider}</div>
          </div>
        </div>
        <span class="badge ${badge}" style="width:fit-content;">${badgeText}</span>
        <p class="detail">${escapeHtml(status.detail)}</p>
        <div>${actionBtn}</div>
      </div>`;
  }

  function render(statuses, targetId) {
    document.getElementById(targetId).innerHTML = statuses.map(cardHtml).join('');
  }

  async function refresh() {
    const data = await api.get('/channels');
    render(data.channels, 'channelsGrid');
    render(data.channels, 'dashChannels');
  }

  function runQrAnimation() {
    const frame = document.getElementById('qrFrame');
    const statusText = document.getElementById('qrStatusText');
    // Deterministic-looking pseudo-QR grid, purely decorative for the demo.
    const cells = Array.from({ length: 121 }, () => (Math.random() > 0.55 ? '#1c1f2e' : 'transparent'));
    frame.innerHTML = `<svg viewBox="0 0 110 110" width="100%" height="100%">${cells.map((c, i) => {
      const x = (i % 11) * 10; const y = Math.floor(i / 11) * 10;
      return c === 'transparent' ? '' : `<rect x="${x}" y="${y}" width="9" height="9" fill="${c}"/>`;
    }).join('')}</svg>`;
    statusText.innerHTML = 'Waiting for scan…';

    clearTimeout(qrTimer);
    qrTimer = setTimeout(async () => {
      await api.post('/channels/whatsapp/connect');
      statusText.innerHTML = '<strong>Linked!</strong> Closing…';
      showToast('WhatsApp connected (simulated)', 'success');
      refresh();
      setTimeout(() => closeModal('qrModalBackdrop'), 700);
    }, 1800);
  }

  async function connect(name) {
    if (name === 'whatsapp') {
      openModal('qrModalBackdrop');
      runQrAnimation();
      return;
    }
    await api.post(`/channels/${name}/connect`);
    refresh();
  }

  async function disconnect(name) {
    try {
      await api.post(`/channels/${name}/disconnect`);
      showToast(`${LABEL[name] || name} disconnected`, 'success');
      refresh();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return { refresh, connect, disconnect };
})();
