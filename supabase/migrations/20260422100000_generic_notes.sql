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
