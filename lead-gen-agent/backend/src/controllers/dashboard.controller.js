const { leadsRepository, campaignsRepository, messagesRepository } = require('../../../database');
const { listChannels } = require('../services/channels/channelRegistry');

function summary(req, res) {
  const leadStats = leadsRepository.stats();
  const campaigns = campaignsRepository.listSortedByNewest();
  const recentMessages = messagesRepository.recentFirst(10);

  const messagesSentToday = messagesRepository.list().filter((m) => {
    if (m.status !== 'sent' || !m.sentAt) return false;
    const sentDate = new Date(m.sentAt).toDateString();
    return sentDate === new Date().toDateString();
  }).length;

  res.json({
    leadStats,
    campaignCount: campaigns.length,
    activeCampaigns: campaigns.filter((c) => c.status === 'sending').length,
    messagesSentToday,
    channelStatuses: listChannels().map((c) => c.getStatus()),
    recentCampaigns: campaigns.slice(0, 5),
    recentMessages,
  });
}

module.exports = { summary };
