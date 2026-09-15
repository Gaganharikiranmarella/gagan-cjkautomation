# Lead Gen Agent

A multi-channel outreach tool: a business uploads or enters its leads, then
sends personalized messages to them over email, WhatsApp and SMS from one
dashboard.

## Layout

```
lead-gen-agent/
├── backend/     Express API + channel/campaign logic
├── database/    Embedded JSON-file data layer (repository pattern)
├── frontend/    Static dashboard (vanilla HTML/CSS/JS)
└── .env.example
```

- **backend/** — `server.js` boots Express, serves `frontend/` as static
  files, and mounts the API under `/api`. `src/services/channels/` holds one
  module per outreach channel behind a common `{ send, getStatus }`
  interface, looked up through `channelRegistry.js`.
- **database/** — a small embedded JSON-file store (`database/data/store.json`,
  created on first run) accessed only through repositories
  (`leadsRepository`, `campaignsRepository`, `messagesRepository`,
  `channelsRepository`). Swapping in a real database later means rewriting
  `database/db.js`, not the rest of the app.
- **frontend/** — no build step. `js/` is split by concern (`api.js`,
  `leads.js`, `campaigns.js`, `channels.js`, `dashboard.js`, `main.js`).

## Channels

| Channel  | Default mode | Going live |
|----------|-------------|------------|
| Email    | Real (Gmail SMTP) | Set `GMAIL_USER` + `GMAIL_APP_PASSWORD` in `.env` |
| WhatsApp | Simulated (mock QR-link flow) | Set `WHATSAPP_PROVIDER=twilio` or `meta`, fill in the matching keys, and implement the `TODO` in `backend/src/services/channels/whatsappChannel.js` |
| SMS      | Simulated | Set `SMS_PROVIDER=twilio`, fill in the keys, implement the `TODO` in `backend/src/services/channels/smsChannel.js` |

Every channel is called the same way from `campaignEngine.js`, so switching a
channel from simulated to real never touches the campaign logic, routes, or
UI — only the one provider file and `.env`.

## Running it

```bash
cd backend
npm install
npm start
```

Then open http://localhost:4100 (or whatever `PORT` you set in `.env`).

Copy `.env.example` to `.env` first if you want real email sending or a
non-default port.

## Consent

Leads have a `consentGiven` flag. A campaign only sends to leads that are
marked as consented, have the contact info the channel needs, and haven't
unsubscribed — enforced in `leadsRepository.findEligibleForChannel()`. Keep
this on when wiring up real providers: unsolicited bulk messaging violates
WhatsApp's and most SMS/email providers' terms of service.
