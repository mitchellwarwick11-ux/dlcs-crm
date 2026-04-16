-- Purchase Orders (POs issued by clients authorising work on a job)

CREATE TABLE IF NOT EXISTS purchase_orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  po_number    TEXT NOT NULL,
  issued_by    TEXT,
  issued_date  DATE,
  amount       NUMERIC(10,2),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON purchase_orders
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
