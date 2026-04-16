-- Invoice number sequences + RPC (mirrors quote_number_sequences pattern)
CREATE TABLE IF NOT EXISTS invoice_number_sequences (
  id INT PRIMARY KEY DEFAULT 1,
  last_sequence INT NOT NULL DEFAULT 1000
);

INSERT INTO invoice_number_sequences (id, last_sequence)
VALUES (1, 1000)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_sequence INT;
BEGIN
  UPDATE invoice_number_sequences
  SET last_sequence = last_sequence + 1
  WHERE id = 1
  RETURNING last_sequence INTO next_sequence;

  RETURN 'INV-' || next_sequence;
END;
$$ LANGUAGE plpgsql;
