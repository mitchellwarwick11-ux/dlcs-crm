-- Link tasks created from an accepted quote back to that quote, so the
-- Tasks card can show "From Quote Q-5001" approval info alongside the
-- existing email/phone approval fields.
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_quote_id ON project_tasks (quote_id);
