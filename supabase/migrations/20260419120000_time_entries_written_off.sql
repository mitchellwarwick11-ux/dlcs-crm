-- Track write-offs on time entries so they can be excluded from future invoicing
-- without losing the original is_billable intent.

alter table time_entries
  add column if not exists written_off_at timestamptz,
  add column if not exists written_off_by uuid references staff_profiles(id);

create index if not exists time_entries_task_unbilled_idx
  on time_entries (task_id)
  where invoice_item_id is null and written_off_at is null;
