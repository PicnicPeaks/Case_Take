-- Firms table — one row per law firm tenant
CREATE TABLE IF NOT EXISTS firms (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT        UNIQUE NOT NULL,
  name             TEXT        NOT NULL,
  tagline          TEXT        DEFAULT 'California Workers'' Compensation',
  logo_url         TEXT,
  primary_color    TEXT        DEFAULT '#1a2e4a',
  intake_emails    TEXT[]      DEFAULT '{}',
  from_email       TEXT,
  from_name        TEXT,
  fluent_case_api_key TEXT,
  settings_token   UUID        DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_firms_slug ON firms(slug);

-- Track which firm each intake belongs to
ALTER TABLE intakes ADD COLUMN IF NOT EXISTS firm_slug TEXT;
CREATE INDEX IF NOT EXISTS idx_intakes_firm_slug ON intakes(firm_slug);
