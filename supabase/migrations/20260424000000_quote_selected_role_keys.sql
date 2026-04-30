-- Adds a per-quote selection of which role hourly rates to display
-- on the generated fee proposal. Null = legacy behaviour (show all active).
alter table quotes
  add column if not exists selected_role_keys text[];
