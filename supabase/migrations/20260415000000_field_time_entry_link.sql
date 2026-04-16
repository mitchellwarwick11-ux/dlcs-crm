-- Link field_time_logs back to the time_entries record it created
-- so re-submitting updates rather than duplicates
ALTER TABLE field_time_logs
  ADD COLUMN IF NOT EXISTS time_entry_id UUID REFERENCES time_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_field_time_logs_time_entry ON field_time_logs(time_entry_id);
