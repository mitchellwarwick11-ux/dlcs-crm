-- Field Schedule feature
-- Creates schedule_equipment, field_schedule_entries, and two junction tables

CREATE TYPE field_schedule_status AS ENUM (
  'must_happen',
  'asap',
  'scheduled',
  'completed',
  'cancelled'
);

-- Equipment/resource reference list (managed via Settings)
CREATE TABLE IF NOT EXISTS schedule_equipment (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label      TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Main booking table
CREATE TABLE IF NOT EXISTS field_schedule_entries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date               DATE NOT NULL,
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id            UUID REFERENCES project_tasks(id) ON DELETE SET NULL,
  office_surveyor_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  hours              NUMERIC(5,2),
  status             field_schedule_status NOT NULL DEFAULT 'scheduled',
  notes              TEXT,
  created_by         UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Junction: entry <-> field surveyors (multiple per entry)
CREATE TABLE IF NOT EXISTS field_schedule_surveyors (
  entry_id UUID NOT NULL REFERENCES field_schedule_entries(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, staff_id)
);

-- Junction: entry <-> equipment (multiple per entry)
CREATE TABLE IF NOT EXISTS field_schedule_resources (
  entry_id     UUID NOT NULL REFERENCES field_schedule_entries(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES schedule_equipment(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, equipment_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fse_date    ON field_schedule_entries(date);
CREATE INDEX IF NOT EXISTS idx_fse_project ON field_schedule_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_fss_staff   ON field_schedule_surveyors(staff_id);

-- Row Level Security
ALTER TABLE schedule_equipment       ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_schedule_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_schedule_surveyors ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_schedule_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_schedule_equipment"
  ON schedule_equipment FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_field_schedule_entries"
  ON field_schedule_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_field_schedule_surveyors"
  ON field_schedule_surveyors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_field_schedule_resources"
  ON field_schedule_resources FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default equipment
INSERT INTO schedule_equipment (label, sort_order) VALUES
  ('GPS',          1),
  ('Drone',        2),
  ('Scanner',      3),
  ('Total Station',4),
  ('Level',        5)
ON CONFLICT (label) DO NOTHING;
