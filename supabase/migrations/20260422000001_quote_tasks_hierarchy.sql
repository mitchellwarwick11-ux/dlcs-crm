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
