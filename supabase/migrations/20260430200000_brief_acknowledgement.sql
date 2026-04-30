-- Track brief acknowledgement on field schedule entries.
-- One acknowledgement covers the entry (any surveyor can ack — covers both).
-- The brief content itself reuses the existing `notes` column.
ALTER TABLE field_schedule_entries
  ADD COLUMN IF NOT EXISTS brief_acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS brief_acknowledged_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL;
