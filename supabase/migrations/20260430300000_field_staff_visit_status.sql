-- Per-staff "Save & Exit" / "Did Not Attend" / "Submitted" tracking for a
-- field schedule entry.
--
-- Each surveyor on an entry has one row that records:
--   * saved_at        — when they Saved & Exited (work for this job is finished
--                       for the day, ready to submit at end-of-day)
--   * did_not_attend  — true if they marked the entry as "Couldn't attend"
--   * dna_reason      — free-text reason
--   * submitted_at    — set in Phase 3 when the surveyor submits the day's work
--                       (posts hours and marks the entry completed)

CREATE TABLE IF NOT EXISTS field_staff_visit_status (
  entry_id        UUID        NOT NULL REFERENCES field_schedule_entries(id) ON DELETE CASCADE,
  staff_id        UUID        NOT NULL REFERENCES staff_profiles(id)         ON DELETE CASCADE,
  saved_at        TIMESTAMPTZ,
  did_not_attend  BOOLEAN     NOT NULL DEFAULT false,
  dna_reason      TEXT,
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entry_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_field_staff_visit_status_staff_saved
  ON field_staff_visit_status(staff_id, saved_at);

CREATE INDEX IF NOT EXISTS idx_field_staff_visit_status_staff_submitted
  ON field_staff_visit_status(staff_id, submitted_at);

ALTER TABLE field_staff_visit_status ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'auth_all_field_staff_visit_status'
      AND tablename  = 'field_staff_visit_status'
  ) THEN
    CREATE POLICY "auth_all_field_staff_visit_status"
      ON field_staff_visit_status
      FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;
