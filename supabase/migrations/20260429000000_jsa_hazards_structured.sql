-- Replace free-text additional_hazards with a structured JSONB array of rows
-- (procedure, hazard, risk {c,p}, control_measures, residual {c,p}, person_responsible).
ALTER TABLE jsa_submissions
  DROP COLUMN IF EXISTS additional_hazards;

ALTER TABLE jsa_submissions
  ADD COLUMN additional_hazards JSONB NOT NULL DEFAULT '[]'::jsonb;
