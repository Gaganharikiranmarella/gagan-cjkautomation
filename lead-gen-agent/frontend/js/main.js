const PAGE_META = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your leads and outreach performance' },
  leads: { title: 'Leads', subtitle: 'Everyone your client wants to reach, in one place' },
  campaigns: { title: 'Campaigns', subtitle: 'Compose and send outreach across every channel' },
  channels: { title: 'Channels', subtitle: 'Connect and monitor how messages go out' },
};

function switchView(name) {
  document.querySelectorAll('.nav-item').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === name));
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
  document.getElementById('pageTitle').textContent = PAGE_META[name].title;
  document.getElementById('pageSubtitle').textContent = PAGE_META[name].subtitle;
  document.getElementById('sidebar').classList.remove('open');
}

function bindNav() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

async function init() {
  bindNav();
  leadsView.bind();
  campaignsView.bind();

  try {
    await Promise.all([
      leadsView.refresh(),
      campaignsView.refresh(),
      channelsView.refresh(),
      dashboardView.refresh(),
    ]);
  } catch (err) {
    showToast(err.message, 'error');
  }

  // Light polling keeps the dashboard/channel cards fresh without a
  // websocket layer, cheap enough for a low-traffic internal tool.
  setInterval(() => dashboardView.refresh().catch(() => {}), 8000);
}

document.addEventListener('DOMContentLoaded', init);
