const { BaseRepository } = require('./baseRepository');

class CampaignsRepository extends BaseRepository {
  constructor() {
    super('campaigns', 'camp');
  }

  create(fields) {
    return super.create({
      name: '',
      channel: 'email',
      subject: '',
      messageTemplate: '',
      status: 'draft',
      stats: { total: 0, sent: 0, failed: 0, skipped: 0 },
      ...fields,
    });
  }

  listSortedByNewest() {
    return [...this.list()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
}

module.exports = new CampaignsRepository();
