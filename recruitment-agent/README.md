# Resumalyze v2.0

AI-assisted recruitment platform: companies post job openings, applicants
apply with a resume, and every resume is scored against the role's keywords
and skills the moment it's uploaded. Score 65% or higher and the applicant
is automatically shortlisted — visible instantly on both dashboards.

## Layout

```
recruitment-agent/
├── backend/     Express API - auth, jobs, applications, ATS scoring engine
├── frontend/    Static dashboard (vanilla HTML/CSS/JS, no build step)
├── api/         Vercel serverless entrypoint (re-exports the Express app)
└── vercel.json  Single-project deploy config (frontend + backend together)
```

- **backend/server.js** boots Express, serves `frontend/` as static files,
  and mounts the API under `/api`. `backend/src/` is split by concern:
  `db/schema.sql` (Postgres schema), `repositories/` (parameterized SQL
  queries, one file per table), `controllers/` + `routes/` (auth, jobs,
  applications), `services/` (resume parsing + the ATS scoring engine),
  `middleware/` (JWT auth, file upload, error handling).
- **frontend/** has three pages: `index.html` (landing + login/register for
  both roles), `applicant.html` (browse jobs, apply, track applications),
  `company.html` (post/edit jobs, review applicants). `js/` is split by
  concern (`api.js`, `session.js`, `toast.js`, one file per page).
- **api/index.js** just re-exports the Express app so the same code runs
  locally with `node backend/server.js` and on Vercel as a single
  serverless function.

## Database: Neon Postgres

The app uses [Neon](https://neon.tech) (serverless Postgres) via
`@neondatabase/serverless`, queried through a small repository layer
(`backend/src/repositories/`) with plain parameterized SQL — no ORM. Each
repository function returns rows already shaped in camelCase to match what
the frontend expects (e.g. `companyName`, `skillsRequired`), so nothing
outside `repositories/` needs to know about the underlying `snake_case`
columns.

**Setup (one-time):**

1. Create a free project at [console.neon.tech](https://console.neon.tech).
2. Copy its connection string (Dashboard → Connect) into `.env` as
   `DATABASE_URL` (copy `.env.example` to `.env` first).
3. Create the tables:
   ```bash
   npm run migrate
   ```
   This runs `backend/src/db/schema.sql` against `DATABASE_URL`. It's safe
   to re-run — every statement is `CREATE ... IF NOT EXISTS`.

There's no local-only fallback — `DATABASE_URL` is required both locally
and in production, since Neon's free tier is instant to set up and works
identically in both places (this is also why the app has no bundled/local
database dependency to install).

## How scoring works

`backend/src/services/scoringService.js` builds a weighted keyword set for
a job — the company's explicit **Required skills** carry the most weight,
followed by terms recognized in the **Minimum requirements** bullets, then
terms recognized in the free-text description. Each resume is scanned for
those keywords (with a synonym table in `skillsTaxonomy.js`, e.g. "JS" ↔
"JavaScript", "ReactJS" ↔ "React") and scored as a percentage of matched
weight. A small bonus is added if the resume's stated years of experience
meets the job's minimum. 65%+ auto-shortlists the applicant — no manual
review step, fully deterministic and explainable (every application shows
its matched/missing keywords), and the shortlist decision is never changed
by the optional AI layer below.

## AI-powered resume insights (optional)

If `ANTHROPIC_API_KEY` is set, every application also gets a qualitative
layer from Claude (`backend/src/services/aiAnalysisService.js`), generated
right after the deterministic score: a short candidate summary, genuine
strengths and gaps for that specific role, a fit rating (strong/moderate/
weak), and — on the applicant's side — actionable tips to improve their
resume. This is purely additive:

- It never changes the ATS score or the shortlist decision.
- It never blocks an application - if the key is missing or the call fails
  for any reason, `aiInsights` is just `null` and the UI quietly omits that
  section.
- It costs nothing and does nothing without the key configured.

To enable it, set `ANTHROPIC_API_KEY` in `.env` (locally) or in your Vercel
project's environment variables (production).

## Running it locally

```bash
npm install
npm run migrate   # one-time, after setting DATABASE_URL in .env
npm start
```

Then open http://localhost:3020 (or whatever `PORT` you set in `.env`).

## Deploying to Vercel

Resumalyze deploys as **one Vercel project** — frontend and backend both,
no separate services.

1. Create a free Neon project (see Database section above) and run
   `npm run migrate` locally against it at least once, so the tables exist
   before you deploy.
2. Push this repo to GitHub and import it in Vercel (or run `vercel` from
   this folder). If this project lives in a subfolder of a larger repo, set
   Vercel's **Root Directory** to this folder.
3. In the Vercel project's Environment Variables, set:
   - `DATABASE_URL` — your Neon connection string
   - `JWT_SECRET` — any long random string
   - `ANTHROPIC_API_KEY` — optional, enables AI resume insights (see above)
4. Deploy. `vercel.json` routes every request to `api/index.js`, which is
   the same Express app used locally, so there's nothing else to configure.

## Roles

- **Applicant** — register, browse open roles (search/filter by title,
  skill, job type, location), upload a resume (PDF/DOCX/TXT) to apply, and
  see the match score, shortlist status, matched/missing keywords, and (if
  AI is enabled) an AI summary with tips to improve their resume for every
  application.
- **Company** — register, post job openings (title, description, minimum
  requirements, required skills, pay range, openings, deadline), edit or
  close them any time, and review applicants sorted by match score with a
  full keyword breakdown, the extracted resume text, and (if AI is enabled)
  an AI summary with strengths/gaps and a fit rating for each applicant.
