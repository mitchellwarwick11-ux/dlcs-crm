ALTER TABLE invoice_items
  ADD COLUMN is_variation boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN invoice_items.is_variation IS
  'When true, this hourly-style item bills work that was outside the scope of the fixed-fee task referenced by task_id. Rendered below that fixed-fee section on the invoice.';
