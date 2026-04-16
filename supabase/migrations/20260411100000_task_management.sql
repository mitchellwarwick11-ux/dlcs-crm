-- 1. Add financial fields to project_tasks
ALTER TABLE project_tasks
  ADD COLUMN fee_type TEXT NOT NULL DEFAULT 'hourly',
  ADD COLUMN quoted_amount NUMERIC(10,2);

-- 2. Change status from enum to TEXT (allows new status values)
ALTER TABLE project_tasks ALTER COLUMN status TYPE TEXT;

-- 3. Migrate existing status values to new naming
UPDATE project_tasks SET status = 'not_started' WHERE status = 'todo';
UPDATE project_tasks SET status = 'completed'   WHERE status = 'done';
UPDATE project_tasks SET status = 'on_hold'     WHERE status = 'blocked';
-- 'in_progress' stays as-is

-- 4. Drop single-person assignment (replaced by task_assignments below)
ALTER TABLE project_tasks DROP COLUMN IF EXISTS assigned_to;

-- 5. New task_assignments table (many staff per task)
CREATE TABLE task_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  estimated_hours NUMERIC(6,2),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, staff_id)
);

ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can manage task_assignments"
  ON task_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
