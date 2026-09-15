// Sends the real interview-notification email via Gmail SMTP.
// Credentials come only from environment variables — never hardcoded, never logged.
const nodemailer = require('nodemailer');

const SENDER = process.env.GMAIL_USER || 'ghk7125@gmail.com';

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.GMAIL_APP_PASSWORD) return null;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: SENDER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  return transporter;
}

function isConfigured() {
  return Boolean(process.env.GMAIL_APP_PASSWORD);
}

// Stage 5 — Notify shortlisted candidate (score > 67%) that an interview is coming
async function sendInterviewNotice({ to, candidateName, roleTitle }) {
  const t = getTransporter();
  if (!t) {
    return { sent: false, reason: 'Email not sent: GMAIL_APP_PASSWORD is not configured on the server.' };
  }

  const firstName = (candidateName || '').split(' ')[0] || 'there';
  const subject = `Your Application for ${roleTitle} — Next Steps`;
  const text = `Dear ${firstName},

Thank you for taking the time to apply for the ${roleTitle} position with us. After a thorough review of your application and resume, we are pleased to let you know that your profile has stood out among the candidates we evaluated.

We would like to move forward with the next stage of our hiring process. An interview will be scheduled shortly, and a member of our recruiting team will reach out to you directly with available time slots and further details.

In the meantime, please don't hesitate to reach out if you have any questions. We look forward to staying in touch and to the opportunity of speaking with you soon.

Warm regards,
The Recruiting Team`;

  try {
    await t.sendMail({ from: SENDER, to, subject, text });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: `Email failed to send: ${err.message}` };
  }
}

module.exports = { sendInterviewNotice, isConfigured, SENDER };
