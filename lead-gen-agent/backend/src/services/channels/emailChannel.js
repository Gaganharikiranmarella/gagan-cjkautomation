// Real channel: sends through Gmail SMTP via nodemailer. Needs GMAIL_USER +
// GMAIL_APP_PASSWORD in .env (an "app password", never the account password).
const nodemailer = require('nodemailer');
const env = require('../../config/env');

let cachedTransporter = null;

function getTransporter() {
  if (!env.gmailAppPassword || !env.gmailUser) return null;
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: env.gmailUser, pass: env.gmailAppPassword },
  });
  return cachedTransporter;
}

function isConfigured() {
  return Boolean(env.gmailUser && env.gmailAppPassword);
}

function getStatus() {
  return {
    channel: 'email',
    provider: 'gmail',
    connected: isConfigured(),
    detail: isConfigured()
      ? `Sending as ${env.gmailUser}`
      : 'Add GMAIL_USER and GMAIL_APP_PASSWORD to .env to enable real sending.',
  };
}

async function send({ to, subject, message }) {
  const transporter = getTransporter();
  if (!transporter) {
    return { ok: false, error: 'Email channel is not configured (missing Gmail app password).' };
  }
  if (!to) return { ok: false, error: 'Lead has no email address.' };

  try {
    await transporter.sendMail({
      from: env.gmailUser,
      to,
      subject: subject || 'A message for you',
      text: message,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { name: 'email', isConfigured, getStatus, send };
