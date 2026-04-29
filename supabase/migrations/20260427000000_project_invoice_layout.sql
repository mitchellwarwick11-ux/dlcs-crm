-- Per-project invoice layout choice. Read at render time by both the HTML print
-- page and the PDF route.
--   invoice_layout = 'role_grouped' (default): group hourly entries by role with
--                                              one rate/amount line per role.
--   invoice_layout = 'per_line':               show every entry as its own row
--                                              with its own rate/amount.
--   invoice_show_entry_details: only meaningful when layout = 'role_grouped' —
--   when true, list individual entry rows (date, description, hours) under each
--   role group with no per-row rate/amount.
alter table projects
  add column if not exists invoice_layout text not null default 'role_grouped',
  add column if not exists invoice_show_entry_details boolean not null default false;

alter table projects
  add constraint projects_invoice_layout_check
    check (invoice_layout in ('role_grouped', 'per_line'));
