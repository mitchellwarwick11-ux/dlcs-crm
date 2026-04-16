-- Create fee_proposal_templates table
CREATE TABLE IF NOT EXISTS fee_proposal_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label            TEXT NOT NULL,
  scope_items      JSONB NOT NULL DEFAULT '[]'::jsonb,
  please_note_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  valid_until_days INT NOT NULL DEFAULT 60,
  sort_order       INT NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fee_proposal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage fee_proposal_templates"
  ON fee_proposal_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed with the existing Contour & Detail Survey template
INSERT INTO fee_proposal_templates (label, scope_items, please_note_items, valid_until_days, sort_order)
VALUES (
  'Contour & Detail Survey',
  '[
    "Site boundaries shown (dimensions and approximate positions).",
    "All levels and contours shown relative to AHD.",
    "Place benchmark on site.",
    "Location of any existing easements affecting the site.",
    "Location of all buildings on site including Building Finished Floor Levels (FFL).",
    "Location of existing fencing, retaining walls and steps.",
    "Location of trees on site — including canopy spreads, trunk diameters and heights.",
    "Roof heights of subject lot (ridge and gutters).",
    "Levels of neighbouring building roofs within close proximity of site boundary (where accessible).",
    "Neighbouring walls, window sill and head heights facing the subject site (where accessible).",
    "Neighbouring building frontages (within 40m where accessible).",
    "Spot levels across the site, along all boundaries and kerb and gutter.",
    "Location of visible above ground services including sewer manholes and sewer inspection pits, etc.",
    "Drainage pits and inverts (if accessible).",
    "DBYD overlay of existing services."
  ]'::jsonb,
  '[
    "Any additional work requested will be undertaken at the below Standard Hourly Rates.",
    "No allowance has been made for boundary marking.",
    "The above fee does not include council/certifier or LRS fees."
  ]'::jsonb,
  60,
  0
);

-- Add selected_note_items to quotes so each quote stores its own notes snapshot
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS selected_note_items JSONB DEFAULT '[]'::jsonb;
