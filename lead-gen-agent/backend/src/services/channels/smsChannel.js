// SMS channel. Same provider-switch shape as whatsappChannel.js — flip
// SMS_PROVIDER to "twilio", add the keys, and fill in sendViaTwilio().
const env = require('../../config/env');

const CHANNEL_NAME = 'sms';

function isConfigured() {
  if (env.smsProvider === 'mock') return true;
  return Boolean(env.twilioAccountSid && env.twilioAuthToken && env.twilioSmsFrom);
}

function getStatus() {
  return {
    channel: CHANNEL_NAME,
    provider: env.smsProvider,
    connected: isConfigured(),
    detail: env.smsProvider === 'mock'
      ? 'Simulated sending — demo mode, no SMS provider attached.'
      : isConfigured()
        ? `Using ${env.smsProvider} provider`
        : `SMS_PROVIDER=${env.smsProvider} but its API keys are missing from .env`,
  };
}

async function sendViaMock({ to, message }) {
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
  return { ok: true, simulated: true, detail: `Simulated SMS to ${to}: "${message.slice(0, 40)}..."` };
}

async function sendViaTwilio() {
  // TODO: real integration — call Twilio's SMS API here using
  // env.twilioAccountSid / env.twilioAuthToken / env.twilioSmsFrom.
  return { ok: false, error: 'Twilio SMS provider selected but not implemented yet.' };
}

async function send({ to, message }) {
  if (!to) return { ok: false, error: 'Lead has no phone number.' };
  if (!isConfigured()) return { ok: false, error: 'SMS channel is not configured.' };

  if (env.smsProvider === 'twilio') return sendViaTwilio({ to, message });
  return sendViaMock({ to, message });
}

module.exports = { name: CHANNEL_NAME, isConfigured, getStatus, send };
