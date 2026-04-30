-- Add approval reference fields to project_tasks for Fixed Fee items.
-- These capture how a fixed-fee quote was approved (often by phone or email,
-- outside a formal written quote) so the agreement has a traceable reference.

alter table project_tasks
  add column if not exists approval_prepared_by uuid references staff_profiles(id) on delete set null,
  add column if not exists approval_approved_by text,
  add column if not exists approval_method text check (approval_method in ('email', 'phone')),
  add column if not exists approval_date date;

create index if not exists idx_project_tasks_approval_prepared_by
  on project_tasks (approval_prepared_by);
