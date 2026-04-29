-- Add state and postcode to projects for site address details
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS state    text,
  ADD COLUMN IF NOT EXISTS postcode text;
