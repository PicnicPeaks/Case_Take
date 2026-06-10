CREATE TABLE IF NOT EXISTS prospects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  firm_name   TEXT,
  interest    TEXT NOT NULL DEFAULT 'general', -- workers_comp | sibtf | both | general
  message     TEXT,
  source      TEXT,                            -- which CTA triggered the form
  status      TEXT NOT NULL DEFAULT 'new',     -- new | contacted | demo_scheduled | converted | declined
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prospects_status     ON prospects (status);
CREATE INDEX idx_prospects_created_at ON prospects (created_at DESC);
