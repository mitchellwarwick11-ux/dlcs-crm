-- Adds an `is_test_user` flag on staff_profiles so the in-app Test Users page
-- can list and manage testers separately from real staff.
ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN NOT NULL DEFAULT FALSE;
