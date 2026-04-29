-- ============================================================
-- 20260417100000_task_items_notes.sql
-- ============================================================
-- Add notes column to task_items for longer-form notes beyond the short description.
alter table task_items
  add column if not exists notes text;

-- ============================================================
-- 20260419120000_time_entries_written_off.sql
-- ============================================================
-- Track write-offs on time entries so they can be excluded from future invoicing
-- without losing the original is_billable intent.

alter table time_entries
  add column if not exists written_off_at timestamptz,
  add column if not exists written_off_by uuid references staff_profiles(id);

create index if not exists time_entries_task_unbilled_idx
  on time_entries (task_id)
  where invoice_item_id is null and written_off_at is null;

-- ============================================================
-- 20260420100000_project_site_coords.sql
-- ============================================================
-- Geocoded site coordinates for map display on the Field Schedule
-- Populated at address-selection time via Google Places resolve,
-- and backfilled for existing projects via scripts/backfill-project-coords.mjs

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS site_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS site_lng DOUBLE PRECISION;

-- ============================================================
-- 20260421100000_project_state_postcode.sql
-- ============================================================
-- Add state and postcode to projects for site address details
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS state    text,
  ADD COLUMN IF NOT EXISTS postcode text;

-- ============================================================
-- 20260422000000_project_role_rates.sql
-- ============================================================
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

do $$ begin
  create policy "project_role_rates all access to authenticated"
    on project_role_rates for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- ============================================================
-- 20260422000000_quote_tasks_hierarchy.sql
-- ============================================================
-- Hierarchical quote body: Quote Task → Items Heading → Information Lines
--
-- Template side: a template carries a default structure (no prices).
-- Quote side:    a quote stores the customised structure with prices per task.
--
-- Shape (both columns):
-- [
--   {
--     "title": "Quote Task",
--     "price": 1200,                    // nullable on template
--     "itemsHeadings": [
--       { "heading": "ITEMS HEADING", "lines": ["info 1", "info 2"] }
--     ]
--   }
-- ]

ALTER TABLE public.fee_proposal_templates
  ADD COLUMN IF NOT EXISTS quote_tasks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Site-detail columns on quotes (added to mirror the Projects "Site Details"
-- template used on the Prepare Fee Proposal page).
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS state           text,
  ADD COLUMN IF NOT EXISTS postcode        text,
  ADD COLUMN IF NOT EXISTS section_number  text,
  ADD COLUMN IF NOT EXISTS lga             text,
  ADD COLUMN IF NOT EXISTS parish          text,
  ADD COLUMN IF NOT EXISTS county          text;

-- New hierarchical body on quotes.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS selected_quote_tasks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ============================================================
-- 20260422100000_generic_notes.sql
-- ============================================================
-- Firm-wide "generic notes" shown on every fee proposal.
-- Users tick which ones apply; an "Edit Notes" button adds/removes from the master list.

CREATE TABLE IF NOT EXISTS public.generic_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generic_notes_sort_idx ON public.generic_notes (sort_order);

ALTER TABLE public.generic_notes ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can read and write. (This matches the existing company-wide
-- tables in the project — tighten later if needed.)
DO $$ BEGIN
  CREATE POLICY "authenticated can read generic_notes"
    ON public.generic_notes FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can write generic_notes"
    ON public.generic_notes FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 20260422100000_quote_site_details.sql
-- ============================================================
-- Round out the quote's site details to match what the job form captures,
-- so accepting a quote pre-fills every Site Details field on the new job.
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS state          text,
  ADD COLUMN IF NOT EXISTS postcode       text,
  ADD COLUMN IF NOT EXISTS section_number text,
  ADD COLUMN IF NOT EXISTS lga            text,
  ADD COLUMN IF NOT EXISTS parish         text,
  ADD COLUMN IF NOT EXISTS county         text;

-- ============================================================
-- 20260422200000_drop_client_state_default.sql
-- ============================================================
-- The initial schema defaulted clients.state to 'QLD', which meant the quick
-- New Client modal (and any other insert that skips state) silently stamped 'QLD'
-- onto every new client. Drop the default so blank stays blank.
ALTER TABLE clients ALTER COLUMN state DROP DEFAULT;

-- ============================================================
-- 20260423000000_task_approval_reference.sql
-- ============================================================
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

-- ============================================================
-- 20260423100000_task_quote_link.sql
-- ============================================================
-- Link tasks created from an accepted quote back to that quote, so the
-- Tasks card can show "From Quote Q-5001" approval info alongside the
-- existing email/phone approval fields.
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_quote_id ON project_tasks (quote_id);

-- ============================================================
-- 20260423200000_client_contacts.sql
-- ============================================================
-- Per-client contacts list (distinct from per-project project_contacts).
-- Used to store multiple points of contact for company clients.

CREATE TABLE IF NOT EXISTS client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON client_contacts(client_id);

-- At most one primary contact per client
CREATE UNIQUE INDEX IF NOT EXISTS uniq_client_contacts_primary
  ON client_contacts(client_id) WHERE is_primary = TRUE;

-- Row Level Security (matches the pattern used for clients / project_contacts)
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_read_client_contacts"
    ON client_contacts FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_write_client_contacts"
    ON client_contacts FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 20260424000000_quote_selected_role_keys.sql
-- ============================================================
-- Adds a per-quote selection of which role hourly rates to display
-- on the generated fee proposal. Null = legacy behaviour (show all active).
alter table quotes
  add column if not exists selected_role_keys text[];

