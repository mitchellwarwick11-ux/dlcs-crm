ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS job_manager_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_job_manager_id ON projects(job_manager_id);
