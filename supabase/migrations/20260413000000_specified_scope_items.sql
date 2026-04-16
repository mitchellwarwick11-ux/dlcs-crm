-- Add specified_scope_items to quotes for free-form "Specified Inclusions"
-- that are outside the standard template scope items.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS specified_scope_items text[] NOT NULL DEFAULT '{}';
