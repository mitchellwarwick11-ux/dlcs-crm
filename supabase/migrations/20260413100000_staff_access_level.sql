-- Add access_level to staff_profiles for role-based access control.
-- Levels: 'staff' (default), 'project_manager', 'admin'

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'staff'
    CHECK (access_level IN ('staff', 'project_manager', 'admin'));
