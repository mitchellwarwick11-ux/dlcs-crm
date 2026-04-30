-- Role-based project rate overrides.
-- Replaces the per-staff overrides on a job's Details tab: one rate per role,
-- applied to every staff member with that role when logging time to the job.

create table if not exists project_role_rates (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  role_key    text not null,
  hourly_rate numeric(10,2) not null check (hourly_rate >= 0),
  created_at  timestamptz not null default now(),
  unique (project_id, role_key)
);

create index if not exists project_role_rates_project_idx on project_role_rates(project_id);

-- RLS: same posture as project_staff_rates — anyone authenticated can read/write.
alter table project_role_rates enable row level security;

create policy "project_role_rates all access to authenticated"
  on project_role_rates for all to authenticated using (true) with check (true);
