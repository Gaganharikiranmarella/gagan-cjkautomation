-- ============================================================================
-- WhatsApp Lead Agent — database schema (PostgreSQL 15+)
-- CJK Technologies · Schema Design v1.0
--
-- Run once against a fresh database:
--   psql "$DATABASE_URL" -f database/schema.sql
-- or paste into your Neon/Supabase SQL editor.
--
-- Every tenant-scoped table carries tenant_id and a row-level security policy
-- so a bug in the application layer can never leak one tenant's rows into
-- another's response — RLS is the backstop, the app still filters by tenant
-- in every query for clarity and index usage.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 01 · Identity & multi-tenancy
-- ---------------------------------------------------------------------------

CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  brand_config    JSONB NOT NULL DEFAULT '{"logo_url": null, "accent_color": "#12A9A6"}'::jsonb,
  scoring_config  JSONB NOT NULL DEFAULT '{
    "signals": {
      "source_quality":     {"weight": 15, "map": {"referral": 15, "whatsapp_inbound": 10, "csv_import": 6, "manual": 8}},
      "stated_budget":      {"weight": 25, "map": {"confirmed": 25, "implied": 12, "none": 0}},
      "timeline_urgency":   {"weight": 20, "map": {"immediate": 20, "this_quarter": 12, "exploring": 4}},
      "questions_completed":{"weight": 20, "per_question": 4, "max_questions": 5},
      "response_latency":   {"weight": 10, "under_1h": 10, "under_24h": 5, "over_24h": 0},
      "engagement_recency": {"weight": 10, "decay_per_day": 1.5}
    },
    "thresholds": {"unqualified_below": 30, "contacted_below": 55, "qualified_at": 70}
  }'::jsonb,
  default_locale  TEXT NOT NULL DEFAULT 'en',
  active_locales  TEXT[] NOT NULL DEFAULT ARRAY['en', 'hi'],
  plan            TEXT NOT NULL DEFAULT 'trial',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE waba_accounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number_id      TEXT NOT NULL,
  waba_id              TEXT NOT NULL,
  display_phone_number TEXT,
  display_name         TEXT,
  access_token_enc     TEXT NOT NULL, -- Fernet-encrypted, never stored in plaintext
  app_secret_enc       TEXT,          -- Fernet-encrypted; used to verify inbound webhook HMAC
  verify_token         TEXT NOT NULL,
  default_locale       TEXT NOT NULL DEFAULT 'en',
  connection_method    TEXT NOT NULL DEFAULT 'manual' CHECK (connection_method IN ('manual', 'embedded_signup')),
  status               TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phone_number_id)
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL only for super_admin
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'tenant_admin' CHECK (role IN ('super_admin', 'tenant_admin', 'sales_rep', 'viewer')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- ---------------------------------------------------------------------------
-- 02 · Contacts & conversations
-- ---------------------------------------------------------------------------

CREATE TABLE contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_e164    TEXT NOT NULL,
  name          TEXT,
  locale        TEXT NOT NULL DEFAULT 'en',
  opted_in      BOOLEAN NOT NULL DEFAULT true,
  opted_in_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  opted_out_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone_e164)
);
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);

CREATE TABLE conversations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id               UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  lead_id                  UUID, -- FK added after leads table is created
  state                    TEXT NOT NULL DEFAULT 'new' CHECK (
                              state IN ('new','greeting','qualifying','qualified','unqualified',
                                        'handed_off','converted','dormant','opted_out')
                            ),
  current_flow_step        INT NOT NULL DEFAULT 0,
  locale                   TEXT NOT NULL DEFAULT 'en',
  slots                    JSONB NOT NULL DEFAULT '{}'::jsonb, -- extracted qualification answers, feeds the scoring engine
  last_customer_message_at TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX idx_conversations_contact ON conversations(contact_id);

CREATE TABLE message_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  locale          TEXT NOT NULL DEFAULT 'en',
  category        TEXT NOT NULL DEFAULT 'marketing' CHECK (category IN ('marketing', 'utility', 'authentication')),
  body            TEXT NOT NULL,
  meta_template_id TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name, locale)
);
CREATE INDEX idx_templates_tenant ON message_templates(tenant_id);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  wa_message_id   TEXT UNIQUE, -- makes webhook redelivery idempotent
  type            TEXT NOT NULL DEFAULT 'text',
  content         JSONB NOT NULL,
  template_id     UUID REFERENCES message_templates(id),
  status          TEXT NOT NULL DEFAULT 'received' CHECK (
                    status IN ('queued','sent','delivered','read','failed','received')
                  ),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_tenant ON messages(tenant_id);

-- ---------------------------------------------------------------------------
-- 03 · Leads & scoring
-- ---------------------------------------------------------------------------

CREATE TABLE leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id     UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  owner_user_id  UUID REFERENCES users(id),
  company        TEXT,
  status         TEXT NOT NULL DEFAULT 'new' CHECK (
                   status IN ('new','contacted','qualifying','qualified','unqualified','converted','dormant')
                 ),
  score          NUMERIC(5,2) NOT NULL DEFAULT 0,
  source         TEXT NOT NULL DEFAULT 'whatsapp_inbound' CHECK (
                   source IN ('whatsapp_inbound','csv_import','manual','referral')
                 ),
  notes          TEXT,
  qualified_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_tenant ON leads(tenant_id);
CREATE INDEX idx_leads_status ON leads(tenant_id, status);
CREATE INDEX idx_leads_owner ON leads(tenant_id, owner_user_id);

