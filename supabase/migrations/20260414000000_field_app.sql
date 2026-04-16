-- Field App tables: JSA, job briefs, checklists, photos, time logs

-- JSA / Risk Assessment submissions
CREATE TABLE IF NOT EXISTS jsa_submissions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id              UUID        NOT NULL REFERENCES field_schedule_entries(id) ON DELETE CASCADE,
  staff_id              UUID        NOT NULL REFERENCES staff_profiles(id)         ON DELETE CASCADE,
  specific_swms_required BOOLEAN   NOT NULL DEFAULT false,
  selected_tasks        TEXT[]      NOT NULL DEFAULT '{}',
  additional_hazards    TEXT,
  signature_data        TEXT,       -- base64 PNG data URL from canvas drawing
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entry_id, staff_id)
);

-- PM-authored job briefs (linked to a project, optionally a specific task)
CREATE TABLE IF NOT EXISTS job_briefs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id)        ON DELETE CASCADE,
  task_id     UUID                 REFERENCES project_tasks(id)   ON DELETE SET NULL,
  content     TEXT        NOT NULL,
  created_by  UUID                 REFERENCES staff_profiles(id)  ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reusable equipment/task checklist templates (managed in Settings)
CREATE TABLE IF NOT EXISTS checklist_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT        NOT NULL,
  items      JSONB       NOT NULL DEFAULT '[]',  -- [{id: string, text: string}]
  job_type   TEXT        CHECK (job_type IN ('survey', 'sewer_water', 'internal')),
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Completed checklists per job entry
CREATE TABLE IF NOT EXISTS checklist_submissions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      UUID        NOT NULL REFERENCES field_schedule_entries(id) ON DELETE CASCADE,
  staff_id      UUID        NOT NULL REFERENCES staff_profiles(id)         ON DELETE CASCADE,
  template_id   UUID        NOT NULL REFERENCES checklist_templates(id)    ON DELETE CASCADE,
  checked_items TEXT[]      NOT NULL DEFAULT '{}',
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entry_id, staff_id, template_id)
);

-- Site photos and fieldbook note photos
CREATE TABLE IF NOT EXISTS field_photos (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id              UUID        NOT NULL REFERENCES field_schedule_entries(id) ON DELETE CASCADE,
  project_id            UUID        NOT NULL REFERENCES projects(id)               ON DELETE CASCADE,
  staff_id              UUID        NOT NULL REFERENCES staff_profiles(id)         ON DELETE CASCADE,
  storage_path          TEXT        NOT NULL,
  original_size_bytes   INT,
  compressed_size_bytes INT,
  type                  TEXT        NOT NULL CHECK (type IN ('site_photo', 'fieldbook_note')),
  caption               TEXT,
  uploaded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Field time logs (start/end/breaks per surveyor per entry)
CREATE TABLE IF NOT EXISTS field_time_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id       UUID        NOT NULL REFERENCES field_schedule_entries(id) ON DELETE CASCADE,
  staff_id       UUID        NOT NULL REFERENCES staff_profiles(id)         ON DELETE CASCADE,
  work_date      DATE        NOT NULL,
  start_time     TEXT        NOT NULL,  -- 'HH:MM' 24-hour
  end_time       TEXT        NOT NULL,  -- 'HH:MM' 24-hour
  break_minutes  INT         NOT NULL DEFAULT 0,
  total_hours    NUMERIC(5,2) NOT NULL,
  is_overtime    BOOLEAN     NOT NULL DEFAULT false,
  notes          TEXT,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entry_id, staff_id)
);

-- Row Level Security
ALTER TABLE jsa_submissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_briefs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_photos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_time_logs        ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth_all_jsa_submissions'       AND tablename = 'jsa_submissions')       THEN CREATE POLICY "auth_all_jsa_submissions"       ON jsa_submissions       FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth_all_job_briefs'            AND tablename = 'job_briefs')            THEN CREATE POLICY "auth_all_job_briefs"            ON job_briefs            FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth_all_checklist_templates'   AND tablename = 'checklist_templates')   THEN CREATE POLICY "auth_all_checklist_templates"   ON checklist_templates   FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth_all_checklist_submissions' AND tablename = 'checklist_submissions') THEN CREATE POLICY "auth_all_checklist_submissions" ON checklist_submissions  FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth_all_field_photos'          AND tablename = 'field_photos')          THEN CREATE POLICY "auth_all_field_photos"          ON field_photos          FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth_all_field_time_logs'       AND tablename = 'field_time_logs')       THEN CREATE POLICY "auth_all_field_time_logs"       ON field_time_logs       FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jsa_entry         ON jsa_submissions(entry_id);
CREATE INDEX IF NOT EXISTS idx_jsa_staff         ON jsa_submissions(staff_id);
CREATE INDEX IF NOT EXISTS idx_job_briefs_proj   ON job_briefs(project_id);
CREATE INDEX IF NOT EXISTS idx_job_briefs_task   ON job_briefs(task_id);
CREATE INDEX IF NOT EXISTS idx_field_photos_entry ON field_photos(entry_id);
CREATE INDEX IF NOT EXISTS idx_field_time_entry  ON field_time_logs(entry_id);

-- Storage bucket for field photos and fieldbook notes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'field-photos',
  'field-photos',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can read/write to field-photos bucket
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'field_photos_select' AND tablename = 'objects') THEN
    CREATE POLICY "field_photos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'field-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'field_photos_insert' AND tablename = 'objects') THEN
    CREATE POLICY "field_photos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'field-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'field_photos_delete' AND tablename = 'objects') THEN
    CREATE POLICY "field_photos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'field-photos');
  END IF;
END $$;
