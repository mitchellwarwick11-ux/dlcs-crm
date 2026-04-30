ALTER TABLE time_entries
  ADD COLUMN is_variation boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN time_entries.is_variation IS
  'When true, this time entry is variation-to-fixed-fee work — out-of-scope hours on a fixed-fee task that should be billed hourly. The entry stays linked to its real task_id; the flag carries through to the invoice form so the matching invoice item is also flagged is_variation.';
