// WhatsApp channel, built provider-first so going live later is a config
// change, not a rewrite:
//   1. set WHATSAPP_PROVIDER=twilio (or meta) in .env
//   2. fill in the matching keys in .env
//   3. implement the body of that provider's send() below — the call site
//      in campaignEngine.js and every route/controller stays untouched.
//
// "mock" (the default) needs no account at all: it simulates a QR-link
// connect flow and "sends" by recording the message as delivered.
const env = require('../../config/env');
const { channelsRepository } = require('../../../../database');

const CHANNEL_NAME = 'whatsapp';

function connectionRecord() {
  return channelsRepository.findByName(CHANNEL_NAME);
}

function getStatus() {
  if (env.whatsappProvider !== 'mock') {
    const configured = env.whatsappProvider === 'twilio'
      ? Boolean(env.twilioAccountSid && env.twilioAuthToken && env.twilioWhatsappFrom)
      : Boolean(env.metaWhatsappToken && env.metaWhatsappPhoneId);
    return {
      channel: CHANNEL_NAME,
      provider: env.whatsappProvider,
      connected: configured,
      detail: configured
        ? `Using ${env.whatsappProvider} provider`
        : `WHATSAPP_PROVIDER=${env.whatsappProvider} but its API keys are missing from .env`,
    };
  }

  const record = connectionRecord();
  const connected = record?.status === 'connected';
  return {
    channel: CHANNEL_NAME,
    provider: 'mock',
    connected,
    detail: connected
      ? 'Simulated session linked — demo mode, no real WhatsApp account attached.'
      : 'Not linked. Click Connect to simulate scanning a QR code.',
  };
}

// Simulates the "scan this QR code" hand-off a real whatsapp-web.js session
// would need. Immediately marks the channel connected — good enough to
// demo the flow the real integration will slot into.
function connect() {
  channelsRepository.upsert(CHANNEL_NAME, {
    status: 'connected',
    connectedAt: new Date().toISOString(),
  });
  return getStatus();
}

function disconnect() {
  channelsRepository.upsert(CHANNEL_NAME, { status: 'disconnected', connectedAt: null });
  return getStatus();
}

function isConfigured() {
  return getStatus().connected;
}

async function sendViaMock({ to, message }) {
  // Small artificial delay so the UI's "sending..." progress state has
  // something real to show, mirroring the latency a real API call would have.
  await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 250));
  return { ok: true, simulated: true, detail: `Simulated WhatsApp message to ${to}: "${message.slice(0, 40)}..."` };
}

async function sendViaTwilio() {
  // TODO: real integration — call Twilio's WhatsApp API here using
  // env.twilioAccountSid / env.twilioAuthToken / env.twilioWhatsappFrom.
  return { ok: false, error: 'Twilio WhatsApp provider selected but not implemented yet.' };
}

async function sendViaMeta() {
  // TODO: real integration — call the Meta WhatsApp Cloud API here using
  // env.metaWhatsappToken / env.metaWhatsappPhoneId.
  return { ok: false, error: 'Meta WhatsApp Cloud provider selected but not implemented yet.' };
}

async function send({ to, message }) {
  if (!to) return { ok: false, error: 'Lead has no phone number.' };
  if (!isConfigured()) return { ok: false, error: 'WhatsApp channel is not connected.' };

  if (env.whatsappProvider === 'twilio') return sendViaTwilio({ to, message });
  if (env.whatsappProvider === 'meta') return sendViaMeta({ to, message });
  return sendViaMock({ to, message });
}

module.exports = { name: CHANNEL_NAME, isConfigured, getStatus, connect, disconnect, send };
