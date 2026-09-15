const { BaseRepository } = require('./baseRepository');

const CHANNEL_FIELD = {
  email: 'email',
  whatsapp: 'phone',
  sms: 'phone',
};

class LeadsRepository extends BaseRepository {
  constructor() {
    super('leads', 'lead');
  }

  create(fields) {
    return super.create({
      name: '',
      email: '',
      phone: '',
      company: '',
      source: 'manual',
      tags: [],
      status: 'new',
      consentGiven: false,
      notes: '',
      ...fields,
    });
  }

  // Leads that can legally/practically receive a campaign on this channel:
  // consent on file, an unsubscribed flag not set, and the contact field the
  // channel needs actually filled in.
  findEligibleForChannel(channel) {
    const field = CHANNEL_FIELD[channel];
    return this.list().filter((lead) => {
      if (!lead.consentGiven) return false;
      if (lead.status === 'unsubscribed') return false;
      return Boolean(lead[field] && String(lead[field]).trim());
    });
  }

  stats() {
    const leads = this.list();
    return {
      total: leads.length,
      consented: leads.filter((l) => l.consentGiven).length,
      byStatus: leads.reduce((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      }, {}),
    };
  }
}

module.exports = new LeadsRepository();
