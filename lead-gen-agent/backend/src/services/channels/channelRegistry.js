// Single lookup table the rest of the app uses to reach a channel — nothing
// outside this file should require a channel module directly. Adding a new
// channel later means writing one module with { send, getStatus,
// isConfigured } and registering it here.
const emailChannel = require('./emailChannel');
const whatsappChannel = require('./whatsappChannel');
const smsChannel = require('./smsChannel');

const registry = {
  email: emailChannel,
  whatsapp: whatsappChannel,
  sms: smsChannel,
};

function getChannel(name) {
  const channel = registry[name];
  if (!channel) throw new Error(`Unknown channel "${name}"`);
  return channel;
}

function listChannels() {
  return Object.values(registry);
}

module.exports = { getChannel, listChannels };
