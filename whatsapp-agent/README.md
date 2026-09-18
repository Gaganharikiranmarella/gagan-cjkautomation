# WhatsApp Lead Agent

A white-label WhatsApp inbound sales agent: connect a WhatsApp Business number, and every
conversation is automatically understood, answered, and scored by Claude, landing in a
dashboard your sales team works from. Built by CJK Technologies.

```
whatsapp-agent/
├── frontend/    Next.js 14 (App Router, TypeScript, Tailwind) — the dashboard + marketing site
├── backend/     FastAPI (Python) — API, WhatsApp webhook, Claude integration, cron dispatcher
├── database/    PostgreSQL schema (18 tables, row-level security) — see database/README.md
└── vercel.json  Deploys both frontend and backend as a single Vercel project
```

## How it works

1. A business signs up, then connects their WhatsApp Business number from **Settings → Connect
   WhatsApp** — paste the credentials Meta gives you instantly in the App Dashboard (no app
   review needed), or use one-click Embedded Signup if you've set up a full Meta app.
2. Customers message the connected number. The webhook (`backend/app/routers/webhooks.py`)
   verifies Meta's signature, then Claude (`backend/app/services/claude_agent.py`) detects the
   language, extracts an answer to the current qualification question, and drafts a fallback
   reply when the customer goes off-script.
3. A deterministic, per-tenant weighted scoring engine (`backend/app/services/scoring.py`) —
   **not** an LLM — scores the lead after every message, so "why is this lead scored 78?" always
   has a reproducible answer.
4. The moment a lead crosses the qualified threshold, an email alert goes out (Resend) and shows
   up in the dashboard's notification bell.
5. Sales works the pipeline from the dashboard: filter/search/export leads, read the full
   transcript, override status with an audited reason, import a CSV (Claude suggests the column
   mapping), and run template campaigns or automated follow-up rules.

## Architecture notes for Vercel

