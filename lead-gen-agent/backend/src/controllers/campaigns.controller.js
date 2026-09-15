const { campaignsRepository, messagesRepository, leadsRepository } = require('../../../database');
const { HttpError } = require('../utils/httpError');
const { startCampaign } = require('../services/campaignEngine');
const { schema } = require('../../../database');

function sanitizeCampaignInput(body) {
  const name = String(body.name || '').trim();
  const channel = String(body.channel || '').trim();
  const messageTemplate = String(body.messageTemplate || '').trim();

  if (!name) throw new HttpError(400, 'Campaign name is required');
  if (!schema.CAMPAIGN_CHANNELS.includes(channel)) {
    throw new HttpError(400, `channel must be one of ${schema.CAMPAIGN_CHANNELS.join(', ')}`);
  }
  if (!messageTemplate) throw new HttpError(400, 'Message template is required');
  if (channel === 'email' && !String(body.subject || '').trim()) {
    throw new HttpError(400, 'Subject is required for email campaigns');
  }

  return {
    name,
    channel,
    subject: String(body.subject || '').trim(),
    messageTemplate,
  };
}

function list(req, res) {
  res.json({ campaigns: campaignsRepository.listSortedByNewest() });
}

function create(req, res) {
  const campaign = campaignsRepository.create(sanitizeCampaignInput(req.body));
  res.status(201).json({ campaign });
}

function get(req, res) {
  const campaign = campaignsRepository.findById(req.params.id);
  if (!campaign) throw new HttpError(404, 'Campaign not found');
  res.json({ campaign, messages: messagesRepository.findByCampaign(campaign.id) });
}

// Returns just the fields the polling UI needs, cheap enough to call every
// couple of seconds while a campaign is sending.
function status(req, res) {
  const campaign = campaignsRepository.findById(req.params.id);
  if (!campaign) throw new HttpError(404, 'Campaign not found');
  res.json({ id: campaign.id, status: campaign.status, stats: campaign.stats });
}

function previewRecipients(req, res) {
  const channel = req.query.channel;
  if (!schema.CAMPAIGN_CHANNELS.includes(channel)) {
    throw new HttpError(400, `channel must be one of ${schema.CAMPAIGN_CHANNELS.join(', ')}`);
  }
  const eligible = leadsRepository.findEligibleForChannel(channel);
  res.json({ count: eligible.length });
}

function send(req, res) {
  const campaign = campaignsRepository.findById(req.params.id);
  if (!campaign) throw new HttpError(404, 'Campaign not found');
  try {
    const result = startCampaign(campaign.id);
    res.json(result);
  } catch (err) {
    throw new HttpError(409, err.message);
  }
}

function remove(req, res) {
  const removed = campaignsRepository.remove(req.params.id);
  if (!removed) throw new HttpError(404, 'Campaign not found');
  res.status(204).end();
}

module.exports = { list, create, get, status, previewRecipients, send, remove };
