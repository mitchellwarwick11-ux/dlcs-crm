-- Cost items (disbursements) recorded against a job.
-- GST defaults to false — most pass-through costs are GST-free (govt fees etc.)
CREATE TABLE IF NOT EXISTS project_costs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description      TEXT NOT NULL,
  amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
  has_gst          BOOLEAN NOT NULL DEFAULT false,
  date             DATE,
  invoice_item_id  UUID REFERENCES invoice_items(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE project_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_project_costs"
  ON project_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Per-line GST flag on invoice items (existing rows default to true — services always attract GST)
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS has_gst BOOLEAN NOT NULL DEFAULT true;
