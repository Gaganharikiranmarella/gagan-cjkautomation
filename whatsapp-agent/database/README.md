# Database

PostgreSQL 15+. Works with any managed provider — [Neon](https://neon.tech) or
[Supabase](https://supabase.com) are the easiest to pair with Vercel (both give
you a pooled connection string and a generous free tier).

## Setup

1. Create a Postgres database with your provider of choice.
2. Copy the connection string into `DATABASE_URL` in your `.env` (see
   `../.env.example`). Use the **pooled** connection string if your provider
   offers one (Neon: the one with `-pooler` in the hostname) — serverless
   functions open a lot of short-lived connections.
3. Apply the schema:

   ```bash
   psql "$DATABASE_URL" -f schema.sql
   ```

   Or paste the contents of `schema.sql` into your provider's SQL editor
   (Neon and Supabase both have one in their dashboard — no local `psql`
   needed).

## What's in `schema.sql`

18 tables across 7 modules — identity & multi-tenancy, contacts &
conversations, leads & scoring, manual/CSV intake, outbound campaigns,
notifications, and an immutable audit log — plus row-level security policies
on every tenant-scoped table so tenant isolation is enforced by the database
itself, not only by application code. See the backend's `app/db.py` for how
`app.tenant_id` / `app.role` are set on every request.

## Multi-tenancy model

Shared database, shared schema: every tenant-scoped table carries
`tenant_id`, and a `tenant_isolation` RLS policy restricts every query to the
caller's own tenant unless their role is `super_admin`. This is enforced at
the database layer, so even a bug in an API route that forgets a `WHERE
tenant_id = …` clause cannot leak another tenant's rows.
