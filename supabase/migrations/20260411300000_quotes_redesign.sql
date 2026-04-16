-- ============================================================
-- QUOTES REDESIGN
-- Makes quotes a first-class entity (not tied to a job)
-- Adds new statuses: issued, accepted, cancelled
-- Adds quote number sequence (Q-5001, Q-5002, ...)
-- ============================================================

-- 1. Make project_id nullable (quotes can exist before a job is created)
ALTER TABLE quotes ALTER COLUMN project_id DROP NOT NULL;

-- 2. Add new columns to quotes table
ALTER TABLE quotes
  ADD COLUMN client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN contact_name  TEXT,
  ADD COLUMN contact_phone TEXT,
  ADD COLUMN contact_email TEXT,
  ADD COLUMN site_address  TEXT,
  ADD COLUMN suburb        TEXT,
  ADD COLUMN lot_number    TEXT,
  ADD COLUMN plan_number   TEXT,
  ADD COLUMN job_type      TEXT;

-- 3. Add new enum values (old values remain in enum but are retired from use)
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'issued';
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 4. Quote number sequence table (single global counter starting at 5000)
CREATE TABLE IF NOT EXISTS quote_number_sequences (
  id            INT PRIMARY KEY DEFAULT 1,
  last_sequence INT NOT NULL DEFAULT 5000,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO quote_number_sequences (id, last_sequence)
VALUES (1, 5000)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE quote_number_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can manage quote_number_sequences"
  ON quote_number_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Generate quote number function (returns Q-5001, Q-5002, ...)
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TEXT AS $$
DECLARE
  next_sequence INT;
BEGIN
  UPDATE quote_number_sequences
  SET last_sequence = last_sequence + 1
  WHERE id = 1
  RETURNING last_sequence INTO next_sequence;

  RETURN 'Q-' || next_sequence;
END;
$$ LANGUAGE plpgsql;
