-- Per-role flag: should this rate be ticked by default on a new fee proposal?
-- Replaces the hard-coded DEFAULT_CHECKED_ROLE_KEYS list in the form.
-- Re-runnable.

ALTER TABLE role_rates
  ADD COLUMN IF NOT EXISTS default_checked BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill the four roles that were the hard-coded default in the app.
UPDATE role_rates
   SET default_checked = TRUE
 WHERE role_key IN (
   'registered_surveyor',
   'field_surveyor',
   'office_surveyor',
   'drafting'
 );
