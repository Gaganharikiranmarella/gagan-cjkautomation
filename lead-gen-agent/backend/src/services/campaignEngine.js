// Orchestrates sending a campaign: picks eligible leads, personalizes the
// message per lead, dispatches through the right channel, and logs the
// outcome of every attempt. Runs in the background — the HTTP layer only
// kicks it off and polls status, it never blocks a request on a full send.
const { leadsRepository, campaignsRepository, messagesRepository } = require('../../../database');
const { getChannel } = require('./channels/channelRegistry');
const { renderTemplate } = require('./templateEngine');
const { logger } = require('../utils/logger');

// Throttle between sends so a burst of outreach doesn't look like spam to
// the receiving provider (and to keep mock delays feeling realistic too).
const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 900;

const runningCampaigns = new Set();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRunning(campaignId) {
  return runningCampaigns.has(campaignId);
}

async function runCampaign(campaign) {
  const channel = getChannel(campaign.channel);
  const leads = leadsRepository.findEligibleForChannel(campaign.channel);

  const stats = { total: leads.length, sent: 0, failed: 0, skipped: 0 };
  campaignsRepository.update(campaign.id, { status: 'sending', stats });

  for (const lead of leads) {
    const message = renderTemplate(campaign.messageTemplate, lead);
    const subject = campaign.channel === 'email' ? renderTemplate(campaign.subject, lead) : undefined;
    const to = campaign.channel === 'email' ? lead.email : lead.phone;

    let result;
    try {
      result = await channel.send({ to, subject, message });
    } catch (err) {
      result = { ok: false, error: err.message };
    }

    if (result.ok) {
      stats.sent += 1;
      leadsRepository.update(lead.id, { status: 'contacted' });
    } else {
      stats.failed += 1;
      logger.warn(`Campaign ${campaign.id} -> lead ${lead.id} failed:`, result.error);
    }

    messagesRepository.create({
      campaignId: campaign.id,
      leadId: lead.id,
      channel: campaign.channel,
      status: result.ok ? 'sent' : 'failed',
      error: result.ok ? null : result.error,
      sentAt: result.ok ? new Date().toISOString() : null,
      preview: message.slice(0, 160),
    });

    campaignsRepository.update(campaign.id, { stats: { ...stats } });
    await delay(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
  }

  campaignsRepository.update(campaign.id, {
    status: 'completed',
    completedAt: new Date().toISOString(),
  });
  runningCampaigns.delete(campaign.id);
}

function startCampaign(campaignId) {
  const campaign = campaignsRepository.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found');
  if (isRunning(campaignId)) throw new Error('Campaign is already sending');
  if (campaign.status === 'sending') throw new Error('Campaign is already sending');

  runningCampaigns.add(campaignId);
  // Fire-and-forget: errors are caught so a bug in one send loop can't crash
  // the server, but still surface on the campaign record for the UI to show.
  runCampaign(campaign).catch((err) => {
    logger.error(`Campaign ${campaignId} crashed:`, err);
    campaignsRepository.update(campaignId, { status: 'failed', error: err.message });
    runningCampaigns.delete(campaignId);
  });

  return { started: true };
}

module.exports = { startCampaign, isRunning };
