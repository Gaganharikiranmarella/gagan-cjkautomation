// Shape of every collection in the store. Not enforced at runtime like a real
// SQL schema would be, but documents what each record looks like so swapping
// this JSON file for a real database later is a matter of matching this shape.

const LEAD_STATUSES = ['new', 'contacted', 'responded', 'converted', 'unsubscribed'];

const CAMPAIGN_CHANNELS = ['email', 'whatsapp', 'sms'];
const CAMPAIGN_STATUSES = ['draft', 'sending', 'completed', 'failed'];

const MESSAGE_STATUSES = ['pending', 'sent', 'failed', 'skipped'];

const DEFAULT_STATE = {
  leads: [],
  campaigns: [],
  messages: [],
  channels: [],
};

module.exports = {
  LEAD_STATUSES,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_STATUSES,
  MESSAGE_STATUSES,
  DEFAULT_STATE,
};