ALTER TABLE conversations ADD CONSTRAINT fk_conversations_lead
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

CREATE TABLE lead_score_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id    UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  score      NUMERIC(5,2) NOT NULL,
  breakdown  JSONB NOT NULL, -- per-signal contribution, the "why"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_score_history_lead ON lead_score_history(lead_id, created_at);

CREATE TABLE tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  UNIQUE (tenant_id, name)
);

CREATE TABLE lead_tags (
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- 04 · Manual & CSV intake
-- ---------------------------------------------------------------------------

CREATE TABLE csv_imports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uploaded_by    UUID REFERENCES users(id),
  filename       TEXT NOT NULL,
  mapping        JSONB NOT NULL DEFAULT '{}'::jsonb,
  status         TEXT NOT NULL DEFAULT 'uploaded' CHECK (
                   status IN ('uploaded','validating','processing','completed','completed_with_errors','failed')
                 ),
  total_rows     INT NOT NULL DEFAULT 0,
  success_count  INT NOT NULL DEFAULT 0,
  error_count    INT NOT NULL DEFAULT 0,
  enrolled_campaign_id UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_csv_imports_tenant ON csv_imports(tenant_id);

CREATE TABLE csv_import_rows (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  csv_import_id  UUID NOT NULL REFERENCES csv_imports(id) ON DELETE CASCADE,
  row_number     INT NOT NULL,
  raw_data       JSONB NOT NULL,
  result         TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','imported','skipped_duplicate','failed')),
  error_reason   TEXT,
  lead_id        UUID REFERENCES leads(id) ON DELETE SET NULL
);
CREATE INDEX idx_csv_rows_import ON csv_import_rows(csv_import_id);

-- ---------------------------------------------------------------------------
-- 05 · Outbound
-- ---------------------------------------------------------------------------

CREATE TABLE campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  template_id     UUID REFERENCES message_templates(id),
  audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  schedule_type   TEXT NOT NULL DEFAULT 'immediate' CHECK (schedule_type IN ('immediate', 'scheduled')),
  scheduled_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','completed','failed')),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);

ALTER TABLE csv_imports ADD CONSTRAINT fk_csv_imports_campaign
  FOREIGN KEY (enrolled_campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE TABLE follow_up_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  trigger_status  TEXT NOT NULL, -- lead status that arms this rule, e.g. 'new'
  delay_minutes   INT NOT NULL,
  action          TEXT NOT NULL DEFAULT 'send_template' CHECK (action IN ('send_template', 'move_dormant', 'notify_owner')),
  template_id     UUID REFERENCES message_templates(id),
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_follow_up_rules_tenant ON follow_up_rules(tenant_id);

CREATE TABLE scheduled_jobs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_type   TEXT NOT NULL CHECK (job_type IN ('campaign_send', 'follow_up_send')),
  payload    JSONB NOT NULL,
  run_at     TIMESTAMPTZ NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','cancelled')),
  attempts   INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scheduled_jobs_due ON scheduled_jobs(status, run_at);
CREATE INDEX idx_scheduled_jobs_tenant ON scheduled_jobs(tenant_id);

-- ---------------------------------------------------------------------------
-- 06 · Notifications
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'lead_qualified' CHECK (type IN ('lead_qualified', 'campaign_failed', 'import_completed')),
  recipient   TEXT NOT NULL,
  subject     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  dedupe_key  TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, dedupe_key)
);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id, created_at);

-- ---------------------------------------------------------------------------
-- 07 · Audit log & support (immutable — no RLS by design; only super_admin/API
-- with service-level access reads across tenants, every such read is logged)
-- ---------------------------------------------------------------------------

CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID, -- nullable: cross-tenant super_admin actions
  actor_user_id UUID,
  action        TEXT NOT NULL,
  entity        TEXT NOT NULL,
  entity_id     UUID,
  reason        TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, created_at);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);

-- Customer-care complaint box (requirement: complaints + support routed to a
-- fixed mailbox regardless of tenant) — intentionally NOT tenant-isolated by
-- RLS since CJK support staff triage across all tenants.
CREATE TABLE support_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  category    TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'complaint', 'bug', 'billing')),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Row-level security — applied identically to every tenant-scoped table.
-- The API sets these once per request, right after acquiring the DB
-- connection: SELECT set_config('app.tenant_id', $1, false);
--                     set_config('app.role', $2, false);
-- super_admin bypasses tenant scoping entirely (policy allows role='super_admin').
-- ============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'waba_accounts','users','contacts','conversations','message_templates','messages',
    'leads','lead_score_history','tags','lead_tags','csv_imports','csv_import_rows',
    'campaigns','follow_up_rules','scheduled_jobs','notifications'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- users/tags/lead_tags reference tenant_id indirectly for some paths; all listed
    -- tables above carry tenant_id directly except lead_tags, handled via a join policy below.
    IF t <> 'lead_tags' THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I USING (
           current_setting(''app.role'', true) = ''super_admin''
           OR tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid
         )', t
      );
    END IF;
  END LOOP;
END $$;

ALTER TABLE lead_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON lead_tags USING (
  current_setting('app.role', true) = 'super_admin'
  OR EXISTS (
    SELECT 1 FROM leads l WHERE l.id = lead_tags.lead_id
      AND l.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
);

-- tenants: every authenticated user may read their own tenant row only.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_self_read ON tenants USING (
  current_setting('app.role', true) = 'super_admin'
  OR id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
);

-- audit_log / support_messages: intentionally no RLS (see comments above).
