-- Round out the quote's site details to match what the job form captures,
-- so accepting a quote pre-fills every Site Details field on the new job.
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS state          text,
  ADD COLUMN IF NOT EXISTS postcode       text,
  ADD COLUMN IF NOT EXISTS section_number text,
  ADD COLUMN IF NOT EXISTS lga            text,
  ADD COLUMN IF NOT EXISTS parish         text,
  ADD COLUMN IF NOT EXISTS county         text;
