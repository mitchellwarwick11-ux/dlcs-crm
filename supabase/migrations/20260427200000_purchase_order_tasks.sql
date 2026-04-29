-- Many-to-many link between purchase orders and the tasks they authorise.
-- A PO with no rows here remains a project-level PO.

CREATE TABLE IF NOT EXISTS purchase_order_tasks (
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  task_id           UUID NOT NULL REFERENCES project_tasks(id)   ON DELETE CASCADE,
  PRIMARY KEY (purchase_order_id, task_id)
);

ALTER TABLE purchase_order_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON purchase_order_tasks
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pot_task ON purchase_order_tasks(task_id);
