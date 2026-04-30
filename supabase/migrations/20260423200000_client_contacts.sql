-- Per-client contacts list (distinct from per-project project_contacts).
-- Used to store multiple points of contact for company clients.

CREATE TABLE IF NOT EXISTS client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON client_contacts(client_id);

-- At most one primary contact per client
CREATE UNIQUE INDEX IF NOT EXISTS uniq_client_contacts_primary
  ON client_contacts(client_id) WHERE is_primary = TRUE;

-- Row Level Security (matches the pattern used for clients / project_contacts)
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_client_contacts"
  ON client_contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth_write_client_contacts"
  ON client_contacts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
