-- Items: smaller units of work within a Task
-- Invoicing stays at Task level; items are for PM planning/tracking.

CREATE TABLE task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE task_item_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES task_items(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, staff_id)
);

-- RLS (match existing permissive policies on project_tasks / task_assignments)
ALTER TABLE task_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_item_assignments  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_task_items"
  ON task_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_task_item_assignments"
  ON task_item_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at trigger (reuses existing function)
CREATE TRIGGER update_task_items_updated_at
  BEFORE UPDATE ON task_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_task_items_task_id              ON task_items(task_id);
CREATE INDEX idx_task_item_assignments_staff_id  ON task_item_assignments(staff_id);
CREATE INDEX idx_task_item_assignments_item_id   ON task_item_assignments(item_id);
