-- Add fee-proposal-specific columns to quotes table
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS template_key TEXT,
  ADD COLUMN IF NOT EXISTS selected_scope_items JSONB DEFAULT '[]'::jsonb;