The system design this was built from (see the client's own schema/system-design docs) specifies
Redis + Celery for the inbound queue and a scheduler worker. **This deployment intentionally
drops that** in favor of an architecture that deploys to Vercel with zero extra infrastructure:

- **Inbound messages** are processed synchronously inside the webhook request (language
  detection → scoring → reply, all within Vercel's function time limit). Fine for v1 volumes;
  swap in [Upstash QStash](https://upstash.com/docs/qstash) later if you need the queue back
  without standing up your own Redis.
- **Scheduled follow-ups & campaigns** use `scheduled_jobs`/`follow_up_rules` tables plus a
  single protected endpoint, `GET/POST /api/backend/cron/dispatch`, invoked by Vercel Cron
  (see `vercel.json`'s `"crons"` entry, set to run once daily at 03:00 UTC — **Vercel's Hobby
  plan only allows daily cron jobs**, so this is the free-tier-friendly default). For
  near-real-time follow-ups either upgrade to Pro and tighten the schedule, or point a free
  external scheduler (e.g. [cron-job.org](https://cron-job.org) or a GitHub Actions scheduled
  workflow) at `POST https://yourdomain.com/api/backend/cron/dispatch` with header
  `Authorization: Bearer <CRON_SECRET>` every few minutes instead.
- **Email** uses Resend instead of the doc's Amazon SES recommendation — one API key, no AWS
  account, much less deploy friction.

Everything else (multi-tenant row-level security, the scoring model, the CSV pipeline, the
qualification state machine) follows the original design.

## Local development

### 1. Database
Follow `database/README.md` — create a free Neon/Supabase Postgres, run `database/schema.sql`.

### 2. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env   # fill in DATABASE_URL, JWT_SECRET, TOKEN_ENCRYPTION_KEY at minimum
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:3000 — /api/* is proxied to localhost:8000 automatically
```

Sign up at `/signup`, then connect a WhatsApp test number from **Settings**. Meta gives every
developer a free test number + temporary access token instantly under
**Meta App Dashboard → WhatsApp → API Setup** — no review required to start testing.

> **Windows note:** if your project sits on an exFAT-formatted drive, `next build` can fail with
> `EISDIR: illegal operation on a directory, readlink` — a filesystem limitation (exFAT has no
> real symlink support), not a code issue. `next.config.js` already works around it for `npm run
> dev`/`next build` on that drive; it does not occur on Vercel's (Linux) build machines or on a
> normal NTFS drive.

## Deploying to Vercel

1. **Push this repo to GitHub** (or GitLab/Bitbucket).
2. **Create the database.** Spin up a free [Neon](https://neon.tech) Postgres, run
   `database/schema.sql` against it (Neon's SQL editor can paste-and-run it directly).
3. **Get your third-party keys:**
   - Anthropic API key → [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
   - Resend API key → [resend.com/api-keys](https://resend.com/api-keys) (free tier is plenty to start)
   - A Meta App with the WhatsApp product added → [developers.facebook.com](https://developers.facebook.com)
     (only needed for tenants to connect a number — the app itself deploys fine without this)
4. **Import the project into Vercel** ([vercel.com/new](https://vercel.com/new)) from your repo.
   This app lives in the `whatsapp-agent/` subfolder of a larger repo — in the import screen's
   **Root Directory** setting, choose `whatsapp-agent` (not the repo root, and not `frontend/`).
   Vercel then reads `whatsapp-agent/vercel.json`, which declares two **services** in one
   project — `frontend` (Next.js, serves everything) and `backend` (FastAPI, serves everything
   under `/api/backend/*`) — so both deploy together from this one import with no extra config.
5. **Add environment variables** (Project Settings → Environment Variables) — copy every key from
   `.env.example`, with real values. At minimum: `DATABASE_URL`, `JWT_SECRET` (generate with
   `openssl rand -hex 32`), `TOKEN_ENCRYPTION_KEY` (generate with
   `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`),
   `CRON_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `SUPPORT_EMAIL` (defaults to
   ghk7125@gmail.com), `FRONTEND_URL` (your production URL, e.g. `https://your-app.vercel.app`).
   Add `ANTHROPIC_API_KEY` and `RESEND_API_KEY` too once you have them — both are optional at
   first launch and degrade gracefully when unset (see below).
6. **Deploy.** Vercel builds the Next.js frontend and the FastAPI backend as two services in the
   one project, from the one repo, in one click.
7. **Point Meta's webhook at your live URL.** In Meta App Dashboard → WhatsApp → Configuration,
   set the callback URL to `https://your-app.vercel.app/api/backend/webhooks/whatsapp` and the
   verify token to whichever token your tenant's **Connect WhatsApp** step gave you (shown on
   screen after connecting, and re-visible in the `waba_accounts` table).
8. **(Optional, recommended for near-real-time follow-ups on Hobby plan)** point an external
   scheduler at `/api/backend/cron/dispatch` as described above.

That's it — no servers to provision, no Docker, no Redis. Every subsequent `git push` to your
main branch redeploys automatically.

## Security

- Every tenant-scoped database table is protected by PostgreSQL row-level security — the app
  can't leak one tenant's leads into another's response even if a query forgets a `WHERE
  tenant_id = …` clause (`database/schema.sql`).
- WhatsApp access tokens and app secrets are encrypted at rest (Fernet, `backend/app/crypto.py`)
  before being written to the database.
- Passwords are bcrypt-hashed (`passlib`); sessions are short-lived signed JWTs.
- Inbound WhatsApp webhooks are verified against Meta's `X-Hub-Signature-256` HMAC before any
  processing happens.
- `.gitignore` excludes every `.env` file, upload directory, and local secret from version
  control — only `.env.example` (no real values) is committed.
- Every manual override on a lead (status, owner, score) requires a reason and is written to an
  immutable `audit_log`.

## Customer care

The `/support` page (also linked from the dashboard sidebar and the marketing footer) offers a
direct `mailto:` link plus a complaint-box form. Both routes — direct email and the form — reach
**ghk7125@gmail.com** (configurable via `SUPPORT_EMAIL`); the form also stores a copy in
`support_messages` for the team's own records and emails the sender a confirmation receipt.
