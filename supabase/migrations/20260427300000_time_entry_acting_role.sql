-- Acting role on time entries
-- Allows a staff member to log time under a role different to their default
-- Staff role (e.g. a Registered Surveyor working as a Field Assistant for the day).
-- NULL means "use staff_profiles.role" (preserves all existing rows).

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS acting_role TEXT;

ALTER TABLE field_time_logs
  ADD COLUMN IF NOT EXISTS acting_role TEXT;

CREATE INDEX IF NOT EXISTS idx_time_entries_acting_role ON time_entries(acting_role) WHERE acting_role IS NOT NULL;
