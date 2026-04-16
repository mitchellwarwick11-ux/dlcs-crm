-- Add field_surveyor to the existing user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'field_surveyor';

-- Change staff_profiles.role from enum to TEXT so roles are fully managed by the app
ALTER TABLE staff_profiles ALTER COLUMN role TYPE TEXT;

-- Role rates table — managed from the Settings page
CREATE TABLE IF NOT EXISTS role_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key    TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with initial roles and rates
INSERT INTO role_rates (role_key, label, hourly_rate, sort_order) VALUES
  ('registered_surveyor',  'Registered Surveyor',    220.00, 1),
  ('field_surveyor',       'Field Surveyor',          190.00, 2),
  ('office_surveyor',      'Office Surveyor',         160.00, 3),
  ('sewer_water_designer', 'Sewer & Water Designer',  160.00, 4),
  ('drafting',             'Drafter',                 130.00, 5),
  ('administration',       'Administration',           80.00, 6)
ON CONFLICT (role_key) DO NOTHING;

-- Auto-update updated_at
CREATE TRIGGER update_role_rates_updated_at
  BEFORE UPDATE ON role_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE role_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read role_rates"
  ON role_rates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users can manage role_rates"
  ON role_rates FOR ALL TO authenticated USING (true);
