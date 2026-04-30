-- Link checklist templates to a specific task type (task_definitions),
-- replacing the coarse job_type-based matching.
--
-- Strategy:
--   * Drop existing checklist_templates rows (they'll be re-created via the
--     new Settings UI with task type assignments).
--   * Add task_definition_id column referencing task_definitions.
--   * Keep job_type column for now in case it's referenced elsewhere; new
--     code matches strictly by task_definition_id.

-- 1. Wipe existing templates and any submissions that reference them.
DELETE FROM checklist_submissions;
DELETE FROM checklist_templates;

-- 2. Add task_definition_id column.
ALTER TABLE checklist_templates
  ADD COLUMN IF NOT EXISTS task_definition_id UUID
  REFERENCES task_definitions(id) ON DELETE CASCADE;

-- 3. Each task type can have at most one checklist template (Option A:
--    one checklist per task).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_checklist_templates_task_definition
  ON checklist_templates(task_definition_id)
  WHERE task_definition_id IS NOT NULL;

-- 4. Index for the field-app lookup.
CREATE INDEX IF NOT EXISTS idx_checklist_templates_task_definition
  ON checklist_templates(task_definition_id)
  WHERE is_active = true;
