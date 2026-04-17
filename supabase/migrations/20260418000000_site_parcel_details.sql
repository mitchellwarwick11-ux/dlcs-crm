-- Add parcel / cadastral identifiers to projects
-- Section Number completes the lot/section/plan triple (NSW style)
-- LGA / Parish / County are cadastral administrative units

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS section_number TEXT,
  ADD COLUMN IF NOT EXISTS lga            TEXT,
  ADD COLUMN IF NOT EXISTS parish         TEXT,
  ADD COLUMN IF NOT EXISTS county         TEXT;
