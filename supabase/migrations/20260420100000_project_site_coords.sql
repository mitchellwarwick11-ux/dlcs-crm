-- Geocoded site coordinates for map display on the Field Schedule
-- Populated at address-selection time via Google Places resolve,
-- and backfilled for existing projects via scripts/backfill-project-coords.mjs

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS site_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS site_lng DOUBLE PRECISION;
