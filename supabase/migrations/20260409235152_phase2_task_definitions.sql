-- ============================================================
-- PHASE 2: TASK DEFINITIONS + SCHEMA UPDATES
-- ============================================================

-- 1. Simplify job_type: replace many-value enum with just two types
ALTER TABLE projects DROP COLUMN job_type;
DROP TYPE job_type;
CREATE TYPE job_type AS ENUM ('survey', 'sewer_water');
ALTER TABLE projects ADD COLUMN job_type job_type NOT NULL DEFAULT 'survey';

-- 2. Task definitions — master list of reusable task types
CREATE TABLE task_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  applicable_job_type job_type,  -- NULL means applies to both job types
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE task_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_task_definitions" ON task_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_task_definitions" ON task_definitions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Seed predefined task definitions
INSERT INTO task_definitions (name, applicable_job_type, sort_order) VALUES
  ('Contour & Detail Survey',  'survey',     10),
  ('Identification Survey',    'survey',     20),
  ('Set-out Survey',           'survey',     30),
  ('As-Built Survey',          'survey',     40),
  ('Draft DP',                 'survey',     50),
  ('Final DP',                 'survey',     60),
  ('Cadastral Survey',         'survey',     70),
  ('Feature Survey',           'survey',     80),
  ('Consulting',               NULL,         90),
  ('Sewer & Water Design',     'sewer_water',100),
  ('Council Submission',       'sewer_water',110),
  ('As-Constructed',           'sewer_water',120);

-- 4. Update project_tasks to link to task definitions
ALTER TABLE project_tasks ADD COLUMN task_definition_id UUID REFERENCES task_definitions(id) ON DELETE SET NULL;

-- 5. Add task linkage to time_entries
ALTER TABLE time_entries ADD COLUMN task_id UUID REFERENCES project_tasks(id) ON DELETE SET NULL;

-- 6. Add task linkage to quote_items
ALTER TABLE quote_items ADD COLUMN task_id UUID REFERENCES project_tasks(id) ON DELETE SET NULL;
