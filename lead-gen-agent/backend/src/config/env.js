const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

module.exports = {
  port: Number(process.env.PORT) || 4100,

  gmailUser: process.env.GMAIL_USER || '',
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',

  whatsappProvider: (process.env.WHATSAPP_PROVIDER || 'mock').toLowerCase(),
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '',
  metaWhatsappToken: process.env.META_WHATSAPP_TOKEN || '',
  metaWhatsappPhoneId: process.env.META_WHATSAPP_PHONE_ID || '',

  smsProvider: (process.env.SMS_PROVIDER || 'mock').toLowerCase(),
  twilioSmsFrom: process.env.TWILIO_SMS_FROM || '',
};
