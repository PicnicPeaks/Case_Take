-- Add case workflow columns to intakes table
ALTER TABLE intakes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fluent_case_id INTEGER;

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_intakes_status ON intakes(status);
