const dashboardView = (() => {
  function statCard(icon, label, value, sub) {
    return `
      <div class="card stat-card">
        <div class="icon-badge">${icon}</div>
        <span class="label">${label}</span>
        <span class="value">${value}</span>
        ${sub ? `<span class="sub">${sub}</span>` : ''}
      </div>`;
  }

  function renderStats(data) {
    document.getElementById('dashStats').innerHTML = [
      statCard('📇', 'Total leads', data.leadStats.total, `${data.leadStats.consented} consented`),
      statCard('🚀', 'Campaigns', data.campaignCount, `${data.activeCampaigns} sending now`),
      statCard('📨', 'Messages today', data.messagesSentToday, 'across all channels'),
      statCard('🔗', 'Channels ready', data.channelStatuses.filter((c) => c.connected).length + ' / ' + data.channelStatuses.length, 'connected'),
    ].join('');
  }

  function renderActivity(messages) {
    const wrap = document.getElementById('dashActivity');
    if (!messages.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="icon">📭</div><h3>No activity yet</h3><p>Send your first campaign to see messages appear here.</p></div>`;
      return;
    }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Channel</th><th>Status</th><th>Preview</th><th>When</th></tr></thead>
        <tbody>
          ${messages.map((m) => `
            <tr>
              <td><span class="badge badge-info">${m.channel}</span></td>
              <td><span class="badge ${m.status === 'sent' ? 'badge-success' : 'badge-danger'}">${m.status}</span></td>
              <td class="cell-sub">${escapeHtml(m.preview || m.error || '—')}</td>
              <td class="cell-sub">${new Date(m.createdAt).toLocaleString()}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  async function refresh() {
    const data = await api.get('/dashboard/summary');
    renderStats(data);
    renderActivity(data.recentMessages);
  }

  return { refresh };
})();
