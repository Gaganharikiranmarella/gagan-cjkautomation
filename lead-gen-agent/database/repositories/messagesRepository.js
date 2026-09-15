const { BaseRepository } = require('./baseRepository');

class MessagesRepository extends BaseRepository {
  constructor() {
    super('messages', 'msg');
  }

  create(fields) {
    return super.create({
      campaignId: null,
      leadId: null,
      channel: 'email',
      status: 'pending',
      error: null,
      sentAt: null,
      ...fields,
    });
  }

  findByCampaign(campaignId) {
    return this.list().filter((m) => m.campaignId === campaignId);
  }

  recentFirst(limit = 20) {
    return [...this.list()]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  }
}

module.exports = new MessagesRepository();
