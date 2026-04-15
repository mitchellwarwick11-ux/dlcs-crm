-- Performance indexes missing from earlier migrations

-- time_entries.task_id — used in timesheet joins
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id
  ON time_entries(task_id);

-- purchase_orders.project_id — used in project invoice pages
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id
  ON purchase_orders(project_id);

-- task_assignments — both FK columns
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id
  ON task_assignments(task_id);

CREATE INDEX IF NOT EXISTS idx_task_assignments_staff_id
  ON task_assignments(staff_id);

-- invoice_items.time_entry_id — used in invoicing joins
CREATE INDEX IF NOT EXISTS idx_invoice_items_time_entry_id
  ON invoice_items(time_entry_id);

-- Trigram index for fast partial-text search on project titles
-- Enables ilike '%query%' on the jobs list to use an index instead of a full table scan
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_projects_title_trgm
  ON projects USING GIN (title gin_trgm_ops);
